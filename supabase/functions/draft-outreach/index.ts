// Gemini-powered account research and outreach drafting for a single lead.
//
// Two actions, both real calls to the Gemini API with the key held server-side:
//
//   kind: 'research' → an account brief built from the lead's own scraped fields
//   kind: 'outreach' → a short message written from that brief
//
// Nothing is sent. The product has no connected mailbox, and outreach should be
// approved by a person regardless, so the output is a draft the user reviews and
// copies. See LEADGENAI_EVENT_READINESS.md for the integration status.
//
// The prompts forbid inventing facts about the business. Everything the model is
// given comes from the scrape, and anything it infers must be marked as an
// inference — a lead brief that reads confidently about things nobody verified
// is worse than a short one.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json, logEvent, fetchWithTimeout, MODELS } from '../_shared/pipeline.ts'

type Lead = Record<string, unknown>

// Only the fields that came off the scrape. Passing the whole row would hand the
// model the customer's private notes and internal status.
function leadFacts(l: Lead) {
  return {
    business_name: l.name,
    industry: l.industry,
    city: l.city,
    website: l.website || null,
    email: l.email || null,
    phone: l.phone || null,
    address: l.address || null,
    google_rating: l.rating ?? null,
    google_review_count: l.review_count ?? null,
    ai_score: l.score ?? null,
    ai_summary: l.summary || null,
  }
}

const RESEARCH_PROMPT = (facts: unknown) => `You are a B2B sales researcher preparing a short account brief.

STRICT RULES:
- Use ONLY the data provided below. Do not invent facts, people, funding, headcount, tech stack or news.
- If you infer something, mark it clearly as an inference ("likely", "suggests", "may").
- Never invent a contact person's name or job title. None are known.
- If the data is thin, say so plainly and keep the brief short.

Data: ${JSON.stringify(facts)}

Return JSON only: {"body": "..."} where body is plain text with:
- 3 short bullet points (start each line with "• ") covering what the business appears to be, its apparent scale or presence, and its contactability
- then a final line starting with "Why they may fit: " giving one concrete reason based on the data.
No markdown headings, no preamble.`

const OUTREACH_PROMPT = (facts: unknown, sender: string, research: string) => `Write one short cold outreach email to this business.

STRICT RULES:
- 90 words maximum in the body.
- Reference at least one concrete detail from the data (their city, industry, rating, or web presence).
- Do NOT invent facts about them, do NOT claim you used their product, do NOT name a contact person.
- ${sender ? `The sender's business is described as: "${sender}". Do not embellish beyond this.` : 'The sender\'s business is NOT specified, so keep the offer generic and do not invent what the sender sells.'}
- Plain, direct, no hype, no "I hope this email finds you well".
- End with a low-friction question.

Business data: ${JSON.stringify(facts)}
${research ? `\nResearch notes already gathered:\n${research}` : ''}

Return JSON only: {"subject": "...", "body": "..."}`

// Walks the primary model then the fallback. Returns which one answered, so the
// stored draft records the model that actually produced it.
async function callGemini(prompt: string, key: string): Promise<{ parsed: Record<string, unknown>; model: string }> {
  let lastErr = 'Gemini did not return a usable response.'

  for (const model of MODELS) {
    try {
      const res = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.7 },
          }),
        },
        20_000,
      )

      if (!res.ok) {
        lastErr = `Gemini ${model} returned HTTP ${res.status}`
        console.error(lastErr, (await res.text()).slice(0, 200))
        continue
      }

      const body = await res.json()
      const text = body.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const parsed = JSON.parse(text)
      if (parsed && typeof parsed.body === 'string' && parsed.body.trim()) {
        return { parsed, model }
      }
      lastErr = `Gemini ${model} returned an unusable shape`
    } catch (e) {
      lastErr = `Gemini ${model} failed: ${(e as Error).message}`
      console.error(lastErr)
    }
  }

  throw new Error(lastErr)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const geminiKey = Deno.env.get('GEMINI_API_KEY') || ''
  const db = createClient(supabaseUrl, serviceKey)

  try {
    if (!geminiKey) {
      return json({ error: 'not_configured', message: 'AI drafting is not configured.' }, 503)
    }

    const body = await req.json()
    const kind = body.kind === 'outreach' ? 'outreach' : 'research'
    const leadId = body.lead_id as string
    if (!leadId) return json({ error: 'lead_id required' }, 400)

    // The caller's JWT decides which leads they may act on. The service-role
    // client below bypasses RLS, so ownership is checked explicitly.
    const authHeader = req.headers.get('Authorization') || ''
    const { data: { user } } = await db.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user?.id) return json({ error: 'Not authenticated' }, 401)

    const { data: lead, error: leadErr } = await db
      .from('leads').select('*').eq('id', leadId).eq('user_id', user.id).single()

    if (leadErr || !lead) return json({ error: 'not_found', message: 'Lead not found.' }, 404)

    const facts = leadFacts(lead)
    let prompt: string

    if (kind === 'research') {
      prompt = RESEARCH_PROMPT(facts)
    } else {
      // Feed the most recent research in, so the message builds on the brief the
      // user just read rather than starting from nothing.
      const { data: prior } = await db
        .from('lead_drafts').select('body')
        .eq('lead_id', leadId).eq('kind', 'research')
        .order('created_at', { ascending: false }).limit(1)

      const senderBusiness = typeof body.sender_business === 'string'
        ? body.sender_business.slice(0, 300).trim()
        : ''
      prompt = OUTREACH_PROMPT(facts, senderBusiness, prior?.[0]?.body || '')
    }

    const { parsed, model } = await callGemini(prompt, geminiKey)

    const draft = {
      lead_id: leadId,
      user_id: user.id,
      kind,
      subject: typeof parsed.subject === 'string' ? parsed.subject.slice(0, 300) : null,
      body: String(parsed.body).slice(0, 8000),
      model,
    }

    const { data: saved, error: saveErr } = await db
      .from('lead_drafts').insert(draft).select('id, created_at').single()

    if (saveErr) {
      // The generation succeeded; failing the request because the archive write
      // failed would waste a real API call the user is waiting on.
      console.error('draft save failed', saveErr.message)
    }

    await logEvent(db, {
      source: 'draft-outreach', stage: kind,
      message: `Generated ${kind} for lead ${leadId} with ${model}`,
      user_id: user.id,
    })

    return json({
      success: true,
      kind,
      model,
      subject: draft.subject,
      body: draft.body,
      id: saved?.id ?? null,
      created_at: saved?.created_at ?? new Date().toISOString(),
    })

  } catch (err) {
    console.error('draft-outreach error:', err)
    return json({
      error: 'ai_unavailable',
      message: 'The AI could not produce a draft just now. Please try again in a moment.',
      detail: (err as Error).message,
    }, 503)
  }
})

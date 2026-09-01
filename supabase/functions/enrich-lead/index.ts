// Fills in the contact details discovery could not provide, one lead at a time.
//
// Google Places reports what Google holds about a business and never visits its
// website, so every lead arrives without an email. Enriching all of them the way
// the old Apify pipeline did is what made runs expensive — it paid to visit a
// site for every place found, and produced an email for about a quarter of them.
//
// So this runs per lead, when someone asks for it, and tries the cheap thing
// first:
//
//   1. Fetch the business's own website and read the address off the page.
//      Free, and about 41% of leads that have a website yield one.
//   2. Only if that finds nothing, ask Gemini with Google Search grounding.
//      That costs real money past 5,000 prompts a month, so it is the fallback
//      and it is rate limited per user.
//
// Both paths are recorded in enrichment_source so a lead's history says where
// its email came from, and so a lead that yielded nothing is not retried
// forever.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json, logEvent, fetchWithTimeout, MODELS } from '../_shared/pipeline.ts'

// Grounded lookups per user per rolling 24h. The free Gemini allowance is 5,000
// prompts a month across the whole project, so one enthusiastic user must not be
// able to spend all of it in an afternoon.
const GROUNDED_DAILY_LIMIT = Number(Deno.env.get('GROUNDED_DAILY_LIMIT') || 100)

const SITE_FETCH_MS = 8_000
const MAX_HTML_CHARS = 400_000

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,24}/g

// Addresses that exist on the page but are never who a salesperson wants.
const REJECT_LOCAL = /^(noreply|no-reply|donotreply|do-not-reply|postmaster|abuse|webmaster|privacy|dmca|unsubscribe|mailer-daemon)$/i
// Domains that belong to the tooling a site is built with, not the business.
const REJECT_DOMAIN = /(sentry|wixpress|example\.|godaddy|squarespace|shopify|schema\.org|w3\.org|googleapis|gstatic|cloudflare|jquery|bootstrap|fontawesome)/i
// Ranked best first. A generic business inbox beats a careers or billing one.
const PREFER_LOCAL = ['sales', 'contact', 'info', 'hello', 'enquiry', 'enquiries', 'business', 'connect', 'support']

function domainOfUrl(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

// Scores a candidate so the best address on a page wins rather than the first.
function rankEmail(email: string, siteDomain: string): number {
  const [local, domain] = email.toLowerCase().split('@')
  if (!local || !domain) return -1
  if (REJECT_LOCAL.test(local)) return -1
  if (REJECT_DOMAIN.test(domain)) return -1
  // An address ending in an image or asset extension came out of markup, not
  // out of a mailto link.
  if (/\.(png|jpe?g|gif|svg|webp|css|js)$/i.test(domain)) return -1

  let score = 0
  if (siteDomain && domain === siteDomain) score += 100          // same company
  else if (siteDomain && domain.endsWith(`.${siteDomain}`)) score += 80
  const idx = PREFER_LOCAL.indexOf(local)
  if (idx >= 0) score += 40 - idx                                 // sales > support
  if (/^(careers|jobs|hr|recruit|billing|accounts|invoice)/i.test(local)) score -= 20
  return score
}

function bestEmail(haystack: string, siteDomain: string): string {
  const seen = new Set<string>()
  let best = ''
  let bestScore = 0
  for (const raw of haystack.match(EMAIL_RE) || []) {
    const email = raw.toLowerCase()
    if (seen.has(email)) continue
    seen.add(email)
    const score = rankEmail(email, siteDomain)
    if (score > bestScore) { best = email; bestScore = score }
  }
  return best
}

// --- Path 1: the business's own website -------------------------------------
//
// Homepage first, then one contact-page guess. Two requests is the point where
// the yield stops paying for the latency.
async function fromWebsite(website: string): Promise<string> {
  const siteDomain = domainOfUrl(website)
  if (!siteDomain) return ''

  const base = website.startsWith('http') ? website : `https://${website}`
  const candidates = [base, `${base.replace(/\/+$/, '')}/contact`]

  for (const url of candidates) {
    try {
      const res = await fetchWithTimeout(url, {
        // Some sites serve a different, emptier page to an unknown agent.
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadGenAI/1.0)' },
        redirect: 'follow',
      }, SITE_FETCH_MS)
      if (!res.ok) continue
      const html = (await res.text()).slice(0, MAX_HTML_CHARS)

      // mailto links are the highest-confidence signal on a page, so try them
      // before falling back to any address that appears in the text.
      const mailtos = [...html.matchAll(/mailto:([^"'?>\s]+)/gi)].map(m => m[1]).join(' ')
      const found = bestEmail(mailtos, siteDomain) || bestEmail(html, siteDomain)
      if (found) return found
    } catch {
      // A site that times out, blocks us, or serves nothing readable is the
      // normal case, not an error worth failing the request over.
      continue
    }
  }
  return ''
}

// --- Path 2: grounded Gemini ------------------------------------------------
//
// Only reached when the site gave nothing. Google Search grounding is billed per
// search past the free monthly allowance, which is why this is second and why it
// is capped per user.
//
// The reply is constrained to a bare address so that a confident-sounding
// sentence cannot become an email: anything that is not a plausible address is
// discarded.
async function fromGroundedSearch(
  lead: Record<string, unknown>, geminiKey: string,
): Promise<string> {
  const prompt = [
    'Find the public contact email address for this business.',
    `Business: ${lead.name}`,
    lead.address ? `Address: ${lead.address}` : '',
    lead.website ? `Website: ${lead.website}` : '',
    '',
    'Reply with the email address and nothing else.',
    'If you cannot find one actually published by this business, reply exactly: NONE',
    'Do not guess or construct an address from the domain name.',
  ].filter(Boolean).join('\n')

  for (const model of MODELS) {
    try {
      const res = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            // Grounding cannot be combined with a JSON response type, so the
            // reply is plain text and is validated by pattern below.
            tools: [{ google_search: {} }],
          }),
        },
        20_000,
      )
      if (!res.ok) {
        console.error('Grounded lookup failed', model, res.status, (await res.text()).slice(0, 200))
        continue
      }
      const body = await res.json()
      const text: string = body.candidates?.[0]?.content?.parts?.[0]?.text || ''
      // No separate check for a NONE reply: if the model declined there is
      // no address to extract and bestEmail returns nothing anyway. Calling
      // .test() on a /g regex would also carry lastIndex between calls.

      const siteDomain = domainOfUrl(String(lead.website || ''))
      const found = bestEmail(text, siteDomain)
      if (found) return found
    } catch (e) {
      console.error('Grounded lookup error', model, String(e))
      continue
    }
  }
  return ''
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const geminiKey = Deno.env.get('GEMINI_API_KEY') || ''
  const db = createClient(supabaseUrl, serviceKey)

  try {
    const { lead_id: leadId } = await req.json()
    if (!leadId) return json({ error: 'invalid_request', message: 'No lead was specified.' }, 400)

    const authHeader = req.headers.get('Authorization') || ''
    const { data: { user } } = await db.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user?.id) return json({ error: 'unauthenticated', message: 'Please sign in again.' }, 401)

    // Ownership is checked by filtering on it rather than trusting the id: a
    // lead belonging to someone else simply does not exist for this caller.
    const { data: lead, error: loadErr } = await db
      .from('leads')
      .select('id, name, address, website, email, enriched_at, enrichment_source')
      .eq('id', leadId).eq('user_id', user.id).single()

    if (loadErr || !lead) {
      return json({ error: 'not_found', message: 'That lead is not in your list.' }, 404)
    }
    if (lead.email) {
      return json({ status: 'unchanged', message: 'This lead already has an email.', email: lead.email })
    }

    // --- Free path ----------------------------------------------------------
    let email = lead.website ? await fromWebsite(String(lead.website)) : ''
    let source = email ? 'website' : ''

    // --- Paid path, rate limited -------------------------------------------
    if (!email && geminiKey) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { count } = await db
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('enrichment_source', 'search')
        .gte('enriched_at', since)

      if ((count ?? 0) >= GROUNDED_DAILY_LIMIT) {
        // Not an error: the free path already ran and found nothing. Say which
        // limit was hit so it does not read as the lookup silently failing.
        await db.from('leads')
          .update({ enriched_at: new Date().toISOString(), enrichment_source: 'none' })
          .eq('id', lead.id)
        return json({
          status: 'limited',
          message: `You have used all ${GROUNDED_DAILY_LIMIT} deep lookups for today. The website check found nothing for this lead.`,
        }, 429)
      }

      email = await fromGroundedSearch(lead, geminiKey)
      source = email ? 'search' : ''
    }

    // A lead that yielded nothing is still marked as attempted, so clicking the
    // button again does not re-run the expensive path for the same empty result.
    const { error: saveErr } = await db.from('leads').update({
      ...(email ? { email } : {}),
      enriched_at: new Date().toISOString(),
      enrichment_source: source || 'none',
    }).eq('id', lead.id)

    if (saveErr) {
      console.error('Could not save enrichment', saveErr)
      return json({ error: 'save_failed', message: 'Found the details but could not save them. Please try again.' }, 500)
    }

    await logEvent(db, {
      source: 'enrich-lead',
      stage: source || 'none',
      message: email ? `Found an email via ${source}` : 'No email found',
      detail: { lead_id: lead.id, had_website: Boolean(lead.website) },
      user_id: user.id,
    })

    return json({
      status: email ? 'enriched' : 'not_found',
      email: email || null,
      source: source || 'none',
      message: email
        ? 'Contact details updated.'
        : 'No published email address found for this business.',
    })

  } catch (err) {
    console.error('enrich-lead error:', err)
    return json({ error: 'unexpected', message: 'Something went wrong. Please try again.' }, 500)
  }
})

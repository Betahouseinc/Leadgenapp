import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function enrichWithGemini(
  lead: Record<string, unknown>,
  geminiKey: string
): Promise<{ industry: string; score: number; summary: string }> {
  const prompt = `Given this business data: ${JSON.stringify(lead)}. Return JSON only with fields: industry (classify into: Real estate / IT Software / Manufacturing / Healthcare / Retail / Education / Pharma), score (0-100 based on completeness and relevance), summary (one line, max 12 words). No explanation.`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  )

  if (!res.ok) return { industry: (lead.industry as string) || 'Other', score: 40, summary: '' }

  const body = await res.json()
  try {
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    return JSON.parse(text)
  } catch {
    return { industry: (lead.industry as string) || 'Other', score: 40, summary: '' }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const payload = await req.json()
    console.log('Webhook received:', JSON.stringify(payload))

    const { defaultDatasetId, industry, city, source, eventType } = payload

    if (eventType === 'ACTOR.RUN.FAILED') {
      console.error('Apify run failed for', source)
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
    }

    const apifyKey = Deno.env.get('APIFY_API_KEY') || ''
    const geminiKey = Deno.env.get('GEMINI_API_KEY') || ''
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://dbmtdeensqawntawaoyf.supabase.co'
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

    // Fetch dataset items from Apify
    const dataRes = await fetch(
      `https://api.apify.com/v2/datasets/${defaultDatasetId}/items?token=${apifyKey}`
    )
    const items: Record<string, unknown>[] = await dataRes.json()
    console.log(`Fetched ${items.length} items from Apify dataset`)

    // Map to lead records
    const raw = items.map(item => {
      if (source === 'gmaps') {
        return {
          name: (item.title as string) || '',
          website: (item.website as string) || '',
          phone: (item.phone as string) || '',
          city,
          industry: (item.categoryName as string) || industry,
          source: 'gmaps',
          status: 'new',
        }
      } else {
        return {
          name: (item.name as string) || '',
          website: (item.website as string) || '',
          city: (item.location as string) || city,
          industry,
          source: 'linkedin',
          status: 'new',
        }
      }
    }).filter(l => l.name)

    // Dedup
    const seen = new Set<string>()
    const unique = raw.filter(l => {
      const key = `${l.name.toLowerCase()}|${l.city.toLowerCase()}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // Enrich with Gemini
    const enriched = await Promise.all(
      unique.map(async lead => {
        try {
          const ai = await enrichWithGemini(lead, geminiKey)
          return { ...lead, ...ai }
        } catch {
          return lead
        }
      })
    )

    // Upsert to DB
    if (enriched.length > 0) {
      const db = createClient(supabaseUrl, supabaseKey)
      const { error } = await db
        .from('leads')
        .upsert(enriched, { onConflict: 'name,city', ignoreDuplicates: false })
      if (error) console.error('Upsert error:', error)
      else console.log(`Upserted ${enriched.length} leads`)
    }

    return new Response(
      JSON.stringify({ success: true, count: enriched.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Webhook error:', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

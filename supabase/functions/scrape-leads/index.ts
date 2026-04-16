import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function runApifyAndWait(actorId: string, input: unknown, apiKey: string): Promise<Record<string, unknown>[]> {
  // Start run and wait up to 120s for it to finish
  const runRes = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/runs?token=${apiKey}&waitForFinish=120`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }
  )
  if (!runRes.ok) throw new Error(`Apify run failed: ${await runRes.text()}`)
  const { data: run } = await runRes.json()

  if (run.status !== 'SUCCEEDED') throw new Error(`Apify run ${run.status}`)

  // Fetch dataset items
  const dataRes = await fetch(
    `https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items?token=${apiKey}`
  )
  return await dataRes.json()
}

async function enrichWithGemini(lead: Record<string, unknown>, geminiKey: string) {
  const prompt = `Given this business data: ${JSON.stringify(lead)}. Return JSON only with fields: industry (classify into: Real estate / IT Software / Manufacturing / Healthcare / Retail / Education / Pharma), score (0-100 based on completeness and relevance), summary (one line, max 12 words). No explanation.`

  try {
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
    if (!res.ok) return {}
    const body = await res.json()
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    return JSON.parse(text)
  } catch {
    return {}
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { industry, city, sources, limit } = await req.json()
    const apifyKey = Deno.env.get('APIFY_API_KEY') || ''
    const geminiKey = Deno.env.get('GEMINI_API_KEY') || ''
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://dbmtdeensqawntawaoyf.supabase.co'
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const db = createClient(supabaseUrl, supabaseKey)

    let raw: Record<string, unknown>[] = []

    // Run scrapers in parallel
    const tasks = sources.map(async (s: string) => {
      if (s === 'gmaps') {
        const items = await runApifyAndWait('nwua9Gu5YrADL7ZDj', {
          searchStringsArray: [`${industry} companies in ${city} India`],
          maxCrawledPlaces: Math.min(limit, 20),
          language: 'en',
          maxImages: 0,
          maxReviews: 0,
        }, apifyKey)
        return items.map(item => ({
          name: (item.title as string) || '',
          phone: (item.phone as string) || '',
          website: (item.website as string) || '',
          city,
          industry: (item.categoryName as string) || industry,
          source: 'gmaps',
          status: 'new',
        }))
      } else if (s === 'linkedin') {
        const items = await runApifyAndWait('UwSdACBp7ymaGUJjS', {
          searchUrl: `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(industry)}+${encodeURIComponent(city)}`,
          maxResults: Math.min(limit, 20),
        }, apifyKey)
        return items.map(item => ({
          name: (item.name as string) || '',
          website: (item.website as string) || '',
          city: (item.location as string) || city,
          industry,
          source: 'linkedin',
          status: 'new',
        }))
      }
      return []
    })

    const results = await Promise.allSettled(tasks)
    for (const r of results) {
      if (r.status === 'fulfilled') raw = raw.concat(r.value)
    }

    // Dedup
    const seen = new Set<string>()
    const unique = raw.filter(l => {
      const key = `${String(l.name).toLowerCase()}|${String(l.city).toLowerCase()}`
      if (!l.name || seen.has(key)) return false
      seen.add(key)
      return true
    })

    // Enrich with Gemini
    const enriched = await Promise.all(
      unique.map(async lead => {
        const ai = await enrichWithGemini(lead, geminiKey)
        return { ...lead, ...ai }
      })
    )

    // Upsert to DB
    if (enriched.length > 0) {
      const { error } = await db
        .from('leads')
        .upsert(enriched, { onConflict: 'name,city', ignoreDuplicates: false })
      if (error) console.error('Upsert error:', error)
    }

    return new Response(
      JSON.stringify({ success: true, count: enriched.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error(err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

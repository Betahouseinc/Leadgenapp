import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ScrapeRequest {
  industry: string
  city: string
  sources: string[]
  limit: number
}

interface LeadRecord {
  name: string
  company?: string
  email?: string
  phone?: string
  website?: string
  city?: string
  industry?: string
  source: string
  score?: number
  summary?: string
  status: string
}

// ── Apify helpers ─────────────────────────────────────────────

async function runApifyActor(actorId: string, input: unknown, apiKey: string): Promise<unknown[]> {
  const runRes = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/runs?token=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }
  )
  if (!runRes.ok) throw new Error(`Apify run failed: ${await runRes.text()}`)
  const { data: { id: runId } } = await runRes.json()

  // Poll until finished (max 3 min)
  for (let i = 0; i < 36; i++) {
    await sleep(5000)
    const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apiKey}`)
    const { data } = await statusRes.json()
    if (data.status === 'SUCCEEDED') {
      const datasetRes = await fetch(
        `https://api.apify.com/v2/datasets/${data.defaultDatasetId}/items?token=${apiKey}`
      )
      return await datasetRes.json()
    }
    if (data.status === 'FAILED' || data.status === 'ABORTED') {
      throw new Error(`Apify actor ${actorId} ${data.status}`)
    }
  }
  throw new Error('Apify actor timed out')
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// ── Google Maps scraper ────────────────────────────────────────

async function scrapeGoogleMaps(industry: string, city: string, limit: number, apiKey: string): Promise<Partial<LeadRecord>[]> {
  const items = await runApifyActor(
    'nwua9Gu5YkAVuf7GQ',
    {
      searchStringsArray: [`${industry} companies in ${city} India`],
      maxCrawledPlaces: limit,
    },
    apiKey
  ) as Record<string, unknown>[]

  return items.map(item => ({
    name: (item.title as string) || '',
    website: (item.website as string) || '',
    phone: (item.phone as string) || '',
    city,
    industry: (item.categoryName as string) || industry,
    source: 'gmaps',
    status: 'new',
  }))
}

// ── LinkedIn scraper ───────────────────────────────────────────

async function scrapeLinkedIn(industry: string, city: string, limit: number, apiKey: string): Promise<Partial<LeadRecord>[]> {
  const searchUrl = `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(industry)}+${encodeURIComponent(city)}`
  const items = await runApifyActor(
    '2SyF0bVxmgGr8IVCZ',
    { searchUrl, maxResults: limit },
    apiKey
  ) as Record<string, unknown>[]

  return items.map(item => ({
    name: (item.name as string) || '',
    website: (item.website as string) || '',
    city: (item.location as string) || city,
    industry,
    source: 'linkedin',
    status: 'new',
  }))
}

// ── Gemini enrichment ──────────────────────────────────────────

async function enrichWithGemini(lead: Partial<LeadRecord>, geminiKey: string): Promise<{ industry: string; score: number; summary: string }> {
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

  if (!res.ok) {
    console.error('Gemini error:', await res.text())
    return { industry: lead.industry || 'Other', score: 40, summary: '' }
  }

  const body = await res.json()
  try {
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    return JSON.parse(text)
  } catch {
    return { industry: lead.industry || 'Other', score: 40, summary: '' }
  }
}

// ── Deduplication ──────────────────────────────────────────────

function dedup(leads: Partial<LeadRecord>[]): Partial<LeadRecord>[] {
  const seen = new Set<string>()
  return leads.filter(l => {
    const key = l.email || `${(l.name || '').toLowerCase()}|${(l.city || '').toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ── Handler ────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { industry, city, sources, limit }: ScrapeRequest = await req.json()

    const apifyKey = Deno.env.get('APIFY_API_KEY') || ''
    const geminiKey = Deno.env.get('GEMINI_API_KEY') || ''
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

    const db = createClient(supabaseUrl, supabaseKey)

    // Scrape
    let raw: Partial<LeadRecord>[] = []

    const tasks = sources.map(async s => {
      if (s === 'gmaps') return scrapeGoogleMaps(industry, city, limit, apifyKey)
      if (s === 'linkedin') return scrapeLinkedIn(industry, city, limit, apifyKey)
      return []
    })

    const results = await Promise.allSettled(tasks)
    for (const r of results) {
      if (r.status === 'fulfilled') raw = raw.concat(r.value)
    }

    // Dedup
    const unique = dedup(raw)

    // Enrich with Gemini
    const enriched = await Promise.all(
      unique.map(async lead => {
        try {
          const ai = await enrichWithGemini(lead, geminiKey)
          return { ...lead, ...ai } as LeadRecord
        } catch {
          return lead as LeadRecord
        }
      })
    )

    // Upsert into leads table
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

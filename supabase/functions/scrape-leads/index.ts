import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const INDUSTRY_SEARCH_MAP: Record<string, string> = {
  'Real Estate':                  'real estate agency',
  'IT Software':                  'software company',
  'EdTech':                       'edtech education technology company',
  'FinTech':                      'fintech financial technology startup',
  'Social Media Marketing':       'social media marketing agency',
  'Digital Marketing':            'digital marketing agency',
  'Media & Production':           'media production company',
  'Manufacturing':                'manufacturing company',
  'Healthcare':                   'healthcare clinic hospital',
  'Retail':                       'retail store chain',
  'Education':                    'school college university',
  'Pharma':                       'pharmaceutical company',
  'Logistics & Supply Chain':     'logistics supply chain company',
  'Food & Beverage':              'food beverage company restaurant chain',
  'E-commerce':                   'ecommerce online retail company',
  'Construction & Infrastructure':'construction infrastructure company',
  'Legal Services':               'law firm legal services',
  'HR & Staffing':                'hr staffing recruitment agency',
  'Events & Entertainment':       'event management entertainment company',
  'Travel & Hospitality':         'travel agency hotel hospitality',
}

async function runApifyAndWait(actorId: string, input: unknown, apiKey: string): Promise<Record<string, unknown>[]> {
  const runRes = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/runs?token=${apiKey}&waitForFinish=55`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }
  )
  if (!runRes.ok) throw new Error(`Apify run failed: ${await runRes.text()}`)
  const { data: run } = await runRes.json()
  if (run.status !== 'SUCCEEDED') throw new Error(`Apify actor ${run.status}`)
  const dataRes = await fetch(
    `https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items?token=${apiKey}`
  )
  if (!dataRes.ok) throw new Error('Failed to fetch Apify dataset')
  return await dataRes.json()
}

async function enrichWithGemini(lead: Record<string, unknown>, geminiKey: string, industry: string) {
  const industryList = Object.keys(INDUSTRY_SEARCH_MAP).join(' / ')
  const prompt = `Given this business data: ${JSON.stringify(lead)}.
Return JSON only with these exact fields:
- industry: classify into one of: ${industryList}
- score: integer 0-100 (higher = more complete: has phone, website, address, reviews)
- summary: one line description max 12 words
No explanation, no markdown, just raw JSON.`
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
    if (!res.ok) return { industry, score: 40, summary: '' }
    const body = await res.json()
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    const parsed = JSON.parse(text)
    return {
      industry: parsed.industry || industry,
      score: typeof parsed.score === 'number' ? parsed.score : 40,
      summary: parsed.summary || '',
    }
  } catch {
    return { industry, score: 40, summary: '' }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://dbmtdeensqawntawaoyf.supabase.co'
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const db = createClient(supabaseUrl, supabaseKey)

  let scrapeRunId: string | null = null
  let userId: string | null = null

  try {
    const { industry, city, sources, limit } = await req.json()
    const apifyKey = Deno.env.get('APIFY_API_KEY') || ''
    const geminiKey = Deno.env.get('GEMINI_API_KEY') || ''

    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await db.auth.getUser(token)
    userId = user?.id || null

    const searchTerm = INDUSTRY_SEARCH_MAP[industry] || industry

    // Create scrape_run record
    const { data: runRow } = await db
      .from('scrape_runs')
      .insert({ user_id: userId, industry, city, sources, limit_requested: limit, status: 'running' })
      .select('id')
      .single()
    if (runRow) scrapeRunId = runRow.id

    let raw: Record<string, unknown>[] = []

    const tasks = (sources as string[]).map(async (s) => {
      if (s === 'gmaps') {
        const items = await runApifyAndWait('nwua9Gu5YrADL7ZDj', {
          searchStringsArray: [`${searchTerm} in ${city} India`],
          maxCrawledPlaces: Math.min(limit, 40),
          language: 'en',
          maxImages: 0,
          maxReviews: 0,
        }, apifyKey)
        return items.map(item => ({
          name: (item.title as string) || '',
          phone: (item.phone as string) || '',
          website: (item.website as string) || '',
          address: (item.address as string) || '',
          rating: (item.totalScore as number) || null,
          review_count: (item.reviewsCount as number) || null,
          city,
          industry,
          source: 'gmaps',
          status: 'new',
          user_id: userId,
          scrape_run_id: scrapeRunId,
        }))
      } else if (s === 'linkedin') {
        const items = await runApifyAndWait('taHaRcqil3scbchuI', {
          keyword: `${searchTerm} ${city}`,
          maxResults: Math.min(limit, 40),
        }, apifyKey)
        return items
          .filter((item: Record<string, unknown>) => item.name || item.companyName)
          .map((item: Record<string, unknown>) => ({
            name: ((item.name || item.companyName) as string) || '',
            website: ((item.website || item.companyWebsite) as string) || '',
            city: ((item.location || item.headquarter) as string) || city,
            industry,
            source: 'linkedin',
            status: 'new',
            user_id: userId,
            scrape_run_id: scrapeRunId,
          }))
      }
      return []
    })

    const results = await Promise.allSettled(tasks)
    for (const r of results) {
      if (r.status === 'fulfilled') raw = raw.concat(r.value)
    }

    // Dedup by name+city
    const seen = new Set<string>()
    const unique = raw.filter(l => {
      const key = `${String(l.name).toLowerCase()}|${String(l.city).toLowerCase()}`
      if (!l.name || seen.has(key)) return false
      seen.add(key)
      return true
    })

    // Enrich with Gemini
    const enriched: Record<string, unknown>[] = []
    for (const lead of unique) {
      const ai = await enrichWithGemini(lead, geminiKey, industry)
      enriched.push({ ...lead, ...ai })
    }

    // Insert leads
    let savedCount = 0
    if (enriched.length > 0) {
      const { data: inserted, error: insertErr } = await db
        .from('leads')
        .insert(enriched)
        .select('id')

      if (insertErr) {
        console.error('Insert error:', insertErr.message)
        // Fallback: upsert ignoring duplicates
        const { data: upserted } = await db
          .from('leads')
          .upsert(enriched, { onConflict: 'name,city', ignoreDuplicates: true })
          .select('id')
        savedCount = upserted?.length || 0
      } else {
        savedCount = inserted?.length || 0
      }

      if (userId && savedCount > 0) {
        await db.rpc('increment_leads_used', { user_id: userId, amount: savedCount })
      }
    }

    if (scrapeRunId) {
      await db
        .from('scrape_runs')
        .update({ status: 'completed', leads_found: enriched.length, leads_saved: savedCount })
        .eq('id', scrapeRunId)
    }

    return new Response(
      JSON.stringify({ success: true, count: enriched.length, saved: savedCount, run_id: scrapeRunId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('scrape-leads error:', err)
    if (scrapeRunId) {
      await db
        .from('scrape_runs')
        .update({ status: 'failed', error_message: (err as Error).message })
        .eq('id', scrapeRunId)
    }
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

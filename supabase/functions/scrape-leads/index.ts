import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const INDUSTRY_SEARCH_MAP: Record<string, string> = {
  'Real Estate':                  'real estate agency',
  'IT Software':                  'software company',
  'EdTech':                       'education technology company',
  'FinTech':                      'financial technology company',
  'Social Media Marketing':       'social media marketing agency',
  'Digital Marketing':            'digital marketing agency',
  'Media & Production':           'media production studio',
  'Manufacturing':                'manufacturing company',
  'Healthcare':                   'clinic',
  'Retail':                       'retail store',
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
  // Start the run without blocking. waitForFinish caps at 60s, but enabling
  // scrapeContacts pushes many runs past that, so we poll instead of waiting once.
  const runRes = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/runs?token=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }
  )
  if (!runRes.ok) throw new Error(`Apify run failed: ${await runRes.text()}`)
  const { data: started } = await runRes.json()

  const TERMINAL = ['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT']
  const DEADLINE_MS = 6 * 60 * 1000   // hard stop well under the function limit
  const POLL_MS = 5000
  const begun = Date.now()

  let run = started
  while (!TERMINAL.includes(run.status)) {
    if (Date.now() - begun > DEADLINE_MS) {
      throw new Error(`Apify run still ${run.status} after ${Math.round((Date.now()-begun)/1000)}s - aborting`)
    }
    await new Promise(r => setTimeout(r, POLL_MS))
    const poll = await fetch(`https://api.apify.com/v2/actor-runs/${run.id}?token=${apiKey}`)
    if (!poll.ok) throw new Error('Apify status check failed')
    run = (await poll.json()).data
  }

  if (run.status !== 'SUCCEEDED') throw new Error(`Apify actor ${run.status}`)
  console.log(`Apify run ${run.id} finished in ${Math.round((Date.now()-begun)/1000)}s`)

  const dataRes = await fetch(
    `https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items?token=${apiKey}`
  )
  if (!dataRes.ok) throw new Error('Failed to fetch Apify dataset')
  const items = await dataRes.json()
  console.log(`Apify returned ${items.length} items`)
  return items
}

async function enrichBatchWithGemini(leads: Record<string, unknown>[], geminiKey: string, industry: string) {
  const industryList = Object.keys(INDUSTRY_SEARCH_MAP).join(' / ')
  const slim = leads.map((l, i) => ({
    i,
    name: l.name,
    website: l.website,
    phone: l.phone,
    address: l.address,
    rating: l.rating,
    review_count: l.review_count,
  }))
  const prompt = `You are scoring sales leads. For EACH business below, return an object with:
- i: the same index given
- industry: classify into one of: ${industryList}
- score: integer 0-100. Higher = better lead. Reward having a website, phone, address, high rating and many reviews. Vary the scores meaningfully; do NOT give everything the same number.
- summary: one line description, max 12 words

Businesses: ${JSON.stringify(slim)}

Return JSON only: an array of objects. No markdown, no explanation.`

  const attempt = async (modelName: string) => {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    )
    if (!res.ok) {
      const errText = await res.text()
      console.error('Gemini batch error', modelName, res.status, errText.substring(0, 300))
      return null
    }
    const body = await res.json()
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
    try {
      const parsed = JSON.parse(text)
      return Array.isArray(parsed) ? parsed : (parsed.leads || parsed.results || null)
    } catch (e) {
      console.error('Gemini batch parse failed', String(e))
      return null
    }
  }

  // primary model, then a lighter-quota fallback, with one short retry for 429s
  let arr = await attempt('gemini-3.6-flash')
  if (!arr) {
    await new Promise(r => setTimeout(r, 3000))
    arr = await attempt('gemini-3.5-flash-lite')
  }
  if (!arr) {
    console.error('Gemini scoring FAILED for all models - leads saved unscored')
    return leads.map(l => ({ ...l, industry, score: 40, summary: '[AI scoring unavailable]' }))
  }

  const byIndex = new Map<number, Record<string, unknown>>()
  for (const o of arr) {
    if (o && typeof o.i === 'number') byIndex.set(o.i, o)
  }
  return leads.map((l, i) => {
    const ai = byIndex.get(i)
    if (!ai) return { ...l, industry, score: 40, summary: '[AI scoring unavailable]' }
    const s = Number(ai.score)
    return {
      ...l,
      industry: (ai.industry as string) || industry,
      score: Number.isFinite(s) ? Math.max(0, Math.min(100, Math.round(s))) : 40,
      summary: (ai.summary as string) || '',
    }
  })
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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    )
    if (!res.ok) { const errText = await res.text(); console.error('Gemini API error', res.status, errText); return { industry, score: 40, summary: '[AI scoring unavailable]' } }
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

    // --- Quota enforcement (reject if request exceeds remaining allowance) ---
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const { data: quota, error: quotaErr } = await db.rpc('check_lead_quota', { p_user_id: userId })
    if (quotaErr) {
      console.error('Quota check failed', quotaErr)
      return new Response(JSON.stringify({ error: 'Could not verify your plan usage. Please try again.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    // 'allowed' is the lower of what's left today and what's left this month,
    // so a daily cap bounds even an unlimited monthly plan.
    const allowed = quota?.allowed ?? 0
    if (limit > allowed) {
      const daily = quota?.blocked_by === 'daily' || (quota?.day_remaining ?? 0) < (quota?.remaining ?? 0)
      const message = daily
        ? `You have ${quota?.day_remaining} of ${quota?.day_limit} leads left today on the ${quota?.plan} plan. You requested ${limit}. Your daily allowance resets at midnight IST, or you can upgrade for a higher limit.`
        : `You have ${quota?.remaining} of ${quota?.limit} leads left this month on the ${quota?.plan} plan. You requested ${limit}. Reduce the number or upgrade your plan.`

      return new Response(JSON.stringify({
        error: 'quota_exceeded',
        scope: daily ? 'daily' : 'monthly',
        message,
        plan: quota?.plan,
        limit: quota?.limit,
        used: quota?.used,
        remaining: quota?.remaining,
        day_limit: quota?.day_limit,
        day_used: quota?.day_used,
        day_remaining: quota?.day_remaining,
        allowed,
      }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

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
          // Keep the search term clean and pass location separately — embedding the
          // city in the query makes Google Maps match literally and starves results.
          searchStringsArray: [searchTerm],
          locationQuery: `${city}, India`,
          maxCrawledPlacesPerSearch: Math.min(limit, 200),
          language: 'en',
          // Visits each business website on Apify's infra to pull business emails
          // and social profiles. Runs in parallel there, so it can't time out here.
          scrapeContacts: true,
          skipClosedPlaces: true,
          maxImages: 0,
          maxReviews: 0,
        }, apifyKey)
        return items.map(item => ({
          name: (item.title as string) || '',
          // scrapeContacts returns emails[] on the item; take the first business address.
          email: (Array.isArray(item.emails) ? (item.emails[0] as string) : '') || '',
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
    const enriched: Record<string, unknown>[] = await enrichBatchWithGemini(unique, geminiKey, industry)

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

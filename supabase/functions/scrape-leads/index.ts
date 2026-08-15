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

// Gemini returns the industry as free text, so "Real estate" and "Real Estate"
// used to land as separate tags — and the dashboard filter, which hardcoded one
// spelling, matched neither reliably. Squash to alphanumerics and map back to
// the canonical label. Mirrors public.normalise_industry() in the database.
const INDUSTRY_BY_KEY = new Map<string, string>()
for (const label of Object.keys(INDUSTRY_SEARCH_MAP)) {
  INDUSTRY_BY_KEY.set(industryKey(label), label)
}
for (const [variant, label] of [
  ['Real Estate Agency', 'Real Estate'],
  ['Software', 'IT Software'],
  ['IT', 'IT Software'],
  ['Information Technology', 'IT Software'],
  ['Ecommerce', 'E-commerce'],
  ['Health Care', 'Healthcare'],
  ['Food and Beverage', 'Food & Beverage'],
  ['Media and Production', 'Media & Production'],
  ['HR and Staffing', 'HR & Staffing'],
  ['Logistics', 'Logistics & Supply Chain'],
  ['Construction', 'Construction & Infrastructure'],
]) {
  INDUSTRY_BY_KEY.set(industryKey(variant), label)
}

function industryKey(v: string) {
  return (v || '').toLowerCase().replace(/[^a-z0-9]+/g, '')
}

// An unrecognised label is kept (trimmed) rather than dropped — losing a tag we
// do not know about is worse than showing an untidy one.
function normaliseIndustry(v: string, fallback: string): string {
  return INDUSTRY_BY_KEY.get(industryKey(v)) || (v || '').trim() || fallback
}

// Mirrors the generated dedup_key column on leads.
function dedupKey(name: unknown, city: unknown) {
  const squash = (v: unknown) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '')
  return `${squash(name)}|${squash(city)}`
}

function normalisePhone(v: unknown) {
  const digits = String(v ?? '').replace(/\D/g, '')
  // Compare on the last 10 digits so +91-80-1234 5678 and 08012345678 match.
  return digits.length > 10 ? digits.slice(-10) : digits
}

// The most a single run may collect.
//
// One invocation must start the Apify run, wait it out, score every lead and
// insert them, all inside one worker's lifetime.
//
// 10 is the only size with evidence behind it. Measured 2026-08-15 against
// production: two runs at 10 completed in roughly two minutes each; a run at 50
// was killed mid-flight and left its scrape_runs row stranded in 'running' with
// nothing saved. 11-49 is untested.
//
// Two minutes for ten leads points at the platform's wall clock being far lower
// than the 400s these budgets were written for — a killed worker never reaches
// the catch block, so neither deadline below ever got the chance to fire. Do not
// raise this on the strength of the budgets; raise it only after watching a run
// at the new size complete, and check scrape_runs for rows stuck in 'running'.
//
// Plan allowances are daily, not per-run (starter 100/day, pro 300, agency
// 1000), so this costs a customer extra runs, never leads they paid for.
const MAX_LEADS_PER_RUN = 10

// Wall-clock budget. Supabase kills a worker that runs past its ceiling, and
// the Apify poll and the Gemini scoring share one invocation — so their two
// budgets must add up to less than the ceiling, with room left for the inserts.
// They previously totalled 450s, which is over it on its own.
const APIFY_DEADLINE_MS = 200 * 1000
const SCORING_BUDGET_MS = 120 * 1000

async function runApifyAndWait(
  actorId: string,
  input: unknown,
  apiKey: string,
  // Apify projects the dataset server-side, so this is the difference between
  // parsing a few hundred KB and parsing tens of MB. A Google Maps item carries
  // opening hours, popular-times histograms, image URLs and review metadata that
  // this function never reads; pulling all 200 of them in full is what exhausts
  // the worker's memory and gets it killed with "not enough compute resources".
  fields: string[],
  itemLimit: number,
): Promise<Record<string, unknown>[]> {
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
  const DEADLINE_MS = APIFY_DEADLINE_MS
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

  const params = new URLSearchParams({
    token: apiKey,
    limit: String(Math.max(1, Math.min(itemLimit, 200))),
    fields: fields.join(','),
    // Drops empty records and Apify's internal #-prefixed keys.
    clean: 'true',
  })
  const dataRes = await fetch(
    `https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items?${params}`
  )
  if (!dataRes.ok) throw new Error('Failed to fetch Apify dataset')
  const items = await dataRes.json()
  console.log(`Apify returned ${items.length} items`)
  return items
}

// A lead that could not be scored is never persisted. Scoring is the product's
// core value, so a half-scored batch is worse than no batch: the previous code
// papered over failures with a hardcoded score of 40, which shipped garbage to
// the customer and billed them for it. Failing loudly is the deliberate choice.
class ScoringError extends Error {}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// Free-tier keys rate-limit aggressively (429) and Gemini intermittently 5xxs.
// Both are transient and earn a retry. A 400/403 means a malformed request or a
// bad key and will never succeed, so it drops straight to the fallback model
// instead of burning the backoff budget waiting.
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504])

const MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite']
const BACKOFF_MS = [0, 2000, 5000]

// Chunks are fired sequentially. With no gap between them a free-tier key 429s
// from the second chunk onward — which is precisely what produced whole runs of
// identically-scored leads.
const INTER_CHUNK_MS = 1500

// Scoring must leave room for Apify inside the function's wall-clock budget, so
// retries are bounded by a deadline rather than being allowed to run forever.
// SCORING_BUDGET_MS is declared alongside APIFY_DEADLINE_MS above, where the two
// halves of the budget can be read together.

function buildScoringPrompt(leads: Record<string, unknown>[]) {
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
  return `You are scoring sales leads. For EACH business below, return an object with:
- i: the same index given
- industry: classify into one of: ${industryList}
- score: integer 0-100. Higher = better lead. Reward having a website, phone, address, high rating and many reviews. Vary the scores meaningfully; do NOT give everything the same number.
- summary: one line description, max 12 words

Businesses: ${JSON.stringify(slim)}

Return JSON only: an array of objects. No markdown, no explanation.`
}

// Distinguishes "ask again" from "this will never work", so the caller knows
// whether a retry is worth the remaining time budget.
async function requestScores(
  model: string,
  prompt: string,
  geminiKey: string,
): Promise<{ arr: Record<string, unknown>[] | null; retryable: boolean }> {
  let res: Response
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    )
  } catch (e) {
    console.error('Gemini network error', model, String(e))
    return { arr: null, retryable: true }
  }

  if (!res.ok) {
    const errText = await res.text()
    console.error('Gemini error', model, res.status, errText.substring(0, 300))
    return { arr: null, retryable: RETRYABLE_STATUS.has(res.status) }
  }

  const body = await res.json()
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text || ''
  try {
    const parsed = JSON.parse(text)
    const arr = Array.isArray(parsed) ? parsed : (parsed.leads || parsed.results || null)
    // A truncated or oddly-shaped reply is usually transient — worth one more go.
    return { arr: Array.isArray(arr) ? arr : null, retryable: !Array.isArray(arr) }
  } catch (e) {
    console.error('Gemini parse failed', model, String(e))
    return { arr: null, retryable: true }
  }
}

// Returns null if the model skipped any lead or gave it an unusable score.
// Partial results are rejected wholesale rather than backfilled with a default,
// which is what the old flat-40 behaviour amounted to.
function mergeScores(
  leads: Record<string, unknown>[],
  arr: Record<string, unknown>[],
  industry: string,
): Record<string, unknown>[] | null {
  const byIndex = new Map<number, Record<string, unknown>>()
  for (const o of arr) {
    if (o && typeof o.i === 'number') byIndex.set(o.i, o)
  }

  const out: Record<string, unknown>[] = []
  for (let i = 0; i < leads.length; i++) {
    const ai = byIndex.get(i)
    if (!ai) return null
    const s = Number(ai.score)
    if (!Number.isFinite(s)) return null
    out.push({
      ...leads[i],
      industry: normaliseIndustry(ai.industry as string, industry),
      score: Math.max(0, Math.min(100, Math.round(s))),
      summary: (ai.summary as string) || '',
    })
  }
  return out
}

// Walks primary model → fallback model, retrying each with exponential backoff,
// and throws ScoringError once every option is exhausted or the budget is spent.
async function scoreChunk(
  leads: Record<string, unknown>[],
  geminiKey: string,
  industry: string,
  deadline: number,
): Promise<Record<string, unknown>[]> {
  const prompt = buildScoringPrompt(leads)

  for (const model of MODELS) {
    for (let attempt = 0; attempt < BACKOFF_MS.length; attempt++) {
      if (Date.now() > deadline) {
        throw new ScoringError('AI scoring ran out of time before every lead could be scored. Please try a smaller batch.')
      }
      if (BACKOFF_MS[attempt]) await sleep(BACKOFF_MS[attempt])

      const { arr, retryable } = await requestScores(model, prompt, geminiKey)

      if (arr) {
        const merged = mergeScores(leads, arr, industry)
        if (merged) return merged
        console.warn(`Gemini ${model} returned an incomplete batch - retrying`)
        continue
      }
      // Nothing a retry can fix; give the fallback model its turn instead.
      if (!retryable) break
    }
  }

  throw new ScoringError('AI scoring is temporarily unavailable, so no leads were saved and your allowance was not used. This is usually a rate limit — please try again in a few minutes.')
}

// Best-effort: monitoring must never be the reason a scrape fails, so a failed
// write here is swallowed after being logged to stdout.
// deno-lint-ignore no-explicit-any
async function logError(
  db: any,
  entry: { source: string; stage?: string; message: string; detail?: unknown; user_id?: string | null; scrape_run_id?: string | null },
) {
  try {
    await db.from('error_log').insert({
      source: entry.source,
      stage: entry.stage ?? null,
      message: entry.message.slice(0, 2000),
      detail: entry.detail ? JSON.parse(JSON.stringify(entry.detail)) : null,
      user_id: entry.user_id ?? null,
      scrape_run_id: entry.scrape_run_id ?? null,
    })
  } catch (e) {
    console.error('error_log write failed', String(e))
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
    const body = await req.json()
    const { industry, city, sources } = body

    // Clamp rather than trust the caller. The UI caps its own slider, but the
    // function is a public HTTP endpoint and the scheduled job posts to it too,
    // so the ceiling has to be enforced where it cannot be bypassed. An
    // oversized request is the one input that reliably kills the worker, and a
    // killed worker never reaches the catch block below — no error is logged,
    // the scrape_runs row is stranded in 'running', and the customer is left
    // with a raw platform error. Rejecting here keeps every failure legible.
    const requested = Number(body.limit)
    if (!Number.isFinite(requested) || requested < 1) {
      return new Response(
        JSON.stringify({ error: 'invalid_limit', message: 'Please choose how many leads to collect.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    if (requested > MAX_LEADS_PER_RUN) {
      return new Response(JSON.stringify({
        error: 'limit_too_large',
        message: `A single search can collect up to ${MAX_LEADS_PER_RUN} leads. Run it again — or change the city or industry — to collect more.`,
        max_per_run: MAX_LEADS_PER_RUN,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const limit = Math.floor(requested)
    const apifyKey = Deno.env.get('APIFY_API_KEY') || ''
    const geminiKey = Deno.env.get('GEMINI_API_KEY') || ''

    // Two ways in. Normally the caller's JWT identifies the user. The scheduled
    // job has no user session, so it presents a shared secret and names the
    // user explicitly — which is why the secret must be compared before the
    // body's user_id is trusted at all.
    const cronSecret = Deno.env.get('CRON_SECRET') || ''
    const presentedSecret = req.headers.get('x-cron-secret') || ''
    const isCron = cronSecret.length > 0 && presentedSecret === cronSecret

    if (isCron) {
      userId = (body.user_id as string) || null
    } else {
      const authHeader = req.headers.get('Authorization') || ''
      const token = authHeader.replace('Bearer ', '')
      const { data: { user } } = await db.auth.getUser(token)
      userId = user?.id || null
    }

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
        }, apifyKey, ['title', 'emails', 'phone', 'website', 'address', 'totalScore', 'reviewsCount'], limit)
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
        }, apifyKey, ['name', 'companyName', 'website', 'companyWebsite', 'location', 'headquarter'], limit)
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
      else {
        // Previously discarded in silence: a source that failed looked
        // identical to a source that legitimately returned nothing.
        console.error('Source failed:', r.reason)
        await logError(db, {
          source: 'scrape-leads', stage: 'apify',
          message: `Source failed: ${r.reason?.message || String(r.reason)}`,
          user_id: userId, scrape_run_id: scrapeRunId,
        })
      }
    }

    // Every source failed — surface it rather than reporting a successful run
    // that happened to find nothing.
    if (raw.length === 0 && results.every(r => r.status === 'rejected')) {
      throw new Error('The lead source could not be reached. Please try again shortly.')
    }

    // --- Dedup, in two passes ---
    // Pass 1: within this run. Two sources, or one source paginating, routinely
    // return the same business twice.
    const seen = new Set<string>()
    const withinRun = raw.filter(l => {
      if (!l.name) return false
      const key = dedupKey(l.name, l.city)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // Pass 2: against what this user already has. This is the pass that was
    // missing entirely — every re-run of a search previously re-inserted the
    // same businesses and charged the customer's quota for them. Name+city is
    // the primary key; phone and email catch the same business relisted under a
    // slightly different trading name.
    const unique = await (async () => {
      const keys = withinRun.map(l => dedupKey(l.name, l.city))
      const phones = withinRun.map(l => normalisePhone(l.phone)).filter(p => p.length >= 10)
      const emails = withinRun.map(l => String(l.email ?? '').toLowerCase().trim()).filter(Boolean)

      const inList = (col: string, vals: string[]) =>
        vals.length ? `${col}.in.(${[...new Set(vals)].map(v => JSON.stringify(v)).join(',')})` : null

      const { data: existing, error: existErr } = await db
        .from('leads')
        .select('dedup_key, phone_key, email')
        .eq('user_id', userId)
        .or([
          inList('dedup_key', keys),
          inList('phone_key', phones),
          inList('email', emails),
        ].filter(Boolean).join(','))

      if (existErr) {
        // Fail open. A dedup lookup that errors (most likely because the
        // 20260813 migration has not been applied yet) must not take the whole
        // scrape down with it — the unique index is the real backstop.
        console.error('Dedup lookup failed, continuing without it:', existErr.message)
        await logError(db, {
          source: 'scrape-leads', stage: 'dedup',
          message: `Dedup lookup failed, continued without it: ${existErr.message}`,
          user_id: userId, scrape_run_id: scrapeRunId,
        })
        return withinRun
      }

      const seenKeys = new Set((existing || []).map(r => r.dedup_key).filter(Boolean))
      const seenPhones = new Set((existing || []).map(r => r.phone_key).filter(p => p && p.length >= 10))
      const seenEmails = new Set((existing || []).map(r => String(r.email ?? '').toLowerCase()).filter(Boolean))

      const kept = withinRun.filter(l => {
        if (seenKeys.has(dedupKey(l.name, l.city))) return false
        const phone = normalisePhone(l.phone)
        if (phone.length >= 10 && seenPhones.has(phone)) return false
        const email = String(l.email ?? '').toLowerCase().trim()
        if (email && seenEmails.has(email)) return false
        return true
      })

      console.log(`Dedup: ${raw.length} scraped -> ${withinRun.length} unique in run -> ${kept.length} new for user`)
      return kept
    })()

    // Everything the search returned was already in the customer's list. Stop
    // before Gemini: scoring leads that will not be inserted burns quota on the
    // AI key and, on a free tier, is exactly what triggers the rate limiting.
    if (unique.length === 0) {
      if (scrapeRunId) {
        await db
          .from('scrape_runs')
          .update({ status: 'completed', leads_found: 0, leads_saved: 0 })
          .eq('id', scrapeRunId)
      }
      return new Response(
        JSON.stringify({ success: true, count: 0, saved: 0, duplicates: withinRun.length, run_id: scrapeRunId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Enrich with Gemini.
    // The pause between chunks keeps a free-tier key under its per-minute
    // request ceiling. Any chunk that cannot be scored aborts the whole run —
    // see ScoringError.
    //
    // 25 per chunk, not 10: chunks are scored strictly sequentially, so the
    // round trips — not the payload — are what spend the budget. At 10 a full
    // run needed five calls plus four pauses where it now needs two and one.
    // The reply per lead is four short fields, so a chunk of 25 is still a
    // couple of KB and nowhere near a truncation risk.
    const CHUNK = 25
    const scoringDeadline = Date.now() + SCORING_BUDGET_MS
    const enriched: Record<string, unknown>[] = []
    for (let ci = 0; ci < unique.length; ci += CHUNK) {
      if (ci > 0) await sleep(INTER_CHUNK_MS)
      const scored = await scoreChunk(unique.slice(ci, ci + CHUNK), geminiKey, industry, scoringDeadline)
      enriched.push(...scored)
    }

    // Insert leads
    let savedCount = 0
    if (enriched.length > 0) {
      // Upsert against the unique index rather than plain insert. The dedup pass
      // above already removed known duplicates; this closes the race where two
      // concurrent runs scrape the same business, and means one collision no
      // longer aborts the entire batch the way a plain insert did.
      const { data: inserted, error: insertErr } = await db
        .from('leads')
        .upsert(enriched, { onConflict: 'user_id,dedup_key', ignoreDuplicates: true })
        .select('id')

      if (insertErr) {
        console.error('Insert error:', insertErr.message)
        throw new Error(`Leads could not be saved: ${insertErr.message}`)
      }
      savedCount = inserted?.length || 0

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
    // A scoring failure is a transient upstream problem, not a bug in the
    // request, and nothing was saved or billed — 503 says "try again" where a
    // 500 would suggest the request itself was at fault.
    const scoringFailed = err instanceof ScoringError

    await logError(db, {
      source: 'scrape-leads',
      stage: scoringFailed ? 'scoring' : 'run',
      message: (err as Error).message,
      detail: { stack: (err as Error).stack?.slice(0, 1000) },
      user_id: userId,
      scrape_run_id: scrapeRunId,
    })

    return new Response(
      JSON.stringify({
        error: scoringFailed ? 'scoring_unavailable' : (err as Error).message,
        message: (err as Error).message,
        retryable: scoringFailed,
      }),
      { status: scoringFailed ? 503 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

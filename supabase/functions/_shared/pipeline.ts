// Shared pipeline code for the sliced lead-generation engine.
//
// scrape-leads (which creates a job) and scrape-worker (which advances it) both
// need the industry vocabulary, the dedup rules and the Gemini scoring client.
// Keeping one copy is the point: the previous single-function design had this
// logic inline, and the moment a second entry point appeared it would have been
// copy-pasted and drifted.

// deno-lint-ignore-file no-explicit-any

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

// --------------------------------------------------------------------------
// Tunables
//
// Every one of these is an env override with a conservative default, so the
// reliability/throughput trade can be changed without a code deploy. The old
// design hardcoded its budgets, which is why correcting them meant editing and
// redeploying the function three times in one week.
// --------------------------------------------------------------------------

function envInt(name: string, fallback: number): number {
  const v = Number(Deno.env.get(name))
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback
}

// The most a single job may collect. This is now a job-level bound rather than
// a wall-clock one: the work is spread over as many slices as it needs, so this
// governs cost and quota, not survival.
export const MAX_LEADS_PER_RUN = envInt('MAX_LEADS_PER_RUN', 50)

// One slice must finish comfortably inside the platform's wall clock. 45s
// against a ceiling that killed ~120s runs leaves a wide margin, and a slice
// that runs out simply hands over to the next one.
export const SLICE_BUDGET_MS = envInt('SLICE_BUDGET_MS', 45_000)

// Ceiling on the self-invoking chain. At the default slice budget this allows a
// job roughly 45 minutes before it is declared stuck — far longer than any
// healthy run, and the only thing standing between a bug and an infinite loop.
export const MAX_ATTEMPTS = envInt('MAX_ATTEMPTS', 60)

// Leads scored per Gemini call. The reply is four short fields per lead, so 25
// is nowhere near a truncation risk, and round trips (not payload) are what
// cost time.
export const SCORING_CHUNK = envInt('SCORING_CHUNK', 25)

// Rows per insert. Small enough that a unique-violation fallback re-inserts
// only a handful of rows one at a time.
export const INSERT_CHUNK = envInt('INSERT_CHUNK', 25)

// Any single upstream call. Without this a hung provider socket silently eats
// the entire slice budget.
export const REQUEST_TIMEOUT_MS = envInt('REQUEST_TIMEOUT_MS', 25_000)

export const APIFY_POLL_MS = envInt('APIFY_POLL_MS', 5_000)

// Attempts per Gemini model before falling through to the next one.
export const RETRY_BACKOFF_MS = [0, 2_000, 5_000]

// Gap between chunks. With no gap a free-tier key 429s from the second chunk
// onward, which is what once produced whole runs of identically-scored leads.
export const INTER_CHUNK_MS = envInt('INTER_CHUNK_MS', 1_500)

// How long a job may keep retrying scoring before it settles for `partial`.
// Gemini's free tier rate-limits per minute and back-to-back jobs hit it
// routinely, so the first failure is usually not the final answer. Measured
// against the job's own start time, not the slice's.
export const SCORING_GIVE_UP_MS = envInt('SCORING_GIVE_UP_MS', 360_000)

// Pause before handing scoring to the next slice after a rate limit, so the
// retry lands in a fresh quota window instead of immediately re-triggering it.
export const SCORING_RETRY_GAP_MS = envInt('SCORING_RETRY_GAP_MS', 15_000)

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// A provider that never answers must not be allowed to consume the slice.
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
}

// --------------------------------------------------------------------------
// Industry vocabulary
// --------------------------------------------------------------------------

export const INDUSTRY_SEARCH_MAP: Record<string, string> = {
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

export function industryKey(v: string) {
  return (v || '').toLowerCase().replace(/[^a-z0-9]+/g, '')
}

// Gemini returns the industry as free text, so "Real estate" and "Real Estate"
// used to land as separate tags and the dashboard filter matched neither.
// Squash to alphanumerics and map back to the canonical label. Mirrors
// public.normalise_industry() in the database.
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

// An unrecognised label is kept (trimmed) rather than dropped — losing a tag we
// do not know about is worse than showing an untidy one.
export function normaliseIndustry(v: string, fallback: string): string {
  return INDUSTRY_BY_KEY.get(industryKey(v)) || (v || '').trim() || fallback
}

// --------------------------------------------------------------------------
// Identity
// --------------------------------------------------------------------------

// Mirrors the generated dedup_key column on leads.
export function dedupKey(name: unknown, city: unknown) {
  const squash = (v: unknown) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '')
  return `${squash(name)}|${squash(city)}`
}

export function normalisePhone(v: unknown) {
  const digits = String(v ?? '').replace(/\D/g, '')
  // Compare on the last 10 digits so +91-80-1234 5678 and 08012345678 match.
  return digits.length > 10 ? digits.slice(-10) : digits
}

// The registrable host, lowercased, without www. Used as an identity of last
// resort before falling back to the display name: two listings for the same
// business under different trading names usually still share a website.
export function domainOf(website: unknown): string {
  const raw = String(website ?? '').trim()
  if (!raw) return ''
  try {
    const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
    return u.hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

// --------------------------------------------------------------------------
// Structured logging
//
// Best-effort by design: monitoring must never be the reason a scrape fails, so
// a failed write here is logged to stdout and swallowed. Never pass a secret —
// `detail` is serialised verbatim into a table the account owner can read.
// --------------------------------------------------------------------------

export async function logEvent(
  db: any,
  entry: {
    source: string
    stage?: string
    message: string
    detail?: unknown
    user_id?: string | null
    scrape_run_id?: string | null
  },
) {
  // stdout first, so the record survives even if the insert fails.
  console.log(JSON.stringify({
    src: entry.source,
    stage: entry.stage ?? null,
    run: entry.scrape_run_id ?? null,
    msg: entry.message,
    ...(entry.detail ? { detail: entry.detail } : {}),
  }))
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

// --------------------------------------------------------------------------
// Gemini scoring
// --------------------------------------------------------------------------

// Free-tier keys rate-limit aggressively (429) and Gemini intermittently 5xxs.
// Both are transient and earn a retry. A 400/403 means a malformed request or a
// bad key and will never succeed, so it drops straight to the fallback model
// instead of burning the backoff budget waiting.
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504])

export const MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite']

export function buildScoringPrompt(leads: Record<string, unknown>[]) {
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
// whether a retry is worth the remaining budget.
async function requestScores(
  model: string,
  prompt: string,
  geminiKey: string,
): Promise<{ arr: Record<string, unknown>[] | null; retryable: boolean; reason: string }> {
  let res: Response
  try {
    res = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      },
    )
  } catch (e) {
    // Includes the AbortError from a timeout, which is squarely retryable.
    console.error('Gemini network error', model, String(e))
    return { arr: null, retryable: true, reason: `${model}: network error` }
  }

  if (!res.ok) {
    const errText = await res.text()
    console.error('Gemini error', model, res.status, errText.substring(0, 300))
    // The status is the whole diagnosis: 429 clears by itself, 400/403 never
    // will. Carrying it up is what lets the worker decide whether to wait.
    const label = res.status === 429 ? 'rate limited (429)'
      : res.status === 403 ? 'rejected the key (403)'
      : res.status === 400 ? 'rejected the request (400)'
      : `HTTP ${res.status}`
    return { arr: null, retryable: RETRYABLE_STATUS.has(res.status), reason: `${model}: ${label}` }
  }

  const body = await res.json()
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text || ''
  try {
    const parsed = JSON.parse(text)
    const arr = Array.isArray(parsed) ? parsed : (parsed.leads || parsed.results || null)
    // A truncated or oddly-shaped reply is usually transient — worth one more go.
    return {
      arr: Array.isArray(arr) ? arr : null,
      retryable: !Array.isArray(arr),
      reason: `${model}: unexpected response shape`,
    }
  } catch (e) {
    console.error('Gemini parse failed', model, String(e))
    return { arr: null, retryable: true, reason: `${model}: unparseable response` }
  }
}

// Returns null if the model skipped any lead or gave it an unusable score.
// Partial results are rejected rather than backfilled with a default, which is
// what the old flat-40 behaviour amounted to.
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

// Walks primary model → fallback model, retrying each with exponential backoff.
//
// Reports why it gave up rather than just failing. The distinction matters to
// the caller: a rate limit clears on its own and is worth another slice, while a
// bad key never will and should stop the job wasting time on it.
//
// Never throws. This is the substantive change from the old engine: a chunk that
// could not be scored used to abort the whole run and discard every lead already
// scraped. Now the caller keeps those leads — the score column is nullable and
// the UI renders an honest "Unscored" badge — and the job ends `partial`.
export async function scoreChunk(
  leads: Record<string, unknown>[],
  geminiKey: string,
  industry: string,
  deadline: number,
): Promise<{ scored: Record<string, unknown>[] | null; reason: string; transient: boolean }> {
  const prompt = buildScoringPrompt(leads)
  let reason = 'Gemini returned no usable response.'
  let transient = true

  for (const model of MODELS) {
    for (let attempt = 0; attempt < RETRY_BACKOFF_MS.length; attempt++) {
      if (Date.now() > deadline) {
        return { scored: null, reason: 'slice budget spent before scoring completed', transient: true }
      }
      if (RETRY_BACKOFF_MS[attempt]) await sleep(RETRY_BACKOFF_MS[attempt])

      const r = await requestScores(model, prompt, geminiKey)

      if (r.arr) {
        const merged = mergeScores(leads, r.arr, industry)
        if (merged) return { scored: merged, reason: '', transient: false }
        reason = `${model} returned an incomplete batch`
        continue
      }

      reason = r.reason || `${model} failed`
      transient = r.retryable
      // Nothing a retry can fix; give the fallback model its turn instead.
      if (!r.retryable) break
    }
  }

  return { scored: null, reason, transient }
}

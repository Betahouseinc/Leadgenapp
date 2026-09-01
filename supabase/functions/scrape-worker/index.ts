// Advances one lead-generation job by one short slice, then hands over to the
// next slice by invoking itself.
//
// Why this exists: the whole pipeline used to run inside a single HTTP request.
// The platform kills a worker that outlives its wall clock, and a killed worker
// never reaches its catch block — no error logged, the job stranded in
// 'running', every scraped lead lost. See LEADGENAI_STABILITY_AUDIT.md.
//
// A slice is bounded by SLICE_BUDGET_MS, well under any platform ceiling, and
// every stage persists its work before the next begins:
//
//   discovering → saving → scoring → finalising
//
// So a slice that dies costs at most that slice. Companies are saved before
// scoring starts, which is what makes "37 of 50 succeeded, #38 failed, keep the
// 37" true rather than aspirational.
//
// Authenticated by CRON_SECRET only. It is never called by a browser.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  corsHeaders, json, logEvent, fetchWithTimeout, sleep,
  dedupKey, normalisePhone, domainOf, scoreChunk,
  SLICE_BUDGET_MS, MAX_ATTEMPTS, SCORING_CHUNK, INSERT_CHUNK,
  INTER_CHUNK_MS, SCORING_GIVE_UP_MS, SCORING_RETRY_GAP_MS,
  INDUSTRY_SEARCH_MAP, MAX_LEADS_PER_RUN,
} from '../_shared/pipeline.ts'

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined

// deno-lint-ignore-file no-explicit-any
type Row = Record<string, any>

const TERMINAL_JOB = ['completed', 'partial', 'failed', 'cancelled']

// Google Places API (New), Text Search. The field mask decides both what comes
// back and which SKU the call is billed against; this set sits in the tier that
// carries 5,000 free calls a month, which at 20 places per call is far more than
// this product consumes.
const PLACES_ENDPOINT = 'https://places.googleapis.com/v1/places:searchText'
const PLACES_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'nextPageToken',
].join(',')

// Text Search returns at most 20 places per page over at most 3 pages, so 60 is
// the hard ceiling for a single query. MAX_LEADS_PER_RUN is 50, inside it.
const PLACES_PAGE_SIZE = 20
const PLACES_MAX_PAGES = 3

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const cronSecret = Deno.env.get('CRON_SECRET') || ''
  const presented = req.headers.get('x-cron-secret') || ''
  // An unset secret must never degrade to "no auth required".
  if (!cronSecret || presented !== cronSecret) return json({ error: 'forbidden' }, 403)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const placesKey = Deno.env.get('GOOGLE_PLACES_API_KEY') || ''
  const geminiKey = Deno.env.get('GEMINI_API_KEY') || ''
  const db = createClient(supabaseUrl, serviceKey)

  const sliceDeadline = Date.now() + SLICE_BUDGET_MS
  const budgetLeft = () => sliceDeadline - Date.now()

  let runId: string | null = null

  try {
    const body = await req.json()
    runId = body.run_id as string
    if (!runId) return json({ error: 'run_id required' }, 400)

    const { data: run, error: loadErr } = await db
      .from('scrape_runs').select('*').eq('id', runId).single()

    if (loadErr || !run) return json({ error: 'job not found' }, 404)
    if (TERMINAL_JOB.includes(run.status)) return json({ done: true, status: run.status })

    // The only thing standing between a bug and an infinite self-invoking chain.
    if ((run.attempts ?? 0) >= MAX_ATTEMPTS) {
      await finish(db, run, 'failed', 'This search took too long and was stopped. Any leads already saved were kept.')
      await logEvent(db, {
        source: 'scrape-worker', stage: 'guard',
        message: `Job exceeded ${MAX_ATTEMPTS} slices and was stopped`,
        user_id: run.user_id, scrape_run_id: runId,
      })
      return json({ done: true, status: 'failed', reason: 'max_attempts' })
    }

    // Heartbeat first. A job whose chain breaks is indistinguishable from one
    // still working unless it says so on every slice; this is what
    // reap_stalled_scrape_runs() reads.
    await db.from('scrape_runs').update({
      attempts: (run.attempts ?? 0) + 1,
      heartbeat_at: new Date().toISOString(),
      status: 'running',
    }).eq('id', runId)

    let stage: string = run.stage || 'discovering'
    let done = false

    // Run as many stages as the budget allows, rather than one per invocation —
    // a re-invoke costs a round trip, and scoring 50 leads is two chunks that
    // comfortably share one slice.
    while (!done && budgetLeft() > 5_000) {
      if (stage === 'discovering') {
        // Places answers in about a second, so discovery and saving are one
        // step now rather than a poll loop feeding a separate stage. Repeating
        // it is safe: the dedup pass treats a second sighting as a refresh.
        const found = await discoverPlaces(db, run, placesKey)
        await saveDiscovered(db, run, found)
        stage = 'scoring'
        await db.from('scrape_runs').update({ stage }).eq('id', runId)

      } else if (stage === 'saving') {
        // Only reachable for a job queued before the Places switch, whose rows
        // were already written by the old saving stage. Nothing left to do.
        stage = 'scoring'
        await db.from('scrape_runs').update({ stage }).eq('id', runId)

      } else if (stage === 'scoring') {
        const more = await scoreSome(db, run, geminiKey, sliceDeadline)
        if (more === 'exhausted_budget') break              // hand over mid-scoring
        if (more === 'none_left') {
          stage = 'finalising'
          await db.from('scrape_runs').update({ stage }).eq('id', runId)
        }

      } else if (stage === 'finalising') {
        await finalise(db, run)
        done = true

      } else {
        // An unrecognised stage would otherwise spin the loop until the budget
        // ran out, every slice, until MAX_ATTEMPTS.
        await finish(db, run, 'failed', `Unknown job stage "${stage}".`)
        done = true
      }
    }

    // Not finished and budget spent: chain to the next slice.
    if (!done) {
      const next = fetchWithTimeout(`${supabaseUrl}/functions/v1/scrape-worker`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-secret': cronSecret,
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ run_id: runId }),
      }, 10_000).catch(e => console.error('slice handover failed', String(e)))

      if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(next)
      else await next
    }

    return json({ ok: true, run_id: runId, stage, done })

  } catch (err) {
    console.error('scrape-worker error:', err)
    if (runId) {
      // Mark failed rather than leaving it to the reaper: the leads already
      // saved stay exactly where they are, and the customer gets an answer now.
      await db.from('scrape_runs').update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        error_message: (err as Error).message,
      }).eq('id', runId)
      await logEvent(db, {
        source: 'scrape-worker', stage: 'slice',
        message: (err as Error).message,
        detail: { stack: (err as Error).stack?.slice(0, 1000) },
        scrape_run_id: runId,
      })
    }
    return json({ error: (err as Error).message }, 500)
  }
})

// ---------------------------------------------------------------------------
// Stage: discovering — wait on the Apify run a previous slice started
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Stage: discovering - Google Places API (New), Text Search
// ---------------------------------------------------------------------------
//
// This replaces the Apify actor that used to run this stage. Two things change,
// and both suit a product this size: Places answers in about a second rather
// than minutes, so there is no run to poll and no hand-off between slices, and
// the free monthly call allowance is far larger than this product's usage.
//
// The cost is email harvesting. Apify visited each business's website to scrape
// contacts; Places does not, so leads now arrive with phone, website, address
// and rating, and no email.

async function discoverPlaces(db: any, run: Row, placesKey: string): Promise<Row[]> {
  const searchTerm = INDUSTRY_SEARCH_MAP[run.industry] || run.industry
  const wanted = Math.max(1, Math.min(run.limit_requested || 50, MAX_LEADS_PER_RUN))

  const collected: Row[] = []
  let pageToken: string | undefined
  let pages = 0

  // Every field except pageToken must match the first request on a paged call,
  // so the page size is fixed for the whole walk and the tail is trimmed after.
  const pageSize = Math.min(PLACES_PAGE_SIZE, wanted)

  while (collected.length < wanted && pages < PLACES_MAX_PAGES) {
    const body: Record<string, unknown> = {
      // Location goes in the query rather than a bias box: a text query naming
      // the city is what Places is tuned for, and it needs no coordinates.
      textQuery: `${searchTerm} in ${run.city}, India`,
      pageSize,
      languageCode: 'en',
      regionCode: 'IN',
    }
    if (pageToken) body.pageToken = pageToken

    const res = await fetchWithTimeout(PLACES_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': placesKey,
        'X-Goog-FieldMask': PLACES_FIELD_MASK,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300)
      await logEvent(db, {
        source: 'scrape-worker', stage: 'discovering',
        message: `Places search failed: HTTP ${res.status}`,
        detail: { body: detail, page: pages + 1 },
        user_id: run.user_id, scrape_run_id: run.id,
      })
      // A first page that fails leaves nothing to save. A later one still has
      // the pages before it, so keep those rather than lose the run to one bad
      // page.
      if (collected.length === 0) {
        throw new Error('Could not reach the lead source. Please try again shortly.')
      }
      break
    }

    const payload = await res.json()
    const places: Row[] = Array.isArray(payload.places) ? payload.places : []
    collected.push(...places)
    pages++

    pageToken = payload.nextPageToken || undefined
    if (!pageToken || places.length === 0) break
  }

  return collected.slice(0, wanted).map(p => ({
    place_id:     (p.id as string) || '',
    name:         ((p.displayName as Row)?.text as string) || '',
    // Places reports what Google holds about a business and never visits its
    // website, so there is no email to take. Kept as '' because the dedup and
    // refresh passes both read this field and must behave as they always did.
    email:        '',
    phone:        (p.nationalPhoneNumber as string) || '',
    website:      (p.websiteUri as string) || '',
    address:      (p.formattedAddress as string) || '',
    rating:       (p.rating as number) ?? null,
    review_count: (p.userRatingCount as number) ?? null,
    city:         run.city,
    industry:     run.industry,
    source:       'gmaps',
    status:       'new',
    user_id:      run.user_id,
    scrape_run_id: run.id,
  })).filter(l => l.name)
}

// ---------------------------------------------------------------------------
// Stage: saving — persist companies BEFORE any scoring happens
// ---------------------------------------------------------------------------

async function saveDiscovered(db: any, run: Row, mapped: Row[]) {

  // --- Pass 1: within this run -------------------------------------------
  // One source paginating routinely returns the same business twice. Prefer the
  // provider's own id; fall back to name+city only when it is absent.
  const seen = new Set<string>()
  const withinRun = mapped.filter(l => {
    const key = l.place_id ? `p:${l.place_id}` : `n:${dedupKey(l.name, l.city)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // --- Pass 2: against what this user already holds -----------------------
  // Matched businesses are not dropped: their scraped fields are refreshed and
  // they are reported back as "already in your list".
  const inList = (col: string, vals: string[]) =>
    vals.length ? `${col}.in.(${[...new Set(vals)].map(v => JSON.stringify(v)).join(',')})` : null

  const placeIds = withinRun.map(l => l.place_id).filter(Boolean)
  const keys = withinRun.map(l => dedupKey(l.name, l.city))
  const phones = withinRun.map(l => normalisePhone(l.phone)).filter(p => p.length >= 10)
  const emails = withinRun.map(l => l.email.toLowerCase().trim()).filter(Boolean)

  let held: Row[] = []
  const { data: existing, error: existErr } = await db
    .from('leads')
    .select('id, name, city, place_id, dedup_key, phone_key, email, phone, website, address, rating, review_count')
    .eq('user_id', run.user_id)
    .or([
      inList('place_id', placeIds),
      inList('dedup_key', keys),
      inList('phone_key', phones),
      inList('email', emails),
    ].filter(Boolean).join(','))

  if (existErr) {
    // Fail open. A dedup lookup that errors must not take the scrape down with
    // it — the unique indexes are the real backstop.
    console.error('Dedup lookup failed, continuing without it:', existErr.message)
    await logEvent(db, {
      source: 'scrape-worker', stage: 'dedup',
      message: `Dedup lookup failed, continued without it: ${existErr.message}`,
      user_id: run.user_id, scrape_run_id: run.id,
    })
  } else {
    held = existing || []
  }

  const byPlace = new Map<string, Row>()
  const byKey = new Map<string, Row>()
  const byPhone = new Map<string, Row>()
  const byEmail = new Map<string, Row>()
  const byDomain = new Map<string, Row>()
  for (const r of held) {
    if (r.place_id) byPlace.set(String(r.place_id), r)
    if (r.dedup_key) byKey.set(String(r.dedup_key), r)
    const p = String(r.phone_key ?? '')
    if (p.length >= 10) byPhone.set(p, r)
    const e = String(r.email ?? '').toLowerCase().trim()
    if (e) byEmail.set(e, r)
    const d = domainOf(r.website)
    if (d) byDomain.set(d, r)
  }

  const fresh: Row[] = []
  const dupes: { lead: Row; held: Row }[] = []
  for (const l of withinRun) {
    const phone = normalisePhone(l.phone)
    const email = l.email.toLowerCase().trim()
    const domain = domainOf(l.website)
    const hit =
      (l.place_id ? byPlace.get(l.place_id) : undefined) ||
      byKey.get(dedupKey(l.name, l.city)) ||
      (phone.length >= 10 ? byPhone.get(phone) : undefined) ||
      (email ? byEmail.get(email) : undefined) ||
      (domain ? byDomain.get(domain) : undefined)
    if (hit) dupes.push({ lead: l, held: hit })
    else fresh.push(l)
  }

  // --- Refresh the ones already held, in place ----------------------------
  // Only fields straight off the scrape, and only where the scrape actually has
  // a value: a run that returns no phone must not blank the phone on file.
  // score and summary are left alone — re-scoring a lead nobody is billed for
  // spends Gemini quota for nothing.
  let updated = 0
  if (dupes.length > 0) {
    const pick = (f: unknown, h: unknown) => {
      const v = typeof f === 'string' ? f.trim() : f
      return v === '' || v === null || v === undefined ? (h ?? null) : v
    }
    // One fixed column set on purpose: PostgREST unions the keys of a bulk
    // payload, so a row missing a key writes NULL over a stored value.
    const refresh = dupes.map(({ lead, held: h }) => ({
      id: h.id,
      user_id: run.user_id,
      name: h.name,
      city: h.city,
      place_id: pick(lead.place_id, h.place_id),
      phone: pick(lead.phone, h.phone),
      email: pick(lead.email, h.email),
      website: pick(lead.website, h.website),
      address: pick(lead.address, h.address),
      rating: pick(lead.rating, h.rating),
      review_count: pick(lead.review_count, h.review_count),
      last_scraped_at: new Date().toISOString(),
    }))
    const { error: refreshErr } = await db.from('leads').upsert(refresh, { onConflict: 'id' })
    if (refreshErr) {
      console.error('Duplicate refresh failed, continuing:', refreshErr.message)
      await logEvent(db, {
        source: 'scrape-worker', stage: 'refresh',
        message: `Duplicate refresh failed, continued without it: ${refreshErr.message}`,
        user_id: run.user_id, scrape_run_id: run.id,
      })
    } else {
      updated = refresh.length
    }
  }

  // --- Insert the new ones, unscored --------------------------------------
  // This is the change that makes partial success real: the companies land in
  // the customer's list now, and scoring fills in afterwards. A job that dies
  // during scoring leaves real leads behind instead of nothing.
  let inserted = 0
  let failed = 0
  for (let i = 0; i < fresh.length; i += INSERT_CHUNK) {
    const chunk = fresh.slice(i, i + INSERT_CHUNK).map(l => ({
      user_id: run.user_id,
      place_id: l.place_id || null,
      name: l.name,
      city: l.city,
      industry: l.industry,
      source: l.source,
      status: 'new',
      email: l.email || null,
      phone: l.phone || null,
      website: l.website || null,
      address: l.address || null,
      rating: l.rating,
      review_count: l.review_count,
      score: null,             // honest: not scored yet. ScoreBar renders "Unscored".
      summary: '',
      scrape_run_id: run.id,
    }))

    const { data: ok, error } = await db
      .from('leads').upsert(chunk, { onConflict: 'user_id,dedup_key' }).select('id')

    if (!error) {
      inserted += ok?.length || 0
      continue
    }

    // A unique violation here is a race with a concurrent run on place_id, which
    // the bulk upsert cannot resolve because it can only name one conflict
    // target. Retry the chunk row by row so one collision costs one lead rather
    // than the whole batch — which is exactly how the old engine lost runs.
    console.warn('Bulk insert failed, retrying row by row:', error.message)
    for (const row of chunk) {
      const { data: one, error: rowErr } = await db
        .from('leads').upsert(row, { onConflict: 'user_id,dedup_key' }).select('id')
      if (rowErr) failed++
      else inserted += one?.length || 0
    }
  }

  // Charge quota for what actually landed, at the moment it lands. A job that
  // dies later has already given the customer these leads.
  if (inserted > 0) {
    await db.rpc('increment_leads_used', { user_id: run.user_id, amount: inserted })
  }

  // Real measurement, not an estimate: how many saved leads carry a reachable
  // contact. This is the number the contact-enrichment A/B is decided on.
  const withContact = fresh.filter(l => l.email || l.phone).length

  await db.from('scrape_runs').update({
    discovered_count: withinRun.length,
    enriched_count: withContact,
    duplicate_count: dupes.length,
    failed_count: failed,
    leads_found: withinRun.length,   // kept in step for the existing history UI
    leads_saved: inserted,
    heartbeat_at: new Date().toISOString(),
  }).eq('id', run.id)

  await logEvent(db, {
    source: 'scrape-worker', stage: 'saving',
    message: `Saved ${inserted} new, refreshed ${updated} held, ${failed} failed`,
    detail: {
      returned: mapped.length, unique_in_run: withinRun.length,
      with_contact: withContact, enrich_contacts: run.enrich_contacts,
    },
    user_id: run.user_id, scrape_run_id: run.id,
  })
}

// ---------------------------------------------------------------------------
// Stage: scoring — one Gemini chunk at a time, each persisted on its own
// ---------------------------------------------------------------------------

async function scoreSome(
  db: any, run: Row, geminiKey: string, sliceDeadline: number,
): Promise<'more' | 'none_left' | 'exhausted_budget'> {
  const { data: pending, error } = await db
    .from('leads')
    .select('id, name, website, phone, address, rating, review_count')
    .eq('scrape_run_id', run.id)
    .is('score', null)
    .limit(SCORING_CHUNK)

  if (error) throw new Error(`Could not load leads to score: ${error.message}`)
  if (!pending || pending.length === 0) return 'none_left'

  // Leave enough budget to actually write the results away.
  if (sliceDeadline - Date.now() < 12_000) return 'exhausted_budget'

  const { scored, reason, transient } = await scoreChunk(
    pending, geminiKey, run.industry, sliceDeadline - 5_000,
  )

  if (!scored) {
    // The free Gemini tier rate-limits per minute, and back-to-back jobs hit it
    // routinely. That clears on its own, so the honest response is to wait and
    // try again on a later slice rather than abandoning the scoring — the leads
    // are already saved either way, but a lead with a score is worth far more.
    //
    // Bounded by how long the whole job has been alive: past the ceiling, stop
    // retrying and finish `partial` so the customer gets an answer.
    const startedAt = run.started_at ? new Date(run.started_at).getTime() : Date.now()
    const aliveMs = Date.now() - startedAt
    const keepTrying = transient && aliveMs < SCORING_GIVE_UP_MS

    await logEvent(db, {
      source: 'scrape-worker', stage: 'scoring',
      message: keepTrying
        ? `Scoring deferred to a later slice — ${reason}`
        : `Gemini could not score a chunk of ${pending.length}; leads kept unscored — ${reason}`,
      detail: { reason, transient, alive_seconds: Math.round(aliveMs / 1000) },
      user_id: run.user_id, scrape_run_id: run.id,
    })

    await db.from('scrape_runs').update({ heartbeat_at: new Date().toISOString() }).eq('id', run.id)

    if (keepTrying) {
      // Hand over. The next slice is a fresh invocation a few seconds later,
      // which is usually all a per-minute limit needs.
      await sleep(SCORING_RETRY_GAP_MS)
      return 'exhausted_budget'
    }

    // Give up on scoring and keep the leads. The count of what went unscored is
    // computed in finalise() from the rows themselves — `pending` is only this
    // chunk, so using it here would under-report a run with several left.
    return 'none_left'
  }

  // Persist this chunk before asking for the next one.
  let written = 0
  for (const l of scored) {
    const { error: upErr } = await db.from('leads')
      .update({ score: l.score, summary: l.summary, industry: l.industry })
      .eq('id', l.id)
    if (!upErr) written++
  }

  await db.from('scrape_runs').update({
    scored_count: (run.scored_count ?? 0) + written,
    heartbeat_at: new Date().toISOString(),
  }).eq('id', run.id)
  run.scored_count = (run.scored_count ?? 0) + written

  await sleep(INTER_CHUNK_MS)   // keeps a free-tier key under its per-minute ceiling
  return 'more'
}

// ---------------------------------------------------------------------------
// Stage: finalising
// ---------------------------------------------------------------------------

async function finalise(db: any, run: Row) {
  const { data: fresh } = await db
    .from('scrape_runs')
    .select('discovered_count, scored_count, leads_saved')
    .eq('id', run.id).single()

  const saved = fresh?.leads_saved ?? 0
  const scored = fresh?.scored_count ?? 0

  // Count what is actually still unscored rather than trusting a running total.
  // This is the number shown to the customer, so it should come from the rows.
  const { count: unscored } = await db
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('scrape_run_id', run.id)
    .is('score', null)

  // `partial` is a real outcome, not a failure: leads were saved but some could
  // not be scored. Saying so is the point — the customer can see exactly what
  // they got and re-run to fill the gaps.
  const status = saved === 0 ? 'completed' : ((unscored ?? 0) > 0 ? 'partial' : 'completed')

  await db.from('scrape_runs').update({
    status,
    stage: 'done',
    failed_count: unscored ?? 0,
    finished_at: new Date().toISOString(),
    heartbeat_at: new Date().toISOString(),
  }).eq('id', run.id)

  await logEvent(db, {
    source: 'scrape-worker', stage: 'finalising',
    message: `Job ${status}: ${saved} saved, ${scored} scored, ${unscored ?? 0} unscored`,
    detail: { attempts: run.attempts, discovered: fresh?.discovered_count },
    user_id: run.user_id, scrape_run_id: run.id,
  })
}

async function finish(db: any, run: Row, status: string, message: string) {
  await db.from('scrape_runs').update({
    status,
    stage: 'done',
    finished_at: new Date().toISOString(),
    error_message: message,
  }).eq('id', run.id)
}

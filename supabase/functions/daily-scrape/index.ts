// Nightly job: re-runs each user's recent searches, then leaves a summary for a
// notifier to pick up.
//
// There is no separate list of searches to maintain — every scrape already
// writes a scrape_runs row, and the recent_searches view collapses that history
// into distinct industry+city pairs ordered by when they last ran.
//
// Deliberately thin. It does not scrape, score or dedup itself — it calls
// scrape-leads, which already does all three, enforces quota, and hands the
// actual work to scrape-worker in slices. Duplicating that logic here is how the
// two paths drift apart.
//
// Triggered by pg_cron via trigger_daily_scrape(), every 15 minutes across a
// two-hour window. Each tick works through whatever tonight's queue still holds
// until its time budget runs out, records what it did in daily_runs, and stops.
// The tick that finds the queue empty writes the daily summaries. That is what
// keeps the job inside the platform's wall clock however many users there are:
// a single invocation looping over everyone would eventually be killed mid-run
// with nothing recorded.
//
// Authenticated by a shared secret, never by a user JWT.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { fetchWithTimeout } from '../_shared/pipeline.ts'

const HIGH_SCORE = 70

// Only searches the user has actually touched recently. Without this the job
// would keep re-running a city someone tried once months ago.
const RECENT_WINDOW_DAYS = 30

// Per user, per night. Quota already caps spend, but this also keeps one heavy
// user from monopolising the run.
const MAX_SEARCHES_PER_USER = 3

// Searches start one at a time. Firing them together would put several
// concurrent Apify runs and Gemini batches in flight, which is what rate-limits
// the free tier and produced unscored leads in the first place.
const GAP_BETWEEN_SEARCHES_MS = 5000

// "Tonight". Long enough to span the whole schedule window, short enough that
// yesterday's run never counts. A search the user ran by hand during the day
// also counts as done — it does not need repeating a few hours later.
const NIGHT_WINDOW_MS = 20 * 60 * 60 * 1000

// Stop starting new searches after this, leaving the rest for the next tick.
// The platform limit is 150s on the free plan; this leaves room for the last
// search's request and the final write.
const RUN_BUDGET_MS = Number(Deno.env.get('DAILY_RUN_BUDGET_MS') || 100_000)

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

type Search = { user_id: string; industry: string; city: string; country?: string; last_run_at: string; last_limit: number }
type Result = { user_id: string; industry: string; city: string; country?: string; status: 'ok' | 'quota' | 'failed'; saved?: number }

// Country is part of the identity — Melbourne AU and Melbourne US are different
// searches. Results recorded before international support carry none: India.
const keyOf = (s: { user_id: string; industry: string; city: string; country?: string }) =>
  `${s.user_id}|${s.industry.toLowerCase()}|${s.city.toLowerCase()}|${(s.country || 'IN').toUpperCase()}`

const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  const startedAt = Date.now()
  const cronSecret = Deno.env.get('CRON_SECRET') || ''
  const presented = req.headers.get('x-cron-secret') || ''

  // No secret configured means the endpoint is open — refuse rather than run.
  if (!cronSecret || presented !== cronSecret) return respond({ error: 'forbidden' }, 403)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const db = createClient(supabaseUrl, serviceKey)

  const log = async (stage: string, message: string, detail?: unknown, userId?: string | null) => {
    try {
      await db.from('error_log').insert({
        source: 'daily-scrape', stage, message: message.slice(0, 2000),
        detail: detail ? JSON.parse(JSON.stringify(detail)) : null,
        user_id: userId ?? null,
      })
    } catch (e) {
      console.error('error_log write failed', String(e))
    }
  }

  // A previous tick killed by the platform leaves its row in 'running'.
  await db.rpc('reap_stalled_daily_runs', { p_stale_minutes: 10 })

  const nightStart = new Date(Date.now() - NIGHT_WINDOW_MS).toISOString()
  const since = new Date(Date.now() - RECENT_WINDOW_DAYS * 86400000).toISOString()

  const [{ data: history, error: loadErr }, { data: priorRuns, error: runsErr }] = await Promise.all([
    db.from('recent_searches').select('*').gte('last_run_at', since).order('last_run_at', { ascending: false }),
    db.from('daily_runs').select('results').gte('started_at', nightStart),
  ])

  if (loadErr || runsErr) {
    const message = (loadErr || runsErr)!.message
    await log('load', `Could not load tonight's queue: ${message}`)
    return respond({ error: message }, 500)
  }

  // Each user's most recent few, chosen from the full history BEFORE filtering
  // out what already ran. Filtering first would promote the user's fourth and
  // fifth searches into the slots the first three just vacated.
  const perUser = new Map<string, Search[]>()
  for (const row of (history || []) as Search[]) {
    const list = perUser.get(row.user_id) || []
    if (list.length < MAX_SEARCHES_PER_USER) {
      list.push(row)
      perUser.set(row.user_id, list)
    }
  }

  // Already attempted tonight by an earlier tick. Needed on top of last_run_at
  // because a quota rejection or an early failure never writes a scrape_runs
  // row, so without this those searches would be retried on every tick.
  const attempted = new Set<string>()
  for (const r of priorRuns || []) {
    for (const res of (r.results as Result[]) || []) attempted.add(keyOf(res))
  }

  const pending = [...perUser.values()].flat().filter(s =>
    !attempted.has(keyOf(s)) && new Date(s.last_run_at).getTime() < Date.now() - NIGHT_WINDOW_MS
  )

  // --- Queue empty: write tonight's summaries, once ------------------------
  if (pending.length === 0) {
    const summaries = await writeSummaries(db, [...perUser.keys()], nightStart, log)
    return respond({ ran: 0, summaries })
  }

  // --- Work the queue within the budget ------------------------------------
  const { data: run, error: runErr } = await db
    .from('daily_runs')
    .insert({ status: 'running', searches_total: pending.length })
    .select('id')
    .single()

  if (runErr || !run) {
    await log('start', `Could not record the run: ${runErr?.message}`)
    return respond({ error: runErr?.message || 'could not start run' }, 500)
  }

  const results: Result[] = []
  const counts = { ok: 0, quota: 0, failed: 0 }

  // Written after every search, so a tick killed part-way still shows what it
  // got through — and the next tick does not repeat those searches.
  const persist = (extra: Record<string, unknown> = {}) =>
    db.from('daily_runs').update({
      heartbeat_at: new Date().toISOString(),
      results,
      searches_ok: counts.ok,
      searches_quota: counts.quota,
      searches_failed: counts.failed,
      ...extra,
    }).eq('id', run.id)

  try {
    for (const s of pending) {
      if (Date.now() - startedAt > RUN_BUDGET_MS) break

      let result: Result
      try {
        const res = await fetchWithTimeout(`${supabaseUrl}/functions/v1/scrape-leads`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-cron-secret': cronSecret,
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            user_id: s.user_id,
            industry: s.industry,
            city: s.city,
            country: s.country || 'IN',
            sources: ['gmaps'],
            // Reuse the size the user last asked for, bounded so an old 200-lead
            // request does not silently become a nightly 200-lead request.
            //
            // The bound must not exceed MAX_LEADS_PER_RUN in scrape-leads, which
            // rejects anything larger with a 400. Keep in step.
            limit: Math.min(Number(s.last_limit) || 10, 10),
          }),
        }, 25_000)

        const payload = await res.json().catch(() => ({}))

        // A quota rejection (402) is normal operation, not a fault — the user
        // has simply used their allowance. Recorded, but not logged as an error.
        const status = res.ok ? 'ok' : res.status === 402 ? 'quota' : 'failed'
        if (status === 'failed') {
          await log('scrape', `Scheduled search failed for ${s.industry}/${s.city}: ${payload?.message || payload?.error}`,
            { http_status: res.status, daily_run_id: run.id }, s.user_id)
        }
        result = { user_id: s.user_id, industry: s.industry, city: s.city, country: s.country, status, saved: payload?.saved ?? 0 }
      } catch (e) {
        await log('scrape', `Scheduled search threw for ${s.industry}/${s.city}: ${(e as Error).message}`,
          { daily_run_id: run.id }, s.user_id)
        result = { user_id: s.user_id, industry: s.industry, city: s.city, country: s.country, status: 'failed' }
      }

      results.push(result)
      counts[result.status]++
      await persist()

      await sleep(GAP_BETWEEN_SEARCHES_MS)
    }

    // All attempted searches failing is a fault worth flagging; a mix of ok and
    // failed is still a run that did its job for most users.
    const leftOver = pending.length - results.length
    const status = leftOver > 0
      ? 'partial'
      : results.length > 0 && counts.failed === results.length ? 'failed' : 'completed'

    await persist({ status, finished_at: new Date().toISOString() })
    return respond({ daily_run_id: run.id, status, ran: results.length, left_for_next_tick: leftOver, results })

  } catch (e) {
    const message = (e as Error).message
    await log('run', `Nightly run crashed: ${message}`, { daily_run_id: run.id })
    await persist({ status: 'failed', finished_at: new Date().toISOString(), error_message: message.slice(0, 2000) })
    return respond({ error: message }, 500)
  }
})

// One summary per user per night, written by the first tick that finds the
// queue empty. Later ticks see the row and skip, so the schedule firing eight
// times does not produce eight summaries.
async function writeSummaries(
  // deno-lint-ignore no-explicit-any
  db: any,
  userIds: string[],
  nightStart: string,
  log: (stage: string, message: string, detail?: unknown, userId?: string | null) => Promise<void>,
) {
  if (userIds.length === 0) return []

  const { data: existing } = await db
    .from('daily_summaries')
    .select('user_id')
    .in('user_id', userIds)
    .gte('created_at', nightStart)
  const done = new Set((existing || []).map((r: { user_id: string }) => r.user_id))

  const written: Record<string, unknown>[] = []
  for (const uid of userIds) {
    if (done.has(uid)) continue

    const { data: summary, error } = await db.rpc('daily_lead_summary', { p_user_id: uid, p_min_score: HIGH_SCORE })
    if (error) {
      await log('summary', `Summary failed: ${error.message}`, null, uid)
      continue
    }
    if (!summary) continue

    // Persisted rather than emailed. A notifier picks these up — this job does
    // not send mail, matching the rule that a human approves sends.
    await db.from('daily_summaries').insert({
      user_id: uid,
      new_count: summary.new_count ?? 0,
      high_count: summary.high_count ?? 0,
      payload: summary,
    })
    written.push({ user_id: uid, new_count: summary.new_count, high_count: summary.high_count })
  }
  return written
}

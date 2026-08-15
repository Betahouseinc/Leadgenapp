// Nightly job: re-runs each user's recent searches, then leaves a summary for a
// notifier to pick up.
//
// There is no separate list of searches to maintain — every scrape already
// writes a scrape_runs row, and the recent_searches view collapses that history
// into distinct industry+city pairs ordered by when they last ran.
//
// Deliberately thin. It does not scrape, score or dedup itself — it calls
// scrape-leads, which already does all three and enforces quota. Duplicating
// that logic here is how the two paths drift apart.
//
// Triggered by pg_cron via trigger_daily_scrape(). Authenticated by a shared
// secret, never by a user JWT.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const HIGH_SCORE = 70

// Only searches the user has actually touched recently. Without this the job
// would keep re-running a city someone tried once months ago.
const RECENT_WINDOW_DAYS = 30

// Per user, per night. Quota already caps spend, but this also keeps one heavy
// user from monopolising the run.
const MAX_SEARCHES_PER_USER = 3

// Saved searches run one at a time. Firing them in parallel would put several
// concurrent Apify runs and Gemini batches in flight, which is what rate-limits
// the free tier and produced unscored leads in the first place.
const GAP_BETWEEN_SEARCHES_MS = 5000

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get('CRON_SECRET') || ''
  const presented = req.headers.get('x-cron-secret') || ''

  // No secret configured means the endpoint is open — refuse rather than run.
  if (!cronSecret || presented !== cronSecret) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403, headers: { 'Content-Type': 'application/json' },
    })
  }

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

  const since = new Date(Date.now() - RECENT_WINDOW_DAYS * 86400000).toISOString()

  const { data: history, error: loadErr } = await db
    .from('recent_searches')
    .select('*')
    .gte('last_run_at', since)
    .order('last_run_at', { ascending: false })

  if (loadErr) {
    await log('load', `Could not load recent searches: ${loadErr.message}`)
    return new Response(JSON.stringify({ error: loadErr.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }

  // Already newest-first from the view; take each user's most recent few.
  const perUser = new Map<string, Record<string, unknown>[]>()
  for (const row of history || []) {
    const list = perUser.get(row.user_id) || []
    if (list.length < MAX_SEARCHES_PER_USER) {
      list.push(row)
      perUser.set(row.user_id, list)
    }
  }
  const searches = [...perUser.values()].flat()

  const results: Record<string, unknown>[] = []

  for (const s of searches || []) {
    // One search failing must not stop the rest of the queue.
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/scrape-leads`, {
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
          sources: ['gmaps'],
          // Reuse the size the user last asked for, bounded so an old 200-lead
          // request does not silently become a nightly 200-lead request.
          //
          // The bound must not exceed MAX_LEADS_PER_RUN in scrape-leads, which
          // rejects anything larger with a 400 — at 50 every nightly run would
          // have been turned away the moment that cap dropped. Keep in step.
          limit: Math.min(Number(s.last_limit) || 10, 10),
        }),
      })

      const payload = await res.json().catch(() => ({}))

      // A quota rejection (402) is normal operation, not a fault — the user has
      // simply used their allowance. Recorded, but not logged as an error.
      const status = res.ok ? 'ok' : res.status === 402 ? 'quota' : 'failed'

      // No status written back here: scrape-leads already inserts a scrape_runs
      // row for this run, which is the same history recent_searches reads from.
      if (status === 'failed') {
        await log('scrape', `Scheduled search failed for ${s.industry}/${s.city}: ${payload?.message || payload?.error}`,
          { http_status: res.status }, s.user_id as string)
      }

      results.push({ industry: s.industry, city: s.city, status, saved: payload?.saved ?? 0 })
    } catch (e) {
      await log('scrape', `Scheduled search threw for ${s.industry}/${s.city}: ${(e as Error).message}`,
        null, s.user_id as string)
      results.push({ industry: s.industry, city: s.city, status: 'failed' })
    }

    await sleep(GAP_BETWEEN_SEARCHES_MS)
  }

  // --- Daily summary, one row per user who had a search run ---
  const userIds = [...new Set(searches.map(s => s.user_id as string))]
  const summaries: Record<string, unknown>[] = []

  for (const uid of userIds) {
    const { data: summary, error: sumErr } = await db.rpc('daily_lead_summary', {
      p_user_id: uid,
      p_min_score: HIGH_SCORE,
    })
    if (sumErr) {
      await log('summary', `Summary failed: ${sumErr.message}`, null, uid)
      continue
    }
    if (summary) {
      // Persisted rather than emailed. A notifier picks these up — this job
      // does not send mail, matching the rule that a human approves sends.
      await db.from('daily_summaries').insert({
        user_id: uid,
        new_count: summary.new_count ?? 0,
        high_count: summary.high_count ?? 0,
        payload: summary,
      })
      summaries.push({ user_id: uid, new_count: summary.new_count, high_count: summary.high_count })
    }
  }

  return new Response(
    JSON.stringify({ ran: results.length, results, summaries }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})

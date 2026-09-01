// Creates a lead-generation job and returns immediately.
//
// This function used to run the entire pipeline inside one HTTP request: start
// Apify, poll it for up to 200s, score every lead with Gemini for up to 120s,
// then insert. The platform kills a worker that outlives its wall clock, and a
// killed worker never reaches its catch block — so 14 production runs died
// leaving no error and a scrape_runs row stranded in 'running' forever, and the
// per-run cap was cut 200 → 50 → 10 chasing the symptom.
//
// It now does the small, fast part only: validate, check quota, create the job
// row, and hand off to scrape-worker, which advances the job in short slices
// that persist as they go. The browser gets a run id in about two seconds and
// polls scrape_runs for progress.
//
// Discovery moved to Google Places in August 2026, replacing Apify. Places
// answers in about a second, so there is no third-party run to start here at
// all - the worker calls it directly during its discovering stage.
//
// See LEADGENAI_STABILITY_AUDIT.md for the full diagnosis.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  corsHeaders, json, logEvent, fetchWithTimeout,
  INDUSTRY_SEARCH_MAP, MAX_LEADS_PER_RUN,
} from '../_shared/pipeline.ts'

// Supabase's background-task API. Without it a fire-and-forget fetch is
// cancelled the moment this handler returns its response, and the job would
// never leave 'queued'.
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined


// Start (or restart) the slice chain for a job. waitUntil keeps the runtime
// alive past this handler's response; without it a fire-and-forget fetch is
// cancelled the instant we reply and the job never leaves 'queued'.
function kickWorker(supabaseUrl: string, runId: string) {
  const cronSecret = Deno.env.get('CRON_SECRET') || ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

  const kick = fetchWithTimeout(`${supabaseUrl}/functions/v1/scrape-worker`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cron-secret': cronSecret,
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ run_id: runId }),
  }, 10_000).catch(e => console.error('worker kick failed', String(e)))

  if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(kick)
  return kick
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://dbmtdeensqawntawaoyf.supabase.co'
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const db = createClient(supabaseUrl, serviceKey)

  let scrapeRunId: string | null = null
  let userId: string | null = null

  try {
    const body = await req.json()
    const { industry, city, sources } = body

    // --- Resume -------------------------------------------------------------
    //
    // A slice chain breaks only if a slice is killed mid-flight, but when it
    // does the job would otherwise sit still until the reaper closes it. The
    // browser is already polling and can see a stale heartbeat, so let it ask
    // for the chain to be restarted. It cannot call scrape-worker itself — that
    // endpoint takes the cron secret, which no browser may hold — so the nudge
    // comes through here, where the caller's JWT proves they own the job.
    if (body.action === 'resume' && body.run_id) {
      const authHeader = req.headers.get('Authorization') || ''
      const { data: { user } } = await db.auth.getUser(authHeader.replace('Bearer ', ''))
      if (!user?.id) return json({ error: 'Not authenticated' }, 401)

      const { data: owned } = await db
        .from('scrape_runs').select('id, status')
        .eq('id', body.run_id).eq('user_id', user.id).single()

      if (!owned) return json({ error: 'not_found' }, 404)
      if (['completed', 'partial', 'failed', 'cancelled'].includes(owned.status)) {
        return json({ ok: true, status: owned.status, resumed: false })
      }

      await kickWorker(supabaseUrl, body.run_id)
      return json({ ok: true, resumed: true })
    }

    // --- Validate -----------------------------------------------------------
    //
    // Clamp rather than trust the caller: this is a public HTTP endpoint and the
    // scheduled job posts to it too, so the ceiling has to be enforced where it
    // cannot be bypassed. Requested counts are never silently reduced — an
    // oversized request is rejected with a number the caller can act on.
    const requested = Number(body.limit)
    if (!Number.isFinite(requested) || requested < 1) {
      return json({ error: 'invalid_limit', message: 'Please choose how many leads to collect.' }, 400)
    }
    if (requested > MAX_LEADS_PER_RUN) {
      return json({
        error: 'limit_too_large',
        message: `A single search can collect up to ${MAX_LEADS_PER_RUN} leads. Run it again — or change the city or industry — to collect more.`,
        max_per_run: MAX_LEADS_PER_RUN,
      }, 400)
    }
    const limit = Math.floor(requested)

    if (!industry || !city) {
      return json({ error: 'invalid_request', message: 'Choose an industry and a city.' }, 400)
    }

    // Google Maps is the discovery source. Rejecting an unknown source beats
    // accepting it and returning an empty run the caller cannot explain.
    const sourceList: string[] = Array.isArray(sources) && sources.length ? sources : ['gmaps']
    if (!sourceList.includes('gmaps')) {
      return json({ error: 'unsupported_source', message: 'Google Maps is the only available lead source.' }, 400)
    }

    // Contact enrichment is currently performed by no source. Places reports
    // what Google holds about a business and never visits its website, so no
    // lead arrives with an email. The request flag is still read so the field
    // keeps meaning when a per-lead reveal step is added.
    const enrichRequested = body.enrich_contacts !== false

    const placesKey = Deno.env.get('GOOGLE_PLACES_API_KEY') || ''
    if (!placesKey) {
      return json({ error: 'not_configured', message: 'Lead discovery is not configured. Please contact support.' }, 500)
    }

    // --- Authenticate -------------------------------------------------------
    //
    // Two ways in. Normally the caller's JWT identifies the user. The scheduled
    // job has no user session, so it presents a shared secret and names the user
    // explicitly — which is why the secret must be compared before the body's
    // user_id is trusted at all.
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
    if (!userId) return json({ error: 'Not authenticated' }, 401)

    // --- Quota --------------------------------------------------------------
    const { data: quota, error: quotaErr } = await db.rpc('check_lead_quota', { p_user_id: userId })
    if (quotaErr) {
      console.error('Quota check failed', quotaErr)
      return json({ error: 'Could not verify your plan usage. Please try again.' }, 500)
    }
    // 'allowed' is the lower of what's left today and what's left this month, so
    // a daily cap bounds even an unlimited monthly plan.
    const allowed = quota?.allowed ?? 0
    if (limit > allowed) {
      const daily = quota?.blocked_by === 'daily' || (quota?.day_remaining ?? 0) < (quota?.remaining ?? 0)
      return json({
        error: 'quota_exceeded',
        scope: daily ? 'daily' : 'monthly',
        message: daily
          ? `You have ${quota?.day_remaining} of ${quota?.day_limit} leads left today on the ${quota?.plan} plan. You requested ${limit}. Your daily allowance resets at midnight IST, or you can upgrade for a higher limit.`
          : `You have ${quota?.remaining} of ${quota?.limit} leads left this month on the ${quota?.plan} plan. You requested ${limit}. Reduce the number or upgrade your plan.`,
        plan: quota?.plan,
        limit: quota?.limit,
        used: quota?.used,
        remaining: quota?.remaining,
        day_limit: quota?.day_limit,
        day_used: quota?.day_used,
        day_remaining: quota?.day_remaining,
        allowed,
      }, 402)
    }

    // No source enriches contacts at present, whatever was asked for. Recorded
    // on the job so a run's history says plainly that it could not have found
    // an email, rather than looking like a run that simply found none.
    const enrichContacts = false

    // Close out any job whose slice chain broke before starting a new one. It is
    // one indexed update, and it is the only sweep available — pg_cron is not
    // installed on this project.
    try {
      const { data: reaped } = await db.rpc('reap_stalled_scrape_runs', { p_stale_minutes: 10 })
      if (reaped) console.log(JSON.stringify({ src: 'scrape-leads', msg: 'reaped stalled runs', count: reaped }))
    } catch (e) {
      console.error('reap failed, continuing', String(e))
    }

    // --- Create the job -----------------------------------------------------
    const { data: runRow, error: runErr } = await db
      .from('scrape_runs')
      .insert({
        user_id: userId,
        industry, city,
        sources: sourceList,
        limit_requested: limit,
        status: 'queued',
        stage: 'discovering',
        enrich_contacts: enrichContacts,
        started_at: new Date().toISOString(),
        heartbeat_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (runErr || !runRow) {
      console.error('Could not create job row', runErr)
      return json({ error: 'Could not start the search. Please try again.' }, 500)
    }
    // scrapeRunId stays mutable and nullable so the catch block can report a job
    // that may or may not have been created. From here the id is known, so hold
    // a narrowed copy rather than asserting non-null at each use.
    const runId: string = runRow.id
    scrapeRunId = runId

    // Discovery itself belongs to the worker: Places is a single fast call, so
    // there is no third-party run to start here and nothing to poll. This
    // function's job ends at creating the row and handing over.
    await logEvent(db, {
      source: 'scrape-leads', stage: 'job_start',
      message: `Job created: ${limit} leads, ${industry} in ${city}`,
      detail: { enrich_contacts: enrichContacts, sources: sourceList },
      user_id: userId, scrape_run_id: runId,
    })

    // --- Hand off to the worker ---------------------------------------------
    //
    // If the kick fails the job is not lost: its heartbeat goes stale, the
    // client's poll notices and asks for a resume, and a chain that never starts
    // at all is closed by the reaper on the next job.
    kickWorker(supabaseUrl, runId)

    return json({
      success: true,
      run_id: runId,
      status: 'running',
      stage: 'discovering',
      limit_requested: limit,
      // Reported so the UI can explain a blank email column rather than letting
      // it read as a bug. Always false today: no discovery source returns an
      // email, so every lead arrives without one.
      enrich_contacts: enrichContacts,
      enrich_withheld: enrichRequested && !enrichContacts,
    })

  } catch (err) {
    console.error('scrape-leads error:', err)
    if (scrapeRunId) {
      await db.from('scrape_runs').update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        error_message: (err as Error).message,
      }).eq('id', scrapeRunId)
    }
    await logEvent(db, {
      source: 'scrape-leads', stage: 'create',
      message: (err as Error).message,
      detail: { stack: (err as Error).stack?.slice(0, 1000) },
      user_id: userId, scrape_run_id: scrapeRunId,
    })
    return json({ error: (err as Error).message, message: (err as Error).message }, 500)
  }
})

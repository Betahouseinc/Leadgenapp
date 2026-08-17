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
// row, start the Apify run without waiting, and hand off to scrape-worker, which
// advances the job in short slices that persist as they go. The browser gets a
// run id in about two seconds and polls scrape_runs for progress.
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

const GMAPS_ACTOR = 'nwua9Gu5YrADL7ZDj'

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

    // Contact enrichment makes Apify visit every discovered business's website
    // to harvest emails. It is the single biggest driver of run time, so it is a
    // per-run choice recorded on the job rather than a hardcoded actor flag.
    const enrichContacts = body.enrich_contacts !== false

    const apifyKey = Deno.env.get('APIFY_API_KEY') || ''
    if (!apifyKey) {
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
    scrapeRunId = runRow.id

    // --- Start Apify, without waiting for it --------------------------------
    //
    // The old code started the run and then polled it to completion in this same
    // invocation. Starting it and recording its id is all that belongs here; the
    // waiting is the worker's job, spread across as many slices as it takes.
    const searchTerm = INDUSTRY_SEARCH_MAP[industry] || industry
    const actorInput = {
      // Keep the search term clean and pass location separately — embedding the
      // city in the query makes Google Maps match literally and starves results.
      searchStringsArray: [searchTerm],
      locationQuery: `${city}, India`,
      maxCrawledPlacesPerSearch: limit,
      language: 'en',
      scrapeContacts: enrichContacts,
      skipClosedPlaces: true,
      maxImages: 0,
      maxReviews: 0,
    }

    const runRes = await fetchWithTimeout(
      `https://api.apify.com/v2/acts/${GMAPS_ACTOR}/runs?token=${apifyKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(actorInput) },
    )
    if (!runRes.ok) {
      const detail = (await runRes.text()).slice(0, 300)
      await db.from('scrape_runs').update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        error_message: 'The lead source could not be reached. Please try again shortly.',
      }).eq('id', scrapeRunId)
      await logEvent(db, {
        source: 'scrape-leads', stage: 'discovering',
        message: `Apify run could not be started: HTTP ${runRes.status}`,
        detail: { body: detail }, user_id: userId, scrape_run_id: scrapeRunId,
      })
      return json({ error: 'source_unavailable', message: 'The lead source could not be reached. Please try again shortly.', run_id: scrapeRunId }, 502)
    }

    const { data: started } = await runRes.json()

    await db.from('scrape_runs').update({
      apify_run_id: started.id,
      status: 'running',
      heartbeat_at: new Date().toISOString(),
    }).eq('id', scrapeRunId)

    await logEvent(db, {
      source: 'scrape-leads', stage: 'job_start',
      message: `Job created: ${limit} leads, ${industry} in ${city}`,
      detail: { apify_run_id: started.id, enrich_contacts: enrichContacts, sources: sourceList },
      user_id: userId, scrape_run_id: scrapeRunId,
    })

    // --- Hand off to the worker ---------------------------------------------
    //
    // If the kick fails the job is not lost: its heartbeat goes stale, the
    // client's poll notices and asks for a resume, and a chain that never starts
    // at all is closed by the reaper on the next job.
    kickWorker(supabaseUrl, scrapeRunId)

    return json({
      success: true,
      run_id: scrapeRunId,
      status: 'running',
      stage: 'discovering',
      limit_requested: limit,
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

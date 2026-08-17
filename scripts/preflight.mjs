#!/usr/bin/env node
//
// Preflight: refuse to deploy code whose database dependencies are missing.
//
// Twice on 2026-08-15 a deploy shipped code that referenced a database object
// that had never been created — `leads.dedup_key`, then `public.leads_view` —
// and both times the failure surfaced as a customer-facing error rather than a
// build failure. This project's schema was built by hand and its migration
// ledger is empty, so `supabase migration list` cannot answer "is the database
// ready for this code?". Asking the live database directly is the only reliable
// answer, and that is all this script does.
//
//   node scripts/preflight.mjs           check, print a report
//   node scripts/preflight.mjs --quiet   only print problems
//
// Exits non-zero if anything required is missing, so it can gate a deploy:
//   node scripts/preflight.mjs && npx supabase functions deploy scrape-leads
//
// Adding a dependency: when code starts reading a new table, column, view or
// function, add it to REQUIRED below in the same commit. That is the whole
// discipline — the list is only as good as it is current.

import { execSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// `db query --linked` resolves the project from supabase/.temp/project-ref, set
// by `supabase link`. It takes no --project-ref of its own, so run this from the
// repo root.

// Each entry: what the object is, and which code depends on it. The `why` shows
// up in the failure message so whoever hits it knows what will break.
const REQUIRED = {
  columns: [
    ['leads', 'dedup_key',         'scrape-leads upsert onConflict — insert fails outright without it'],
    ['leads', 'phone_key',         'scrape-leads cross-run dedup lookup'],
    ['leads', 'company',           'leads_view and the lead drawer'],
    ['leads', 'email',             'dedup lookup and the dashboard contact column'],
    ['leads', 'score',             'lead_stats, score filter, high-score export'],
    ['profiles', 'role',           'can_see_contacts and the error_log read policy'],
    ['profiles', 'plan_id',        'can_see_contacts — decides contact masking'],
  ],
  relations: [
    ['leads',        'Leads.jsx writes, scrape-leads inserts'],
    ['leads_view',   'Leads.jsx reads every lead through this — dashboard is blank without it'],
    ['profiles',     'auth, plan and role lookups'],
    ['scrape_runs',  'run history and stalled-run detection'],
    ['error_log',    'scrape-leads logError — failures vanish silently without it'],
    ['plans',        'check_lead_quota'],
  ],
  functions: [
    ['lead_stats',        'StatsBar — tiles render blank without it'],
    ['can_see_contacts',  'leads_view masking'],
    ['mask_email',        'leads_view masking'],
    ['mask_phone',        'leads_view masking'],
    ['check_lead_quota',  'scrape-leads quota gate — every scrape 500s without it'],
    ['increment_leads_used', 'scrape-leads quota accounting'],
  ],
  indexes: [
    ['uq_leads_user_dedup_key', 'the unique index upsert onConflict resolves against'],
  ],
}

// Not required to deploy, but each one means a feature is quietly inert.
const EXPECTED = {
  relations: [
    ['industry_canonical', 'industry labels stay free-text from the AI'],
  ],
  functions: [
    ['normalise_industry', 'industry normalisation trigger'],
  ],
  extensions: [
    ['pg_cron', 'the nightly scrape is not scheduled'],
  ],
}

function query(sql) {
  // The SQL goes via a temp file rather than an argument. Inline, it needs a
  // shell to survive Windows' .cmd resolution, and that same shell re-splits it
  // on its spaces and commas into eight arguments. A file path has neither
  // problem, and quoting one path is something a shell does reliably.
  const file = join(tmpdir(), `leadgen-preflight-${process.pid}.sql`)
  writeFileSync(file, sql, 'utf8')
  // One command string rather than an args array: Node deprecates mixing the two
  // with `shell: true`, since it concatenates without escaping. The only
  // interpolated value is a path this script just built from tmpdir and its own
  // pid, so there is nothing here that could carry a shell metacharacter.
  let out
  try {
    out = execSync(
      `npx supabase db query --linked -o csv -f "${file}"`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    )
  } finally {
    try { unlinkSync(file) } catch { /* best effort */ }
  }
  // The CLI appends update notices after the CSV; keep only real rows.
  return out
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && l.includes(','))
}

// One round trip. Every check is a row of (kind, name, present).
function probe() {
  const lit = s => `'${String(s).replace(/'/g, "''")}'`
  const parts = []

  for (const [table, col] of REQUIRED.columns) {
    parts.push(`select 'column' as kind, ${lit(`${table}.${col}`)} as name, exists(
      select 1 from information_schema.columns
       where table_schema='public' and table_name=${lit(table)} and column_name=${lit(col)}) as present`)
  }
  for (const [rel] of [...REQUIRED.relations, ...EXPECTED.relations]) {
    parts.push(`select 'relation', ${lit(rel)}, to_regclass(${lit(`public.${rel}`)}) is not null`)
  }
  for (const [fn] of [...REQUIRED.functions, ...EXPECTED.functions]) {
    parts.push(`select 'function', ${lit(fn)}, exists(
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public' and p.proname=${lit(fn)})`)
  }
  for (const [idx] of REQUIRED.indexes) {
    parts.push(`select 'index', ${lit(idx)}, exists(select 1 from pg_indexes where indexname=${lit(idx)})`)
  }
  for (const [ext] of EXPECTED.extensions) {
    parts.push(`select 'extension', ${lit(ext)}, exists(select 1 from pg_extension where extname=${lit(ext)})`)
  }

  const rows = query(parts.join(' union all ') + ';')
  const present = new Map()
  for (const row of rows) {
    const [kind, name, val] = row.split(',')
    if (kind === 'kind') continue          // header
    present.set(`${kind}:${name}`, val === 't' || val === 'true')
  }
  return present
}

// A run that never reached its error handler. These are invisible in the
// product, so surface them here — they are the only trace a killed worker
// leaves, and the evidence for where the real per-run ceiling sits.
function stalledRuns() {
  const rows = query(`select count(*)::text, coalesce(max(limit_requested)::text,'0')
                        from scrape_runs
                       where status='running' and created_at < now() - interval '15 minutes';`)
  const data = rows.find(r => !r.startsWith('count'))
  if (!data) return { count: 0, largest: 0 }
  const [count, largest] = data.split(',')
  return { count: Number(count), largest: Number(largest) }
}

const quiet = process.argv.includes('--quiet')
const G = s => `\x1b[32m${s}\x1b[0m`
const R = s => `\x1b[31m${s}\x1b[0m`
const Y = s => `\x1b[33m${s}\x1b[0m`
const dim = s => `\x1b[2m${s}\x1b[0m`

let present
try {
  present = probe()
} catch (err) {
  console.error(R('preflight could not reach the database.'))
  console.error(dim(String(err.stderr || err.message).trim().split('\n').slice(-3).join('\n')))
  process.exit(2)
}

const missing = []
const inert = []

const check = (kind, list, sink) => {
  for (const [name, why] of list) {
    const key = `${kind}:${name}`
    const ok = present.get(key)
    if (ok) { if (!quiet) console.log(`  ${G('ok')}      ${name}`) }
    else { sink.push([name, why]); if (!quiet) console.log(`  ${sink === missing ? R('MISSING') : Y('inert')}  ${name}`) }
  }
}

if (!quiet) console.log('\nRequired by deployed code')
check('column',   REQUIRED.columns.map(([t, c, w]) => [`${t}.${c}`, w]), missing)
check('relation', REQUIRED.relations, missing)
check('function', REQUIRED.functions, missing)
check('index',    REQUIRED.indexes,   missing)

if (!quiet) console.log('\nOptional — missing means a feature is inert')
check('relation',  EXPECTED.relations,  inert)
check('function',  EXPECTED.functions,  inert)
check('extension', EXPECTED.extensions, inert)

const stalled = stalledRuns()
if (stalled.count > 0) {
  console.log(`\n${Y('!')} ${stalled.count} scrape run(s) stuck in 'running' — killed workers.`)
  console.log(dim(`  Largest was limit_requested=${stalled.largest}. Keep the per-run cap below it.`))
} else if (!quiet) {
  console.log(`\n${G('ok')}      no stalled scrape runs`)
}

if (inert.length && !quiet) {
  console.log('\nInert features:')
  for (const [name, why] of inert) console.log(`  ${Y('·')} ${name} — ${why}`)
}

if (missing.length) {
  console.log(`\n${R('PREFLIGHT FAILED')} — ${missing.length} required object(s) missing. Do not deploy.`)
  for (const [name, why] of missing) console.log(`  ${R('·')} ${name} — ${why}`)
  console.log(dim('\n  Apply the matching migration, e.g.'))
  console.log(dim('  npx supabase db query --linked -f supabase/migrations/<file>.sql'))
  process.exit(1)
}

console.log(`\n${G('PREFLIGHT PASSED')} — the database has everything the deployed code needs.\n`)

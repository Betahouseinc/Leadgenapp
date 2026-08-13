// Serves the nightly summary as JSON or CSV for a notifier to pick up.
//
//   GET /daily-summary?format=csv          unsent summaries, all users
//   GET /daily-summary?format=json
//   GET /daily-summary?user_id=<uuid>      one user
//   POST /daily-summary  {"mark_sent": ["<summary id>", ...]}
//
// Shared-secret auth, same as daily-scrape. This returns unmasked contact
// details, so it must never be reachable with the anon key.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const COLUMNS = ['name', 'email', 'phone', 'website', 'industry', 'city', 'score', 'summary', 'source', 'created_at']

// Spreadsheet apps execute a leading =, +, - or @ as a formula, and these rows
// contain scraped business names. Same guard as the in-app export.
function csvCell(v: unknown) {
  if (v === null || v === undefined) return ''
  let s = String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsv(rows: Record<string, unknown>[]) {
  const lines = [['summary_id', 'user_id', ...COLUMNS].join(',')]
  for (const r of rows) {
    const leads = (r.payload as Record<string, unknown>)?.leads as Record<string, unknown>[] || []
    for (const l of leads) {
      lines.push([csvCell(r.id), csvCell(r.user_id), ...COLUMNS.map(c => csvCell(l[c]))].join(','))
    }
  }
  // BOM so Excel reads UTF-8 business names correctly.
  return '﻿' + lines.join('\r\n')
}

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get('CRON_SECRET') || ''
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403, headers: { 'Content-Type': 'application/json' },
    })
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  )

  // Acknowledge delivery so the next poll does not resend the same summaries.
  if (req.method === 'POST') {
    const { mark_sent } = await req.json().catch(() => ({ mark_sent: [] }))
    if (!Array.isArray(mark_sent) || mark_sent.length === 0) {
      return new Response(JSON.stringify({ error: 'mark_sent must be a non-empty array of ids' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      })
    }
    const { error } = await db
      .from('daily_summaries')
      .update({ sent_at: new Date().toISOString() })
      .in('id', mark_sent)
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({ marked: mark_sent.length }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const url = new URL(req.url)
  const format = (url.searchParams.get('format') || 'json').toLowerCase()
  const userId = url.searchParams.get('user_id')

  let q = db.from('daily_summaries').select('*').is('sent_at', null).order('created_at')
  if (userId) q = q.eq('user_id', userId)

  const { data, error } = await q
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }

  const rows = data || []

  if (format === 'csv') {
    return new Response(toCsv(rows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="leadgenai-daily-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  }

  return new Response(
    JSON.stringify({ count: rows.length, summaries: rows }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})

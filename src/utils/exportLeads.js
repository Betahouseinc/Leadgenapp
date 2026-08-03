import * as XLSX from 'xlsx'
import { statusLabel } from '../constants/leadStatus'

const COLUMNS = [
  'Name', 'Phone', 'Email', 'Website', 'Industry', 'City',
  'Score', 'AI Summary', 'Status', 'Last Contacted', 'Notes',
  'Source', 'Date Added',
]

function fmtDate(v) {
  if (!v) return ''
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

function sourceLabel(s) {
  if (s === 'gmaps' || s === 'Google Maps') return 'Google Maps'
  if (s === 'linkedin' || s === 'LinkedIn') return 'LinkedIn'
  return s || ''
}

export function leadToRow(l) {
  return {
    Name: l.name || '',
    Phone: l.phone || '',
    Email: l.email || '',
    Website: l.website || '',
    Industry: l.industry || '',
    City: l.city || '',
    Score: l.score ?? '',
    'AI Summary': l.summary || '',
    Status: statusLabel(l.status),
    'Last Contacted': fmtDate(l.last_contacted_at),
    Notes: l.notes || '',
    Source: sourceLabel(l.source),
    'Date Added': fmtDate(l.created_at),
  }
}

// Spreadsheet apps execute leading =, +, -, @ as formulas. Scraped business
// names are untrusted input, so neutralise them.
function guardInjection(value) {
  const s = String(value)
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
}

function csvCell(value) {
  if (value === null || value === undefined) return ''
  const s = guardInjection(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function buildCsv(leads) {
  const lines = [COLUMNS.join(',')]
  for (const l of leads) {
    const row = leadToRow(l)
    lines.push(COLUMNS.map(c => csvCell(row[c])).join(','))
  }
  // BOM so Excel reads UTF-8 correctly (₹, accented business names).
  return '\uFEFF' + lines.join('\r\n')
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function filename(ext) {
  return `leadgenai-leads-${new Date().toISOString().slice(0, 10)}.${ext}`
}

export function exportCsv(leads) {
  download(new Blob([buildCsv(leads)], { type: 'text/csv;charset=utf-8;' }), filename('csv'))
}

export function exportExcel(leads) {
  const ws = XLSX.utils.json_to_sheet(leads.map(leadToRow), { header: COLUMNS })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Leads')
  XLSX.writeFile(wb, filename('xlsx'))
}

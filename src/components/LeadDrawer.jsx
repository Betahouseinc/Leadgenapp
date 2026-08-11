import { useState } from 'react'

const T = {
  surface: '#FFFFFF',
  bg: '#FAFAF7',
  border: 'rgba(0,0,0,0.12)',
  ink: '#2C2416',
  ink2: '#5C5240',
  muted: '#9C8E7A',
  blue: '#109840',
  blueL: '#EFF8F1',
  teal: '#1A8A72',
  tealL: '#E0F5F0',
}

function ScoreColor(score) {
  if (score >= 75) return '#2E7D32'
  if (score >= 50) return '#109840'
  return '#C44B4B'
}

function SourceBadge({ source }) {
  const isGmaps = source === 'gmaps' || source === 'Google Maps'
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 600,
      background: isGmaps ? '#E8F5E9' : '#E6F4EA',
      color: isGmaps ? '#2E7D32' : '#087A32',
    }}>
      {isGmaps ? 'Google Maps' : 'LinkedIn'}
    </span>
  )
}

function StatusBadge({ status }) {
  const map = {
    new: { bg: '#EFF8F1', color: '#109840' },
    contacted: { bg: '#E6F4EA', color: '#087A32' },
    qualified: { bg: '#E0F5F0', color: '#1A8A72' },
    rejected: { bg: '#FDEAEA', color: '#C44B4B' },
  }
  const s = map[status] || map.new
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 600,
      background: s.bg,
      color: s.color,
    }}>
      {status || 'new'}
    </span>
  )
}

export default function LeadDrawer({ lead, onClose }) {
  const [showMailboxes, setShowMailboxes] = useState(false)

  if (!lead) return null

  const to = lead.email || ''
  const subjectRaw = `Partnership opportunity - ${lead.company || lead.name}`
  const bodyRaw = [
    `Hi ${lead.name || 'there'},`,
    '',
    `I came across ${lead.company || lead.name}${lead.city ? ` in ${lead.city}` : ''} and wanted to get in touch.`,
    '',
    '',
    'Best regards,',
  ].join('\n')

  const subject = encodeURIComponent(subjectRaw)
  const body = encodeURIComponent(bodyRaw)

  // mailto: does nothing on a machine with no mail client configured, which is
  // most desktop browsers — so offer the webmail compose windows directly.
  const mailboxes = [
    { label: 'Gmail', href: `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${subject}&body=${body}` },
    { label: 'Outlook', href: `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(to)}&subject=${subject}&body=${body}` },
    { label: 'Default mail app', href: `mailto:${to}?subject=${subject}&body=${body}` },
  ]

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.18)',
          zIndex: 100,
        }}
      />
      {/* Drawer */}
      <div style={{
        position: 'fixed',
        top: 0, right: 0, bottom: 0,
        width: 360,
        background: T.surface,
        borderLeft: `0.5px solid ${T.border}`,
        zIndex: 101,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: `0.5px solid ${T.border}`,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: T.ink, marginBottom: 2 }}>
              {lead.name}
            </div>
            <div style={{ fontSize: 13, color: T.ink2 }}>{lead.company}</div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: T.muted, fontSize: 20, lineHeight: 1, padding: 2,
            }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {/* Score */}
          <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              fontSize: 48,
              fontWeight: 800,
              color: ScoreColor(lead.score || 0),
              lineHeight: 1,
            }}>{lead.score ?? '—'}</div>
            <div style={{ fontSize: 13, color: T.muted }}>Lead score</div>
          </div>

          <Row label="City" value={lead.city} />
          <Row label="Industry" value={lead.industry} />

          <Row label="Email" value={
            lead.email
              ? <a href={`mailto:${lead.email}`} style={{ color: T.blue }}>{lead.email}</a>
              : '—'
          } />
          <Row label="Phone" value={lead.phone || '—'} />

          <Row label="Source" value={<SourceBadge source={lead.source} />} />
          <Row label="Status" value={<StatusBadge status={lead.status} />} />

          {lead.summary && (
            <div style={{
              background: T.bg,
              border: `0.5px solid ${T.border}`,
              borderRadius: 8,
              padding: '12px 14px',
              fontSize: 13,
              color: T.ink2,
              marginTop: 8,
            }}>
              {lead.summary}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: `0.5px solid ${T.border}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <button
            onClick={() => setShowMailboxes(v => !v)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'center',
              padding: '10px 0',
              background: T.blue,
              color: '#FFF',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Draft outreach email
          </button>

          {showMailboxes && (
            <div style={{
              display: 'grid',
              gap: 6,
              padding: 10,
              background: T.blueL,
              border: `1px solid ${T.blue}`,
              borderRadius: 8,
            }}>
              <div style={{ fontSize: 12, color: T.ink2, marginBottom: 2 }}>
                Open the draft in:
              </div>
              {mailboxes.map(m => (
                <a
                  key={m.label}
                  href={m.href}
                  target={m.label === 'Default mail app' ? undefined : '_blank'}
                  rel="noopener noreferrer"
                  onClick={() => setShowMailboxes(false)}
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    padding: '9px 0',
                    background: T.surface,
                    color: T.ink,
                    border: `1px solid ${T.border}`,
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  {m.label}
                </a>
              ))}
            </div>
          )}
          <button
            onClick={onClose}
            style={{
              padding: '10px 0',
              background: 'none',
              border: `0.5px solid ${T.border}`,
              borderRadius: 8,
              fontSize: 13,
              color: T.ink2,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </>
  )
}

function Row({ label, value }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '9px 0',
      borderBottom: 'none',
    }}>
      <span style={{ fontSize: 12, color: '#9C8E7A', fontWeight: 500, minWidth: 72 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#2C2416', textAlign: 'right' }}>{value}</span>
    </div>
  )
}

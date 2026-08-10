import { useState, useEffect } from 'react'

const KEY = 'leadgenai_cookie_consent'
const T = { surface:'#FFFFFF', ink2:'#4B5560', border:'rgba(11,13,12,0.12)', blue:'#109840' }

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(KEY)
    if (!stored) setTimeout(() => setVisible(true), 0)
  }, [])

  const accept = () => {
    localStorage.setItem(KEY, 'accepted')
    if (window.__loadGA) window.__loadGA()
    setVisible(false)
  }

  const decline = () => {
    localStorage.setItem(KEY, 'declined')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div style={{
      position:'fixed', bottom:0, left:0, right:0, zIndex:9999,
      background:T.surface, borderTop:`0.5px solid ${T.border}`,
      boxShadow:'0 -2px 12px rgba(0,0,0,0.08)',
      padding:'14px 24px', display:'flex', alignItems:'center',
      justifyContent:'space-between', flexWrap:'wrap', gap:12,
      fontFamily:'system-ui,-apple-system,sans-serif',
    }}>
      <p style={{ margin:0, fontSize:13, color:T.ink2, lineHeight:1.6, flex:'1 1 300px' }}>
        We use analytics cookies to understand aggregate usage — no advertising or cross-site tracking.{' '}
        <a href="/legal/privacy" style={{ color:T.blue, textDecoration:'none', fontWeight:500 }}>Privacy Policy</a>
      </p>
      <div style={{ display:'flex', gap:8, flexShrink:0 }}>
        <button onClick={decline} style={{ padding:'7px 16px', background:'none', border:`0.5px solid ${T.border}`, borderRadius:7, fontSize:13, color:T.ink2, cursor:'pointer', fontWeight:500 }}>Decline</button>
        <button onClick={accept} style={{ padding:'7px 16px', background:T.blue, border:'none', borderRadius:7, fontSize:13, color:'#FFF', cursor:'pointer', fontWeight:600 }}>Accept analytics</button>
      </div>
    </div>
  )
}

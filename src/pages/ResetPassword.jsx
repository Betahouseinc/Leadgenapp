import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const T = { bg: '#FAFAF7', surface: '#FFFFFF', ink: '#2C2416', ink2: '#5C5240', border: 'rgba(0,0,0,0.12)', blue: '#2563EB' }

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (err) { setError(err.message); return }
    setDone(true)
    setTimeout(() => navigate('/leads'), 2000)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: T.surface, borderRadius: 12, padding: '36px 40px', border: `0.5px solid ${T.border}`, width: '100%', maxWidth: 420 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: T.blue, textAlign: 'center', margin: '0 0 6px', letterSpacing: '-0.5px' }}>Set new password</h2>
        {done ? (
          <p style={{ textAlign: 'center', color: '#1A8A72', marginTop: 20 }}>Password updated! Redirecting…</p>
        ) : (
          <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
            <label style={{ display: 'block', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: T.ink, marginBottom: 6 }}>New password</div>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} placeholder="Min 8 characters" style={{ width: '100%', padding: '10px 12px', border: `0.5px solid ${T.border}`, borderRadius: 8, fontSize: 14, color: T.ink, background: T.bg, outline: 'none', boxSizing: 'border-box' }} />
            </label>
            <label style={{ display: 'block', marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: T.ink, marginBottom: 6 }}>Confirm password</div>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required placeholder="Repeat password" style={{ width: '100%', padding: '10px 12px', border: `0.5px solid ${T.border}`, borderRadius: 8, fontSize: 14, color: T.ink, background: T.bg, outline: 'none', boxSizing: 'border-box' }} />
            </label>
            {error && <div style={{ color: '#B91C1C', fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px', background: T.blue, color: '#FFF', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: loading ? 'wait' : 'pointer' }}>
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const T = {
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  ink: '#0B0D0C',
  ink2: '#4B5560',
  border: 'rgba(11,13,12,0.12)',
  blue: '#109840',
  blueL: '#EFF8F1',
  error: '#C44B4B',
  errorL: '#FDEAEA',
}

export default function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get('redirect') || 'leads'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const handleReset = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setResetSent(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (err) {
      setError(err.message)
    } else {
      navigate(`/${redirectTo}`)
    }
  }

  if (showReset) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: T.bg, fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        <div style={{
          background: T.surface, borderRadius: 12, padding: '36px 40px',
          border: `0.5px solid ${T.border}`, width: '100%', maxWidth: 420,
        }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: T.blue, textAlign: 'center', margin: '0 0 6px', letterSpacing: '-0.5px' }}>
            Reset password
          </h2>
          {resetSent ? (
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <p style={{ color: T.ink2, fontSize: 14, lineHeight: 1.7 }}>
                Check your inbox — we've sent a reset link to <strong>{email}</strong>.
              </p>
              <button
                onClick={() => { setShowReset(false); setResetSent(false) }}
                style={{ marginTop: 16, fontSize: 13, color: T.blue, background: 'none', border: 'none', cursor: 'pointer' }}
              >← Back to sign in</button>
            </div>
          ) : (
            <form onSubmit={handleReset} style={{ marginTop: 20 }}>
              <label style={{ display: 'block', marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: T.ink, marginBottom: 6 }}>Email address</div>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  required placeholder="you@company.com"
                  style={{ width: '100%', padding: '10px 12px', border: `0.5px solid ${T.border}`, borderRadius: 8, fontSize: 14, color: T.ink, background: T.bg, outline: 'none', boxSizing: 'border-box' }}
                />
              </label>
              {error && <div style={{ color: '#B91C1C', fontSize: 13, marginBottom: 12 }}>{error}</div>}
              <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px', background: T.blue, color: '#FFF', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: loading ? 'wait' : 'pointer' }}>
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
              <button type="button" onClick={() => setShowReset(false)} style={{ display: 'block', margin: '14px auto 0', fontSize: 13, color: T.ink2, background: 'none', border: 'none', cursor: 'pointer' }}>
                ← Back to sign in
              </button>
            </form>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: T.bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        background: T.surface,
        border: `0.5px solid ${T.border}`,
        borderRadius: 8,
        padding: '40px 48px',
        width: '100%',
        maxWidth: 400,
      }}>
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div style={{
            fontSize: 24,
            fontWeight: 700,
            color: T.blue,
            letterSpacing: '-0.5px',
            marginBottom: 4,
          }}>LeadGen</div>
          <div style={{ fontSize: 14, color: T.ink2 }}>Sign in to your account</div>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: T.ink, marginBottom: 6 }}>Email</div>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@company.com"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: `0.5px solid ${T.border}`,
                borderRadius: 8,
                fontSize: 14,
                color: T.ink,
                background: T.bg,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </label>

          <label style={{ display: 'block', marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: T.ink }}>Password</span>
              <button
                type="button"
                onClick={() => setShowReset(true)}
                style={{ fontSize: 12.5, color: T.blue, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >Forgot password?</button>
            </div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: `0.5px solid ${T.border}`,
                borderRadius: 8,
                fontSize: 14,
                color: T.ink,
                background: T.bg,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </label>

          {error && (
            <div style={{
              background: T.errorL,
              border: `0.5px solid ${T.error}`,
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 13,
              color: T.error,
              marginBottom: 16,
            }}>{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '11px 0',
              background: loading ? T.blueL : T.blue,
              color: loading ? T.blue : '#FFF',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: T.ink2 }}>
          Don't have an account?{' '}
          <Link to="/signup" style={{ color: T.blue, fontWeight: 600, textDecoration: 'none' }}>
            Sign up free
          </Link>
        </div>
      </div>
    </div>
  )
}

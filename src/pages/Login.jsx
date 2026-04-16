import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const T = {
  bg: '#FAFAF7',
  surface: '#FFFFFF',
  ink: '#2C2416',
  ink2: '#5C5240',
  border: 'rgba(0,0,0,0.12)',
  blue: '#2563EB',
  blueL: '#EFF6FF',
  error: '#C44B4B',
  errorL: '#FDEAEA',
}

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (err) {
      setError(err.message)
    } else {
      navigate('/leads')
    }
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

          <label style={{ display: 'block', marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: T.ink, marginBottom: 6 }}>Password</div>
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

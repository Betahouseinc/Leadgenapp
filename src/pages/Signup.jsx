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
  teal: '#1A8A72',
  tealL: '#E0F5F0',
}

export default function Signup() {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    // Update profile with full name
    if (data?.user) {
      await supabase.from('profiles').upsert({ id: data.user.id, email, full_name: fullName })
    }
    setLoading(false)
    setDone(true)
    setTimeout(() => navigate('/leads'), 1500)
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
        maxWidth: 420,
      }}>
        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: T.blue, marginBottom: 4 }}>LeadgenAI</div>
          <div style={{ fontSize: 14, color: T.ink2 }}>Create your free account</div>
          <div style={{
            marginTop: 10,
            padding: '6px 14px',
            background: T.tealL,
            borderRadius: 20,
            display: 'inline-block',
            fontSize: 12,
            color: T.teal,
            fontWeight: 600,
          }}>10 free leads — no credit card needed</div>
        </div>

        {done ? (
          <div style={{
            background: T.tealL,
            border: `0.5px solid ${T.teal}`,
            borderRadius: 8,
            padding: '14px 16px',
            fontSize: 14,
            color: T.teal,
            textAlign: 'center',
          }}>
            ✓ Account created! Redirecting…
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <Field label="Full name" value={fullName} onChange={setFullName} placeholder="Rahul Sharma" />
            <Field label="Work email" value={email} onChange={setEmail} type="email" placeholder="you@company.com" />
            <Field label="Password" value={password} onChange={setPassword} type="password" placeholder="Min 8 characters" />

            {error && (
              <div style={{
                background: T.errorL, border: `0.5px solid ${T.error}`,
                borderRadius: 8, padding: '10px 12px',
                fontSize: 13, color: T.error, marginBottom: 16,
              }}>{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '11px 0',
                background: loading ? T.blueL : T.blue,
                color: loading ? T.blue : '#FFF',
                border: 'none', borderRadius: 8,
                fontSize: 14, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >{loading ? 'Creating account…' : 'Start for free'}</button>
          </form>
        )}

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: T.ink2 }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: T.blue, fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: '#2C2416', marginBottom: 6 }}>{label}</div>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        required
        placeholder={placeholder}
        style={{
          width: '100%', padding: '10px 12px',
          border: `0.5px solid rgba(0,0,0,0.12)`,
          borderRadius: 8, fontSize: 14,
          color: '#2C2416', background: '#FAFAF7',
          outline: 'none', boxSizing: 'border-box',
        }}
      />
    </label>
  )
}

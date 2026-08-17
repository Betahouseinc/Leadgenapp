import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
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
  teal: '#7BCF16',
  tealL: '#F3FBEA',
}

export default function Signup() {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [needsConfirm, setNeedsConfirm] = useState(false)
  const [compliance, setCompliance] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (!compliance) { setError('Please confirm the compliance statement to continue'); return }
    setLoading(true)

    const acceptedAt = new Date().toISOString()
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Both values go through auth metadata rather than a follow-up write to
        // `profiles`. Signup returns no session while email confirmation is on,
        // so a client write here would run as `anon` and be refused by RLS —
        // which is exactly how full_name and the compliance timestamp were
        // being lost. The on_auth_user_created trigger copies these across.
        data: { full_name: fullName, terms_accepted_at: acceptedAt },
        // Without this the confirmation link falls back to the Site URL, which
        // drops a freshly confirmed user on the marketing page with no sign
        // they are actually signed in.
        emailRedirectTo: `${window.location.origin}/leads`,
      },
    })
    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    // Signing up with an address that already exists is not an error — Supabase
    // returns a user with an empty identities array so the endpoint cannot be
    // used to test which emails are registered. Without this check that case
    // renders as "Account created!" and the user waits for a mail that the
    // server deliberately never sent.
    if (data?.user && data.user.identities?.length === 0) {
      setError('An account with this email already exists. Sign in instead.')
      setLoading(false)
      return
    }

    // A session comes back only when email confirmation is off. When it is on,
    // redirecting to /leads hits the auth guard and bounces to /login, which
    // reads as a failed signup. Ask for the confirmation instead.
    if (!data?.session) {
      setLoading(false)
      setNeedsConfirm(true)
      return
    }

    // Confirmation is off, so we have a session and the profile row already
    // exists from the trigger. Fill in anything an older trigger missed.
    const { error: profileErr } = await supabase.from('profiles').upsert({
      id: data.user.id, email, full_name: fullName, terms_accepted_at: acceptedAt,
    })
    if (profileErr) console.error('Profile update after signup failed:', profileErr.message)

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

        {needsConfirm ? (
          <div style={{
            background: T.tealL,
            border: `0.5px solid ${T.teal}`,
            borderRadius: 8,
            padding: '18px 16px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.teal, marginBottom: 8 }}>
              ✓ Check your inbox
            </div>
            <div style={{ fontSize: 13.5, color: T.ink2, lineHeight: 1.6 }}>
              We sent a confirmation link to <strong style={{ color: T.ink }}>{email}</strong>.
              Click it to activate your account and your 10 free leads.
            </div>
            <div style={{ fontSize: 12.5, color: T.ink2, marginTop: 12, lineHeight: 1.6 }}>
              Nothing after a minute? Check spam, or{' '}
              <Link to="/login" style={{ color: T.blue, fontWeight: 600, textDecoration: 'none' }}>
                sign in
              </Link>{' '}
              once confirmed.
            </div>
          </div>
        ) : done ? (
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

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={compliance}
                onChange={e => setCompliance(e.target.checked)}
                style={{ marginTop: 3, flexShrink: 0, accentColor: T.blue, width: 15, height: 15 }}
              />
              <span style={{ fontSize: 12, color: T.ink2, lineHeight: 1.5 }}>
                I confirm I will use exported data in compliance with applicable anti-spam, do-not-call,
                and data protection laws, and that I am solely responsible for my outreach.
              </span>
            </label>

            <button
              type="submit"
              disabled={loading || !compliance}
              style={{
                width: '100%', padding: '11px 0',
                background: (loading || !compliance) ? T.blueL : T.blue,
                color: (loading || !compliance) ? T.blue : '#FFF',
                border: 'none', borderRadius: 8,
                fontSize: 14, fontWeight: 600,
                cursor: (loading || !compliance) ? 'not-allowed' : 'pointer',
              }}
            >{loading ? 'Creating account…' : 'Start for free'}</button>
          </form>
        )}

        {!needsConfirm && (
          <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: T.ink2 }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: T.blue, fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: '#0B0D0C', marginBottom: 6 }}>{label}</div>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        required
        placeholder={placeholder}
        style={{
          width: '100%', padding: '10px 12px',
          border: `0.5px solid rgba(11,13,12,0.12)`,
          borderRadius: 8, fontSize: 14,
          color: '#0B0D0C', background: '#FFFFFF',
          outline: 'none', boxSizing: 'border-box',
        }}
      />
    </label>
  )
}

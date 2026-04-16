import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const T = {
  bg: '#FAFAF7',
  surface: '#FFFFFF',
  ink: '#2C2416',
  ink2: '#5C5240',
  muted: '#9C8E7A',
  border: 'rgba(0,0,0,0.12)',
  blue: '#2563EB',
  blueL: '#EFF6FF',
  teal: '#1A8A72',
  tealL: '#E0F5F0',
}

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    leads: 10,
    features: ['10 leads total', 'Google Maps scraping', 'AI scoring', 'Excel export'],
    cta: 'Get started',
    highlight: false,
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 999,
    leads: 500,
    features: ['500 leads/month', 'Google Maps scraping', 'AI scoring + summary', 'Excel export', 'Email support'],
    cta: 'Start Starter',
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 2999,
    leads: 2000,
    features: ['2,000 leads/month', 'Google Maps scraping', 'AI scoring + summary', 'Excel export', 'Priority support', 'Saved searches'],
    cta: 'Start Pro',
    highlight: true,
  },
  {
    id: 'agency',
    name: 'Agency',
    price: 7999,
    leads: -1,
    features: ['Unlimited leads', 'Google Maps scraping', 'AI scoring + summary', 'Excel export', 'Dedicated support', 'Saved searches', 'Custom integrations'],
    cta: 'Contact us',
    highlight: false,
  },
]

export default function Pricing() {
  const navigate = useNavigate()
  const [currentPlan, setCurrentPlan] = useState('free')
  const [loading, setLoading] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data } = await supabase.from('profiles').select('plan_id').eq('id', session.user.id).single()
      if (data) setCurrentPlan(data.plan_id)
    })
  }, [])

  const handleSelect = async (plan) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { navigate('/login?redirect=pricing'); return }
    if (plan.id === 'free') { navigate('/leads'); return }
    if (plan.id === 'agency') {
      window.location.href = 'mailto:betahouseincorporation@gmail.com?subject=Agency Plan Enquiry'
      return
    }

    setLoading(plan.id)
    try {
      // Create Razorpay order
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-order`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ plan_id: plan.id }),
        }
      )
      const order = await res.json()
      if (!res.ok) throw new Error(order.error)

      // Load Razorpay script dynamically
      await loadRazorpay()

      // Open Razorpay checkout
      const rzp = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: 'LeadgenAI',
        description: `${order.plan_name} Plan`,
        order_id: order.order_id,
        prefill: { email: order.user_email },
        theme: { color: '#2563EB' },
        handler: () => {
          // Payment successful — webhook will update plan
          alert('Payment successful! Your plan will be upgraded in a moment.')
          navigate('/leads')
        },
      })
      rzp.open()
    } catch (err) {
      alert(err.message)
    }
    setLoading(null)
  }

  const loadRazorpay = () => new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = resolve
    document.body.appendChild(script)
  })

  return (
    <div style={{
      minHeight: '100vh',
      background: T.bg,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '60px 24px',
    }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div
            onClick={() => navigate('/leads')}
            style={{ fontSize: 22, fontWeight: 800, color: T.blue, marginBottom: 12, cursor: 'pointer' }}
          >LeadgenAI</div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: T.ink, margin: '0 0 12px' }}>
            Simple, transparent pricing
          </h1>
          <p style={{ fontSize: 16, color: T.ink2, margin: 0 }}>
            Start free. Upgrade when you need more leads.
          </p>
        </div>

        {/* Plans grid */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          {PLANS.map(plan => (
            <div
              key={plan.id}
              style={{
                background: T.surface,
                border: plan.highlight ? `2px solid ${T.blue}` : `0.5px solid ${T.border}`,
                borderRadius: 8,
                padding: '28px 24px',
                width: 210,
                position: 'relative',
                flex: '1 1 200px',
                maxWidth: 240,
              }}
            >
              {plan.highlight && (
                <div style={{
                  position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                  background: T.blue, color: '#FFF',
                  padding: '3px 12px', borderRadius: 20,
                  fontSize: 11, fontWeight: 700,
                }}>MOST POPULAR</div>
              )}

              <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, marginBottom: 8 }}>{plan.name}</div>
              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: plan.highlight ? T.blue : T.ink }}>
                  {plan.price === 0 ? 'Free' : `₹${plan.price.toLocaleString()}`}
                </span>
                {plan.price > 0 && <span style={{ fontSize: 13, color: T.muted }}>/mo</span>}
              </div>

              <div style={{ fontSize: 12, color: T.muted, marginBottom: 16 }}>
                {plan.leads === -1 ? 'Unlimited leads' : `${plan.leads.toLocaleString()} leads/month`}
              </div>

              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px', fontSize: 13, color: T.ink2 }}>
                {plan.features.map(f => (
                  <li key={f} style={{ marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    <span style={{ color: T.teal, fontWeight: 700 }}>✓</span> {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelect(plan)}
                disabled={loading === plan.id || currentPlan === plan.id}
                style={{
                  width: '100%',
                  padding: '10px 0',
                  background: currentPlan === plan.id ? T.tealL : plan.highlight ? T.blue : 'transparent',
                  color: currentPlan === plan.id ? T.teal : plan.highlight ? '#FFF' : T.blue,
                  border: `1px solid ${currentPlan === plan.id ? T.teal : T.blue}`,
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: currentPlan === plan.id ? 'default' : 'pointer',
                }}
              >
                {currentPlan === plan.id ? 'Current plan' : loading === plan.id ? 'Loading…' : plan.cta}
              </button>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 40, fontSize: 13, color: T.muted }}>
          All plans include AI-powered lead scoring and Excel export. <br />
          Questions? Email <a href="mailto:betahouseincorporation@gmail.com" style={{ color: T.blue }}>betahouseincorporation@gmail.com</a>
        </div>
      </div>
    </div>
  )
}

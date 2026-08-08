import { useParams, useNavigate } from 'react-router-dom'

const T = {
  bg: '#FAFAF7',
  surface: '#FFFFFF',
  ink: '#2C2416',
  ink2: '#5C5240',
  muted: '#9C8E7A',
  border: 'rgba(0,0,0,0.12)',
  blue: '#2563EB',
  blueL: '#EFF6FF',
}

const COMPANY = 'Exommerce.online'
const BRAND = 'LeadgenAI'
const SUPPORT = 'admin@exommerce.online'
const UPDATED = '4 August 2026'

const LEGAL_PAGES = {
  terms: {
    title: 'Terms of Use',
    blurb: `The rules for using ${BRAND}. Please read them before you create an account.`,
    sections: [
      {
        heading: '1. Who we are',
        body: `${BRAND} ("the Service") is operated by ${COMPANY}, Bengaluru, Karnataka, India. By creating an account or using the Service you agree to these Terms. If you are accepting on behalf of a company, you confirm you are authorised to bind that company.`,
      },
      {
        heading: '2. What the Service does',
        body: `${BRAND} collects publicly listed business information from third-party sources — currently Google Maps — based on the industry and location you search for. Each result is scored using an AI model and made available in your account for filtering, annotation and export.

The Service returns information about businesses. It is a research and prospecting tool. It does not send messages, place calls, or contact anyone on your behalf.`,
      },
      {
        heading: '3. Accuracy is not guaranteed',
        body: `Results are gathered from third-party sources and are provided "as is". Business details may be outdated, incomplete or incorrect, and AI-generated scores and summaries are estimates, not verified facts.

You are responsible for verifying any information before you rely on it or act on it commercially. We do not warrant that any lead will be reachable, relevant, or in business.`,
      },
      {
        heading: '4. How you may use the data',
        body: `You may use exported data for your own legitimate business development. You must not:

• Contact anyone in a way that breaks applicable law, including TRAI regulations on unsolicited commercial communication and the National Do Not Call (DND) registry
• Resell, redistribute or publish the raw data as a standalone list or database product
• Use the Service to build a competing lead-generation product
• Attempt to circumvent plan limits, or access another user's account or data
• Use automated means to extract data from the Service beyond the export features we provide

You are solely responsible for your outreach. If you email, call or message a lead, the legal obligations of that outreach — consent, opt-out, record-keeping — are yours, not ours.`,
      },
      {
        heading: '5. Plans, billing and limits',
        body: `Paid plans are billed in advance in Indian Rupees (₹) through Razorpay. Each plan includes a monthly allowance of leads, shown on the Pricing page. Allowances reset at the start of each calendar month and do not carry over.

A lead counts towards your allowance when it is successfully added to your account. Searches that return no new results, or where AI scoring fails, do not consume your allowance.

We may change prices with at least 30 days' notice. Changes will not affect a billing period you have already paid for.`,
      },
      {
        heading: '6. Acceptable use of our infrastructure',
        body: `The Service depends on paid third-party APIs. We may apply fair-use limits, throttle unusual activity, or suspend an account that places disproportionate load on the platform or appears to be automated abuse. Where practical we will contact you first.`,
      },
      {
        heading: '7. Availability',
        body: `We aim to keep the Service available but do not guarantee uninterrupted access. The Service may be unavailable for maintenance, or because of failures in third-party services we depend on. We are not liable for losses arising from downtime.`,
      },
      {
        heading: '8. Termination',
        body: `You may stop using the Service and delete your account at any time. We may suspend or terminate an account that breaches these Terms. On termination you may export your data for 30 days, after which it may be permanently deleted.`,
      },
      {
        heading: '9. Liability',
        body: `To the extent permitted by law, our total liability to you for any claim relating to the Service is limited to the amount you paid us in the three months before the claim arose. We are not liable for indirect or consequential losses, including lost profits or lost business opportunities.`,
      },
      {
        heading: '10. Governing law',
        body: `These Terms are governed by the laws of India. Any dispute is subject to the exclusive jurisdiction of the courts of Bengaluru, Karnataka.`,
      },
      {
        heading: '11. Contact',
        body: `Questions about these Terms: ${SUPPORT}`,
      },
    ],
  },

  privacy: {
    title: 'Privacy Policy',
    blurb: 'What we collect, why, and what you can ask us to do with it.',
    sections: [
      {
        heading: '1. Scope',
        body: `This policy covers ${BRAND}, operated by ${COMPANY}. It describes two distinct categories of information: data about you as our customer, and business information we collect from public sources on your behalf. These are treated differently and are explained separately below.`,
      },
      {
        heading: '2. Information about you',
        body: `When you create an account we collect your name, email address and password (stored hashed, never in plain text). If you subscribe to a paid plan, payment is processed by Razorpay — we receive confirmation of payment and a transaction reference, but we never receive or store your card, UPI or bank details.

We also record usage information: the searches you run, your lead counts, and basic technical logs used to diagnose faults.`,
      },
      {
        heading: '3. Business information collected on your behalf',
        body: `When you run a search, we retrieve publicly listed business information from third-party sources — business name, category, address, phone number, website, ratings and review counts, and where published on the business's own website, a business email address and social media links.

This is information businesses have published for the purpose of being contacted. We do not knowingly collect private profiles or personal information about named employees, their direct contact details, or job titles.

However, publicly listed business data may incidentally include personal data of identifiable individuals — for example, sole proprietors whose personal name or mobile number is the registered business contact, or names appearing in public reviews. Such incidental personal data is subject to the same access, correction, and deletion rights described in section 8 and the same removal process: email ${SUPPORT} with subject line "Data request" and we will remove it from our systems.`,
      },
      {
        heading: '4. Your role and ours',
        body: `For the business information returned by your searches, you decide what to search for and how to use the results. You are responsible for having a lawful basis for your outreach, and for honouring opt-out requests from anyone you contact. We provide the tooling; the outreach decisions are yours.`,
      },
      {
        heading: '5. How we use information',
        body: `• To provide the Service and store your leads
• To enforce plan limits and process payments
• To send transactional email about your account — receipts, limit warnings, security notices
• To diagnose faults and improve reliability

We do not sell your data. We do not use your leads for our own marketing, and we do not share your lead lists with other users.`,
      },
      {
        heading: '6. Sub-processors',
        body: `We rely on the following services, each of which may process data on our behalf:

• Supabase — database, authentication and server functions
• Vercel — website hosting
• Apify — retrieval of public business listings
• Google (Gemini) — AI scoring and summarisation of business listings
• Razorpay — payment processing

Data is stored on infrastructure located outside India. By using the Service you consent to this transfer.`,
      },
      {
        heading: '7. Retention',
        body: `Account and lead data is retained while your account is active. After account deletion, data is removed within 30 days, except where we are required to retain transaction records for tax and accounting purposes.`,
      },
      {
        heading: '8. Your rights',
        body: `You may request access to the personal data we hold about you, ask us to correct it, ask us to delete it, or withdraw consent. You can export your own leads at any time from the dashboard using CSV or Excel export.

To make a request, email ${SUPPORT}. We aim to respond within 30 days.`,
      },
      {
        heading: '9. Security',
        body: `Access to your data is restricted at the database level so that each account can only read its own records. Passwords are hashed. API credentials are held in encrypted secret storage and never exposed to the browser.

No system is perfectly secure. If we become aware of a breach affecting your data, we will notify you.`,
      },
      {
        heading: '10. Cookies',
        body: `We use browser storage to keep you signed in. We use Google Analytics to understand aggregate usage. We do not use advertising or cross-site tracking cookies.`,
      },
      {
        heading: '11. Changes and contact',
        body: `We will post any material change to this policy on this page and update the date above. Questions: ${SUPPORT}`,
      },
    ],
  },

  refunds: {
    title: 'Refund & Cancellation Policy',
    blurb: 'When you can cancel, and when we will refund you.',
    sections: [
      {
        heading: '1. Free plan',
        body: `The free plan requires no payment and can be used to evaluate the Service before you subscribe. We recommend running searches on the free plan first to confirm the data suits your market and industry.`,
      },
      {
        heading: '2. Cancelling a subscription',
        body: `You may cancel at any time from your account settings, or by emailing ${SUPPORT}. Cancellation stops future billing. Your plan remains active until the end of the period you have already paid for, and your leads remain accessible during that time.`,
      },
      {
        heading: '3. Refunds',
        body: `If you cancel within 7 days of your first payment and have used fewer than 10% of your plan's monthly lead allowance, we will refund that payment in full.

Beyond that, payments are non-refundable, because each lead we deliver incurs an irreversible third-party cost to us at the moment it is generated.

We will refund in full, regardless of the above, where:
• You were charged in error or charged twice
• A fault on our side prevented the Service from delivering leads for a sustained period and we could not resolve it`,
      },
      {
        heading: '4. What is not refundable',
        body: `We do not refund on the basis that leads were not commercially successful, that a business did not respond to your outreach, or that fewer results were available for a particular industry or location than you expected. Availability of public listings varies by market and is outside our control. Please validate this on the free plan first.`,
      },
      {
        heading: '5. How refunds are processed',
        body: `Approved refunds are returned to the original payment method through Razorpay, normally within 5–7 working days. We will confirm by email when a refund is issued.`,
      },
      {
        heading: '6. Requesting a refund',
        body: `Email ${SUPPORT} with your account email address and the reason for the request. We aim to respond within 3 working days.`,
      },
    ],
  },

  contact: {
    title: 'Contact Us',
    blurb: 'How to reach us.',
    sections: [
      {
        heading: 'Support and general enquiries',
        body: `Email: ${SUPPORT}

We aim to respond within 2 working days, Monday to Friday.`,
      },
      {
        heading: 'Business details',
        body: `${COMPANY}
Bengaluru, Karnataka, India`,
      },
      {
        heading: 'Privacy, data and removal requests',
        body: `To access, correct or delete your data, or to request removal of a business record, email ${SUPPORT} with the subject line "Data request".`,
      },
      {
        heading: 'Billing and refunds',
        body: `For invoices, cancellations or refund requests, email ${SUPPORT} with the subject line "Billing".`,
      },
    ],
  },
}

const NAV = [
  ['terms', 'Terms of Use'],
  ['privacy', 'Privacy Policy'],
  ['refunds', 'Refunds'],
  ['contact', 'Contact'],
]

export default function Legal() {
  const { doc } = useParams()
  const navigate = useNavigate()
  const key = LEGAL_PAGES[doc] ? doc : 'terms'
  const page = LEGAL_PAGES[key]

  return (
    <div style={{
      minHeight: '100vh', background: T.bg, color: T.ink,
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        background: T.surface, borderBottom: `0.5px solid ${T.border}`,
        padding: '0 24px', height: 56, display: 'flex',
        alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 18, fontWeight: 800, color: T.blue, letterSpacing: '-0.5px',
          }}
        >LeadgenAI</button>
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'none', border: `0.5px solid ${T.border}`,
            borderRadius: 8, padding: '6px 14px',
            fontSize: 13, color: T.ink2, cursor: 'pointer',
          }}
        >← Back to site</button>
      </div>

      <div style={{
        maxWidth: 1000, margin: '0 auto', padding: '32px 24px 80px',
        display: 'flex', gap: 40, flexWrap: 'wrap', alignItems: 'flex-start',
      }}>
        <nav style={{ flex: '0 0 200px', minWidth: 180 }}>
          {NAV.map(([k, label]) => (
            <button
              key={k}
              onClick={() => navigate(`/legal/${k}`)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '9px 12px', marginBottom: 4,
                background: key === k ? T.blueL : 'none',
                border: 'none', borderRadius: 8, cursor: 'pointer',
                fontSize: 13.5, fontWeight: key === k ? 700 : 500,
                color: key === k ? T.blue : T.ink2,
              }}
            >{label}</button>
          ))}
        </nav>

        <main style={{ flex: 1, minWidth: 300 }}>
          <h1 style={{ fontSize: 30, fontWeight: 800, margin: '0 0 8px', letterSpacing: '-0.5px' }}>
            {page.title}
          </h1>
          <p style={{ fontSize: 14.5, color: T.ink2, margin: '0 0 4px', lineHeight: 1.6 }}>
            {page.blurb}
          </p>
          <p style={{ fontSize: 12.5, color: T.muted, margin: '0 0 28px' }}>
            Last updated {UPDATED}
          </p>

          <div style={{
            background: T.surface, border: `0.5px solid ${T.border}`,
            borderRadius: 10, padding: '8px 24px 24px',
          }}>
            {page.sections.map((s, i) => (
              <section key={i} style={{ paddingTop: 20 }}>
                <h2 style={{ fontSize: 15.5, fontWeight: 700, margin: '0 0 8px' }}>
                  {s.heading}
                </h2>
                <p style={{
                  fontSize: 14, lineHeight: 1.75, color: T.ink2,
                  margin: 0, whiteSpace: 'pre-line',
                }}>{s.body}</p>
              </section>
            ))}
          </div>

          <p style={{ fontSize: 12.5, color: T.muted, marginTop: 24, lineHeight: 1.6 }}>
            {BRAND} is a product of {COMPANY} · Powered by{' '}
            <a href="https://exommerce.online" style={{ color: T.blue, textDecoration: 'none' }}>
              Exommerce.online
            </a>
          </p>
        </main>
      </div>
    </div>
  )
}

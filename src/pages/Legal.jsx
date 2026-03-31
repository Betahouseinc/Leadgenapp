import { useParams, Link } from "react-router-dom";

const T = {
  bg:"#FAFAF7", surface:"#FFFFFF", panel:"#F5F3EE",
  border:"#E8E4DC", ink:"#2C2416", ink2:"#5C5240",
  muted:"#9C8E7A", saffron:"#E8821A", saffronB:"#F5A650",
};

const PAGES = {
  privacy: {
    title: "Privacy Policy",
    icon: "🔒",
    updated: "28 March 2026",
    sections: [
      {
        heading: "1. Information We Collect",
        body: `We collect information you provide directly to us when you register for an account, including your name, email address, and property details. We also collect usage data such as pages visited, features used, and device information to improve our service.`,
      },
      {
        heading: "2. How We Use Your Information",
        body: `We use the information we collect to:\n• Provide, maintain, and improve RentAI services\n• Process rent payments and send payment reminders\n• Send transactional emails and account notifications\n• Respond to your comments and support requests\n• Monitor and analyse usage patterns to improve user experience`,
      },
      {
        heading: "3. Information Sharing",
        body: `We do not sell, trade, or otherwise transfer your personal information to third parties except as described in this policy. We may share your information with:\n• Service providers (Supabase for database, email providers) who assist in operating our platform\n• Law enforcement when required by applicable law\n• Other parties with your explicit consent`,
      },
      {
        heading: "4. Data Storage",
        body: `Your data is stored securely on Supabase infrastructure hosted in data centres with industry-standard security. We retain your data for as long as your account is active, or as needed to provide services. You may request deletion of your data at any time by contacting support@rentai.co.in.`,
      },
      {
        heading: "5. Cookies",
        body: `We use localStorage and session storage to maintain your login session and theme preferences. We do not use third-party tracking cookies. Analytics data (Google Analytics) is anonymised and used solely to understand aggregate usage patterns.`,
      },
      {
        heading: "6. Your Rights",
        body: `You have the right to:\n• Access the personal data we hold about you\n• Request correction of inaccurate data\n• Request deletion of your data\n• Withdraw consent at any time\n\nTo exercise these rights, contact us at support@rentai.co.in.`,
      },
      {
        heading: "7. Contact Us",
        body: `For any privacy-related questions, contact us at:\nEmail: support@rentai.co.in\nRentAI, Bengaluru, Karnataka, India`,
      },
    ],
  },
  terms: {
    title: "Terms of Use",
    icon: "📋",
    updated: "28 March 2026",
    sections: [
      {
        heading: "1. Acceptance of Terms",
        body: `By accessing or using RentAI, you agree to be bound by these Terms of Use. If you do not agree to these terms, please do not use our service.`,
      },
      {
        heading: "2. Description of Service",
        body: `RentAI is a property management platform designed for Indian landlords and tenants. The service includes rent tracking, payment reminders, expense management, tenant management, and related features.`,
      },
      {
        heading: "3. User Accounts",
        body: `You are responsible for maintaining the confidentiality of your account credentials. You agree to:\n• Provide accurate and complete registration information\n• Notify us immediately of any unauthorised use of your account\n• Not share your account with others\n• Not use the service for any unlawful purpose`,
      },
      {
        heading: "4. Acceptable Use",
        body: `You agree not to:\n• Use RentAI to facilitate illegal rental arrangements\n• Upload false or misleading property or tenant information\n• Attempt to reverse-engineer or copy the platform\n• Use automated bots or scrapers\n• Harass other users or misuse the communication features`,
      },
      {
        heading: "5. Payments and Billing",
        body: `Free-tier users may use RentAI at no charge subject to plan limits. Paid plans are billed annually or monthly as selected. Refunds are available within 7 days of purchase if the service has not been substantially used. Prices are in Indian Rupees (₹) and inclusive of applicable taxes.`,
      },
      {
        heading: "6. Referral Programme",
        body: `Our referral programme gives you and referred users discounts on paid subscriptions. Referral rewards are at our discretion and may be changed or discontinued at any time. Fraudulent referrals will result in account suspension.`,
      },
      {
        heading: "7. Limitation of Liability",
        body: `RentAI is provided "as is" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the service. Our total liability shall not exceed the amount you paid us in the 3 months preceding the claim.`,
      },
      {
        heading: "8. Termination",
        body: `We reserve the right to suspend or terminate your account for violation of these terms. You may close your account at any time by contacting support@rentai.co.in.`,
      },
      {
        heading: "9. Governing Law",
        body: `These terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts in Bengaluru, Karnataka.`,
      },
    ],
  },
  security: {
    title: "Security Policy",
    icon: "🛡️",
    updated: "28 March 2026",
    sections: [
      {
        heading: "1. Infrastructure Security",
        body: `RentAI uses Supabase as its backend, which is built on PostgreSQL with row-level security (RLS) enforced at the database level. All data is encrypted in transit using TLS 1.2+ and at rest using AES-256 encryption.`,
      },
      {
        heading: "2. Authentication",
        body: `We use email-based one-time passwords (OTP) for authentication — no passwords are stored. OTPs expire within 10 minutes. Sessions are bound to a 7-day TTL and invalidated on logout. We do not store any payment card information.`,
      },
      {
        heading: "3. Access Control",
        body: `All database queries are protected by row-level security policies ensuring users can only access their own data. Owner data, tenant data, and admin data are strictly isolated. API keys are never exposed to the frontend.`,
      },
      {
        heading: "4. Vulnerability Disclosure",
        body: `If you discover a security vulnerability in RentAI, please report it responsibly to security@rentai.co.in. We ask that you:\n• Give us reasonable time to investigate and fix the issue\n• Not publicly disclose the vulnerability until we've addressed it\n• Not access or modify data that is not yours`,
      },
      {
        heading: "5. Data Backups",
        body: `Database backups are taken daily and retained for 30 days. In the event of data loss, we will restore from the most recent available backup and notify affected users promptly.`,
      },
      {
        heading: "6. Security Updates",
        body: `We regularly update our dependencies and infrastructure to address known vulnerabilities. Critical security patches are applied within 24 hours of availability.`,
      },
    ],
  },
  "data-protection": {
    title: "Data Protection Policy",
    icon: "🗄️",
    updated: "28 March 2026",
    sections: [
      {
        heading: "1. Our Commitment",
        body: `RentAI is committed to protecting the personal data of all users in accordance with the Information Technology Act, 2000 and the Digital Personal Data Protection Act, 2023 (DPDPA) of India.`,
      },
      {
        heading: "2. Data We Process",
        body: `We process the following categories of personal data:\n• Identity data: name, email address\n• Property data: property address, unit details, rent amounts\n• Tenant data: tenant names, contact details, lease information\n• Financial data: rent payment records, expense records\n• Usage data: login times, features accessed, device type`,
      },
      {
        heading: "3. Legal Basis for Processing",
        body: `We process personal data on the following legal bases:\n• Contractual necessity: to provide the RentAI service you have subscribed to\n• Legitimate interests: to improve our service and prevent fraud\n• Legal obligation: to comply with applicable laws\n• Consent: for marketing communications (which you may withdraw at any time)`,
      },
      {
        heading: "4. Data Retention",
        body: `We retain personal data for as long as your account remains active. After account closure:\n• Financial records are retained for 7 years as required by Indian law\n• All other personal data is deleted within 90 days of account closure\n• Anonymised analytics data may be retained indefinitely`,
      },
      {
        heading: "5. Data Transfers",
        body: `Your data is stored on servers located in data centres compliant with industry security standards. Where data is processed by third-party service providers outside India, we ensure appropriate safeguards are in place.`,
      },
      {
        heading: "6. Your Rights Under DPDPA",
        body: `Under the Digital Personal Data Protection Act 2023, you have the right to:\n• Access your personal data\n• Correct inaccurate personal data\n• Erase your personal data (right to be forgotten)\n• Nominate another person to exercise rights on your behalf\n\nSubmit requests to: dpo@rentai.co.in`,
      },
      {
        heading: "7. Data Protection Officer",
        body: `Our Data Protection Officer can be contacted at:\nEmail: dpo@rentai.co.in\nRentAI, Bengaluru, Karnataka, India`,
      },
    ],
  },
};

export default function Legal() {
  const { page } = useParams();
  const content = PAGES[page];

  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: ${T.bg}; font-family: 'Nunito', 'Segoe UI', sans-serif; }
    @keyframes fadeUp { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
    .fu { animation: fadeUp .35s ease both; }
  `;

  if (!content) {
    return (
      <div style={{ fontFamily:"'Nunito','Segoe UI',sans-serif", background:T.bg, minHeight:"100vh",
        display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:12 }}>
        <style>{CSS}</style>
        <div style={{ fontSize:48 }}>🤷</div>
        <div style={{ fontSize:18, fontWeight:800, color:T.ink }}>Page not found</div>
        <Link to="/" style={{ color:T.saffron, fontWeight:700, fontSize:13 }}>← Back to RentAI</Link>
      </div>
    );
  }

  return (
    <div style={{ fontFamily:"'Nunito','Segoe UI',sans-serif", background:T.bg, minHeight:"100vh" }}>
      <style>{CSS}</style>

      {/* Nav */}
      <nav style={{ background:T.surface, borderBottom:`1px solid ${T.border}`, padding:"12px 20px",
        display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:50 }}>
        <Link to="/" style={{ display:"flex", alignItems:"center", gap:8, textDecoration:"none" }}>
          <div style={{ width:28, height:28, borderRadius:8,
            background:`linear-gradient(135deg,${T.saffron},${T.saffronB})`,
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>🔑</div>
          <span style={{ fontWeight:900, fontSize:14, color:T.ink }}>RentAI</span>
        </Link>
        <Link to="/" style={{ fontSize:12, fontWeight:700, color:T.muted, textDecoration:"none" }}>← Back</Link>
      </nav>

      {/* Content */}
      <div className="fu" style={{ maxWidth:680, margin:"0 auto", padding:"32px 20px 64px" }}>
        {/* Header */}
        <div style={{ marginBottom:32 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>{content.icon}</div>
          <h1 style={{ fontSize:28, fontWeight:900, color:T.ink, letterSpacing:-0.8, marginBottom:8 }}>
            {content.title}
          </h1>
          <div style={{ fontSize:12, color:T.muted, fontWeight:600 }}>
            Last updated: {content.updated}
          </div>
        </div>

        {/* Sections */}
        {content.sections.map((s, i) => (
          <div key={i} style={{ marginBottom:28 }}>
            <h2 style={{ fontSize:15, fontWeight:800, color:T.ink, marginBottom:8 }}>{s.heading}</h2>
            <div style={{ fontSize:13, color:T.ink2, lineHeight:1.8, whiteSpace:"pre-line" }}>{s.body}</div>
          </div>
        ))}

        {/* Footer links */}
        <div style={{ marginTop:40, paddingTop:20, borderTop:`1px solid ${T.border}`,
          display:"flex", gap:16, flexWrap:"wrap" }}>
          {[
            { label:"Privacy Policy", href:"/legal/privacy" },
            { label:"Terms of Use", href:"/legal/terms" },
            { label:"Security", href:"/legal/security" },
            { label:"Data Protection", href:"/legal/data-protection" },
          ].map(l => (
            <Link key={l.href} to={l.href}
              style={{ fontSize:12, fontWeight:700, color: l.href===`/legal/${page}` ? T.saffron : T.muted,
                textDecoration:"none" }}>
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

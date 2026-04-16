# App Build Checklist

> Rule #1: Don't touch payments until a stranger can sign up, use the product,
> and understand its value without your help.

---

## Phase 1 — Foundation
> Complete before writing any feature code.

- [ ] Define the user persona and core problem in one sentence
- [ ] Map the full user journey end-to-end (Landing → Auth → Core feature → Paywall)
- [ ] Set up repo, hosting (Vercel), and env vars properly from day one
- [ ] Deploy a "hello world" to production *before* building features
- [ ] Confirm domain / project name is available (GitHub, Vercel, socials)

---

## Phase 2 — Auth & Core Feature

- [ ] Landing page with clear value proposition and CTA
- [ ] Signup / Login / Logout working
- [ ] Redirect logic correct (no loops between /login and other pages)
- [ ] The one core feature working end-to-end
- [ ] Error states handled (API failures, empty results, etc.)
- [ ] Empty states handled (new user with no data)
- [ ] Mobile-responsive

---

## Phase 3 — Data & Multi-tenancy

- [ ] Database schema locked in (avoid surprise migrations later)
- [ ] RLS / access control — users only see their own data
- [ ] Usage tracking in place (if the product has limits)
- [ ] Data export working (CSV, Excel, etc.)

---

## Phase 4 — Monetization
> Only start this phase after Phases 1–3 are solid and tested.

- [ ] Pricing page designed and live
- [ ] Free tier limits enforced in the backend (not just the UI)
- [ ] Payment integration (Razorpay / Stripe)
- [ ] Webhook to update plan after payment
- [ ] Plan limits enforced in backend edge functions
- [ ] Upgrade / downgrade flow tested end-to-end with test keys
- [ ] Switch to live payment keys before launch

---

## Phase 5 — Polish & Launch

- [ ] Browser tab title and favicon set correctly
- [ ] SEO basics: meta description, og:title, og:image
- [ ] Onboarding flow for new signups (tooltip, empty state CTA, etc.)
- [ ] Email confirmation working
- [ ] Password reset working
- [ ] Analytics added (Vercel Analytics or Plausible)
- [ ] Test the full flow as a brand new user in an incognito window
- [ ] Ask one real person outside the team to use it cold — watch where they get stuck

---

## Lessons Learned (LeadgenAI — Apr 2025)

- Set up the landing page and routing *first* — a missing home page breaks every other user flow
- Use the correct Supabase key format (JWT anon key, not publishable key) from the start
- Deploy edge functions with `--no-verify-jwt` when using ES256 tokens
- Synchronous API calls (waitForFinish) are simpler than webhooks for short-running tasks
- Never commit API keys or secrets — add sensitive config files to .gitignore before first push
- LinkedIn scraping requires session cookies — don't promise it without checking API constraints
- Push to the correct GitHub remote from day one (confirm with `git remote -v`)

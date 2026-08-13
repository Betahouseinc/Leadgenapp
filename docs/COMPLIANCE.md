# Compliance notes — data sourcing

Working notes on the legal exposure of how LeadgenAI obtains data. Not legal
advice; written so the risks are on the record rather than discovered later.

Last reviewed: 13 August 2026.

## What we actually collect

Business name, category, address, phone, website, rating, review count, and —
where the business publishes it on its own site — a business email address.
Sourced from Google Maps listings via Apify, then scored by Gemini.

## 1. Google Maps Terms of Service — the real exposure

This is the material risk, and the current setup does not clearly comply.

Google's Maps/Places terms prohibit scraping, caching Places content beyond
limited periods, and storing or redistributing Places data outside a Google
Map. LeadgenAI does all three: it extracts listing data, stores it
indefinitely in Postgres, and lets customers export it to CSV/Excel.

Using Apify rather than calling Google directly does not change this. It moves
who performs the scraping, not whether the resulting use is permitted.

Practical exposure is commercial rather than statutory — Google blocking the
actor, or sending a cease-and-desist — but it is a real dependency risk for a
product being sold to customers on the promise of continuous supply.

Options, roughly in order of cost:

- **Accept and monitor.** Cheapest, and where the product is today. Keep the
  "accuracy not guaranteed" language in the Terms and be ready for supply to
  stop without notice.
- **Move to the official Places API.** Compliant, but paid per request, has its
  own caching restrictions, and would not permit the export feature as built.
- **Change source.** Open datasets (OpenStreetMap, government business
  registries) or explicitly licensed data. Lower volume, no ToS conflict.

**This needs a decision from the business owner.** It is not something to fix
in code. Until it is made, do not market uninterrupted data supply as a
guarantee.

## 2. India — DPDP Act 2023

Mostly favourable. The Act governs *personal* data; genuine business contact
details of a company are not personal data.

The catch is that a large share of Indian small businesses are sole
proprietorships, where the listed mobile number and the owner's personal
number are the same. That data **is** personal data, and it is collected
without consent.

Current position, and why it is defensible:
- Publicly available personal data that the individual themselves made public
  is exempt under s.3(c)(ii). A business phone number the owner published on
  their own Google listing fits.
- The exemption is narrower than it looks. It covers the data being *public*,
  not any downstream use.

Already in place: privacy policy discloses incidental personal data
(section 3), a removal route at privacy@exommerce.online, and a 30-day
response commitment.

Gap: no automated way to honour an erasure request. Today it is a manual SQL
delete. Fine at current volume, will not scale.

## 3. EU/UK — GDPR, if selling outside India

The task framing mentions selling globally. **GDPR is where the current
approach is weakest**, and the gap is structural, not cosmetic.

- Scraped contact data is personal data under GDPR whether or not it is
  business data. The narrow "publicly available" carve-out in the DPDP Act has
  no clean GDPR equivalent.
- The plausible lawful basis is legitimate interest, which requires a
  documented balancing test we have not done.
- **Article 14 requires notifying each person whose data was collected
  indirectly, normally within one month.** We do not do this, and at scrape
  volume it is impractical. This is the single largest gap.
- Data subject rights (access, erasure, objection) would need to work on
  request, not just in policy text.

**Recommendation: do not market to EU/UK customers, or scrape EU/UK
businesses, without advice first.** Selling to an EU customer who then scrapes
EU businesses puts us in the chain. The current Terms restrict outreach
conduct but do not restrict geography — worth adding if EU expansion is not
planned.

## 4. Outreach law is the customer's, and is contracted as such

Terms section 4 puts anti-spam, TRAI and DND obligations on the customer, and
signup records acceptance in `profiles.terms_accepted_at`. That allocation is
reasonable — we supply data, we do not send anything.

It is not unlimited. Knowingly supplying data to a customer who is obviously
using it unlawfully would not be covered by a contract term. Worth acting on
if it ever becomes visible.

## Summary

| Area | Status |
|---|---|
| Google Maps ToS | **Unresolved — needs an owner decision** |
| DPDP (India) | Defensible; erasure is manual |
| GDPR (EU/UK) | **Do not expand without advice — Art. 14 gap** |
| Outreach liability | Contracted to the customer |
| In-product disclosure | Done — shown on the leads dashboard |

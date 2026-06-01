# Yield — Legal Compliance Checklist (California + US)

> Last updated: 2026-05-31  
> Status: MANDATORY from Day 1. Do not launch without every item in this file addressed.

---

## 1. CCPA / CPRA (California Consumer Privacy Act / California Privacy Rights Act)

**Applies to:** Any for-profit business that collects personal information from California residents AND meets one of:
- Gross annual revenue > $25M, OR
- Buys/sells/shares personal info of 100,000+ consumers/households per year, OR
- Derives 50%+ of annual revenue from selling/sharing personal info

**Even below these thresholds, best practice is to comply from day 1** — restaurants and operators are California residents; their data is personal information.

### Requirements
- [ ] **Privacy Policy** page (publicly accessible, plain English + Spanish if serving Spanish speakers)
  - What categories of personal info we collect (name, email, phone, business data, usage data, IP)
  - Why we collect it (service delivery, billing, analytics)
  - Whether we sell or share it (we do NOT sell; state this explicitly)
  - How long we retain it
  - Consumer rights (access, delete, correct, opt-out of sale, limit sensitive PI use)
- [ ] **"Do Not Sell or Share My Personal Information"** link in footer (even if we don't sell — required if you "share" with ad networks; if we use analytics/pixels, this applies)
- [ ] **Data Subject Request (DSR) form** — consumers can request access, deletion, correction within 45 days
- [ ] **Opt-out of sale/sharing** honored within 15 business days
- [ ] **Sensitive personal information** (financial data, precise geolocation): must offer right to limit use
- [ ] **Data retention schedule** — delete data after purpose is fulfilled; document retention periods
- [ ] **Contractor/vendor DPAs** — any third party that processes user data needs a Data Processing Agreement
  - Supabase: ✅ DPA available at supabase.com/legal/dpa
  - Stripe: ✅ DPA available in Stripe dashboard
  - Netlify: ✅ DPA available at netlify.com/gdpr-ccpa
  - Azure (Document Intelligence): ✅ DPA in Azure portal
- [ ] **Employee/applicant privacy notice** if/when hiring

### Enforcement
- California AG + California Privacy Protection Agency (CPPA)
- Fines: up to $2,500/violation (unintentional), $7,500/violation (intentional)
- Private right of action for data breaches: $100–$750 per consumer per incident

---

## 2. CalOPPA (California Online Privacy Protection Act)

**Applies to:** Any operator of a website or online service that collects personally identifiable information from California residents.

**This applies to us from day 1, no revenue threshold.**

### Requirements
- [ ] Conspicuous privacy policy on the website (linked from homepage/app)
- [ ] Privacy policy must disclose:
  - What PII is collected
  - Third parties with whom we share PII
  - Process for users to review/change their info
  - How we respond to "Do Not Track" browser signals (state our policy — we either honor it or explain we don't)
  - Effective date of the policy
- [ ] Policy must be accessible from every page (footer link)
- [ ] "Do Not Track" disclosure: since there's no universal standard, we must at minimum disclose whether we honor it

---

## 3. ADA Title III / WCAG 2.1 AA (Web Accessibility)

**Applies to:** Courts have extended ADA Title III to websites of businesses open to the public. California courts are particularly aggressive on this.

**Risk:** Serial litigants file ADA web accessibility lawsuits at high volume in California. This is a real, common litigation risk for SaaS products.

### Requirements — WCAG 2.1 Level AA
- [ ] **Perceivable**
  - All images have alt text
  - Videos have captions
  - Color is not the only way to convey information (use icons + text, not just red/green)
  - Text contrast ratio ≥ 4.5:1 (normal text), 3:1 (large text)
  - Text can be resized up to 200% without loss of function
- [ ] **Operable**
  - All functionality available via keyboard (no mouse-only actions)
  - No content that flashes more than 3 times/second
  - Skip navigation link ("Skip to main content")
  - Page titles are descriptive
  - Focus is visible (don't remove outline CSS without replacement)
  - Sufficient time for time-limited actions
- [ ] **Understandable**
  - Language of page declared in HTML (`<html lang="en">`)
  - Error messages are descriptive and suggest correction
  - Labels on all form inputs
  - Consistent navigation across pages
- [ ] **Robust**
  - Valid HTML (proper semantic tags)
  - ARIA roles/labels on custom components
  - Compatible with screen readers (NVDA, JAWS, VoiceOver)
- [ ] **Accessibility statement** page explaining our commitment and how to report issues
- [ ] Run automated scan: axe DevTools, Lighthouse Accessibility, WAVE
- [ ] Manual screen reader test before launch

### Tools
- `npm install -g @axe-core/cli` — automated scanning
- Lighthouse (built into Chrome DevTools) — quick audit
- WAVE browser extension — visual overlay

---

## 4. CAN-SPAM Act (Email Marketing)

**Applies to:** Any commercial email sent to US recipients.

### Requirements — Every Marketing/Transactional Email
- [ ] Accurate "From" name and address (no spoofing)
- [ ] Honest subject line (no deceptive headers)
- [ ] Physical postal address of sender in every email footer
- [ ] Clear "Unsubscribe" link in every marketing email
- [ ] Honor unsubscribe requests within 10 business days
- [ ] No sending to unsubscribed addresses after opt-out
- [ ] Transactional emails (receipts, password resets) are exempt from opt-out requirement but must still be honest

### Implementation
- [ ] Use an ESP (SendGrid, Postmark, Resend) — all handle unsubscribe lists
- [ ] Store unsubscribe list in Supabase `email_unsubscribes` table
- [ ] Register a physical mailing address (can use registered agent address)

---

## 5. PCI DSS (Payment Card Industry Data Security Standard)

**Applies to:** Any business that accepts, transmits, or stores cardholder data.

**Our approach: Never touch card data directly — use Stripe hosted fields (Stripe Elements / Stripe Checkout). This puts us in SAQ A scope (lightest compliance tier).**

### Requirements — SAQ A (Redirect/iFrame)
- [ ] **Use Stripe Elements or Stripe Checkout exclusively** — card numbers never touch our servers
- [ ] **HTTPS everywhere** — SSL/TLS 1.2+ on all pages
- [ ] **No storing card numbers, CVV, or full PAN** anywhere (logs, DB, analytics)
- [ ] **Annual self-assessment questionnaire** (SAQ A) — Stripe may ask for this
- [ ] **Quarterly vulnerability scans** if storing cardholder data (N/A if SAQ A)
- [ ] Stripe dashboard: enable radar, dispute notifications, and fraud monitoring
- [ ] **Stripe webhook signature validation** — verify `stripe-signature` header on every webhook
- [ ] Document which Stripe products used and retain as PCI evidence

---

## 6. COPPA (Children's Online Privacy Protection Act)

**Applies to:** Online services directed to children under 13, or with actual knowledge of collecting data from children under 13.

**Our service is B2B (restaurant operators) — not directed at children.**

### Requirements
- [ ] **Age gate or ToS clause** stating service is for users 18+ (or 13+ with parental consent)
- [ ] No knowingly collecting data from children under 13
- [ ] Privacy policy must address COPPA if there's any possibility minors use the service

---

## 7. CIPA (California Invasion of Privacy Act)

**Applies to:** Recording or wiretapping electronic communications without consent.

### Requirements
- [ ] **Cookie consent banner** if using any tracking cookies (Google Analytics, pixels, session recording tools like Hotjar)
  - California requires "opt-in" or at minimum clear disclosure + easy opt-out
- [ ] **Session recording** (Hotjar, LogRocket): must disclose and get consent; recommend gating behind explicit consent
- [ ] **Chat support tools** that record conversations: must disclose recording to both parties
- [ ] Do not use third-party pixels (Meta, Google) that "sell" or "share" data without honoring opt-out

---

## 8. Terms of Service

### Required Clauses
- [ ] **Governing law**: State of California, County of [your county]
- [ ] **Dispute resolution / arbitration clause**: Mandatory arbitration with JAMS or AAA, class action waiver
  - Note: CA courts sometimes void these — keep arbitration clause but ensure it's conspicuous
- [ ] **Limitation of liability**: Cap at amounts paid in last 12 months
- [ ] **Disclaimer of warranties**: "AS IS", no uptime guarantee in free tier
- [ ] **Acceptable use policy**: No illegal activities, no reverse engineering
- [ ] **DMCA agent registration**: Register at copyright.gov if users can upload content (~$6/year)
  - If users upload invoices/images → register DMCA agent
- [ ] **Subscription auto-renewal disclosure**: CA law requires clear disclosure before charging recurring fees
  - Must disclose: renewal date, amount, cancellation method
  - Must send reminder before renewal if subscription > $5 and > 1 year
- [ ] **Refund policy**: State clearly (CA law doesn't mandate refunds for SaaS, but must be disclosed)
- [ ] **Account termination**: Conditions under which we can terminate
- [ ] **Data portability**: How users can export their data on cancellation

---

## 9. SB 553 / California Workplace Violence Prevention (if applicable)

N/A for a software company without physical premises at launch.

---

## 10. GDPR (European)

**Not immediately required** — but if any EU users sign up, GDPR applies.

### Minimum Protections for EU Users
- [ ] Lawful basis for processing (contract performance for registered users)
- [ ] Right to erasure ("right to be forgotten") — implement delete account feature
- [ ] Data Protection Officer: not required for small companies
- [ ] Supabase EU region available if needed for EU data residency

---

## 11. California AB 2257 / Worker Classification

**If using contractors/freelancers for any work**, ensure proper classification under California's ABC test (Prop 22 context for gig workers). Use proper 1099-NEC for contractors.

---

## 12. Accessibility Litigation Defense Checklist

California has the highest volume of ADA web accessibility lawsuits in the US. Serial plaintiffs specifically target SaaS products.

- [ ] AccessiBe or UserWay overlay widget (quick mitigation — not a substitute for real fixes)
- [ ] Document all accessibility testing runs with timestamps (evidence of good faith)
- [ ] Respond to demand letters promptly with remediation plan
- [ ] Consider consulting with ADA defense attorney before launch (Ogletree Deakins, Littler)

---

## 13. Data Breach Notification (California SB 1386 / Civil Code 1798.29)

**If we suffer a breach** of unencrypted personal information:

- [ ] Notify affected California residents "in the most expedient time possible" (30 days is considered reasonable)
- [ ] Notification to California AG if breach affects 500+ Californians
- [ ] Written breach response plan before launch

---

## 14. Infrastructure Security Requirements

- [ ] **HTTPS enforced everywhere** — Netlify handles SSL automatically ✅
- [ ] **Secrets management**: Never hardcode API keys; use Netlify env vars + Supabase secrets
- [ ] **Row Level Security (RLS)** on all Supabase tables — users only see their own data
- [ ] **JWT expiration**: Tokens expire ≤ 7 days; refresh on activity
- [ ] **Rate limiting** on auth endpoints (prevent credential stuffing)
- [ ] **Input validation** on all Netlify Functions (sanitize before DB write)
- [ ] **Audit log** table: log login events, sensitive data changes
- [ ] **Dependency scanning**: `npm audit` in CI; Dependabot or Snyk
- [ ] **CORS policy**: Netlify functions only accept requests from our domain

---

## 15. Immediate Pre-Launch Checklist

| Item | Owner | Status |
|------|-------|--------|
| Privacy Policy page live | Dev | ☐ |
| Terms of Service page live | Dev | ☐ |
| Cookie consent banner | Dev | ☐ |
| HTTPS enforced | Netlify | ✅ |
| Stripe integration (not touching card data) | Dev | ☐ |
| Unsubscribe flow in all emails | Dev | ☐ |
| Physical mailing address registered | Legal | ☐ |
| DMCA agent registered (copyright.gov) | Legal | ☐ |
| Accessibility audit (Lighthouse ≥ 90) | Dev | ☐ |
| Data deletion / account close feature | Dev | ☐ |
| Supabase DPA accepted | Dev | ☐ |
| Stripe DPA accepted | Dev | ☐ |

---

## Resources

- [California AG CCPA page](https://oag.ca.gov/privacy/ccpa)
- [CPPA official site](https://cppa.ca.gov/)
- [FTC CAN-SPAM guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business)
- [ADA.gov Title III](https://www.ada.gov/topics/intro-to-ada/)
- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [Stripe PCI compliance](https://stripe.com/guides/pci-compliance)
- [copyright.gov DMCA agent registration](https://www.copyright.gov/dmca-directory/)

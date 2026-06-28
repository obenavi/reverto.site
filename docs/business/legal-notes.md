# Legal / Compliance Notes

> Owned by: `lawyer`. Research log — not a substitute for a licensed attorney.

## Source of truth
`docs/LEGAL.md` — mandatory CCPA/CalOPPA/CIPA/ADA checklist. Keep in sync.
Note: `docs/LEGAL.md` header still says "Yield" (an older product name); the product is now **Reverto**. Worth a cleanup pass, but not blocking.

## Open items
(see dated entries below)

## Standing reminders
- Any new personal-data field needs a path to `data/export`/`data/delete`.
- Any aggregate/anonymized data product using customer data needs review (CCPA "sharing").
- Marketing savings/comparison claims must be substantiable.

---

## 2026-06-28 — Drafted Privacy Policy + Terms of Service

Drafted two public-facing legal documents for Reverto's MVP launch:
- `docs/business/legal-privacy-policy.md`
- `docs/business/legal-terms.md`

Both are marked **DRAFT — attorney review recommended** at the top (HTML comment that can be removed at publish time). Founder-specific blanks are marked with «DOUBLE BRACKETS»: effective date, future entity name, mailing address, and the California county for governing law.

Grounding done against the actual code/schema: tables/data confirmed are `businesses`, `users` (name, email, bcrypt `password_hash`, business_id, role), `invoices` (+ Supabase Storage `invoices` bucket holding raw files), `invoice_items` (parsed line items), `daily_sales`. Processors confirmed in code: Netlify (host), Supabase (US-East DB + storage), Azure Document Intelligence (OCR on uploaded invoices), USDA AMS (public price pull, no PII sent). No Stripe/billing code exists yet — both docs hedge payments as "not collected today."

### Honesty/accuracy decisions made (so we don't overpromise)
- Stated passwords are **bcrypt-hashed** (verified in `auth-signup.js`) and HTTPS/TLS in transit — but did **NOT** claim encryption-at-rest, SOC 2, or any certification (cannot verify).
- Stated data is US-East. No EU residency claim.
- Said we do NOT sell/share, and there is currently no advertising/analytics tracking — true today; both docs say "update before adding analytics or billing."
- Entity framed honestly as "Reverto, operated by an individual founder," with a placeholder for a future registered entity. No invented LLC/Inc.
- Founder must double-check the contact email `revertoo.ino@gmail.com` for typos — flagged in both docs.

---

## Compliance checklist status (Reverto MVP)

| Area | Status | Notes |
|---|---|---|
| Privacy Policy | Drafted | Needs attorney review + publish; engineer to render as page + footer link on every page |
| Terms of Service | Drafted | Same. Arbitration clause intentionally omitted — flag for attorney |
| CalOPPA (DNT, conspicuous policy) | Addressed in draft | Policy must be linked from homepage/app footer |
| CCPA/CPRA rights text | Drafted | But the *mechanism* (export/delete) is not built — see engineering gaps |
| Cookie consent banner | See opinion below | Likely NOT required today |
| CIPA | OK today | No session recording / chat / pixels — confirmed below |
| ADA / WCAG 2.1 AA | Open | No HTML pages exist yet; bake in at build time — see notes below |
| Data breach plan | Open | Write a short written breach-response plan before real users |
| DMCA agent | Open / low | Users upload files; registration (~$6/yr at copyright.gov) is cheap insurance, not blocking for tiny MVP |
| Vendor DPAs | Action | Accept DPAs in Supabase, Netlify, Azure dashboards |

---

## Engineering work still required for full compliance (HAND TO ENGINEER)

These are the **mandatory** technical gaps. The privacy rights are only real if a user can actually exercise them.

### 1. `data/export` endpoint (CCPA right to know / access + data portability)
- Authenticated function (same inline `verifyJwt` pattern as `invoices/upload.js` / `sales/save.js`), scoped by `business_id` from the JWT.
- Must gather and return everything tied to the account: the `users` row (excluding `password_hash`), the `businesses` row, all `invoices` (including links/copies of the raw uploaded files in the `invoices` storage bucket), all `invoice_items`, and all `daily_sales`.
- Output a single machine-readable file (JSON, optionally a zip including the original invoice images/PDFs).
- Triggerable from the app by the logged-in owner. Until built, exports are handled manually by the founder via email — acceptable short-term but slow and error-prone.

### 2. `data/delete` endpoint (CCPA right to delete / account close)
- Authenticated, scoped by `business_id`. Must delete (or fully de-identify):
  - `daily_sales`, `invoice_items`, `invoices` rows
  - the raw invoice files in the `invoices` Storage bucket (path prefix is `{business_id}/...` — easy to enumerate)
  - the `users` row(s) and the `businesses` row
- Confirm cascade behavior in the live Supabase schema so deletes don't orphan rows or fail on FK constraints. If FKs aren't `ON DELETE CASCADE`, delete children first.
- Keep a minimal record that a deletion occurred (for audit), without retaining the personal data.
- Handle the "I want my data gone but keep records the law requires" exception path.

### 3. Supporting
- **Footer link to Privacy Policy + Terms on every page** (CalOPPA requires the policy be conspicuous/accessible from every page).
- **Row Level Security** on all Supabase tables (currently enforcement is via service key + `business_id` filtering in functions; RLS is defense-in-depth and is on the LEGAL.md list).
- **Audit log** of login + sensitive changes (already on LEGAL.md §14).
- Until export/delete endpoints exist, wire the in-app "Privacy / Your data" help text to email `revertoo.ino@gmail.com`.

---

## Cookie-consent banner — my reasoned opinion

**Opinion: a cookie-consent banner is NOT legally required for Reverto today, and I would not add one yet.**

Reasoning:
- The app's only browser-storage use is the **auth token in localStorage/sessionStorage**, which is **strictly necessary** to keep a logged-in user authenticated. Strictly-necessary storage does not require opt-in consent under the frameworks that matter here.
- There are **no analytics cookies, no advertising pixels, no third-party trackers, and no session recording** in the code today. CCPA/CPRA "Do Not Sell or Share" and CIPA consent obligations are triggered by tracking/sharing — none of which is happening.
- A consent banner that asks permission for cookies you don't set is misleading and creates its own (small) deception risk.

What we DO instead: disclose the localStorage usage honestly in the Privacy Policy (done — Section 7) and the DNT position (done — Section 8).

**This flips the moment you add anything tracking-like** — Google Analytics, Meta/Google pixels, Hotjar/LogRocket session recording, or any third-party that "shares" data. At that point: add a consent mechanism (CIPA + CPRA), add a "Do Not Sell or Share My Personal Information" footer link, and update the Privacy Policy. Treat this as a hard gate on the data/marketing team.

---

## CIPA considerations

Confirmed **no CIPA exposure today**: no session-recording tools (Hotjar/LogRocket), no chat widget that records conversations, no third-party pixels in the codebase. Nothing wiretaps or records communications.
If a support chat, session replay, or pixel is ever added, CIPA requires disclosure and (for recording) consent of both parties — revisit before shipping any of those.

---

## ADA / WCAG 2.1 AA notes

No HTML/CSS exists in the repo yet (`js/db.js` is the only frontend file). This is the **best possible time** to bake accessibility in rather than retrofit — California has the highest volume of ADA web-accessibility lawsuits and serial plaintiffs target SaaS. Engineer should build customer-facing pages (`index`, `login`, `onboarding`, `app`, and the two new legal pages) to WCAG 2.1 AA from the start:
- `<html lang="en">`, semantic landmarks, descriptive `<title>` per page, "skip to main content" link.
- Labels on every form input (login, signup, sales entry, invoice upload), descriptive error messages.
- Visible focus outlines (don't strip them), full keyboard operability, 4.5:1 text contrast.
- Alt text on images; don't convey cost over/under purely by red/green color.
- Run axe/Lighthouse (target ≥ 90) and one manual screen-reader pass before inviting users.
- Add a short **Accessibility Statement** page with a contact for reporting issues.

---

## Prioritized: before inviting REAL users vs. later

### MUST-HAVE before any real user signs up
1. Privacy Policy + Terms **attorney-reviewed, published, and linked in the footer of every page**.
2. Founder verifies the contact email (`revertoo.ino@gmail.com`) and adds a mailing address.
3. A **working way to exercise delete + export** — ideally the `data/delete` and `data/export` endpoints; at minimum a documented manual email process the founder will actually honor within 45 days.
4. Accept **DPAs** with Supabase, Netlify, and Azure.
5. Confirm **HTTPS enforced** (Netlify default — verify) and that no secrets are committed.
6. A short **written data-breach response plan** (who notifies whom, within 30 days).
7. Accessibility baseline on the pages that exist (labels, focus, contrast, keyboard) + Lighthouse pass.

### LATER (not blocking a small MVP, but plan for it)
- Build the in-app self-service export/delete UI (replacing the manual email path).
- DMCA agent registration (~$6/yr) since users upload files.
- Row Level Security on all Supabase tables; audit-log table; rate limiting on auth.
- CAN-SPAM setup (unsubscribe + physical address) — only once you send marketing email.
- Arbitration / class-action-waiver clause in Terms — discuss with attorney whether worth it.
- Auto-renewal disclosures + refund policy — required **before** turning on Stripe billing; update both legal docs then.
- Re-evaluate cookie banner the instant any analytics/pixel/session-recording is added.
- Spanish-language privacy policy if you actively serve Spanish-speaking operators.

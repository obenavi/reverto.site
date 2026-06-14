# Decisions Log

Running log of notable decisions and recommendations made by the AI team. Newest first.

---

## 2026-06-14 — Phase 1 build sequence: smallest end-to-end slice first
`product` reviewed current state (auth + Sysco parser + USDA sync built, but zero HTML/CSS — nothing
usable in a browser) and proposed a concrete ordered build sequence in
`docs/business/product-backlog.md`. Recommendation: skip onboarding/billing/legal polish for now and
go straight for the minimum path to a demoable core loop:

0. Confirm/create Supabase schema against `docs/ARCHITECTURE.md` (verify what auth/parse already
   assume exists).
1. `invoices/upload.js` + a bare-bones login + upload page — first time anything is clickable.
2. Invoice results page showing parsed `invoice_items` (the "wow" moment, validates parser output).
3. USDA price comparison column on that page (the headline value prop).
4. Daily Z report entry form -> `daily_sales`.
5. Food cost % dashboard (`sales/report.js`) — closes the full core loop end-to-end.
6. Minimal shared styling/nav so a real operator can use it on a phone.

Everything else (supplier setup, onboarding, item master, Stripe billing, legal pages, push
notifications) is sequenced after step 6, with legal pages flagged as a hard gate before inviting
any outside beta users (open question to `lawyer` on whether founder-only testing changes urgency).
Open questions for `engineer` (does `parse.js` already populate cost_per_lb/usda_price_ref? does
signup create a default location?) and `data` (USDA commodity-matching strategy) are logged in the
backlog.

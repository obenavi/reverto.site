# Decisions Log

Running log of notable decisions and recommendations made by the AI team. Newest first.

---

## 2026-06-14 — GTM plan: concierge-first, don't wait for the product
`ceo` synthesized a go-to-market plan in `docs/business/go-to-market.md`. Core call: the moat (Sysco
parser + USDA sync) is already built; the product has zero UI. Do NOT wait for the full 3-tier
product/billing/legal to start GTM. **Highest-leverage first move: manually deliver ~10 concierge
"Overpayment Report" PDFs to real Bay Area/LA Sysco operators**, running the existing
`invoices/parse.js` by hand — no login/dashboard/billing needed. This validates demand, produces
testimonials with exact $ savings, and seeds the benchmarking dataset (with opt-in consent) in
parallel with `engineer` building the demoable core loop (backlog steps 0–6, ~6 weeks).
Data collection starts NOW via consented concierge, NOT a public free tier (public free tier waits
until Azure DI cost is capped + lawyer sign-off). Milestones: first 10 users = 10 concierge reports
(wks 1–4, no product); first paying customer likely a concierge user paying manually ~wk 4–8; first
50 users wks 8–16 after the self-serve loop ships. Biggest risk: founder + AI team build forever and
never do unscalable outreach → empty product, no users. **Mitigation/recommended rule: no self-serve
feature work past core-loop step 6 until 10 concierge reports delivered and ≥3 operators say they'd
pay.** Sysco reps = referral channel only, not a data deal. Any pricing publish / formal partnership
still needs founder sign-off.

## 2026-06-14 — Founder's 3-tier pricing proposal reviewed (Free / $49 / $98)
`ceo` assessed the founder's new proposal: Free (10 invoices/wk + USDA price list + "send orders from
text/email"), $49 (benchmarking + 15+ invoices/wk), $98 (full food cost tracking + reverto.cloud
features localized to US English). Verdict: keep the three-tier shape and the free-USDA hook (good
instincts, benchmarking-as-upsell mirrors Orderly's ~$195 feature). Four risks flagged: (1) free tier
too generous and inverts the value ladder — 43 OCR invoices/mo free beats MarketMan's *paid* tier;
recommend gating benchmarking + high-volume OCR behind paid; (2) **uncapped Azure DI OCR cost — founder
must verify actual per-invoice Azure Document Intelligence pricing and set a hard free-tier OCR cap
before launch** (DO NOT ship free-unlimited OCR); (3) switch weekly caps to monthly; (4) $98 tier
depends on undefined reverto.cloud scope — treat as placeholder. **"Send orders from text/email"
flagged as a NEW, unscoped product concept** (not in PLAN.md/ARCHITECTURE.md) — implies catalog/order
builder + SMS/email pipeline (new vendor cost, CAN-SPAM/TCPA compliance); needs its own spec/estimate
before being promised. Data-acquisition-via-free-tier judged sound but requires opt-in + lawyer review
for any cross-customer use. Full assessment + open questions in `business-model.md`. **Pricing change =
founder sign-off; do not publish until cost/cap/scope questions resolved.**

## 2026-06-14 — Competitive landscape re-verified; pricing figures refreshed
`ceo` re-ran web research on MarginEdge, Ottimate (Plate IQ), xtraCHEF, MarketMan, Apicbase,
CrunchTime/R365, and Orderly to verify and sharpen the existing `competitors.md`. Confirmed and
refined figures: MarginEdge $350/mo/location (10% off annual, +$50/mo Toast API fee); xtraCHEF tiers
Core $149 / Chef's Choice $199–299 / Pro $349 (recipe costing only at Pro; OCR self-reported ~90–95%);
MarketMan $199/$249/custom + **$500 setup fee**, OCR capped at 50 scans/mo on Starter; Ottimate from
~$200; Orderly from ~$195 with its Restaurant Food Index peer benchmark running on ~18k line items/day.
Updated `competitors.md` summary table, per-competitor notes, "where Yield can win," and sources.

Reaffirmed Yield's three wedges: (1) Sysco-specific obfuscation-defeating parser as a *named*
capability, (2) neutral USDA benchmark (free to source, no data-scale flywheel needed — unlike
Orderly), (3) cheapest credible price with no setup fee + fastest time-to-insight. Orderly remains the
closest threat on the market-price angle.

Added two business-model ideas to `business-model.md` (now items 4–5): (4) hold one $49 tier for
launch vs. a future ~$19–29 Lite tier — recommend holding, revisit only if conversion data shows price
is the blocker (**pricing change = founder sign-off**); (5) use Sysco reps as a co-branded referral
*marketing* channel, explicitly NOT a data-sharing deal (would invert Yield's positioning + CCPA risk).

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

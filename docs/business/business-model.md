# Business Model

> Owned by: `ceo`. Source of truth for pricing/plans is `docs/PLAN.md` until updated here.

## Current model (from docs/PLAN.md)
- Free: 1 location, 10 invoices/month, no OCR, manual entry only
- Pro: $49/mo — unlimited invoices, OCR, USDA prices, multi-location, push notifications
- Enterprise: custom — API access, integrations, dedicated support
- 14-day free trial, no credit card required

## Pricing context (from competitive research 2026-06-14, re-verified)
Yield's $49/mo is the cheapest credible option in the field by a wide margin, with no setup fee:
MarginEdge $350/mo/location (+$50/mo for Toast API), MarketMan $199–249 plus a $500 setup fee,
Orderly ~$195, xtraCHEF $149 (recipe costing only at $349), Ottimate from ~$200, Apicbase/CrunchTime/
R365 enterprise. The price floor is a deliberate wedge for price-sensitive 1–3 location indies who
find the enterprise tools too expensive/heavy. See `docs/business/competitors.md`.

## Open questions / ideas

> Added 2026-06-14 by `ceo` after competitive research. Ideas to consider, not decisions.
> Anything touching pricing, spend, or partnerships needs founder sign-off.

### 1. "Overpayment Report" as a free lead magnet (cheap, on-brand)
A prospect uploads one Sysco invoice for free (email-gated) and gets a one-page "you're paying X%
above USDA market on these N items" report. This is Yield's strongest hook and costs only one
OCR/parse call. Doubles as the marketing content engine ("what Sysco hides on your invoice").
Realistic solo: it's the existing parser + a templated report. Tradeoff: OCR cost per free upload —
gate with email + a per-IP/day cap to prevent abuse.

### 2. Annual plan + simple referral, before adding seats
Low-build retention/cash-flow levers: (a) annual option at ~2 months free (~$490/yr) to cut churn,
(b) formalize "1 month free per referral" (already in PLAN.md GTM) as a billing mechanic. Both attack
the #1 SaaS risk (churn) without new features. Note competitors already discount annual (MarginEdge
10%, MarketMan ~15%) — an annual option is table stakes, not aggressive. Tradeoff: annual discounting
dents early MRR optics — push only once retention data exists.

### 3. Anonymized regional price benchmark — future data product (validate first, build later)
At data scale, Yield could offer "restaurants like you in your region pay $X/lb for chicken breast" —
the peer benchmark Orderly charges for (Orderly's RFI runs on ~18k line items/day), layered on Yield's
neutral USDA feed. Potentially a premium tier and, much later, of interest to buying groups/suppliers.
**Flagged as future only:** needs data scale, and any external/commercial use of customer data has
CCPA + ToS implications — do not act without legal review and explicit opt-in. For now, just keep the
schema retaining data cleanly so the option stays open.

### 4. Lower-priced "Lite" tier vs. holding the line at $49 (pricing question to settle)
$49 already undercuts the entire field. Two paths worth weighing before launch: (a) hold one simple
$49 Pro tier — simplicity is a selling point and avoids cannibalizing; or (b) add a ~$19–29 "Lite"
tier (USDA comparison + cost/lb, capped invoices, no push/multi-location) to convert the most
price-sensitive single-location operators who balk even at $49. Recommendation: **hold at one $49 tier
for launch** — a non-technical solo founder benefits from one clear price, and $49 is already the
market floor; revisit a Lite tier only if trial-to-paid conversion data shows price is the blocker.
Tradeoff: a Lite tier widens the funnel but adds plan-gating complexity and support surface. **Pricing
change — needs founder sign-off.**

### 5. Sysco-rep / distributor channel as acquisition, not a data deal (low risk, founder-friendly)
PLAN.md already names Sysco reps as a channel. Concrete, realistic version for a solo founder: give
reps a co-brandable one-page "Yield helped this kitchen find $X/mo" leave-behind and a referral link;
reps want sticky, profitable customers and Yield makes them look helpful. This is marketing/partnership
hustle, not a contract or data-sharing arrangement — keep it that way. **Do NOT pursue any deal where
Sysco gets access to customer invoice data or pricing** — that inverts Yield's "we're on your side
against the distributor" positioning and creates CCPA/trust exposure. Tradeoff: rep outreach is manual
and slow; treat as a supplement to direct outreach, not the primary channel. Any formal partnership =
founder sign-off.

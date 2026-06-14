# Business Model

> Owned by: `ceo`. Source of truth for pricing/plans is `docs/PLAN.md` until updated here.

## Current model (from docs/PLAN.md)
- Free: 1 location, 10 invoices/month, no OCR, manual entry only
- Pro: $49/mo — unlimited invoices, OCR, USDA prices, multi-location, push notifications
- Enterprise: custom — API access, integrations, dedicated support
- 14-day free trial, no credit card required

## Pricing context (from competitive research 2026-06-14)
Yield's $49/mo sits far below the field: MarginEdge ~$350/mo/location, xtraCHEF ~$149–349, Ottimate
from ~$200, MarketMan ~$150+, Apicbase/CrunchTime/R365 enterprise. The price floor is a deliberate
wedge for price-sensitive 1–3 location indies who find the enterprise tools too expensive/heavy.
See `docs/business/competitors.md`.

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
the #1 SaaS risk (churn) without new features. Tradeoff: annual discounting dents early MRR optics —
push only once retention data exists.

### 3. Anonymized regional price benchmark — future data product (validate first, build later)
At data scale, Yield could offer "restaurants like you in your region pay $X/lb for chicken breast" —
the peer benchmark Orderly charges for, layered on Yield's neutral USDA feed. Potentially a premium
tier and, much later, of interest to buying groups/suppliers. **Flagged as future only:** needs data
scale, and any external/commercial use of customer data has CCPA + ToS implications — do not act
without legal review and explicit opt-in. For now, just keep the schema retaining data cleanly so the
option stays open.

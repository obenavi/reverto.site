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

## Founder's proposed 3-tier model (2026-06-14) — UNDER REVIEW, not yet decided

This replaces the Free/Pro/Enterprise structure above. Founder's framing: free tier is a
data-acquisition + low-friction land grab, not just a funnel.

| Tier | Price | Contents (as proposed) |
|------|-------|------------------------|
| **Free** | $0 | up to 10 invoices/week (~43/mo) + free USDA price list + "send orders from text/email" |
| **Pro** | $49/mo | benchmarking (vs other restaurants/market) + 15+ invoices/week + "more things" (TBD) |
| **Plus** | $98/mo | full food cost tracking + everything in reverto.cloud (sister product) localized to US English |

Founder's explicit goals: (1) "no-brainer to join" — very low friction at free; (2) get strategic
about acquiring the FIRST 10–20 users specifically.

### CEO assessment

**What's smart:**
- Free USDA price list + an "am I overpaying" hook is the cheapest possible top-of-funnel and plays
  directly to Yield's defensible wedge. Good instinct.
- Tiering on *benchmarking* (peer comparison) as the paid upsell is correct — that's exactly what
  Orderly charges ~$195 for. Yield offering a version at $49 is aggressive in a good way.
- A $98 tier anchors $49 and gives a clear "serious operator" upgrade path. Three tiers also reads as
  more credible/complete than a single price.

**What's risky / what I'd change:**
1. **The free tier is too generous and inverts the value ladder.** 43 invoices/mo free is more than
   MarketMan's *paid* Starter (50/mo at $199). And putting *benchmarking* behind the $49 wall while
   leaving raw OCR + USDA prices free means a single-location operator can extract ~all the core value
   for $0 and never convert. Recommend: free tier = manual entry OR a hard low cap on OCR (e.g.
   2–3 OCR invoices/mo), USDA list yes, benchmarking no. Make OCR-at-volume the paid trigger.
2. **OCR cost exposure — must verify before committing.** Each parsed invoice = an Azure Document
   Intelligence `prebuilt-invoice` call. Public Azure DI pricing has historically been ~$10 per 1,000
   pages for prebuilt models (UNVERIFIED — founder/engineer must confirm current pricing). At ~$0.01/page
   that *sounds* trivial, but a multi-page Sysco invoice is several pages, and "10/week free" across
   even a few hundred free users is a real, uncapped, gross-margin-negative line item with no revenue
   behind it. **Action: confirm actual Azure DI per-page price and set a hard free-tier OCR cap before
   launch.** Do not ship "free unlimited-ish OCR."
3. **"15+ invoices/week" and "more things" are not concrete.** A weekly cap is operationally odd
   (restaurants get invoices in bursts) and hard to explain. Recommend monthly caps and define the
   $49 feature set precisely before publishing.
4. **The $98 tier depends on reverto.cloud, which is undefined here.** "Everything in reverto.cloud,
   localized to English" is a large, unscoped dependency. We cannot price or promise it until we know
   what it contains and what localization actually costs. Treat $98 as a placeholder.

**Recommendation:** Keep the three-tier shape and the free-USDA hook — both are good. But (a) tighten
the free tier so benchmarking and high-volume OCR are paid, (b) verify Azure DI cost + set a free OCR
cap, (c) switch caps to monthly, (d) treat $98/reverto.cloud as TBD. **Pricing structure change =
founder sign-off; do not publish until 1–4 above are resolved.**

### NEW SCOPE FLAG — "send orders from text or email"
This feature appears nowhere in `docs/PLAN.md` or `docs/ARCHITECTURE.md`. It is a **new product
concept**, not a refinement of the existing invoice/cost-tracking loop. It implies: building a product
catalog/order-builder, an outbound email/SMS sending pipeline (Twilio/SendGrid — new vendor, new
cost, new compliance: CAN-SPAM, TCPA for SMS), and likely supplier contact management. This is a
meaningful scope expansion that competes more with ordering tools than cost-control tools.
**Flagged to `product` and `engineer`. Do not assume this is cheap or in-scope. Needs its own
spec + build estimate before it's promised on a pricing page.**

### Data-acquisition angle — sound, with guardrails
Using free invoices to build a price dataset is strategically sound: it's the same flywheel Orderly's
Restaurant Food Index runs on (~18k line items/day), and it's what would let Yield offer real peer
benchmarking — the $49 upsell. The valuable data specifically (coordinate w/ `data`,
`docs/business/data-strategy.md`): real paid prices per item/region/distributor over time, pack-size
normalization, and supplier-code → common-name mappings. BUT: any cross-customer/commercial use of
invoice data carries CCPA + ToS obligations — needs explicit opt-in and `lawyer` review before it's
used for anything beyond serving that customer their own results. Free-as-data-strategy is fine; just
don't let unbounded OCR cost outrun the (currently $0) revenue while the dataset is still small.

### Open questions / risks
- Actual Azure DI per-invoice cost (UNKNOWN — verify before launch).
- Free-tier OCR cap to protect margin (recommend hard cap; founder to set number).
- Exact $49 feature set ("more things") — undefined.
- What is reverto.cloud, what does localization cost, what's actually in the $98 tier?
- "Send orders" feature: full new spec + build estimate + SMS/email compliance review needed.
- Does free benchmarking-vs-paid line hold, or does free tier cannibalize? (watch conversion.)

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
schema retaining data cleanly so the option stays open. (Note: the founder's 3-tier proposal pulls
this forward as the $49 upsell — good, but it only works once free-tier data scale exists.)

### 4. Lower-priced "Lite" tier vs. holding the line at $49 (pricing question to settle)
$49 already undercuts the entire field. Two paths worth weighing before launch: (a) hold one simple
$49 Pro tier — simplicity is a selling point and avoids cannibalizing; or (b) add a ~$19–29 "Lite"
tier (USDA comparison + cost/lb, capped invoices, no push/multi-location) to convert the most
price-sensitive single-location operators who balk even at $49. Recommendation: **hold at one $49 tier
for launch** — a non-technical solo founder benefits from one clear price, and $49 is already the
market floor; revisit a Lite tier only if trial-to-paid conversion data shows price is the blocker.
Tradeoff: a Lite tier widens the funnel but adds plan-gating complexity and support surface. **Pricing
change — needs founder sign-off.** (Superseded in part by the 3-tier proposal above — the free tier
now plays the "widen the funnel" role instead of a $19 Lite tier.)

### 5. Sysco-rep / distributor channel as acquisition, not a data deal (low risk, founder-friendly)
PLAN.md already names Sysco reps as a channel. Concrete, realistic version for a solo founder: give
reps a co-brandable one-page "Yield helped this kitchen find $X/mo" leave-behind and a referral link;
reps want sticky, profitable customers and Yield makes them look helpful. This is marketing/partnership
hustle, not a contract or data-sharing arrangement — keep it that way. **Do NOT pursue any deal where
Sysco gets access to customer invoice data or pricing** — that inverts Yield's "we're on your side
against the distributor" positioning and creates CCPA/trust exposure. Tradeoff: rep outreach is manual
and slow; treat as a supplement to direct outreach, not the primary channel. Any formal partnership =
founder sign-off.

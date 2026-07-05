# Competitive Landscape

> Owned by: `ceo` / `product`. Pricing re-verified 2026-06-14 against current third-party listings
> (Capterra/GetApp/SoftwareAdvice/vendor sites). Most competitors hide pricing behind a demo —
> figures may be location-dependent. Verify before quoting publicly.

## Summary table

| Tool | Price (approx) | Target | Invoice processing | Market price comparison |
|------|---------------|--------|--------------------|--------------------------|
| **MarginEdge** | $350/mo per location (10% off annual; +$50/mo Toast API fee) | Indie → small chains | AI OCR, line-item, free unlimited bill pay | No public/commodity feed |
| **Ottimate (Plate IQ)** | from ~$200/mo (custom) | AP/accounting-led, multi-unit | ~99% line-item OCR, GL coding, payments + cashback | No |
| **xtraCHEF (Toast)** | Core $149 / Chef's Choice $199–299 / Pro $349 per mo | Toast POS users | Photo OCR (~90–95%), auto-categorize, recipe costing | No (price trend by category, internal only) |
| **Apicbase** | Quote only (enterprise) | Multi-site, ghost kitchens, EU-heavy | Yes, tied to recipe/inventory | No |
| **CrunchTime** | Enterprise quote | 100k+ locations, big chains/franchise | Yes, deep inventory | No |
| **Restaurant365 (+Compeat)** | Enterprise quote (~$900/yr entry seen) | Mid-market → enterprise, accounting-first | Yes, full ERP-style | No |
| **MarketMan** | Starter $199 / Growth $249 / Ent custom per mo; +$500 setup; ~15% off annual | Indie → multi-unit | OCR (50 scans/mo Starter, unlimited Growth), variance | No |
| **Orderly** | from ~$195/restaurant | Indie → multi-unit | Yes, no setup ("just snap invoices") | **Yes** — "Local Market Pricing" + Restaurant Food Index (peer benchmark from ~18k line items/day, not a public feed) |

## Per-competitor notes

### MarginEdge — the 800-lb gorilla in the indie space
- **Strengths:** Polished, fast invoice turnaround (often <24h, human-assisted), free unlimited bill
  pay (big draw), POS-agnostic, strong recipe/theoretical food cost, daily P&L. Flat per-location
  fee, no per-user charges.
- **Weaknesses:** $350/mo/location is ~7x Yield's price — real barrier for a 1-location indie. Toast
  users pay an extra $50/mo for API access. Onboarding is heavy. No public-market price benchmark
  (only your own history).
- **Read:** Who Yield's target customer "graduates to" — or can't afford. Yield's wedge is the
  price-sensitive operator who finds MarginEdge overkill/too expensive.

### Ottimate (formerly Plate IQ)
- **Strengths:** Best-in-class AP automation, GL coding, payments + cashback. ~99% line-item accuracy.
- **Weaknesses:** Accounting/finance-led, not operator-led. No market comparison. Aimed at groups with
  an accountant or bookkeeper, not a chef-owner. Pricing opaque (from ~$200/mo, custom).

### xtraCHEF (Toast)
- **Strengths:** Tightest integration if you run Toast POS (sales auto-feeds food cost %). Recipe
  costing + inventory. Entry tier ($149 Core) is competitive on price.
- **Weaknesses:** Recipe costing lives in the $349 Pro tier; cheap tier is AP + price tracking only.
  Most valuable inside the Toast ecosystem. OCR accuracy ~90–95% (notably lower than Ottimate's claim).
  No external market benchmark.

### Apicbase
- **Strengths:** Deep recipe/menu engineering, inventory AI, procurement automation, multi-site.
- **Weaknesses:** Enterprise-priced and complex; EU-centric; overkill and over-budget for a US 1–3
  location indie. Quote-only pricing.

### CrunchTime / Restaurant365 (+Compeat)
- **Strengths:** Full back-office ERP — inventory, labor, scheduling, accounting, BI.
- **Weaknesses:** Built for chains/franchises/enterprise. Long implementations, enterprise contracts.
  Not a realistic competitor for Yield's customer — more a long-term "what they'd buy at 20 locations."

### MarketMan
- **Strengths:** Three clear tiers, invoice verification + variance + recipe costing, popular with indies.
- **Weaknesses:** $199 entry is 4x Yield and caps OCR at 50 scans/mo (unlimited only at $249 Growth),
  plus a **$500 one-time setup fee** — a real friction/cost wall for a small indie. No public
  commodity/market benchmark. More inventory-count-heavy than Yield's "just read my invoice" simplicity.

### Orderly — closest to Yield's USDA angle
- **Strengths:** The only competitor with an explicit market-pricing feature — "Local Market Pricing"
  and the Restaurant Food Index (RFI), benchmarking your prices against what restaurants like yours
  actually paid, compiled from ~18,000 line-item purchases/day. No setup; snap invoices + weekly sales.
  From ~$195/restaurant.
- **Weaknesses:** It's a **peer/crowd benchmark** (what other restaurants pay), not a neutral public
  data source — and it only works at their data scale. Less brand presence than MarginEdge. Worth
  watching closely: it's the strongest validation that "am I overpaying?" is a real demanded feature,
  and the most direct threat to Yield's differentiation.

## Where Yield can win

1. **Sysco-specific obfuscation-defeating parser.** No competitor markets defeating fuel-surcharge
   distribution, catch-weight correction, and split-case math as a *named* capability. Yield turns
   Sysco's deliberately confusing invoice into honest cost/lb. Sharp, ownable wedge — and a killer
   content hook ("what Sysco hides on your invoice"). Note xtraCHEF self-reports only ~90–95% OCR
   accuracy on generic invoices; a Sysco-tuned parser can credibly beat that on its one format.

2. **Neutral USDA market price comparison.** Everyone else benchmarks you against *yourself* (your own
   price history) or, in Orderly's case, against *other restaurants*. Yield benchmarks against a neutral
   government commodity feed — a credible, defensible, hard-to-game "are you being ripped off?" answer
   that's also **free to source** (no data-scale flywheel required to launch, unlike Orderly's RFI).

3. **Price + simplicity.** $49/mo vs MarginEdge $350, MarketMan $199 (+$500 setup), xtraCHEF $149,
   Orderly $195. Yield is the cheapest credible option by a wide margin, with no setup fee. For a
   1-location chef-owner who just wants "am I overpaying and what's my food cost %," the others are
   too expensive and too heavy. Yield's cheap-to-run vanilla stack supports this price floor profitably.

4. **Speed to first insight.** No inventory counts, no GL setup, no POS integration, no setup fee, no
   sales call. Upload an invoice, get a verdict in minutes. The big tools require real onboarding.

## Where Yield is exposed (be honest)
- **No recipe costing / theoretical food cost.** The metric serious operators ultimately want;
  MarginEdge/xtraCHEF Pro/MarketMan/Apicbase all have it. Yield's food cost % is invoice/sales, not
  theoretical. Roadmap item, but a real gap.
- **Sysco-only at launch.** Many indies use US Foods, PFG, or multiple distributors. Limits TAM until
  Phase 2 parsers ship.
- **No bill pay.** MarginEdge's free unlimited bill pay (and Ottimate's payments + cashback) are
  retention hooks Yield can't match.
- **Defensibility of the USDA angle.** The parser is hard to copy; the USDA comparison is not — a
  funded competitor could add a public-data benchmark. Win on Sysco depth + price, not just USDA.

## Sources
- [MarginEdge pricing](https://www.marginedge.com/pricing/), [Capterra](https://www.capterra.com/p/187718/MarginEdge/), [dishcost pricing breakdown](https://dishcost.com/blog/dishcost-vs-marginedge)
- [Ottimate / Plate IQ pricing (SoftwareAdvice)](https://www.softwareadvice.com/accounting/plate-iq-profile/), [GetApp](https://www.getapp.com/retail-consumer-services-software/a/plate-iq/)
- [xtraCHEF by Toast](https://pos.toasttab.com/products/xtrachef), [GetApp](https://www.getapp.com/retail-consumer-services-software/a/xtrachef/), [dishcost xtraCHEF vs MarginEdge](https://dishcost.com/blog/xtrachef-vs-marginedge)
- [Apicbase (Capterra)](https://www.capterra.com/p/171584/Apicbase-Restaurant-Management/)
- [Restaurant365 acquires Compeat](https://www.restaurantbusinessonline.com/technology/back-office-software-provider-restaurant365-buys-competitor-compeat)
- [CrunchTime (Capterra)](https://www.capterra.com/p/2294/CrunchTime-Back-Office/)
- [MarketMan pricing (CheckThat.ai)](https://checkthat.ai/brands/marketman/pricing), [Capterra](https://www.capterra.com/p/136439/Marketman-Restaurant-Inventory/pricing/)
- [Orderly food supplier pricing](https://getorderly.com/features/food-supplier-pricing), [Orderly pricing](https://getorderly.com/pricing), [Restaurant Food Index](https://restaurantfoodindex.com/)

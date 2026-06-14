# Competitive Landscape

> Owned by: `ceo` / `product`. Pricing as of research date 2026-06-14; verify before quoting publicly.
> Most competitors hide pricing behind a demo — figures below are from third-party listings
> (Capterra/GetApp/vendor sites) and may be stale or location-dependent.

## Summary table

| Tool | Price (approx) | Target | Invoice processing | Market price comparison |
|------|---------------|--------|--------------------|--------------------------|
| **MarginEdge** | ~$350/mo per location | Indie → small chains | AI OCR, line-item, free unlimited bill pay | No public/commodity feed |
| **Ottimate (Plate IQ)** | from ~$200/mo | AP/accounting-led, multi-unit | 99% line-item OCR, GL coding, payments | No |
| **xtraCHEF (Toast)** | ~$149–349/mo | Toast POS users | Photo OCR, auto-categorize, recipe costing | No (price trend by category, internal only) |
| **Apicbase** | Quote only (enterprise) | Multi-site, ghost kitchens, EU-heavy | Yes, tied to recipe/inventory | No |
| **CrunchTime** | Enterprise quote | 100k+ locations, big chains/franchise | Yes, deep inventory | No |
| **Restaurant365 (+Compeat)** | Enterprise quote (~$900/yr entry seen) | Mid-market → enterprise, accounting-first | Yes, full ERP-style | No |
| **MarketMan** | ~$150+/mo | Indie → multi-unit | OCR, invoice verification, variance | No |
| **Orderly** | Quote | Indie → multi-unit | Yes | **Yes** — "Local Market Pricing" + Restaurant Food Index (peer benchmark, not a public feed) |

## Per-competitor notes

### MarginEdge — the 800-lb gorilla in the indie space
- **Strengths:** Polished, fast invoice turnaround (often <24h, human-assisted), free unlimited bill
  pay (big draw), POS-agnostic, strong recipe/theoretical food cost, daily P&L.
- **Weaknesses:** ~$350/mo/location is ~7x Yield's price — real barrier for a 1-location indie.
  Onboarding is heavy. No public-market price benchmark (only your own history).
- **Read:** This is who Yield's target customer "graduates to" — or can't afford. Yield's wedge is the
  price-sensitive operator who finds MarginEdge overkill/too expensive.

### Ottimate (formerly Plate IQ)
- **Strengths:** Best-in-class AP automation, GL coding, payments + cashback. ~99% line-item accuracy.
- **Weaknesses:** Accounting/finance-led, not operator-led. No market comparison. Aimed at groups with
  an accountant or bookkeeper, not a chef-owner. Pricing opaque.

### xtraCHEF (Toast)
- **Strengths:** Tightest integration if you run Toast POS (sales auto-feeds food cost %). Recipe
  costing + inventory. Reasonable price.
- **Weaknesses:** Most valuable only inside the Toast ecosystem. No external market benchmark. Toast
  bundles/upsells can get expensive.

### Apicbase
- **Strengths:** Deep recipe/menu engineering, inventory AI, procurement automation, multi-site.
- **Weaknesses:** Enterprise-priced and complex; EU-centric; overkill and over-budget for a US 1–3
  location indie. Quote-only pricing.

### CrunchTime / Restaurant365 (+Compeat)
- **Strengths:** Full back-office ERP — inventory, labor, scheduling, accounting, BI.
- **Weaknesses:** Built for chains/franchises/enterprise. Long implementations, enterprise contracts.
  Not a realistic competitor for Yield's customer — more a long-term "what they'd buy at 20 locations."

### MarketMan
- **Strengths:** Mid-priced, invoice verification + variance + recipe costing, popular with indies.
- **Weaknesses:** No public commodity/market benchmark. More inventory-count-heavy than Yield's "just
  read my invoice" simplicity.

### Orderly — closest to Yield's USDA angle
- **Strengths:** The only one found with an explicit market-pricing feature — "Local Market Pricing"
  and a Restaurant Food Index showing how your prices compare for common ingredients.
- **Weaknesses:** It's a **peer/crowd benchmark** (what other restaurants pay), not a neutral public
  data source. Less brand presence than MarginEdge. Worth watching closely — it's the most direct
  validation that "am I overpaying?" is a real demanded feature, and the most direct threat to Yield's
  differentiation.

## Where Yield can win

1. **Sysco-specific obfuscation-defeating parser.** No competitor markets defeating fuel-surcharge
   distribution, catch-weight correction, and split-case math as a *named* capability. Yield turns
   Sysco's deliberately confusing invoice into honest cost/lb. This is a sharp, ownable wedge — and a
   killer content hook ("what Sysco hides on your invoice").
2. **Neutral USDA market price comparison.** Everyone else benchmarks you against *yourself* (your
   own price history) or, in Orderly's case, against *other restaurants*. Yield benchmarks against a
   neutral government commodity feed — a credible, defensible "are you being ripped off?" answer.
   Orderly proves demand for this; Yield's public-data version is harder to game and free to source.
3. **Price + simplicity.** $49/mo vs MarginEdge's ~$350. For a 1-location chef-owner who just wants
   "am I overpaying and what's my food cost %," the enterprise tools are too expensive and too heavy.
   Yield's cheap-to-run vanilla stack supports this price floor profitably.
4. **Speed to first insight.** No inventory counts, no GL setup, no POS integration required. Upload
   an invoice, get a verdict in minutes. The big tools require real onboarding.

## Where Yield is exposed (be honest)
- **No recipe costing / theoretical food cost.** This is the metric serious operators ultimately
  want; MarginEdge/xtraCHEF/Apicbase all have it. Yield's food cost % is invoice/sales, not
  theoretical. Roadmap item, but a real gap.
- **Sysco-only at launch.** Many indies use US Foods, PFG, or multiple distributors. Limits TAM until
  Phase 2 parsers ship.
- **No bill pay.** MarginEdge's free unlimited bill pay is a strong retention hook Yield can't match.
- **Defensibility of the USDA angle.** The parser is hard to copy; the USDA comparison is not — a
  funded competitor could add a public-data benchmark. Win on Sysco depth + price, not just USDA.

## Sources
- [MarginEdge pricing](https://www.marginedge.com/pricing/)
- [Ottimate / Plate IQ rebrand](https://ottimate.com/news/meet-ottimate-plate-iq-rebrands-as-leading-ap-automation-ai/), [GetApp](https://www.getapp.com/retail-consumer-services-software/a/plate-iq/)
- [xtraCHEF by Toast](https://pos.toasttab.com/products/xtrachef), [Softabase listing](https://softabase.com/software/restaurant-management/xtrachef)
- [Apicbase (Capterra)](https://www.capterra.com/p/171584/Apicbase-Restaurant-Management/)
- [Restaurant365 acquires Compeat](https://www.restaurantbusinessonline.com/technology/back-office-software-provider-restaurant365-buys-competitor-compeat)
- [CrunchTime (Capterra)](https://www.capterra.com/p/2294/CrunchTime-Back-Office/)
- [Orderly food supplier pricing](https://getorderly.com/features/food-supplier-pricing)

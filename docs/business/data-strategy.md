# Data Strategy

> Owned by: `data`. What to collect, why, and how to turn it into value.

## Existing data assets (per docs/PLAN.md schema)
- `invoice_items` — parsed line items, computed cost/lb/oz/each, variance vs USDA
- `usda_prices` — daily market benchmarks
- `daily_sales` — Z reports (net sales, covers)
- `item_master` — learned supplier item code → common name mappings per business

## Ideas to evaluate
- Parser confidence/accuracy tracking over time
- Aggregate (anonymized) cross-business benchmarks — **flag to `lawyer` before pursuing**, CCPA implications
- Food-cost-% improvement per customer as a marketing proof point

(to be expanded)

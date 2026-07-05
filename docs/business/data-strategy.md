# Data Strategy — Reverto Market Price Benchmark Methodology

> Owned by: `data`. Last updated: 2026-06-28.
> This document is the authoritative methodology spec for the "Market Price" benchmark — the number
> a restaurant's paid price is compared against ("you pay $X/lb vs. market $Y/lb"). It is the core
> value proposition and is designed to be **rigorous and transparent**.
>
> **Action flags raised in this doc (see Section C):**
> - `lawyer` — must review peer-price aggregation/sharing before it ships (CCPA + antitrust/price-signaling). Conservative posture below.
> - `engineer` — any new column/table is a proposal; implement via migration. Recommended endpoint/job design in Section D.

---

## 0. Existing data assets (per docs/PLAN.md schema)
- `invoice_items` — parsed line items; computed `cost_per_lb` / `cost_per_oz` / `cost_per_each`, `category`, `pack_size`, `fuel_surcharge`, `split_case_surcharge`, variance vs USDA. Description→commodity mapping exists in `invoices/list.js` (`COMMODITY_MAP` / `matchCommodity`).
- `usda_prices` — columns: `commodity, grade, region, unit, price_low, price_high, price_avg, report_date, source_api`. Neutral, public, regular. Currently the only benchmark. Coverage limited to commodities USDA reports.
- `daily_sales` — Z reports (net sales, covers).
- `item_master` — learned supplier item code → common name mappings per business.

## Two benchmark data sources
1. **USDA AMS published prices** (`usda_prices`). Neutral, public, defensible, free to source, no data-scale flywheel required to launch. Coverage gaps are the weakness.
2. **Peer-paid prices (crowd-sourced)** — actual `cost_per_lb` / `cost_per_oz` / `cost_per_each` from Reverto customers' `invoice_items`, mapped to commodity via the existing mapper. "What restaurants like you actually pay." Same flywheel as Orderly's Restaurant Food Index. **Privacy/antitrust-sensitive — gated behind opt-in + k-anonymity + lawyer review (Section C).**

---

# A. The blended "real market price" computation

## A.0 Design principles
1. **One number, but never a black box.** We surface a single recommended benchmark per (commodity, region, recency window), but always carry the inputs (USDA value, peer value, sample size, dates) so the UI can explain it.
2. **Robust over precise.** Restaurants get wildly different deals. We use **medians / trimmed means**, never raw means. One ugly invoice must not move the benchmark.
3. **Honest about uncertainty.** A thin or stale benchmark is labeled as such, not dressed up.
4. **Cheap to ship.** v1 must run on the current stack (Netlify Functions + Supabase REST + GitHub Actions cron) with no new infra.

## A.1 Unit normalization (the common currency)
Normalize everything to **cost per pound (`$/lb`)** wherever the commodity is weight-based; use `$/each` only for genuinely countable goods (eggs by dozen, count-pack produce).

- The Sysco/generic parser already converts case price → `cost_per_lb` / `cost_per_oz` / `cost_per_each` (pack-size + catch-weight + split-case + fuel-surcharge handled upstream — see `docs/SYSCO-PARSER.md`). The benchmark **consumes `cost_per_lb` directly**; it does not re-derive units.
- USDA `usda_prices` rows carry a `unit`. Normalize to `$/lb` at read time:
  - `lb` → as-is; `cwt` (hundredweight) → `price / 100`; `dozen` → keep as `$/dozen` (eggs); `case`/`carton` → only usable if a documented standard weight exists for that commodity (maintain a small `USDA_UNIT_WEIGHTS` constant); otherwise **drop the row** from the weight-based blend rather than guess.
- **Rule:** never blend two different units. Bucket strictly by the normalized unit. If a commodity has both weight-based and count-based USDA series, pick the one matching how restaurants buy it (config per commodity).

## A.2 Recency weighting & windows
- **Primary window: trailing 30 days.** Falls back to 60, then 90 days if the 30-day window fails the minimum-sample test (Section A.5).
- **USDA recency:** use the most recent report on/before "today" for the (commodity, region). If the latest USDA report is **> 21 days old**, mark USDA as `stale` (still usable, but downweighted and surfaced in the confidence indicator).
- **Peer recency (v2):** weight each peer line item by an exponential decay on invoice date, half-life 30 days: `w_recency = 0.5 ^ (age_days / 30)`. v1 uses a flat trailing-30-day window (no decay) for simplicity.

## A.3 Outlier handling (robustness)
For peer data within a (commodity, region, window) bucket:
1. Collect the per-unit values `x_i` (all `$/lb`, or all `$/each`).
2. Compute the median and IQR (Q1, Q3). Discard any `x_i` outside `[Q1 − 1.5·IQR, Q3 + 1.5·IQR]` (Tukey fence). This removes catch-weight/pack-size parsing blunders and freak one-off deals.
3. From the surviving values, the **peer benchmark = median** (v1) or **20% trimmed mean** (v2, once n is large enough that trimming is stable).
4. Hard sanity floor/ceiling per commodity (config `SANITY_BOUNDS`, e.g. chicken breast must be in `$0.50–$8.00/lb`). Anything outside is dropped *before* step 1 — defends against decimal/parser errors poisoning the IQR itself.

USDA already publishes `price_low`/`price_high`/`price_avg`; we trust `price_avg` (USDA does its own aggregation) and use the band for the confidence display.

## A.4 Region matching & fallback
Peer businesses have a state (and city) from onboarding; USDA rows have a `region`. Resolve in this order, stopping at the first level that passes the minimum-sample test:
1. **Local** — same metro/city (peer) or matching USDA region.
2. **Regional** — same Census region / USDA macro-region (map states → regions in a `STATE_TO_USDA_REGION` constant).
3. **National** — all rows, any region.

The benchmark records which level it resolved at (`scope: 'local' | 'regional' | 'national'`) so the UI can say "regional" vs "national" honestly. Local is preferred because freight and local market conditions dominate produce/protein pricing.

## A.5 Minimum sample size (k-anonymity gate for peer data)
Peer data is **only shown** when, in the chosen bucket+window:
- **≥ 5 distinct businesses** (`MIN_DISTINCT_BUSINESSES = 5`), AND
- **≥ 8 distinct invoice line items** (`MIN_LINE_ITEMS = 8`).

If the 30-day window fails, widen the window (60→90) and then the region scope (local→regional→national) before giving up. If still failing, **peer data is suppressed entirely** and we fall back to USDA-only (or "no benchmark" — Section B).

**Why 5 businesses:** It is the threshold that simultaneously (a) makes the median statistically meaningful and (b) satisfies our k-anonymity floor (k=5) so no single business's price is reverse-engineerable from the aggregate. We deliberately count *distinct businesses*, not line items, so one chatty business can't both dominate the number and be re-identified. This is the antitrust/privacy keystone (Section C).

## A.6 Weighting USDA vs peer when both exist
Each source produces a value and an effective sample weight:
- `W_usda`: base weight 1.0, multiplied by `0.5` if USDA is `stale` (>21 days).
- `W_peer`: `min(n_businesses / 20, 1.0)` — peer weight ramps from 0.25 (at n=5) to a 1.0 cap (at n≥20). Below the k-gate, `W_peer = 0`.

**Blended benchmark:**
```
benchmark = (W_usda * usda_value + W_peer * peer_value) / (W_usda + W_peer)
```

Source-availability cases:
- **Both available:** blended formula above.
- **USDA only:** `benchmark = usda_value`, label "USDA market price".
- **Peer only (USDA has no coverage for this commodity):** `benchmark = peer_value`, label "What restaurants like you pay". Common for items USDA doesn't report (specialty produce, prepared/dry goods).
- **Neither:** no benchmark — see Section B "no benchmark" state.

## A.7 Concrete v1 formula (SHIPPABLE — simple & explainable)
Per (commodity, region-scope, trailing-30-days), computed nightly:

```
1. USDA leg:
   usda_value = latest usda_prices.price_avg for (commodity, resolved region), normalized to $/lb.
   usda_stale = (today - report_date) > 21 days
   W_usda = usda_stale ? 0.5 : 1.0
   (if no USDA row at any region scope: W_usda = 0)

2. Peer leg:
   values = invoice_items.cost_per_lb (or _per_each) for (commodity, region, last 30d)
            after SANITY_BOUNDS filter
   drop values outside Tukey fence [Q1-1.5*IQR, Q3+1.5*IQR]
   n_biz = count(distinct business_id among survivors)
   if n_biz >= 5 AND n_items >= 8:
       peer_value = median(survivors)
       W_peer = min(n_biz / 20, 1.0)
   else:
       widen window (60, 90) then region (local->regional->national); retry
       if still failing: W_peer = 0, peer_value = null

3. Blend:
   if W_usda + W_peer == 0: benchmark = null  (no-benchmark state)
   else: benchmark = (W_usda*usda_value + W_peer*peer_value) / (W_usda + W_peer)

4. Persist row: {commodity, scope, window_days, benchmark, usda_value, peer_value,
                 n_biz, n_items, usda_stale, confidence, computed_at}
```

**Verdict for a given paid price `p`:**
```
delta_pct = (p - benchmark) / benchmark
verdict = delta_pct <= -0.03 ? "below market"   (good, green)
        : delta_pct <   0.05 ? "at market"      (neutral)
        : delta_pct <   0.15 ? "above market"   (caution, yellow)
        :                      "well above market" (alert, red)
```
(Thresholds align with the color coding already in `docs/SYSCO-PARSER.md`'s UI section.)

## A.8 Richer v2 (once data scale exists)
- Replace flat 30-day window with **exponential recency decay** (half-life 30d, Section A.2) and use a **20% trimmed mean** instead of bare median.
- **Grade/spec awareness:** condition on USDA `grade` and parsed item attributes (boneless/skinless, 80/20, count size) so we compare like-for-like instead of one coarse commodity bucket.
- **Seasonality baseline:** for produce, compare against a same-week-last-year peer/USDA index, not just the trailing window, to separate "you're overpaying" from "it's just avocado season."
- **Per-distributor sub-benchmarks** (Sysco vs US Foods vs PFG) once multi-distributor parsers ship — answers "are you overpaying *for Sysco*" vs "should you switch distributors."
- **Confidence as a continuous score** (function of n_biz, recency, USDA/peer agreement, region scope) rather than 3 buckets.

---

# B. Transparency / presentation to the user

## B.1 Labeling — when to show which name
| Situation | Label shown |
|-----------|-------------|
| USDA only | **"USDA market price"** |
| Peer only | **"What restaurants like you pay"** |
| Blended (both) | **"Reverto market price"** (with "Blends USDA + peer data" subtext) |
| Below sample threshold / no data | **"No benchmark yet"** (see B.5) |

Never label peer data as "USDA". Never imply a peer number is a neutral government figure.

## B.2 "How this is calculated" copy (tooltip / info text — ship verbatim)
> **How we calculate this**
> The Reverto market price is what comparable restaurants in your area are actually paying right now,
> blended with the latest USDA published commodity prices. We use the **median** (the middle of the
> range), throw out unusually high and low outliers, and only use the last 30 days. We never show a
> peer number unless at least **5 different restaurants** are in the sample, so no single business's
> prices are ever exposed. When we don't have enough local data, we widen to your region, then
> nationally — and we'll tell you which one you're seeing.

USDA-only variant:
> **How we calculate this**
> This is the latest USDA published market price for this commodity, from public government reports
> updated regularly. It's a neutral, independent reference for what this item costs at wholesale —
> not Reverto's estimate and not other restaurants' prices.

## B.3 Confidence indicator
Show a **High / Medium / Low** badge next to the benchmark:
- **High** — peer `n_biz ≥ 12` at local OR regional scope, USDA fresh (≤21d). Both sources agree within ~15%.
- **Medium** — peer `n_biz` 5–11, OR national scope, OR USDA stale, OR USDA/peer disagree by 15–30%.
- **Low** — USDA-only with stale data, or peer just barely cleared the k-gate, or USDA/peer disagree >30% (we show the number but warn).

Always render the raw evidence on hover: e.g. *"Based on 9 restaurants in your region, last 30 days + USDA (updated 4 days ago)."* Transparency is the moat against "is this number real?"

## B.4 Variance verdict — honest states
- Show verdict (B/A7 thresholds) **only** when a benchmark exists.
- Display the benchmark value, the scope ("regional"), the recency ("last 30 days"), and the confidence badge alongside the verdict — never a naked "you're overpaying."
- If confidence is **Low**, soften wording: "Looks above market, but we have limited data for this item" instead of a hard red verdict.

## B.5 "Not enough data yet" / "no benchmark" states
- **Peer below threshold, USDA available:** show USDA value, badge Medium/Low, note "Peer data still building for this item."
- **Neither available:** show **"No benchmark yet"** with: *"We don't have a reliable market price for this item yet. We'll show one as USDA coverage or nearby restaurant data grows. Your true cost/lb is still computed and tracked."* — i.e. the core parser value (cost/lb) is never blocked by a missing benchmark.
- Never invent a number, never extrapolate across unrelated commodities to fill a gap.

---

# C. Data integrity, privacy, legal flags

## C.1 Anonymization & aggregation (k-anonymity)
- Peer aggregates are **only** ever computed and shown over **≥ 5 distinct businesses** (k=5) and ≥ 8 line items (A.5). No endpoint, query, or UI ever returns a peer figure derived from fewer.
- Aggregates expose **only** the summary statistic (median/blend), sample counts, region scope, and window — **never** individual prices, business names, locations finer than region, invoice IDs, or distributor account numbers.
- Suppress small cells on every dimension: if filtering (e.g. by distributor in v2) drops a cell below k=5, collapse up to the next scope rather than reveal it.

## C.2 Opt-in framing (CCPA / Privacy Policy) — **flag: `lawyer`**
- Contributing one's invoice prices into the peer pool must be **explicit opt-in**, separate from using Reverto for one's own cost tracking. A user who never opts in still gets full single-business value (their own cost/lb, USDA comparison).
- Opt-in copy, settings toggle, and the Privacy Policy disclosure of this secondary aggregate use must be drafted/reviewed by `lawyer` and reconciled with `docs/LEGAL.md` (CCPA notice-at-collection, right to opt out / delete). Aggregated data already published must have a documented stance on deletion requests (we delete the source business's contribution; historical aggregates that no longer meet k after removal are recomputed/suppressed).
- **`lawyer` action item:** approve opt-in language + Privacy Policy delta before peer benchmark ships.

## C.3 Antitrust / competition flag — **flag: `lawyer` (conservative, blocking)**
Aggregating and showing competitors' prices has genuine antitrust sensitivity (price signaling / facilitating coordination). Our mitigations, and they must be reviewed before peer-price sharing ships:
- **Anonymized** — no business identifiable (k=5 floor, region-only granularity).
- **Aggregated** — only a median/blend, never line-level competitor prices.
- **Historical, not forward-looking** — benchmark reflects **past paid prices** (trailing window), never future/quoted/list prices, and is not a recommendation of what to charge or pay. We do not let users target a specific competitor or narrow segment.
- **No two-sided signaling** — we never tell a supplier what restaurants pay, and never tell a restaurant what a *named* competitor pays.
- **Posture:** treat peer-price sharing as **blocked pending `lawyer` sign-off**. USDA-only benchmark (neutral public data, no antitrust exposure) is the safe launch path and is sufficient for v1. Peer blending is a v1.5+ feature contingent on legal review. Be conservative.

## C.4 Data quality risks & defenses
| Risk | Defense in this methodology |
|------|------------------------------|
| Commodity-mapping errors (`matchCommodity` mis-buckets) | Median + Tukey fence + per-commodity `SANITY_BOUNDS` blunt the impact of a few mis-mapped lines; track mapping confidence and exclude `null`-commodity items entirely. |
| Catch-weight / pack-size parse mistakes → bad `cost_per_lb` | `SANITY_BOUNDS` hard filter *before* aggregation; Tukey fence; never use bare mean. Parser confidence score (`docs/SYSCO-PARSER.md`) below threshold → exclude line from peer pool. |
| Stale USDA data | `usda_stale` flag (>21d) downweights USDA (W_usda×0.5) and lowers the confidence badge; surfaced to user. |
| One business dominating a thin bucket | Median over **distinct businesses**, weight cap, k=5 gate. |
| Decimal / unit errors poisoning IQR | `SANITY_BOUNDS` runs first, before quartiles are computed. |
| Mixed units silently blended | Strict per-unit bucketing (A.1); rows of unknown/unconvertible unit are dropped, not guessed. |

---

# D. Implementation notes for the engineer

> All new columns/tables are **proposals**; implement via Supabase migration. The data role is read-only on the DB.

## D.1 Recommended approach: nightly precompute (not on-the-fly)
Computing IQR/median across the peer pool on every `invoices/list.js` request is too expensive and would re-scan `invoice_items` constantly. Instead:

- **New cron job** mirroring the existing `market/sync` pattern (`.github/workflows/market-sync.yml` + a Netlify function gated by `x-cron-secret: $CRON_SECRET`). Proposed: `netlify/functions/market/benchmark/index.js`, triggered nightly **after** the USDA sync.
- It computes, per (commodity × region-scope × window), the A.7 v1 outputs and **upserts into a new `market_benchmarks` table** (proposed columns):
  ```
  market_benchmarks(
    commodity text, scope text, window_days int,
    benchmark_per_lb numeric, benchmark_per_each numeric,
    usda_value numeric, peer_value numeric,
    n_biz int, n_items int, usda_stale bool,
    confidence text, computed_at timestamptz,
    PRIMARY KEY (commodity, scope, window_days)
  )
  ```
- Use `Prefer: resolution=merge-duplicates` (same upsert idiom as `market/sync`).
- **`invoices/list.js` reads `market_benchmarks` instead of computing** — replace `fetchUsdaPrice` with a `fetchBenchmark(commodity, businessRegion)` lookup that resolves scope local→regional→national and returns the precomputed row + verdict.

## D.2 Inputs the job needs
- Peer aggregation must filter to **opt-in businesses only** (proposed `businesses.peer_optin bool` column — `engineer` + `lawyer`).
- Business region: needs `businesses.state` (and optionally city/metro) from onboarding — confirm/add via migration.
- Parser confidence per line: if not already persisted, propose `invoice_items.parse_confidence` so low-confidence lines can be excluded from the peer pool.

## D.3 Constants to centralize (config module)
`SANITY_BOUNDS` (per commodity), `USDA_UNIT_WEIGHTS`, `STATE_TO_USDA_REGION`, `MIN_DISTINCT_BUSINESSES=5`, `MIN_LINE_ITEMS=8`, window ladder `[30,60,90]`, verdict thresholds. Keep alongside / share the existing `COMMODITY_MAP` so mapping and benchmarking stay in lockstep.

## D.4 Launch sequencing
1. **v1 ship now:** USDA-only benchmark via the precompute job (no antitrust/privacy exposure). Gets the nightly table + `invoices/list.js` read path in place.
2. **v1.5 (gated on `lawyer`):** turn on peer leg + blend once opt-in, k-anonymity, and antitrust review are signed off.
3. **v2:** recency decay, trimmed mean, grade/spec matching, seasonality, per-distributor sub-benchmarks.

---

## Appendix — secondary data-product ideas (lower priority)
- Parser confidence / `common_name` match-rate trends over time (product/QA metric).
- **Food-cost-% improvement per customer** tracked from onboarding → ongoing — powerful marketing proof point (coordinate `marketing` / `product`). Must use aggregate, anonymized framing if published.
- Signup → activation (first parsed invoice) → retention funnel (coordinate `product` / `marketing`).
- Cross-business pricing benchmark as a standalone "Restaurant Food Index"-style content/marketing asset — **same C.2/C.3 legal gates apply; `lawyer` review required before any public use.**

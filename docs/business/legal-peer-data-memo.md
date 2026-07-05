<!-- DRAFT — for attorney review; not legal advice. Prepared by a non-lawyer research assistant for Reverto's founder. A licensed California attorney must review and bless this before the peer-benchmarking feature is built or shipped. Nothing here asserts that the design IS compliant — it describes what the design is intended to satisfy and what still needs confirmation. Remove this comment when the attorney signs off. -->

# Attorney-Ready Memo — Peer-Price Benchmarking Feature

**Product:** Reverto (cost-control SaaS for independent restaurants)
**Prepared for:** Founder + reviewing California attorney
**Prepared by:** Legal/compliance research assistant (non-lawyer)
**Date:** 2026-07-05
**Status:** DRAFT — blocking legal review required before build or launch

---

## 0. One-paragraph summary for the busy reader

Reverto wants to show each restaurant whether it is overpaying for a commodity by comparing its own
paid price against (1) USDA public prices and (2) a **peer benchmark = the median of prices that
OTHER Reverto restaurants actually paid** for the same commodity. Input (2) is the legally sensitive
one: aggregating prices paid by businesses that may compete with each other raises **antitrust
(information-exchange)** questions and, because it is a **secondary use of customers' data beyond
serving them their own results**, raises **CCPA/CPRA consent** questions. This memo maps Reverto's
existing design (see `docs/business/data-strategy.md`) to the recognized mitigations and flags what
the attorney still needs to decide. The safe launch path — **USDA-only benchmark** — carries none of
this exposure and should ship first regardless.

---

## 1. What the feature does (facts the analysis depends on)

From the methodology spec (`docs/business/data-strategy.md`, Sections A and C):

- The peer benchmark is computed from customers' own parsed `invoice_items` (`cost_per_lb` /
  `cost_per_each`), grouped by commodity, region scope, and a recency window.
- It is **aggregated**: only a **median** (v1) is ever computed or shown — never any individual
  business's price, name, location finer than region, invoice ID, or distributor account.
- It is gated by **k-anonymity**: a peer number is only computed/shown when the bucket contains
  **≥ 5 distinct businesses AND ≥ 8 distinct line items**. Below that, peer data is suppressed and
  Reverto falls back to USDA-only.
- It is **historical / backward-looking**: it reflects **past paid prices** in a trailing window,
  never quoted, list, forward, or future prices, and is never framed as advice on what to charge or
  pay.
- It is **one-directional and non-targeted**: Reverto never tells a supplier what restaurants pay,
  and never lets a restaurant see a *named* competitor's price or target a narrow segment.
- Reverto (a neutral software vendor) is the party that collects and aggregates the data; the
  restaurants never see each other's raw data.

These facts are what make the mitigations below available. If the product later changes any of them
(e.g., exposes ranges, narrows segments, shortens the age lag, adds supplier-facing views), the
analysis must be redone.

---

## 2. Antitrust / competition analysis (US)

### 2.1 The core risk

Under **Sherman Act § 1** (and FTC Act § 5), agreements that unreasonably restrain trade are
illegal. Courts and the antitrust agencies have long treated **exchanges of competitively sensitive
information among competitors — especially current or future price information — as capable of
facilitating price coordination or "signaling,"** even without an explicit agreement to fix prices.
A tool that aggregates and redistributes what competing restaurants pay could, if designed badly, be
characterized as a mechanism that helps competitors converge on prices. That is the risk we are
managing. (Note: restaurants here are *buyers* comparing *input costs*, not sellers coordinating
menu prices — a materially lower-risk posture than classic seller price-fixing — but buyer-side
information exchange can still raise monopsony/coordination concerns and should be treated
conservatively.)

### 2.2 The recognized mitigations (information-exchange "safety zone" concepts)

Historically, the DOJ/FTC articulated conditions under which competitor information exchanges are
much less likely to be challenged. Those conditions (drawn from the agencies' longstanding
information-exchange guidance) are the template we design against:

1. **Managed by a neutral third party** — the exchange is run by a third party (a trade association,
   consultant, or **software vendor**), not by the competitors themselves passing data to each other.
2. **Aggregated** — what participants see is an aggregate statistic, so that **no individual firm's
   data is identifiable** in the output.
3. **Historical, not current or forward-looking** — the data is old enough that it cannot be used to
   coordinate on today's or tomorrow's prices.
4. **Enough participants** — the pool is large enough that no single participant's data can be
   backed out of the aggregate.

> Caveat for the attorney: the specific "3-month-old data / 5-provider / no-single-firm->25%"
> numeric safe harbor that many people remember comes from the agencies' older healthcare
> statements, which the DOJ **withdrew in 2023**. The *principles* (neutral manager, aggregation,
> historical, sufficient participants) remain the analytical framework the agencies apply, but there
> is **no longer a bright-line numeric safe harbor** to rely on. This is a key reason the age and
> participant thresholds below need express attorney sign-off rather than being treated as
> self-certifying.

### 2.3 How Reverto's design maps to each mitigation

| Mitigation | Reverto's design | Assessment |
|---|---|---|
| Neutral third-party manager | Reverto (a software vendor) collects and aggregates; restaurants never exchange data directly or see raw peer data. | Designed to satisfy. Confirm Reverto's neutrality framing (we are not owned by/acting for any participant group). |
| Aggregated, no firm identifiable | Median only (v1); k ≥ 5 distinct businesses AND ≥ 8 line items; region-only granularity; no line-level prices, names, IDs ever exposed. | Designed to satisfy. See §4 for the de-identification standard. |
| Historical, not forward-looking | Backward-looking paid prices only; never quotes/list/forward prices; never framed as "what to pay." | Designed to satisfy on *type* of data. **Open: the age/lag of the window — see §2.4.** |
| Enough participants | k = 5 distinct businesses floor; peer weight capped so one business can't dominate; median over distinct businesses (not line items). | Designed to satisfy the *principle*. **Open: is 5 enough — see §2.4.** |
| No two-sided signaling | Never supplier-facing; never a named competitor; no narrow-segment targeting; not a pricing recommendation. | Designed to satisfy. |

### 2.4 What is still OPEN for the attorney to bless

1. **Data-age / recency threshold.** This is the single biggest open item. The **methodology's
   default value window is trailing 30 days** (for freshness/usefulness), but the antitrust-safest
   posture is **older, "stale" data that cannot be used to coordinate on current prices.** These two
   goals are in tension.
   - **My conservative recommendation:** aggregate only invoice lines that are **at least ~3 months
     (90 days) old** — i.e., introduce a **minimum age lag**, so the peer benchmark reflects the
     window "roughly 3–6 months ago," not the last 30 days. This aligns with the historical-data
     principle and the (now-withdrawn but still instructive) 3-month concept.
   - **The tradeoff to surface to the founder and attorney:** a 3-month lag makes the peer number
     less "live" and slightly less useful for volatile produce, but it is far more defensible. The
     attorney should decide whether (a) to require the full ~3-month lag, (b) to bless a shorter lag
     given the strong aggregation + k-anonymity + neutral-manager posture and the buyer-side (input
     cost) context, or (c) to launch peer data USDA-blended only for less volatile commodities. Until
     blessed, I recommend the product **default to the ~3-month lag.**

2. **Minimum participants.** The methodology sets **k = 5 distinct businesses**. This satisfies the
   *principle* of "enough participants," but there is no current numeric safe harbor. The attorney
   should confirm whether 5 is acceptable or whether a higher floor (e.g., 6–10) is warranted, and
   should bless the companion rule that **no single business may contribute more than a set share** of
   a bucket (the methodology already caps peer *weight*; consider also a hard contribution cap).

3. **Median only vs. ranges/dispersion.** v1 shows the **median only**. Showing ranges, quartiles, or
   distribution detail increases informational richness and therefore antitrust sensitivity. My
   recommendation is **median only for launch**; the attorney should bless whether any dispersion
   display is ever acceptable.

4. **Commodity/segment granularity.** Confirm that region-only + broad-commodity granularity (no
   per-named-distributor, no sub-metro, no narrow SKU segment that could shrink a cell toward
   re-identification) is the required floor, and that any future v2 granularity (per-distributor
   sub-benchmarks) triggers fresh review.

---

## 3. CCPA / CPRA analysis

### 3.1 Why peer contribution needs its own consent

Using Reverto for your own cost tracking is the service the customer signed up for. **Contributing
your invoice prices into a shared pool that benefits other customers is a *different, secondary use*
of that data** — it goes beyond serving that customer their own results. Under CCPA/CPRA principles
(purpose limitation, notice at collection, and the expectation that secondary uses be disclosed and,
where they exceed the original purpose, separately authorized), this secondary use should be:

- **Separately, explicitly opt-in** — a dedicated toggle, **not bundled into the signup ToS or the
  general Privacy Policy acceptance.** A customer who never opts in still gets full single-business
  value (their own cost/lb and the USDA comparison).
- **Clearly disclosed** — the consent must say *what* is shared (parsed commodity-level prices they
  paid), *how* it is de-identified/aggregated (median only, k ≥ 5, region-only), *what they get in
  return* (access to the peer benchmark), and that it is **optional and revocable.**
- **Revocable** — turning the toggle off must stop future contribution, and the Privacy Policy /
  consent copy must explain what happens to data already contributed (see §3.2).

> Note: whether the shared data is "personal information" at all is itself a question for the
> attorney — it is **business** cost data, arguably tied to a business rather than a consumer, and
> once aggregated to a k≥5 median it is intended to be de-identified. We are nonetheless treating it
> under CCPA/CPRA **conservatively**, as if it were personal information, because (a) sole
> proprietors' business data can be personal, and (b) explicit opt-in is the safer posture for both
> privacy and antitrust. The attorney should confirm this framing.

### 3.2 Reconciling with the deletion right

When a business exercises its **right to delete** (or turns off the toggle), we must define what
happens to peer data already used:

- **Stop future contribution immediately** — remove that business from all forward aggregation.
- **Delete/deidentify the source data** — the business's own `invoice_items` are deleted or
  de-identified through the normal `data/delete` path (see `docs/business/legal-notes.md`
  engineering gaps).
- **Already-computed aggregate medians:** **recommendation — treat published aggregates as
  irreversibly de-identified, so they need not be recomputed or torn down.** The rationale to put in
  front of the attorney: a k ≥ 5 median is a statistic that, by design, **does not contain and cannot
  be reversed to any individual business's price**; once a data point is folded into a k≥5 median it
  is no longer that business's identifiable personal information. Under CCPA/CPRA, **deletion applies
  to the personal information we hold about the consumer, and there is an exception/allowance for
  data that has been de-identified/aggregated.** So: we delete the source contribution and stop using
  it going forward, but we are not required to reach back and recompute historical aggregates that
  are already de-identified.
  - **Belt-and-suspenders (methodology C.2 already contemplates this):** on the **next scheduled
    recompute**, the deleted business simply is not in the pool, so forward aggregates naturally no
    longer reflect it; and if removing it would drop a bucket below k = 5, that bucket is suppressed.
    This means even the "de-identified aggregates persist" stance is time-bounded by the nightly
    recompute in practice.
  - **Open for the attorney:** bless (a) that k≥5 medians qualify as de-identified/aggregate such
    that the deletion right does not force retroactive recomputation, and (b) the exact retention
    stance on any stored historical benchmark rows.

### 3.3 Other CCPA/CPRA touchpoints

- **Notice at collection** must mention the peer-benchmark purpose (as an *optional* purpose the user
  can enable), consistent with the Privacy Policy delta in
  `docs/business/legal-privacy-policy-peer-delta.md`.
- **Not a "sale."** We do not exchange the data for money and do not disclose it to third parties for
  their own use; peer data stays within Reverto and is only ever surfaced as an aggregate. We should
  continue to state we do **not** sell or share (in the cross-context-advertising sense). The
  attorney should confirm the aggregate-benchmark use is not a "sharing"/"sale" under CPRA.
- **Consent record:** the product must **store a durable, timestamped record of the opt-in** (who,
  when, which version of the consent copy) so we can prove consent and honor revocation. This is a
  build requirement (see the product gate in `legal-notes.md`).

---

## 4. De-identification standard (what "anonymized/aggregated" concretely means here)

For this feature, data is treated as de-identified/aggregated only when **all** of the following
hold (mirrors `data-strategy.md` C.1):

1. **k ≥ 5 distinct businesses** contribute to the bucket, **AND ≥ 8 distinct line items** are
   present. No endpoint, query, cron job, or UI ever returns a peer figure derived from fewer.
2. **Median only** is exposed (v1). No individual prices, no min/max, no per-line values.
3. **No sub-region granularity** that could re-identify: region-only (local metro → regional →
   national ladder). No sub-metro, no address, no business name, no location finer than region.
4. **No vendor + item + date tuples exposed** — never a distributor account number, invoice ID, or
   any tuple that pins a price to a business, a supplier, and a time.
5. **Small-cell suppression on every dimension** — if any future filter (e.g., per-distributor in
   v2) would drop a cell below k = 5, collapse up to the next scope rather than reveal it.
6. **Single-contributor dominance controlled** — median computed over *distinct businesses*, plus a
   weight cap, so one high-volume business cannot both move and be reverse-engineered from the number.

If any of these cannot be enforced **server-side**, the peer figure must not be shown.

---

## 5. The safe fallback (why we are not stuck)

The **USDA-only benchmark** uses neutral, public, government data with **no antitrust exposure and no
new consent burden.** The methodology (`data-strategy.md` D.4) already sequences USDA-only as the v1
launch and peer-blending as a gated v1.5. **Reverto can launch and deliver its core value with
USDA-only while the peer feature waits for attorney sign-off.** Nothing in this memo blocks the
product; it blocks only the peer leg.

---

## 6. Questions for our attorney (checklist)

1. **Data-age lag:** Is a ~3-month (90-day) minimum age lag on contributed data required, or is a
   shorter lag acceptable given the aggregation + k-anonymity + neutral-manager + buyer-side posture?
   What age do you bless as the default?
2. **Minimum participants:** Is k = 5 distinct businesses sufficient, or should the floor be higher?
   Do you want a hard per-business contribution cap (not just a weight cap)?
3. **Median only vs. ranges:** Confirm median-only for launch; is any dispersion/range display ever
   acceptable?
4. **Is the shared data "personal information" under CCPA/CPRA** at all (business cost data / sole
   proprietors), and is our conservative "treat it as PI + explicit opt-in" posture the right call?
5. **Is the aggregate peer benchmark a "sale" or "sharing"** under CPRA? (We believe not.)
6. **Deletion reconciliation:** Do you bless that a k≥5 median is de-identified/aggregate such that
   the deletion right does not force retroactive recomputation of already-published aggregates
   (source contribution deleted + dropped from forward recompute)?
7. **Consent mechanics:** Is a dedicated, separate, timestamped opt-in toggle (copy in
   `legal-peer-consent-copy.md`) sufficient, and is the copy adequate?
8. **Privacy Policy delta:** Does the drop-in section in `legal-privacy-policy-peer-delta.md`
   adequately disclose the secondary use?
9. **Neutral-manager framing:** Any concern with Reverto positioning itself as the neutral aggregator
   (e.g., entity status — Reverto is not yet a registered entity)?
10. **Antitrust posture generally:** Given the DOJ's 2023 withdrawal of the old safe-harbor
    statements, are you comfortable with the principle-based design, and are there any additional
    guardrails (audit, documented policy, no supplier-facing product) you want in writing before
    launch?

---

*This memo is a research draft to accelerate the attorney's review. It is not legal advice and must
not be relied upon by the founder as a substitute for review and sign-off by a licensed California
attorney before the peer-benchmarking feature is built or launched.*

# Go-To-Market Plan

> Owned by: `ceo`. Synthesis of `docs/PLAN.md` GTM, the 3-tier pricing review in
> `business-model.md`, the build sequence in `product-backlog.md`, and competitive research in
> `competitors.md`. Written 2026-06-14.

## The core tension
The hardest, most defensible asset (the Sysco obfuscation-defeating parser + USDA sync) is BUILT.
The product has ZERO usable UI — nothing is clickable end-to-end. A non-technical solo founder
should NOT wait on a full 3-tier product + billing + legal before getting in front of real
operators. The parser is the moat and it already runs. Use it manually now.

## 1. Sequencing — don't wait for the full product
GTM starts BEFORE the self-serve product exists, via a concierge "Overpayment Report":
- Founder collects a real Sysco invoice from a prospect (email/text/photo).
- Founder runs it through the existing `invoices/parse.js` pipeline manually (or with `engineer`
  help) and hand-delivers a one-page "you're paying X% over USDA market on these N items" report.
- No login, no dashboard, no billing required. This is a sales/learning motion, not a product.

This validates demand, generates testimonials and exact-dollar savings numbers, and produces the
first labeled invoice corpus — all in the weeks while `engineer` builds the core loop
(`product-backlog.md` steps 0–6). The two tracks run in parallel.

Realistic time-to-first-self-serve-user: the core loop (upload -> cost/lb vs USDA -> sales -> food
cost %) is ~6 weeks of focused build (backlog steps 0–6), NOT the 15-week PLAN.md timeline (which
front-loads billing/legal/a11y polish prematurely). But time-to-first-REAL-conversation is THIS
WEEK via concierge.

## 2. Single highest-leverage first move
**Manually deliver 10 concierge Overpayment Reports to real Bay Area / LA Sysco operators.**

Why this one, for a non-technical solo founder:
- Uses the one thing that already works (the parser) — zero new build required of the founder.
- It IS the marketing hook ("what Sysco hides on your invoice"), the sales pitch, the demand-
  validation experiment, and the first data collection, all at once.
- Each report is a warm relationship with a future paying customer and a concrete savings figure
  ("we found you $X/mo") — the only testimonial that sells this product.
- It forces the founder to talk to 10 operators, which is the single most valuable thing a
  pre-product founder can do. It surfaces real objections before a line of UI is committed.

Tradeoff: it's manual and doesn't scale — that's fine and intended. The goal of move #1 is
learning + first relationships, not throughput. Scaling is move #2's problem.

## 3. Free-tier data strategy vs. timing
Data collection should start NOW, BEFORE monetization features exist — but via concierge, not a
public free tier. Reasons:
- A public free tier with uncapped OCR is gross-margin-negative and unsafe to ship before the Azure
  DI per-invoice cost is verified and a hard cap is set (open item in `business-model.md`).
- Cross-customer/commercial use of invoice data needs opt-in + `lawyer` review; concierge with an
  explicit "may we use your anonymized prices to benchmark?" consent is the clean way to seed the
  dataset legally and early.
- Benchmarking (the $49 upsell) only has value once data scale exists. Seeding it now via concierge
  means the paid tier launches with something real behind it instead of an empty promise.

So: data first (concierge, consented), public free tier LATER once OCR cost is capped and legal
sign-off exists.

## 4. Realistic milestones (honest)
- First 10 users = first 10 concierge Overpayment Reports. Weeks 1–4. No product needed. Bottleneck
  is founder outreach hustle, not engineering.
- First paying customer: likely BEFORE the polished product — a concierge user who says "just keep
  doing this monthly, I'll pay." Target week 4–8. Could be a manual/invoiced $49, not Stripe.
- First 50 users: weeks 8–16, once the self-serve core loop (backlog steps 0–6) ships and the
  founder converts the concierge pipeline + referrals into self-serve signups.
- Sustainable paid conversion: only after the core loop + benchmarking have real data behind them
  (~month 4–6), consistent with PLAN.md's Month 6 target of ~75 paying — that remains ambitious for
  a solo founder and should be treated as a stretch goal, not a plan.

## 5. Biggest risk + mitigation
**Risk: the founder builds (via the AI team) for months and never does the unscalable outreach** —
ending up with a beautiful empty product and no users. This is the classic non-technical-founder
failure mode, and it's amplified here because the AI team makes building feel like progress.

Mitigation: make outreach the gating metric, not features built. Rule: no further self-serve
feature work past the demoable core loop (backlog step 6) until 10 concierge reports are delivered
and at least 3 operators have said they'd pay. Tie the build roadmap to outreach milestones so
engineering can't outrun demand validation.

Secondary risk: concierge can't scale and founder burns out doing manual reports. Mitigation: it's
explicitly capped at ~10–20 reports as a learning/seeding exercise; the self-serve loop replaces it.

## Channel priority (from PLAN.md, sharpened)
1. Direct outreach to Bay Area / LA Sysco operators (DM/email) — primary, drives concierge reports.
2. Referral ("found you $X, know another operator getting squeezed?") — concierge users are warm.
3. Content engine: turn anonymized concierge findings into "what Sysco hides" posts.
4. Sysco reps as co-branded referral channel — supplement only, NOT a data deal (see
   `business-model.md` item 5). Any formal partnership = founder sign-off.

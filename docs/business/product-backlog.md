# Product Backlog

> Owned by: `product`. Reconciles `docs/PLAN.md` Phase 1/2 with reality and new ideas.

## Current state (2026-06-14)
Built: auth (login/signup, JWT), invoice parsing pipeline (`invoices/parse.js`, Sysco + generic
parsers), USDA market price sync. **No HTML/CSS exists at all** — nothing is usable end-to-end in a
browser yet, even though the hardest piece (parsing) is done. Supabase schema per
`docs/ARCHITECTURE.md` has not been confirmed as created in the actual project — first build step
must verify/create it.

## Guiding principle
Smallest possible end-to-end slice first: get ONE invoice from "founder uploads a file" to "sees
cost/lb vs USDA on screen" before building anything else. Every subsequent step should keep the
whole loop demoable/clickable, even if rough. Resist building polished onboarding, billing, or
legal pages before the core loop works — that's how non-technical founders end up with a beautiful
shell around an empty product.

---

## Ordered build sequence — Phase 1 MVP

### 0. Confirm/create Supabase schema (S)
**What**: Run the DDL from `docs/ARCHITECTURE.md` (businesses, users, locations, suppliers,
invoices, invoice_items, daily_sales, usda_prices, item_master, subscriptions,
push_subscriptions, audit_log) against the actual Supabase project. Verify what already exists
(auth/signup presumably already inserts into `users`/`businesses`; market/sync presumably already
writes `usda_prices`).
**Why now**: Nothing else can be tested end-to-end without real tables. `invoices/parse.js` already
assumes `invoices` and `invoice_items` exist — confirm columns match exactly (esp.
`cost_per_lb`/`cost_per_oz`/`usda_price_ref`/`variance_pct`, which `parse.js` likely doesn't populate
yet — check).
**Tables touched**: all of them (create-if-missing).
**Open question for `data`**: are RLS policies needed now, or is `business_id` scoping in function
code (current pattern) sufficient for MVP? Flag for `security` review too.

---

### 1. Bare-bones login + invoice upload page (M)
**What**: The first real HTML page. `login.html` (email/password form, calls existing
`auth/login`/`signup`, stores JWT via `js/db.js` Auth helpers) + a minimal `app.html` with ONE
feature: a file input that uploads a PDF/image to Supabase Storage, creates an `invoices` row
(`status: 'pending'`), and calls `invoices/parse`. No nav, no styling beyond functional. Plain
HTML forms, reuse `js/db.js` exactly as-is.
**New function needed**: `invoices/upload.js` (per ARCHITECTURE spec) — accepts file, uploads to
Storage path `{business_id}/{invoice_id}.pdf`, inserts `invoices` row, calls `invoices/parse`.
**Tables touched**: `invoices` (insert), Supabase Storage bucket (create if missing).
**Why now**: This is the absolute minimum to prove the pipeline works from a browser. Founder can
literally take a photo of a Sysco invoice on their phone and see if parsing succeeds. Everything
else (dashboard, USDA comparison, sales entry) is worthless if this step is broken or slow.
**Risk to flag**: Azure Doc Intelligence is synchronous/polling in `parse.js` — for a real upload
this could take 10-30s. For MVP, simplest is to call parse synchronously from upload and just show
a spinner; don't build a queue yet (that's scope creep for Phase 1).

---

### 2. Invoice results page — show parsed line items (M)
**What**: After upload completes, redirect to a page showing the parsed `invoice_items` for that
invoice: description, pack size, quantity, cost_per_lb/oz/each, category. This is the first
"wow" moment — operator sees their invoice turned into structured cost data.
**New function needed**: `invoices/list.js` (GET, returns invoice + items; can start as
single-invoice detail via `?id=`, expand to list later).
**Tables touched**: `invoices`, `invoice_items` (read only).
**Why now**: Validates that parsing output is actually usable/correct on real invoices — critical
feedback loop before investing in USDA comparison or dashboards. Also the first thing a beta
operator would see and judge the product on.

---

### 3. USDA price comparison column (S/M)
**What**: On the invoice results page, add a column showing USDA market price for matching
commodities and variance % (green/red per ARCHITECTURE spec). Requires mapping `invoice_items`
descriptions/categories to `usda_prices.commodity` — likely a simple keyword match initially
(e.g. "chicken breast" -> commodity key), not the full `item_master` learning system yet.
**New function needed**: none new — extend `invoices/list.js` to join/lookup `usda_prices`, or add
small `market/prices.js` (per spec) called from frontend.
**Tables touched**: `usda_prices` (read), `invoice_items` (update `usda_price_ref`/`variance_pct`
columns — these already exist in schema and `parse.js` should probably populate them at parse time
instead, worth discussing with `engineer`).
**Why now**: This is the headline value prop ("Sysco is hiding the market price from you") — it's
the second pillar of the core loop and differentiates from a plain invoice-digitizer. Doing it
right after step 2 means the demo now tells a complete cost-insight story even before sales data
exists.
**Open question for `data`**: how good is the keyword-match commodity mapping going to be in
practice? May need a small lookup table (description substring -> usda commodity) maintained
manually for top ~20 commodities (matches the ARCHITECTURE's "top 50 commodity price points").

---

### 4. Daily Z report entry (S)
**What**: Simple form — date, net sales, tax, tips, covers. Saves to `daily_sales`.
**New function needed**: `sales/save.js` (POST, upsert on `(location_id, report_date)`).
**Tables touched**: `daily_sales` (insert/upsert). Note: schema requires `location_id` — if
onboarding/locations setup doesn't exist yet, either (a) auto-create a default location at signup,
or (b) make `location_id` nullable for MVP and revisit. Flag for `engineer`.
**Why now**: Cheapest possible piece of the loop — one form, one table, no OCR/AI involved. Unlocks
step 5 immediately.

---

### 5. Food cost % dashboard (M)
**What**: A single dashboard page: for a selected date range, sum invoice costs (from
`invoice_items.extended_price` or `invoices.total_amount`) and divide by `daily_sales.net_sales` to
show food cost %. Show as a number + simple trend (can be a basic table before a chart).
**New function needed**: `sales/report.js` (GET, returns food_cost_pct over date range, plus
underlying totals).
**Tables touched**: `invoices`, `daily_sales` (read), `daily_sales.food_cost_pct` (write — computed
field per schema).
**Why now**: This closes the full core loop end-to-end exactly as described in `docs/PLAN.md`:
upload -> parse -> cost/lb vs USDA -> daily sales -> food cost %. At this point the product has a
genuinely demoable MVP, even with zero styling. This is the milestone to show the founder and get
real-operator feedback before investing further.

---

### 6. Minimal styling + navigation shell (S/M)
**What**: One shared `app.css`, basic nav between upload / invoices / sales / dashboard pages,
mobile-responsive enough to use on a phone (operators will use this in a kitchen). Still not a
design pass — just usable.
**Why now**: Once the loop works functionally (steps 1-5), a thin layer of usability makes it
testable by a real (non-technical) operator without hand-holding. Defer full visual design/branding
until after first real-user feedback.

---

## Deferred within Phase 1 (build after the core loop is proven, in this order)

7. **Supplier setup page + `suppliers/save.js`** (S) — needed for multi-supplier invoices but not
   blocking for a single-supplier (Sysco) demo. `invoices/parse.js` can hardcode/infer supplier
   from vendor name match for now.
8. **Onboarding flow (business + location creation)** (M) — currently signup likely creates a bare
   `users`/`businesses` row; a real onboarding form (cuisine type, location) can wait until there's
   a reason to collect it (billing, multi-location). Needed to properly unblock step 4's
   `location_id` requirement — may need a minimal version (auto-create default location at signup)
   pulled forward into step 0/4.
9. **Invoice list page (multi-invoice)** (S) — expand step 2's single-invoice view into a real list
   with status (pending/verified/paid).
10. **Item master + learned common names** (M) — P1 per PLAN.md; improves USDA matching accuracy
    (feeds step 3) and is the foundation for Phase 2 recipe costing. Good candidate for
    "v1.1" right after initial beta feedback.
11. **Pro plan billing (Stripe)** (M/L) — no reason to gate features before there's a working
    product to gate. Build once 1-2 real beta operators are using the core loop.
12. **Legal pages (Privacy Policy, ToS, Accessibility) + CCPA export/delete** (M) — mandatory before
    any *public* launch or real user data collection beyond the founder's own testing. Must land
    before inviting outside beta operators (data is being collected from step 0 onward — `lawyer`
    should confirm whether founder-only testing triggers these requirements).
13. **Push notifications** (M) — explicitly P1, lowest priority of the listed P0/P1 items; cron
    workflow already scaffolded but `push/send` function doesn't exist.

---

## Phase 1 status checklist (updated)
- [x] Auth (signup/login/JWT)
- [x] Sysco invoice parser (core logic)
- [x] USDA market price sync
- [ ] Supabase schema confirmed/created (step 0)
- [x] Invoice upload endpoint + page (step 1) — built `index.html`, `login.html` (login+signup
  toggle), `app.html`, `netlify/functions/invoices/upload.js`, `css/style.css`. Schema/bucket not
  verified live — see open questions below.
- [ ] Invoice results/list page (steps 2, 9)
- [ ] USDA comparison on invoice view (step 3)
- [ ] Daily Z report entry (step 4)
- [ ] Food cost % dashboard (step 5)
- [ ] Minimal styling/nav (step 6)
- [ ] Supplier setup (step 7)
- [ ] Onboarding / locations (step 8)
- [ ] Item master (step 10)
- [ ] Pro plan billing (Stripe) (step 11)
- [ ] Privacy Policy, ToS, Accessibility statement (step 12)
- [ ] CCPA data export/delete (step 12)
- [ ] Push notifications (step 13)

## Open questions / assumptions
- Does `invoices/parse.js` currently populate `cost_per_lb`/`cost_per_oz`/`usda_price_ref`/
  `variance_pct` on `invoice_items`, or only the raw parsed fields? Affects whether step 3 needs new
  write logic or just a read/join. — for `engineer` to confirm.
- Does signup already create a default `locations` row, or does `daily_sales.location_id` have
  nothing to reference yet? Blocks step 4. — for `engineer`.
- Commodity-matching strategy for USDA comparison (step 3): keyword/substring lookup table vs.
  waiting for full `item_master`. — for `data`.
- Does founder-only testing (no outside beta users) change the urgency of legal pages (step 12)? —
  for `lawyer`.
- RLS policies vs. application-level `business_id` scoping for MVP — for `security`/`data`.

## New ideas
(to be added — competitor research pending; see `docs/business/competitors.md`)

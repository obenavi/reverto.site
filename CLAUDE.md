# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

This is **Yield** (repo: reverto.site) — a cost-control SaaS for US independent restaurants. It parses
distributor invoices (Sysco first), computes true cost per lb/oz/unit, compares against USDA market
prices, and tracks food cost % against daily sales.

Stack: vanilla JS PWA frontend (no build step) + Netlify Functions (Node) + Supabase (Postgres/REST,
US East) + GitHub Actions for cron jobs. No Supabase Auth — custom JWT (HS256) issued by
`netlify/functions/auth/*`.

The full target architecture, DB schema, and product plan are in `docs/ARCHITECTURE.md` and
`docs/PLAN.md`. **The codebase currently implements only a subset of that architecture** (see
"Current implementation status" below) — check what actually exists before assuming a function/page
is present.

## Commands

There is no root build/test setup (no root `package.json`). Each Netlify function directory with
external dependencies has its own `package.json`:

```bash
# Install deps for a specific function (only needed for auth and market/sync currently)
npm install --prefix netlify/functions/auth
npm install --prefix netlify/functions/market/sync

# Local dev (requires Netlify CLI)
netlify dev
```

`netlify.toml`'s build command runs both `npm install --prefix` steps above. There are no lint or
test scripts configured.

## Architecture

### Auth
- Custom JWT (HS256), signed/verified with `JWT_SECRET` using Node's `crypto.createHmac` directly
  (no JWT library). Token payload: `{ user_id, business_id, role, exp }`, 7-day expiry.
- `netlify/functions/auth/login.js` and `signup.js` both define their own local `makeJwt` —
  duplicated, not shared. `invoices/parse.js` defines its own local `verifyJwt` the same way.
  Any new authenticated function needs the same inline verify pattern (copy from `invoices/parse.js`).
- Frontend auth state lives in `js/db.js` (`Auth` object), backed by sessionStorage + localStorage
  fallback, under keys prefixed `yd_`.

### Data access pattern
Netlify functions talk to Supabase **directly via its REST API** (`SUPABASE_URL/rest/v1/...`) using
`fetch` with `apikey`/`Authorization: Bearer <SUPABASE_KEY>` headers — there is no Supabase JS client
or ORM. All business data is scoped by `business_id` from the JWT payload; queries filter with
`?business_id=eq.<id>` query params.

### Invoice parsing pipeline
`netlify/functions/invoices/parse.js` is the entry point:
1. Verifies JWT, loads invoice row (checking `business_id` ownership).
2. Downloads the file from Supabase Storage and sends it to Azure Document Intelligence
   (`prebuilt-invoice` model), polling the async operation until `succeeded`/`failed`.
3. Routes to a supplier-specific parser based on `VendorName`: `parsers/sysco.js` if it matches
   `/sysco/i`, else `parsers/generic.js`.
4. Inserts parsed line items into `invoice_items`, then patches the `invoices` row
   (`status: 'verified'`, invoice number/date/total, `parsed_at`).

`parsers/sysco.js` is the shared logic module — `parsers/generic.js` imports
`guessCommonName`/`guessCategory`/`computeUnitCosts`/`parsePackSize` from it. Key exported helpers:
- `parsePackSize(str)` — parses pack-size strings like `"4/5LB"`, `"6/#10 CAN"`, `"6/4/2.5LB"` into
  `{ count, size, unit }`.
- `computeUnitCosts(casePrice, packSize)` — converts case price to `cost_per_oz`/`cost_per_lb`/etc.
- `isCatchWeight` / `isSplitCase` / `isFuelSurcharge` / `isOverheadLine` — description-based
  classifiers for Sysco's invoice obfuscation patterns (see `docs/SYSCO-PARSER.md` for the full spec
  and rationale — fuel surcharges are distributed proportionally across line items by
  `extended_price`).
- `guessCommonName` / `guessCategory` — map raw descriptions to a controlled vocabulary
  (`'protein'|'produce'|'dairy'|'dry'|'supplies'|'other'`) used by both parsers.

Note: the internal function in `sysco.js` is named `parseSyscoo` but exported as `parseSysco` —
intentional (comment says "both spellings for safety"), don't "fix" the typo without checking
callers.

### USDA market price sync
`netlify/functions/market/sync/index.js` is triggered by `.github/workflows/market-sync.yml` (daily
cron, or manual `workflow_dispatch`) via a POST with header `x-cron-secret: $CRON_SECRET`. It pulls
from several USDA AMS report IDs (`USDA_REPORTS` array), normalizes results, and upserts into
`usda_prices` (Supabase `Prefer: resolution=merge-duplicates`, batches of 500).

`.github/workflows/push-notifications.yml` follows the same cron-secret pattern for
`/.netlify/functions/push/send`, but that function does not exist yet.

### Frontend
`js/db.js` is the only frontend JS file currently present. It provides:
- `Auth` — token/session helpers (`yd_*` storage keys), `isOwner`/`isManager`/`requireAuth`.
- `apiFetch(path, options)` — fetch wrapper that adds the `Authorization: Bearer <token>` header,
  redirects to `/login.html` on 401.
- `showToast`, `formatUSD`, `formatPct`, `formatDate`, `isPro`/`requirePro`/`showUpgradeModal`.

There are currently no HTML/CSS files in the repo, even though `netlify.toml` has redirects for `/`,
`/app`, `/login`, `/onboarding` to `index.html`/`app.html`/`login.html`/`onboarding.html`.

## Current implementation status vs. `docs/ARCHITECTURE.md`

Implemented:
- `netlify/functions/auth/login.js`, `signup.js`
- `netlify/functions/invoices/parse.js`
- `netlify/functions/market/sync/`
- `parsers/sysco.js`, `parsers/generic.js`
- `js/db.js`

Documented in `docs/ARCHITECTURE.md` but **not yet implemented**: `auth/refresh`, `invoices/upload`
and `invoices/list`, `items/list`, `sales/save`/`report`, `suppliers/save`, `market/prices`,
`billing/checkout`/`webhook`, `push/subscribe`/`send`, `users/profile`, `data/export`/`delete`,
`parsers/usfoods.js`/`pfg.js`, all HTML/CSS files, service worker, and the full Supabase schema.
When asked to add one of these, treat `docs/ARCHITECTURE.md` as the spec but verify against the
actual DB schema in Supabase before assuming tables/columns exist.

## Environment variables

Used across functions (set in Netlify, not committed): `SUPABASE_URL`, `SUPABASE_KEY`, `JWT_SECRET`,
`AZURE_DI_ENDPOINT`, `AZURE_DI_KEY`, `CRON_SECRET`, `USDA_API_KEY`.

## AI team

`.claude/agents/` defines specialist personas (ceo, engineer, qa, security, lawyer, marketing,
creative, product, data, development) for working on this project. `docs/business/` is their
shared knowledge base — see `docs/business/README.md`. Agents may research and draft within their
domain autonomously; anything irreversible (spending, legal commitments, public posts, production
deploys) requires founder approval.

## Compliance constraints

`docs/LEGAL.md` documents mandatory CCPA/CalOPPA/CIPA/ADA requirements for this product (privacy
policy, data export/delete endpoints, cookie consent, accessibility). Keep these in mind when adding
user-facing pages or data-handling endpoints — e.g., new tables holding personal info need a path to
the eventual `data/export` and `data/delete` functions.

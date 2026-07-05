# Security Notes

> Owned by: `security`. Running checklist of what's been reviewed and known gaps.

## Known architectural risk areas (from CLAUDE.md)
- Every Supabase REST query must filter by `business_id` from the verified JWT — missing filters
  are the top cross-tenant data leak risk.
- `makeJwt`/`verifyJwt` are duplicated inline per function (no shared lib) — each new function
  must implement this correctly.
- Secrets (`SUPABASE_KEY`, `JWT_SECRET`, `AZURE_DI_KEY`, `CRON_SECRET`, `USDA_API_KEY`) must only
  come from env vars.

## Review log
(to be added as reviews happen)

### 2026-06-14 — invoices/upload.js (new endpoint)

Reviewed: `netlify/functions/invoices/upload.js` (new), cross-checked against `parse.js` and `login.js`.

**High — invoices/parse.js trusts client-supplied `file_url` (pre-existing, surfaced by this review)**
`parse.js:32-43` accepts `file_url` from the request body and fetches it directly with the
Supabase service key as Bearer auth, then OCRs it via Azure DI and writes results into
`invoice_items`/`invoices` for the caller's own `invoice_id` (which *is* business_id-scoped on
line 38). But `file_url` itself is never checked against that invoice's `raw_file_url` or
constrained to the caller's `business_id` storage prefix. Any authenticated user (any tenant) can
call `/invoices/parse` directly with their own `invoice_id` + an arbitrary `file_url` pointing at
another business's object in the `invoices` storage bucket, causing the service-key-authenticated
fetch to retrieve that file and the OCR'd contents to be written into the attacker's own invoice
record — a cross-tenant data exfiltration path.
Fix: in `parse.js`, ignore the client-supplied `file_url` entirely; re-derive it from the invoice
row's `raw_file_url` (already fetched on line 38, just add it to `select=`) and require it to be
prefixed with `${payload.business_id}/`. upload.js itself is fine since it passes a freshly
generated, business-scoped path — but the public endpoint must not trust the parameter.

**Verified clean in upload.js:**
- JWT verification (`verifyJwt`, lines 23-33) is byte-identical to parse.js's pattern — signature
  check before decode, expiry check present. Consistent, no bypass found.
- `invoices` insert (line 76-80) and storage path (line 88) are built from `payload.business_id`
  (JWT-derived) only; no client-supplied `business_id`/`invoice_id` is accepted or trusted.
- Storage path: `${business_id}/${invoiceId}.${ext}` — `business_id` and `invoiceId` come from the
  JWT and a freshly-inserted DB row (UUID), not client input, so no path traversal even though the
  `ext` fallback (`filename.split('.').pop()`) is attacker-controlled and unsanitized (could contain
  `../` if filename has no recognized mime type — but it only affects the *extension* component, not
  a full path segment, and Supabase Storage rejects `/` in object name segments). Low risk, but
  recommend whitelisting `ext` to `[a-z0-9]{1,5}` regex to be safe.
- No secrets logged or returned to client; `SUPABASE_KEY`/`JWT_SECRET` only read from env.
- DoS: no explicit size limit on `data` (base64 body) before `Buffer.from` — Netlify's own request
  body limit (6MB on AWS Lambda-backed functions) bounds this somewhat, but add an explicit check
  (e.g. reject `data.length > ~8_000_000` base64 chars / ~6MB decoded) and return 413, since a large
  upload also drives Azure DI cost via the parse step.

**Medium — orphaned storage objects / DB rows on partial failure**
If the storage upload (line 89-101) fails after the `invoices` row was already inserted (line 73),
the row is left in `status: 'pending'` with no `raw_file_url` — not a security issue but worth a
cleanup job given CCPA data-minimization (`docs/LEGAL.md`).

Action items: fix parse.js file_url trust issue (high), tighten `ext` whitelist (low), add explicit
upload size cap (low/medium - cost control).

### 2026-06-22 — invoices/list.js + invoice.html (new list/detail endpoint)

Reviewed: `netlify/functions/invoices/list.js`, `invoice.html`, `app.html`, `netlify.toml`.

**Low — invoice_items query not scoped by business_id**
`list.js:41` fetches `invoice_items` filtered only by `invoice_id`, with no `business_id` constraint.
The invoice ownership check on line 32-37 gates access correctly (uses `business_id` from JWT), so
a foreign `invoice_id` will 404 before the items query runs. Risk is currently low because invoice
UUIDs are non-guessable. However, if `invoice_id` were ever sequential, or if a business_id check
were accidentally removed upstream, items could leak cross-tenant. Recommend adding
`&business_id=eq.${payload.business_id}` to the items query (requires `business_id` column on
`invoice_items`) to eliminate the dependency on UUID non-guessability.

**Verified clean:**
- `verifyJwt` in list.js is byte-for-byte identical to parse.js canonical pattern.
- Invoice query at list.js:33 uses `business_id=eq.${payload.business_id}` from JWT, not client input.
- No client-supplied `business_id` accepted anywhere.

### 2026-06-28 — Full production security audit (app is LIVE at reverto.site)

Scope: `auth-signup.js`, `auth-login.js`, `invoices/upload.js`, `invoices/parse.js`,
`invoices/list.js`, `market/sync/index.js`, `js/db.js`, `login.html`, `app.html`, `invoice.html`,
`netlify.toml`. New dedicated Supabase project `javitvqlvkluofzbaewx`.

NOTE: Supabase MCP tools were not reachable in this session — live RLS/grants state could not be
machine-verified. Findings below rely on the stated posture (RLS DISABLED on all tables, anon key
in `SUPABASE_KEY`, anon granted full INSERT/SELECT). Founder must confirm via dashboard.

CRITICAL
- RLS disabled + anon key is the app's only DB credential. With RLS off and anon holding full
  SELECT/INSERT, the entire database is exposed to anyone who has the anon key OR can reach the
  Supabase REST endpoint directly. The anon key is designed to be public (it ships to browsers in
  normal Supabase apps) and the project URL is discoverable. Anyone can hit
  `https://javitvqlvkluofzbaewx.supabase.co/rest/v1/users?select=*` with the anon key and read every
  tenant's users (incl. bcrypt password_hash), businesses, invoices, invoice_items. The fact that
  Reverto only uses the key server-side does NOT contain this — the key + URL are not secret.
  FIX (must fix now): switch `SUPABASE_KEY` to the service_role key, enable RLS on every table
  (`users`, `businesses`, `invoices`, `invoice_items`, `usda_prices`), and REVOKE anon/public
  grants. service_role bypasses RLS so functions keep working; RLS+revoke means a leaked/known anon
  key yields nothing. usda_prices may keep a public read policy (non-sensitive global data) if
  desired.

HIGH
- auth-signup.js:91 — catch block returns `err.message` AND `err.stack` to the client. Leaks file
  paths, internals, library versions. FIX: log server-side, return generic `{error:'Signup failed'}`.
- Info disclosure via `detail: await res.text()` returns raw Supabase/PostgREST error bodies to the
  client: auth-signup.js:50, 62, 73; invoices/upload.js:92, 110; invoices/parse.js:67. These leak
  column names, constraint names, RLS messages, schema. FIX: log server-side only; return generic
  error strings to client.
- auth-signup.js:24-26 — the "Server misconfigured: missing X" message enumerates which env vars
  are unset. Minor recon aid. FIX: generic 500, log specifics server-side.

MEDIUM
- market/sync/index.js:25 — CRON_SECRET compared with `!==` (non-constant-time). Timing side channel
  on a shared secret. FIX: `crypto.timingSafeEqual` over equal-length buffers (length-guard first).
- JWT alg confusion / header not validated — verifyJwt (upload/parse/list) and makeJwt recompute
  HS256 over `h.b` and compare the signature, so a forged `alg:none` token fails the HMAC check
  (good, no bypass). BUT the decoded header's `alg` is never asserted to be HS256. Low practical risk
  with a symmetric-only verifier, but assert `alg==='HS256'` for defense in depth. Also: a malformed
  base64 payload throws inside verifyJwt (uncaught) -> 500 instead of 401; wrap the JSON.parse in
  try/catch and return null.
- No `Content-Security-Policy` header in netlify.toml. invoice.html builds rows via innerHTML; it
  does escape via escHtml() (good), but a CSP is cheap defense-in-depth for an app that will handle
  Stripe. Add a restrictive CSP and `Strict-Transport-Security`. (X-Frame-Options/nosniff present.)
- upload.js size cap is on base64 length (8M chars), applied AFTER full body is in memory; Netlify's
  own 6MB limit is the real bound. Acceptable. Extension is whitelisted to [a-z0-9]{1,5} (line 65) —
  the earlier low finding is resolved. Content-type is passed straight to Supabase Storage and Azure;
  fine.

LOW / HARDEN LATER
- invoices/list.js:86 — invoice_items still queried by invoice_id only, no business_id filter. Gated
  by the ownership 404 on line 77-82 and non-guessable UUIDs. Carry-over from prior review; add
  business_id scoping if/when invoice_items gets that column.
- JWT has no rotation/refresh and 7-day expiry with no revocation list; logout is client-side only.
  A leaked token is valid for 7 days. Acceptable pre-Stripe; revisit.
- Password min length 8, bcrypt cost 10 — fine. No rate limiting on login/signup (brute-force +
  signup spam). Add before scale.
- Dependencies: only bcryptjs ^2.4.3 (no known criticals). market/sync has none.

PRE-STRIPE GATE: This review is not a substitute for a professional pentest. Do NOT connect Stripe /
store payment data until the CRITICAL RLS/key item is fixed and re-verified, and ideally a real
pentest is done. Said so to founder.

### 2026-06-28 — CRITICAL RLS hole resolved (new project javitvqlvkluofzbaewx)

Applied fixes after the full audit:
- Netlify `SUPABASE_KEY` switched from the anon key to the **service_role** key (verified: JWT `role: service_role`, ref `javitvqlvkluofzbaewx`).
- Migration `enable_rls_lockdown`: enabled RLS on all public tables and `REVOKE ALL ... FROM anon, authenticated`. Verified: `users`/`businesses`/`invoices`/`invoice_items`/`daily_sales`/`usda_prices` all show `rls_on=true`, `anon_select=false`, `anon_insert=false`. Functions keep working via service_role (BYPASSRLS).
- Code: removed all client-facing error `detail`/`stack`/env-name disclosure (auth-signup, upload, parse) — now logged server-side, generic error to client.
- JWT verify hardened across upload/parse/list: assert `alg=HS256`, timing-safe signature compare, try/catch around decode.
- market/sync: constant-time CRON secret compare.
- netlify.toml: added Content-Security-Policy + Strict-Transport-Security.

Still open (harden later, not blocking): no rate limiting on login/signup; 7-day JWT with no server-side revocation; consider marking Netlify secrets is_secret=true; add business_id filter to invoice_items query once column exists; professional pentest before Stripe.

### 2026-06-28 — data/export.js + data/delete.js (CCPA data-rights endpoints, NEW)

Branch `claude/elegant-albattani-l650n4` (auto-deploys to prod). High blast radius: export returns
all tenant data, delete destroys it.

**Solid / verified:**
- Multi-tenant scoping is correct. `business_id` comes only from the verified JWT (`payload.business_id`),
  never client input. JWT is server-issued from the DB at login/signup. Every query/delete filters by
  `business_id=eq.${biz}` (or `id=eq.${biz}` for the business row). `business_id` is a UUID, so the
  unquoted PostgREST filter values are not injectable.
- `verifyJwt` in both files is byte-identical to the hardened `invoices/list.js` version
  (alg=HS256 assertion, timing-safe compare, exp check, try/catch).
- export uses an explicit user column list — `password_hash` is NOT exported. Other tables use
  `select=*` but contain no secrets.
- export's `invoice_items` `in.()` list is built from invoice ids that were themselves
  business_id-scoped, and values are `encodeURIComponent`-escaped — cannot widen scope.
- delete requires `body.confirm === 'DELETE'`; UI also gates with a typed confirmation.
- Generic client errors; raw Supabase bodies never returned; details only to console.error.
- Token-in-header only (no cookie auth path) — CSRF risk low.
- netlify.toml: /data/export and /data/delete routes precede page routes; no /data page to shadow.

**High — delete will likely FAIL on the final step due to audit_log FK (data left half-deleted):**
delete.js:78-94 writes an `audit_log` row referencing `business_id`, then delete.js:108 deletes the
businesses row. Per docs/ARCHITECTURE.md the schema is `audit_log.business_id UUID REFERENCES
businesses(id)` (and `subscriptions.business_id ... REFERENCES businesses(id)`). Unless those FKs are
ON DELETE CASCADE/SET NULL in the LIVE schema, the `del('businesses?id=eq.${biz}')` will throw a FK
violation AFTER users/invoices/sales/etc. are already deleted — leaving an orphaned business +
subscription and a half-deleted, unusable account, while returning 500. The code comment ("audit_log
has no FK in the live schema") contradicts the documented schema and MUST be verified against the
live DB before this ships. Fix: confirm live FK rules; if FKs exist, either delete audit_log/
subscriptions rows for this business first (or last, before businesses) or rely on verified cascade.

**Medium — orphaned tenant tables not deleted:** delete.js does not delete `item_master`,
`subscriptions`, `push_subscriptions` (all tenant-scoped). CCPA "right to delete" should remove these
too; orphaned subscription rows also block the businesses delete (see above). export.js likewise omits
`item_master` for the "right to know" payload.

**Medium — no transactional atomicity:** the 6 sequential DELETEs (delete.js:103-108) are independent
REST calls. Any mid-sequence failure leaves a partial state with no rollback. Acceptable for MVP but
prefer a single Postgres RPC/function that deletes within one transaction. Document the risk.

**Low — storage deletion depends on raw_file_url integrity:** delete.js:63-76 deletes only the
`raw_file_url` paths recorded on invoice rows (each begins with `{business_id}/`). Files in the bucket
not referenced by a row (orphaned uploads, partial uploads) are not cleaned up. Not a cross-tenant
issue (it only ever touches this tenant's recorded paths), but note residual-data risk for CCPA.

**Low — delete relies on a still-valid 7-day token only (no re-auth):** acceptable for MVP given the
typed-DELETE confirmation, but a stolen/leaked token can wipe an account. Reconfirm before Stripe.

Not a substitute for a professional pentest before handling payment data.

### 2026-07-01 — Five new feature areas (alerts, vendors, payments, invoice approve/issue, market prices, recipes) + data export/delete re-check

Branch `claude/elegant-albattani-l650n4` (auto-deploys to prod). Reviewed for multi-tenant
isolation + info disclosure. Files: `alerts/price-changes.js`, `vendors/list.js`, `vendors/save.js`,
`payments/forecast.js`, `invoices/approve.js`, `invoices/issue.js`, `market/prices.js`,
`recipes/list.js`, `recipes/save.js`, `recipes/delete.js`, `recipes/ingredient-cost.js`,
`data/export.js`, `data/delete.js`, `netlify.toml`, `*.html`.

**Overall: code-level tenant scoping is solid across all 13 functions.** Every one uses the hardened
`verifyJwt` (byte-identical: alg=HS256 assert, timing-safe compare, exp check, try/catch) and the
`SUPABASE_URL` normalization from `invoices/list.js`. `business_id` is taken only from the JWT, never
from client input. All errors are generic; raw Supabase bodies/stacks are console-logged only. No
client-supplied `business_id` anywhere in the HTML. netlify.toml orders function routes before page
routes (no shadowing).

CRITICAL — must verify before relying on it (could not be machine-checked this session)
- RLS/grants on the THREE NEW tables `invoice_issues`, `recipes`, `recipe_ingredients` are UNVERIFIED.
  They are NOT in the checked-in `docs/schema.sql` and were created ad-hoc against the live project,
  so they were NOT covered by the `enable_rls_lockdown` migration (2026-06-28) that locked down the
  original tables. Supabase MCP tools were again not reachable in this session. IF any of these three
  tables has RLS OFF or retains anon/authenticated SELECT grants, the project URL + public anon key
  give any internet user full cross-tenant read of every restaurant's reported invoice issues (incl.
  dollar amounts) and full recipe/BOM + costing data. FIX (founder, via migration): for each of
  `invoice_issues`, `recipes`, `recipe_ingredients` run `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`
  and `REVOKE ALL ON ... FROM anon, authenticated;`, then confirm `rls_on=true`,
  `anon_select=false`, `anon_insert=false` (same check used for the base tables). service_role keeps
  the functions working. Until confirmed, treat as the top open risk.
- Also confirm the FK/cascade assumptions the code now depends on exist in the LIVE schema:
  `invoice_issues.invoice_id -> invoices(id) ON DELETE CASCADE`,
  `recipe_ingredients.recipe_id -> recipes(id) ON DELETE CASCADE`. If the cascades are absent, the
  belt-and-suspenders explicit deletes in `data/delete.js` still cover it (see below), but
  `recipes/delete.js` relies on the recipe_ingredients cascade and would orphan ingredient rows.

Cross-tenant access — verified clean
- `alerts/price-changes.js` and `recipes/ingredient-cost.js`: `invoice_items` has no business_id, so
  both scope by fetching this business's invoices (business_id=eq.JWT) and building the
  `invoice_id in.(...)` list from those owned ids only, each `encodeURIComponent`-escaped. A crafted
  invoice_id cannot enter the list. Correct pattern.
- `recipes/list.js`: both the `recipe_id in.(...)` and single-id paths ALSO carry
  `&business_id=eq.<jwt>`, and `recipe_ingredients` itself is filtered by business_id — belt AND
  suspenders, not reliant on the join alone. Good.
- `recipes/save.js`: update path PATCHes `recipes?id=eq.<client>&business_id=eq.<jwt>` and treats an
  empty 2xx array as 404; ingredient delete + insert are stamped/filtered with business_id. Create
  path stamps business_id from JWT. Cannot edit another tenant's recipe.
- `recipes/delete.js`: DELETE scoped by id + business_id, empty array => 404. Good.
- `vendors/save.js`: update scoped by id + business_id (empty => 404); create stamps business_id.
- `invoices/approve.js` / `invoices/issue.js`: both do a business_id-scoped ownership SELECT on the
  invoice FIRST, then the write is itself business_id-scoped (approve PATCH) or stamps business_id +
  verified invoice_id (issue INSERT). Note: `issue.js` accepts `invoice_item_id` without verifying it
  belongs to the invoice — LOW risk (it is only stored as context, never used to read cross-tenant
  data, and the parent invoice ownership is verified). Recommend later: verify the item_id belongs to
  the invoice for data integrity.

market/prices.js — correct
- `usda_prices` intentionally global/un-scoped; still behind a valid-JWT gate. Table holds only USDA
  commodity/price/date columns — no PII, no business_id. This is the ONLY un-scoped query and it is
  appropriate. (Same table read un-scoped in `invoices/list.js` USDA lookup — also fine.)

Injection — clean
- `ingredient-cost.js` name param: built as `description=ilike.<encodeURIComponent('*'+name+'*')>` —
  user wildcards are encoded, so no PostgREST filter breakout; worst case a broad/narrow match. OK.
- All `in.(...)` id lists are our own UUIDs, encodeURIComponent'd. UUID `eq.` filter values are not
  injectable.

data/export.js + data/delete.js — parallel edits landed cleanly, nothing clobbered
- export.js now also returns `invoice_issues` (business_id-scoped), `recipes`, `recipe_ingredients`
  (both business_id-scoped). `invoice_items` still joined via owned invoice ids only. `password_hash`
  still excluded via explicit user column list. Good.
- delete.js delete order is FK-safe and now includes `invoice_issues` (before invoices),
  `recipe_ingredients` then `recipes` (before users/businesses). Explicit deletes act as
  belt-and-suspenders even if the live cascades differ. The prior-review audit_log/subscriptions FK
  concern still applies — verify live FK rules on the businesses delete before trusting a clean wipe.

Not a substitute for a professional pentest before handling payment data (Stripe). The one hard
blocker to close now is the RLS/grants verification on the three new tables.

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

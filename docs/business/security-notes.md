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

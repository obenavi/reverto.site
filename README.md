# Yield

Cost-control SaaS for US independent restaurant operators. Parses distributor
invoices into true cost per pound, compares against USDA market prices, and
tracks food cost percentage against daily sales.

Vanilla-JS PWA on Netlify, Postgres on Supabase, no build step for the frontend.
See `docs/ARCHITECTURE.md` for the full design and `docs/PLAN.md` for scope.

## Status

Working end to end: sign up → log in → onboarding → app shell.

| Area | State |
|------|-------|
| Auth (signup, login, session bootstrap) | built |
| Onboarding (business, location, supplier) | built |
| App shell (tabs, settings, plan badge) | built, panels are empty states |
| Sysco + generic invoice parsers | built, not yet reachable from the UI |
| `invoices/parse` endpoint | built |
| USDA daily sync (cron + endpoint) | built |
| Invoice upload, invoice list, sales entry, market prices UI | not built |
| Stripe billing, push, CCPA export/delete, legal pages | not built |

## Local development

```bash
npm install -g netlify-cli        # once
cp .env.example .env              # fill in the values
netlify dev                       # serves the site + functions on :8888
```

## Database

`db/schema.sql` is idempotent — safe to re-run.

```bash
psql "$SUPABASE_DB_URL" -f db/schema.sql
```

RLS is on for every table with **no** permissive policies. All reads and writes
go through Netlify Functions holding the `service_role` key, so a leaked
publishable key cannot reach tenant data.

## Function layout

Netlify only discovers functions at the top level of `netlify/functions`
(`foo.js` or `foo/index.js`). Each endpoint is therefore a flat directory —
`auth-login/index.js` — mapped to its public path by a redirect in
`netlify.toml`:

```
/api/auth/login  →  /.netlify/functions/auth-login
```

Add an endpoint by creating the directory, adding the redirect, and adding a
`package.json` inside it only if it needs npm dependencies (the build command
installs each function directory that has one).

Shared code lives in `lib/` and `parsers/` at the repo root and is bundled via
`included_files` in `netlify.toml`.

## Environment variables

Set these in Netlify site settings; see `.env.example` for descriptions.

`SUPABASE_URL`, `SUPABASE_KEY`, `JWT_SECRET`, `SITE_URL`, `AZURE_DI_ENDPOINT`,
`AZURE_DI_KEY`, `USDA_API_KEY`, `CRON_SECRET`

GitHub Actions additionally needs the `CRON_SECRET` and `NETLIFY_URL` secrets
for the scheduled sync jobs.

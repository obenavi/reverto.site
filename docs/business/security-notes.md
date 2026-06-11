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

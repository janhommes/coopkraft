# Project rules
- Data access goes through `src/services/*` (IndexedDB now); a REST backend over the SQL schema in `docs/schema.sql` must keep the same service signatures. Why: swap storage without touching UI.
- Each data area is one SQL table storing the record as JSON (`data`), with frequently queried fields as extra columns. Why: backup file format and DB rows stay 1:1.
- Roles are resolved from SSO groups via `resolveRoles` in `src/lib/sso.ts`; stored per-user roles are only overrides. Why: identity/group membership is owned by the SSO provider.

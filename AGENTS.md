# Project rules

Two agents share this repo: **Lovable** builds the UI and syncs the `main` branch; **Claude Code** builds the PHP backend in `backend/`. The app runs in two storage modes and must keep working in both:
- **Demo** (no `VITE_API_URL`, e.g. the Lovable preview): IndexedDB in the browser, user switcher, demo data.
- **Self-hosted** (`VITE_API_URL=/api`, `SELF_HOST=1`): static SPA + PHP/MySQL API on shared hosting, login via SSO.

## Who edits what
| Area | Owner |
|---|---|
| `src/routes/`, `src/components/`, `src/hooks/`, `src/styles.css`, `src/lib/*`, `src/services/*.service.ts` | Lovable |
| `backend/**`, `scripts/**`, `.github/**`, `.releaserc.json`, `src/services/db.ts`, `db.idb.ts`, `db.rest.ts`, `auth.service.ts` | Claude – Lovable never edits these |
| `vite.config.ts` | Lovable may change it but must keep the `SELF_HOST` / `API_PROXY` block |
| Contract: `src/services/stores.ts`, `src/lib/types.ts`, `src/lib/sso.ts`, `docs/schema.sql` | both – a change needs the matching backend change, see rules below |

## Rules
- Data access goes through `src/services/*`; UI code never touches IndexedDB or `fetch("/api")` directly. Why: `src/services/db.ts` switches between IndexedDB and the PHP API without touching UI.
- Services only use `getAll`, `getOne`, `put`, `del`, `uid`, `countAll`, `exportTables`, `importTables` and `isRemote` from `./db`. Why: these are the only operations both storage adapters implement.
- Each data area is one SQL table storing the record as JSON (`data`), with frequently queried fields as extra columns. Why: backup file format and DB rows stay 1:1.
- New data area: add it to `STORE_NAMES` and `AppSchema` in `src/services/stores.ts`, add a `CREATE TABLE IF NOT EXISTS` to `docs/schema.sql` (copy the shape of an existing table), and add a line to `docs/backend-todo.md`. Why: CI (`scripts/check-contract.mjs`) fails until the backend registers the table, and Claude picks it up from the todo list.
- `docs/schema.sql` is MySQL/MariaDB, not PostgreSQL: `VARCHAR(64)` ids, `JSON` data, `DATETIME(3)`, indexes inside the table definition, no foreign keys. Why: the target is cheap shared PHP + MySQL hosting, and the backend runs this file automatically.
- Roles are resolved from SSO groups via `resolveRoles` in `src/lib/sso.ts`; stored per-user roles are only overrides. Why: identity/group membership is owned by the SSO provider.
- `resolveRoles` and `DEFAULT_SSO_CONFIG` have a PHP twin (`backend/src/Auth/RoleResolver.php`). When you change them, add a line to `docs/backend-todo.md`. Why: in self-hosted mode the server resolves roles, and CI compares both against a shared fixture.
- `can()` in `src/lib/permissions.ts` only shapes the UI. New actions or changed role rights: add a line to `docs/backend-todo.md`. Why: the server enforces access itself (`backend/src/Acl.php`); the browser is not trusted.
- Public pages without login (`/anmeldung`, `/embed/anmeldung`, `/dokumente/$slug`) only read settings, custom fields and public documents; writes go through one dedicated service function (like `submitAnmeldung`). Why: the API rejects anonymous writes.
- Keep demo mode working: user switcher, `seedIfEmpty`, demo reset. Why: the Lovable preview has no backend.
- New admin settings that every installation must fill in (e.g. a new page with demo defaults): add a row to the table in step 6 of `docs/setup.md`. Why: that guide is how other cooperatives set up CoopKraft.
- No server functions (`createServerFn`, server routes), Supabase or other hosted backends in the frontend. Why: the self-hosted build is a static SPA served from PHP hosting.
- Images the app needs (logos, demo defaults) go into `src/assets/` as files and are imported: `import logo from "@/assets/x.png"`, or `"@/assets/x.png?inline"` for a data URL that gets stored in settings. Files in `public/` are referenced as `` `${import.meta.env.BASE_URL}file.png` ``, never with a leading `/`. Don't use Lovable-hosted assets (`*.asset.json`). Why: `/__l5e/…` URLs only exist on Lovable's hosting, and the public demo runs under `/coopkraft/demo/` on GitHub Pages; self-hosted installs and the demo can load neither.

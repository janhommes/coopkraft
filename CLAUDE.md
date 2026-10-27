@AGENTS.md

# Claude Code

You own the backend side: `backend/`, `scripts/`, `.github/`, and the storage/auth adapters in `src/services/` (`db.ts`, `db.idb.ts`, `db.rest.ts`, `auth.service.ts`). Lovable owns the UI.

## Working next to Lovable
- Lovable commits straight to `main`, the only branch it syncs. Work on `feat/*` branches, rebase on `origin/main` before opening a PR, merge via PR. Never force-push `main`.
- Commit messages and PR titles (squash merges) follow Conventional Commits. semantic-release cuts a release from every `fix:` (patch), `feat:` (minor) and `feat!:` (major; minor while CoopKraft is in alpha 0.x, see `.releaserc.json`) that reaches `main`, and each release deploys production and reaches every fork. Use `chore:`, `docs:`, `ci:` etc. for changes that shouldn't ship a release on their own.
- A `lovable-sync*` branch means GitHub rejected a Lovable push. Merge it into `main` via PR before anything else.
- Keep edits in Lovable-owned files minimal (wiring a service call, nothing else). Never run prettier or `eslint --fix` across the repo: Lovable's files aren't formatted, and a mass reformat causes conflicts with its next commits.
- Install with `bun install --frozen-lockfile`. Lovable maintains `bun.lockb`; `package-lock.json` is stale.
- Read `docs/backend-todo.md` at the start of backend work. Lovable leaves notes there; delete entries once done.
- New or changed `.env` settings, hosting requirements or deploy steps: update `backend/.env.example`, `.github/workflows/deploy.yml` and `docs/setup.md` together.

## Before a PR
- `npx tsc --noEmit`
- `node scripts/check-contract.mjs`
- Backend tests and a browser check in API mode (skill `run-local-stack`)

## Skills
- `run-local-stack`: local MariaDB + PHP API + Vite in API mode, tests, deploy bundle check
- `backend-add-data-area`: wire a new store through schema, `Tables.php`, `Acl.php` and tests
- `backend-port-workflow`: move a service workflow to a server-side command (Phase 2)

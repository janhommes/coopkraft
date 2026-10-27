---
name: backend-port-workflow
description: Move a CoopKraft business workflow (approveMembership, confirmPayment, terminations, transfers, member numbers, audit log, processDueTerminations) from browser-side service code to a server-side PHP command, keeping the TypeScript signature and the IndexedDB demo path. Use for Phase 2 hardening or whenever a rule has to be enforced by the server instead of the browser.
---

# Move a workflow to a server command

In Phase 1 the services in `src/services/*.service.ts` run the business logic in the browser and write through the generic API. `Acl.php` only checks coarse rights (staff may write business data). Moving a workflow to the server makes its rules binding. `submitAnmeldung` (`members.service.ts`, served by `backend/src/Http/PublicController.php`) is the existing example to copy.

1. **Understand the TS function.** Read it and everything it calls. Write down:
   - Who may call it: `can()` in `src/lib/permissions.ts` plus the function's own checks, such as self-approval, double approval, or `bestaetigerRollen` from the workflow config.
   - Every write, including side effects such as `recomputeMemberStatus` and lot splits.
   - Every error message it throws, and the audit entries it creates.

2. **PHP command.** Add a method to `backend/src/Http/CommandsController.php` (create it and register it in `App.php`) on `POST /api/commands/<name>`:
   - Run everything inside `$repo->transaction(...)`.
   - Get the user from `$ctx->auth()->user()`; reject with `HttpError::forbidden()` / `badRequest()`, using the same German messages as the TS code.
   - Read the workflow config from the `workflowConfig` row `singleton`.
   - The server sets ids (`Json::uuid()`), timestamps (`Json::now()`) and the user in audit entries.
   - Return the same shape the TS function returns.

3. **TS stays compatible.** Keep the export and signature, and add a branch at the top:
   ```ts
   if (isRemote) return api<Result>("/commands/<name>", { method: "POST", body: JSON.stringify({ ... }) });
   ```
   The existing code below stays as the IndexedDB/demo path. Import `isRemote` from `./db` and `api` from `./db.rest`.

4. **Close the side door.** Tighten `Acl::write()` so the generic API can no longer make the same change. For example, approvals are then only created by the command, and staff writes on `members.status` are refused. Don't break other callers: grep for every `put("<store>"` that still relies on the old path.

5. **Tests.** Add PHPUnit tests mirroring the TS behavior: the happy path, every error, and every permission denial. Re-run the full suite.

6. **Tell Lovable** only if the UI must change how it calls things. Add a rule to `AGENTS.md`, e.g. "member status changes only via approveMembership/terminations".

7. **Verify** the workflow in the browser in API mode and in demo mode (skill `run-local-stack`). Remove the item from the Phase 2 list in `docs/backend-todo.md`.

---
name: backend-add-data-area
description: Wire a new CoopKraft data area (IndexedDB store) end to end through the PHP backend - stores.ts, docs/schema.sql, migration, backend/src/Tables.php, Acl.php, tests. Use when Lovable added a store, when docs/backend-todo.md lists one, or when scripts/check-contract.mjs reports a missing store, table or column.
---

# Add a data area to the backend

A data area is a store name such as `campaigns`. The same name is used by IndexedDB, the backup file and `/api/data/<store>`. Each one is a SQL table `(id, extracted columns, data JSON, updated_at)`.

1. **Store list.** `src/services/stores.ts` needs the name in `STORE_NAMES` and its record type in `AppSchema`; `src/services/backup.service.ts` needs a label in `STORE_LABELS`. Lovable has usually done this already. Add the type to `src/lib/types.ts` if it's missing.

2. **Schema.** In `docs/schema.sql`, copy an existing table and give it a snake_case name:
   ```sql
   CREATE TABLE IF NOT EXISTS my_things (
     id VARCHAR(64) NOT NULL PRIMARY KEY,
     member_id VARCHAR(64) NULL,          -- only fields that get queried or filtered
     data JSON NOT NULL,
     updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
     KEY my_things_member_idx (member_id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
   ```
   Also extend the store→table mapping comment at the end of the file. If Lovable wrote PostgreSQL (`JSONB`, `TIMESTAMPTZ`, `BYTEA`, `now()`), convert it. Don't add foreign keys: a backup restore has to work in any order.

3. **Column on an existing table.** `CREATE TABLE IF NOT EXISTS` never alters a table that already exists. So for a new extracted column on an existing table, add `backend/migrations/NNN_short_name.sql` (next free number) with the change and a backfill:
   ```sql
   ALTER TABLE documents ADD COLUMN category VARCHAR(64) NULL;
   UPDATE documents SET category = JSON_UNQUOTE(JSON_EXTRACT(data, '$.category'));
   ```
   Also put the column into the `CREATE TABLE` in `docs/schema.sql` for fresh installs. Migrations run automatically, once each, on the next API request.

4. **Registry.** In `backend/src/Tables.php`, add one line `'myThings' => ['table' => 'my_things', 'columns' => ['member_id' => 'memberId']],`. Keep it on a single line, because the contract check parses it.

5. **Access rules.** In `backend/src/Acl.php`, decide each case explicitly:
   - **Read:**
     - Anonymous: add a case in `read()` before the `$u === null` check.
     - Members: their own rows match on `memberId` in the `match`.
     - Staff and admin see everything by default.
   - **Write:** configuration-like data goes in `ADMIN_ONLY`. Member self-service needs its own `case` in `write()` with strict preconditions. Otherwise staff may write.
   - **Delete:** `STAFF_DELETE`, or admin only.

6. **Tests.** In `backend/tests/ApiTest.php`, cover staff CRUD, what a member sees and may write, and that anonymous users get nothing.

7. **Verify.** Run `node scripts/check-contract.mjs`, PHPUnit, and click through the feature in API mode (skill `run-local-stack`). Then delete the entry from `docs/backend-todo.md`.

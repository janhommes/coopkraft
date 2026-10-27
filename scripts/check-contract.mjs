#!/usr/bin/env node
// Prüft, dass Frontend (Lovable) und Backend (backend/) zusammenpassen:
//  1. Datenbereiche: src/services/stores.ts  <->  backend/src/Tables.php  <->  docs/schema.sql
//  2. Rollenauflösung: resolveRoles() in src/lib/sso.ts gegen backend/tests/fixtures/resolve-roles.json
//     (dieselbe Fixture prüft PHPUnit für backend/src/Auth/RoleResolver.php)
// Aufruf: node scripts/check-contract.mjs   (Node >= 22.18, lädt .ts-Dateien direkt)
import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";

const root = new URL("..", import.meta.url).pathname;
const read = (path) => readFileSync(root + path, "utf8");
const problems = [];

// --- 1. Datenbereiche ---------------------------------------------------------------
const { STORE_NAMES } = await import(root + "src/services/stores.ts");

const tablesPhp = read("backend/src/Tables.php");
const registry = new Map(
  [...tablesPhp.matchAll(/'(\w+)' => \['table' => '(\w+)', 'columns' => \[([^\]]*)\]/g)].map(
    ([, store, table, cols]) => [
      store,
      { table, columns: [...cols.matchAll(/'(\w+)' =>/g)].map((m) => m[1]) },
    ],
  ),
);

const schema = read("docs/schema.sql");
const schemaTables = new Map(
  [...schema.matchAll(/CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*?)\n\)/g)].map(
    ([, table, body]) => [table, body],
  ),
);

for (const store of STORE_NAMES) {
  if (!registry.has(store)) problems.push(`Store "${store}" fehlt in backend/src/Tables.php`);
}
for (const [store, { table, columns }] of registry) {
  if (!STORE_NAMES.includes(store))
    problems.push(`Tables.php kennt "${store}", src/services/stores.ts nicht`);
  const body = schemaTables.get(table);
  if (!body) {
    problems.push(
      `Tabelle "${table}" (Store "${store}") fehlt in docs/schema.sql (als CREATE TABLE IF NOT EXISTS)`,
    );
    continue;
  }
  for (const column of columns) {
    if (!new RegExp(`^\\s*${column}\\s`, "m").test(body))
      problems.push(`Spalte "${table}.${column}" fehlt in docs/schema.sql`);
  }
  if (store !== "documentFiles" && !/^\s*data JSON NOT NULL/m.test(body))
    problems.push(`Tabelle "${table}" braucht "data JSON NOT NULL"`);
}
const registeredTables = new Set([...registry.values()].map((r) => r.table));
for (const table of schemaTables.keys()) {
  if (!registeredTables.has(table))
    problems.push(`docs/schema.sql hat Tabelle "${table}" ohne Eintrag in Tables.php`);
}
for (const pg of ["JSONB", "TIMESTAMPTZ", "BYTEA", "SERIAL", "now()"]) {
  if (schema.includes(pg))
    problems.push(
      `docs/schema.sql enthält PostgreSQL-Syntax "${pg}" – bitte MySQL/MariaDB verwenden`,
    );
}

// --- 2. Rollenauflösung ---------------------------------------------------------------
const { resolveRoles, DEFAULT_SSO_CONFIG } = await import(root + "src/lib/sso.ts");
const fixture = JSON.parse(read("backend/tests/fixtures/resolve-roles.json"));
for (const c of fixture.cases) {
  const r = resolveRoles(c.identity, c.config, fixture.members, c.overrides);
  const actual = { roles: r.roles, memberId: r.memberId ?? null };
  if (!isDeepStrictEqual(actual, c.expected)) {
    problems.push(
      `resolveRoles "${c.name}": erwartet ${JSON.stringify(c.expected)}, erhalten ${JSON.stringify(actual)} – RoleResolver.php + Fixture anpassen`,
    );
  }
}
const ssoDefault = JSON.parse(read("backend/tests/fixtures/sso-default.json"));
if (!isDeepStrictEqual(JSON.parse(JSON.stringify(DEFAULT_SSO_CONFIG)), ssoDefault)) {
  problems.push(
    "DEFAULT_SSO_CONFIG weicht von backend/tests/fixtures/sso-default.json ab – RoleResolver::DEFAULT_CONFIG + Fixture anpassen",
  );
}

if (problems.length) {
  console.error(
    `Vertrag Frontend/Backend verletzt (${problems.length}):\n- ` + problems.join("\n- "),
  );
  process.exit(1);
}
console.log(
  `Vertrag OK: ${STORE_NAMES.length} Datenbereiche, ${fixture.cases.length} Fälle der Rollenauflösung.`,
);

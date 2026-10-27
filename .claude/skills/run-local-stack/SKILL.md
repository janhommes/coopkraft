---
name: run-local-stack
description: Start CoopKraft locally against the real backend (MariaDB + PHP API in Docker, Vite in API mode), log in via the simulated SSO form, run PHPUnit and the contract check, or build and test the FTP deploy bundle. Use whenever you need to run, test or click through the app with the backend, or verify a backend change.
---

# Run the local stack

All commands run from the repo root.

## 1. Dependencies (once)
```bash
bun install --frozen-lockfile      # Lovable's lockfile; npm ci fails on the stale package-lock.json
```

## 2. Backend: MariaDB + PHP API
```bash
docker compose -f backend/docker-compose.yml up -d --build
curl -s localhost:8092/api/health   # {"ok":true}
```
- MariaDB listens on `localhost:3307` (db `coopkraft`, user/password `coopkraft`); PHPUnit uses the second db `coopkraft_test`.
- The API runs `php -S` with `AUTH_MODE=dev`; code changes apply without a restart.
- On the first start the container runs `composer install`. If the Docker bridge network has no internet (packagist timeout in `docker compose logs api`), install over the host network instead:
  ```bash
  docker run --rm --network host -u $(id -u):$(id -g) -e COMPOSER_HOME=/tmp/composer \
    -v "$PWD/backend":/srv/backend backend-api composer install
  docker compose -f backend/docker-compose.yml restart api
  ```
- To wipe the database: `docker compose -f backend/docker-compose.yml down -v`.

## 3. Frontend in API mode
```bash
API_PROXY=http://localhost:8092 VITE_API_URL=/api npx vite dev --port 8080 --strictPort
```
Open http://localhost:8080/app, click "Anmelden", and use the "SSO simulieren" form:
- `greta@demo.de`: admin via `ADMIN_EMAILS` (an admin's first login also creates the default settings)
- groups such as `egv-vorstand`, `egv-verwaltung`, `egv-finanzen`: staff roles from `DEFAULT_SSO_CONFIG`
- the email of an active member: role `mitglied`, limited to that member's own data

Demo mode, as Lovable runs it, is plain `npm run dev` (IndexedDB plus the user switcher). Check it after any change to `src/services/db*.ts` or the providers.

## 4. API by hand
```bash
J=$(mktemp)
curl -s -c $J -d "email=greta@demo.de&groups=egv-admin" localhost:8092/api/auth/dev-login -o /dev/null
curl -s -b $J localhost:8092/api/data/members
curl -s -b $J -X PUT -H "X-Requested-With: coopkraft" -H "Content-Type: application/json" \
  -d '{"id":"c1","subject":"Test"}' localhost:8092/api/data/campaigns/c1
```
Writes without the `X-Requested-With: coopkraft` header get 403 (CSRF guard).

## 5. Checks
```bash
docker compose -f backend/docker-compose.yml exec -T api vendor/bin/phpunit   # wipes coopkraft_test
node scripts/check-contract.mjs
npx tsc --noEmit
```

## 6. Deploy bundle (what goes to the FTP host)
```bash
COMPOSER="docker run --rm --network host -u $(id -u):$(id -g) -e COMPOSER_HOME=/tmp/composer -v $PWD:/repo -w /repo backend-api composer" \
  scripts/build-deploy.sh
```
To test `deploy/` under Apache like shared hosting: write a `deploy/api/.env` with `DB_HOST=db`, `AUTH_MODE=dev` and `COOKIE_SECURE=false`, then run a `php:8.4-apache` image with `pdo_mysql`, `a2enmod rewrite headers` and `AllowOverride All` on the network `backend_default`, mounting `deploy/` at `/var/www/html`. Check that `/app/...` deep links return the shell, `/api/health` answers, and `/api/.env`, `/api/src/App.php` and `/api/vendor/autoload.php` return 404.

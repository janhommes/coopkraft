#!/usr/bin/env bash
# Baut das Deploy-Paket für Shared Hosting (Apache + PHP + MySQL), Upload per FTP in den Web-Root
# einer (Sub-)Domain – die App braucht den Domain-Root, da die Assets absolut unter /assets/ liegen.
#   deploy/                statische App (SPA-Shell + Assets) + .htaccess
#   deploy/api/            PHP-Backend (public/index.php, src/, vendor/, schema.sql, migrations/)
# Die Konfiguration (deploy/api/.env) schreibt der Deploy-Workflow aus den Secrets.
# Aufruf: scripts/build-deploy.sh   (COMPOSER="<befehl>" überschreibt den Composer-Aufruf)
set -euo pipefail
cd "$(dirname "$0")/.."
COMPOSER="${COMPOSER:-composer}"

rm -rf deploy dist
SELF_HOST=1 VITE_API_URL=/api npx vite build
mkdir -p deploy/api
cp -r dist/client/. deploy/

cp -r backend/public backend/src backend/migrations backend/composer.json backend/composer.lock deploy/api/
cp docs/schema.sql deploy/api/schema.sql
$COMPOSER install --working-dir=deploy/api --no-dev --optimize-autoloader --no-interaction --no-progress
rm deploy/api/composer.json deploy/api/composer.lock

cat > deploy/.htaccess <<'HTACCESS'
# CoopKraft: statische App; /api/ regelt api/.htaccess
Options -Indexes
DirectoryIndex _shell.html
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  # Vorhandene Dateien (Assets, Bilder) direkt ausliefern
  RewriteCond %{REQUEST_FILENAME} -f
  RewriteRule ^ - [L]
  # Alle App-Pfade (/app/..., /anmeldung, ...) laden die SPA-Shell
  RewriteRule ^ _shell.html [L]
</IfModule>
<IfModule mod_headers.c>
  <FilesMatch "^_shell\.html$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
</IfModule>
HTACCESS

cat > deploy/api/.htaccess <<'HTACCESS'
# Nur public/index.php ist erreichbar; src/, vendor/, schema.sql und .env nie direkt.
Options -Indexes
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteRule ^public/index\.php$ - [L]
  RewriteRule ^ public/index.php [QSA,L]
</IfModule>
<IfModule !mod_rewrite.c>
  Require all denied
</IfModule>
HTACCESS

echo "Deploy-Paket fertig: $(du -sh deploy | cut -f1) in deploy/"

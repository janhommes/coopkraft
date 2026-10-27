# Lokale Entwicklung und Tests (nicht für das Hosting – dort läuft das Deploy-Paket per FTP).
FROM php:8.4-cli
RUN apt-get update && apt-get install -y --no-install-recommends unzip git \
    && rm -rf /var/lib/apt/lists/* \
    && docker-php-ext-install pdo_mysql
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /srv/backend

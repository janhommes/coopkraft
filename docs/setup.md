# Setting up CoopKraft for your cooperative

This guide takes you from an empty hosting package to a running CoopKraft that your board, staff and members log into with your existing single sign-on (SSO). It is written for whoever looks after your cooperative's IT. You need basic experience with a hosting control panel and FTP; you do **not** need Lovable, Claude or any other AI tool to run CoopKraft.

**What you end up with**

- The app at its own (sub)domain, e.g. `https://mitglieder.example-eg.de`
- The public signup form at `/anmeldung`, which can also be embedded in your website
- Login for board, staff and members through your SSO provider, with roles taken from SSO groups
- All data in a MySQL/MariaDB database on your own hosting

## Contents

1. [What you need](#1-what-you-need)
2. [Prepare hosting and database](#2-prepare-hosting-and-database)
3. [Register CoopKraft with your SSO provider](#3-register-coopkraft-with-your-sso-provider)
4. [Configure CoopKraft](#4-configure-coopkraft)
5. [Build and upload](#5-build-and-upload)
6. [First login and basic settings](#6-first-login-and-basic-settings)
7. [Map SSO groups to roles](#7-map-sso-groups-to-roles)
8. [Go-live checklist](#8-go-live-checklist)
9. [Running CoopKraft](#9-running-coopkraft)
10. [Troubleshooting](#10-troubleshooting)
11. [Reference: configuration values](#11-reference-configuration-values)

## 1. What you need

**Web hosting.** Most standard shared hosting packages fit. CoopKraft needs:

| Requirement | Details |
|---|---|
| Web server | Apache with `mod_rewrite`, and `.htaccess` files allowed (`AllowOverride All`) |
| PHP | 8.2 or newer, with the `pdo_mysql` extension and either the `curl` extension or `allow_url_fopen` enabled (for the SSO login) |
| Database | MySQL 8 or MariaDB 10.5+ |
| HTTPS | A certificate for the app's domain; Let's Encrypt through the hosting panel is fine |
| Upload | FTP or FTPS access |

**A (sub)domain just for the app.** CoopKraft must run at the root of its domain, e.g. `mitglieder.example-eg.de`, not in a subfolder like `example-eg.de/mitglieder`.

**An SSO provider that speaks OpenID Connect.** Examples are Nextcloud (with the "OIDC Identity Provider" app), Keycloak, Authentik and Microsoft Entra ID. It must be able to put the user's email address and group memberships into the login token or user info.

> Everyone who logs in needs an account at your SSO provider. This includes members who want to use self-service, such as viewing their shares or changing their bank details. A member is recognized by the email address of their SSO account, so it must match the email in their member record.

**To build the app**, choose one:

- **A GitHub account (recommended).** A ready-made workflow builds and uploads CoopKraft for you.
- **A computer with Node.js 22+, [bun](https://bun.sh) and PHP with [Composer](https://getcomposer.org).** You build locally and upload the files yourself.

## 2. Prepare hosting and database

1. **Create the subdomain** in your hosting panel and give it its own, empty folder as document root, e.g. `/mitglieder/`. Note the folder path; you need it for the upload.
2. **Enable HTTPS** for the subdomain.
3. **Check the PHP version** for this folder; set it to 8.2 or newer.
4. **Create a database and a database user.** Use the character set `utf8mb4` if the panel asks. Note host, database name, user name and password.

CoopKraft creates its tables itself on the first request, and applies changes from later updates the same way. You never need to import SQL by hand.

## 3. Register CoopKraft with your SSO provider

Create a new OpenID Connect client (also called "application" or "relying party") in your SSO provider:

| Setting | Value |
|---|---|
| Client type | Confidential (with a client secret) |
| Flow | Authorization Code |
| Redirect URI | `https://<your-app-domain>/api/auth/callback` |
| Scopes | `openid`, `email`, `profile`, plus whatever scope your provider uses for groups |

Note three values from your provider:

- **Client ID** and **client secret**
- **Issuer URL.** This is the `issuer` value in your provider's discovery document, which usually lives at `<issuer>/.well-known/openid-configuration`. Open that address in a browser to check it.

**Groups.** CoopKraft gives people roles based on the groups they belong to in your SSO provider. Make sure your provider sends groups in the token or the user info, and note the **claim name** it uses (often `groups`). How you enable this depends on the provider:

- **Keycloak:** add a "Group Membership" mapper to the client (token claim name `groups`, "Full group path" off).
- **Microsoft Entra ID:** add a groups claim to the app registration. Entra sends group **IDs** rather than names, so you map those IDs in step 7.
- **Nextcloud, Authentik and others:** see your provider's documentation for groups or roles in OpenID Connect.

**Plan your groups now.** Create one group per function at your cooperative, e.g. `eg-vorstand`, `eg-aufsichtsrat`, `eg-verwaltung`, `eg-finanzen`, and add the right people. You connect them to CoopKraft roles in step 7; the [roles table](#roles) shows what each role may do.

## 4. Configure CoopKraft

CoopKraft reads its settings from a file called `.env`. With the GitHub workflow you enter the values as secrets instead, and the workflow writes the file for you (step 5).

The values you need:

| Setting | Example | Notes |
|---|---|---|
| `APP_URL` | `https://mitglieder.example-eg.de` | Address of the app, without `/api` and without a trailing slash |
| `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | | From step 2 |
| `OIDC_ISSUER` | `https://login.example-eg.de` | From step 3 |
| `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` | | From step 3 |
| `ADMIN_EMAILS` | `it@example-eg.de` | Email address(es) that always get the Admin role. You need this for the first login, before any groups are mapped. |

All settings, including optional ones, are listed in the [reference](#11-reference-configuration-values) at the end.

## 5. Build and upload

### Option A: GitHub Actions (recommended)

1. **Fork** the CoopKraft repository to your GitHub account or organization. GitHub switches workflows off in a new fork: open the fork's **Actions** tab and enable them.
2. In your fork, open **Settings → Environments** and create an environment called `production`.
3. In that environment, add these **secrets**:
   - `FTP_HOST`, `FTP_USER`, `FTP_PASSWORD`: your FTP access
   - `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
   - `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`
   - `ADMIN_EMAILS`
4. In the same environment, add these **variables**:
   - `APP_URL`: e.g. `https://mitglieder.example-eg.de`
   - `FTP_SERVER_DIR`: the subdomain's folder from step 2, **with** a trailing slash, e.g. `/mitglieder/`
5. Under **Settings → Secrets and variables → Actions → Variables**, add the repository variable `DEPLOY_ENABLED` with the value `true`. Until it exists, the workflow does nothing.
6. To deploy, publish a release (**Releases → Draft a new release**), or run the workflow by hand (**Actions → Deploy → Run workflow**, environment `production`).

**Optional test instance.** Every push to `main` deploys to an environment called `dev`. To use that, set up `dev` like `production`, with its own subdomain and database. If you don't want a test instance, delete the `push:` trigger at the top of `.github/workflows/deploy.yml`, so that only releases and manual runs deploy.

**Automatic updates (optional).** Once a day, the workflow `.github/workflows/sync-upstream.yml` checks for a new CoopKraft release. Minor and patch versions (e.g. 1.2.0 → 1.3.0 or 1.2.1) are merged into your `main` automatically. A new major version (e.g. 2.0.0) arrives as a pull request, so you can read the release notes first; so does an update that clashes with changes you made in your fork. Updates go live when you publish a release (step 6). To switch it on:

1. Create a fine-grained personal access token (**your profile → Settings → Developer settings → Personal access tokens → Fine-grained tokens**). Under repository access, select only your fork. Under repository permissions, set **Contents**, **Pull requests** and **Workflows** to *Read and write*. If the fork belongs to an organization, the organization may have to approve the token.
2. In your fork, add the token as the repository secret `SYNC_TOKEN` (**Settings → Secrets and variables → Actions → Secrets**).
3. Run the workflow once by hand to check it works (**Actions → Updates → Run workflow**).

A personal token is needed because the built-in workflow token can't change workflow files, and updates can contain them. Each update therefore counts as a push and also deploys to `dev` if you set up the test instance. Tokens expire: renew it when GitHub's reminder email arrives, otherwise updates stop.

### Option B: Build and upload by hand

1. Download or clone the CoopKraft repository.
2. In the repository folder, run (on Windows, use WSL or Git Bash):
   ```bash
   bun install --frozen-lockfile
   scripts/build-deploy.sh
   ```
   This creates a folder `deploy/` containing the app and, in `deploy/api/`, the PHP backend.
3. Copy `backend/.env.example` to `deploy/api/.env` and fill in the values from step 4. Also set `AUTH_MODE=oidc` and `APP_DEBUG=false`.
4. Upload the **contents** of `deploy/` into the subdomain's folder. Include the hidden `.htaccess` files in `deploy/` and `deploy/api/`; some FTP programs hide files starting with a dot.

### Check the upload

| Open in a browser | Expected result |
|---|---|
| `https://<your-app-domain>/api/me` | `{"user":null}`. This also creates the database tables. An error here usually means wrong database settings. |
| `https://<your-app-domain>/api/.env` | `{"error":"Nicht gefunden"}`. Your configuration must **never** be downloadable. |
| `https://<your-app-domain>/anmeldung` | The signup page. Submitting only works after step 6. |

## 6. First login and basic settings

1. Open `https://<your-app-domain>/app` and click **Anmelden**.
2. Log in at your SSO provider with an address from `ADMIN_EMAILS`.
3. On this first admin login, CoopKraft creates a default configuration. **It still contains sample values** such as "Demo Energie eG" and a sample bank account. Replace them under **Admin**:

| Admin page | What to set |
|---|---|
| **Branding** | Name, logo, colors |
| **Stammdaten** | Legal details of the cooperative (address, tax number, register court and number). Used on tax certificates. |
| **Bankkonto** | Account holder, IBAN, BIC, creditor ID (Gläubiger-ID) for SEPA |
| **Anteile** | Value of one share, minimum and maximum shares per member |
| **Beitrittsformular** | Title and texts of the signup form, statutes checkbox text, layout, and the snippet for embedding the form in your website |
| **Newsletter** | Header and footer for emails. The default footer contains a sample address. |
| **Workflows & Kündigung** | Approvals needed to join, whether payment must be confirmed, notice periods and payout rules for terminations and transfers. Compare these with your statutes; the defaults are only examples. |
| **Benutzerdefinierte Felder** | Extra fields for member records and the signup form |

4. Under **Dokumente**, upload your statutes as a public document with the slug `satzung`. The default statutes checkbox on the signup form links to `/dokumente/satzung`.

**Moving over from the demo.** If you already set things up in the demo version, which stores everything in the browser, download a backup there under **Admin → Datenbank & Sicherung**. Then restore it here on the same page. Restoring replaces all data in the database.

## 7. Map SSO groups to roles

Open **Admin → Rollen & SSO**.

1. **Gruppen-Claim im Token:** enter the claim name from step 3, e.g. `groups`.
2. **Ohne passende Gruppe und ohne Mitgliedschaft:** decide what happens when someone logs in who is neither in a mapped group nor a member. "Kein Zugang" (no access) is the safe choice.
3. **Mappings:** connect each of your groups to one or more roles. The preset uses example groups (`egv-admin`, `egv-vorstand`, …). Replace them with your own group names (or group IDs for Entra ID), then save.
4. **Zuordnung testen:** enter an email address and groups to see which roles that person would get.

**Members need no group.** Anyone whose login email matches an active member record automatically gets the role **Mitglied**. This includes members whose termination has not taken effect yet. With that role they see and edit only their own data.

**Exceptions.** For a person who needs a role regardless of their groups, add them under **Testpersonen & Ausnahmen** with their email address and the extra roles.

Once your admin group is mapped and works, remove addresses from `ADMIN_EMAILS` that no longer need permanent admin rights. Keeping one emergency address is reasonable.

### Roles

| Role | May do |
|---|---|
| Mitglied | See and edit their own data, subscribe more shares, request transfers and terminations, download their documents |
| Mitgliederverwalter | Create and edit members, approve transfers and terminations, upload member documents |
| Vorstand | Approve transfers and terminations, upload member documents, run dividends |
| Aufsichtsrat | Approve memberships |
| Mitgliedsbestätiger | Approve memberships |
| Zahlungsprüfer | Confirm incoming payments |
| Kommunikation | Campaigns and newsletters, cooperative documents |
| Auszahler | Dividend runs and SEPA payment files |
| Admin | Everything, including all settings, roles, backup and restore |

All roles except Mitglied can view the member register.

## 8. Go-live checklist

- [ ] HTTPS works, and `http://` redirects to `https://`
- [ ] `/api/.env` returns "Nicht gefunden"
- [ ] `AUTH_MODE=oidc` and `APP_DEBUG=false` (the GitHub workflow sets both)
- [ ] Sample values replaced on all admin pages from step 6
- [ ] Workflow rules match your statutes
- [ ] Statutes uploaded with the slug `satzung`
- [ ] Role mapping tested with one person per group
- [ ] A test signup at `/anmeldung` arrives in the member register, and you deleted it afterwards
- [ ] A first backup downloaded and stored securely

## 9. Running CoopKraft

**Backups.** Under **Admin → Datenbank & Sicherung**, download a backup regularly. It is one JSON file with all data, including uploaded documents. It contains personal data and bank details, so store it encrypted or in a protected place. Also enable your hoster's database backups if they offer them.

**Updates.**
- **With GitHub:** with [automatic updates](#option-a-github-actions-recommended), new versions arrive in your fork by themselves; publish a release to deploy them. Without automatic updates, use **Sync fork**, but note that it brings in the latest development state, not the latest release.
- **By hand:** run `scripts/build-deploy.sh` again and upload; keep your `deploy/api/.env`.

Database changes in a new version are applied automatically on the first request after the update.

**Things to know.**
- Terminations that have reached their date are processed when a staff member opens the app. Nothing runs on a schedule yet.
- "Demo-Daten zurücksetzen" is disabled on a server installation. It would delete real data.

## 10. Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| "Interner Serverfehler" | Set `APP_DEBUG=true` in `api/.env` for a moment to see the real message, then set it back. Also check the PHP error log in your hosting panel. Wrong database settings are the most common cause. |
| Pages like `/app/mitglieder` show a server 404 page | `.htaccess` is missing or not active. Upload the hidden `.htaccess` files, and check that your hoster supports `mod_rewrite` and `.htaccess`. |
| The page loads without styles or stays blank | The app isn't at the root of its domain. Use a (sub)domain of its own. |
| "Anmeldedienst nicht erreichbar" | The web server cannot reach your SSO provider. Check `OIDC_ISSUER`, and that PHP may make outgoing HTTPS requests (`curl` or `allow_url_fopen`). |
| "Ungültiger Anmeldeversuch (state)" | The browser lost the session cookie during login. Make sure the app runs on HTTPS and `APP_URL` matches the address in the browser exactly. |
| The SSO provider reports an invalid redirect URI | The redirect URI in step 3 must be exactly `<APP_URL>/api/auth/callback`. |
| The SSO provider rejects the scope | Set `OIDC_SCOPES` to the scopes your provider supports (default: `openid email profile groups`). |
| "Der Anmeldedienst liefert keine E-Mail-Adresse" | Allow the `email` scope for the client, and make sure the user has an email address at the provider. |
| Login works, but "Für … ist kein Zugang eingerichtet" | Under **Rollen & SSO**, check the claim name and the group names with **Zuordnung testen**. Users get new roles on their next page load; group changes at the provider take effect after logging in again. Members: check that their member record has the same email address and is active. |
| Login fails after "Anmelden" with an error from the token step | Some providers expect the client secret in the request body. Set `OIDC_TOKEN_AUTH=post`. |

## 11. Reference: configuration values

Settings in `api/.env` on the server (template: `backend/.env.example`):

| Setting | Required | Default | Meaning |
|---|---|---|---|
| `APP_URL` | yes | | Public address of the app, without `/api` |
| `DB_HOST` | yes | `localhost` | Database server |
| `DB_PORT` | | `3306` | Database port |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD` | yes | | Database access |
| `AUTH_MODE` | | `oidc` | `oidc` for real logins. `dev` shows a form that lets anyone log in as anyone, so use it only on your own computer. |
| `OIDC_ISSUER` | yes | | Issuer URL of your SSO provider |
| `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` | yes | | Client from step 3 |
| `OIDC_SCOPES` | | `openid email profile groups` | Scopes requested at login |
| `OIDC_TOKEN_AUTH` | | `basic` | How the client secret is sent: `basic` or `post` |
| `OIDC_DISCOVERY_URL` | | `<issuer>/.well-known/openid-configuration` | Only if your provider's discovery document lives elsewhere |
| `ADMIN_EMAILS` | | | Comma-separated emails that always get the Admin role |
| `COOKIE_SECURE` | | `true` | Session cookie only over HTTPS. Never turn this off on a live server. |
| `APP_DEBUG` | | `false` | Show error details in responses. Only for troubleshooting. |
| `BASE_PATH` | | `/api` | Path of the API. Don't change it; the app expects `/api`. |

The group claim name, the group-to-role mapping and the policy for unknown users are not in `.env`. They are set in the app under **Admin → Rollen & SSO**.

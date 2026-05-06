# Plan: Energiegenossenschaft – Mitgliederverwaltung (V1)

## Ziel

Generische, white-label-fähige Web-App zur Verwaltung von Energiegenossenschafts-Mitgliedern, Anteilen, Dokumenten, Dividenden und Kommunikation. V1 läuft komplett lokal im Browser (IndexedDB) mit Demo-Daten, REST-Migration ohne UI-Umbau möglich.

## Tech-Stack

- TanStack Start, file-based Routing
- TanStack Query + Service-Layer (`src/services/*`), aktuell IndexedDB via `idb`
- shadcn/ui, Tailwind v4
- Zod, `date-fns` (DE), `Intl.NumberFormat` (EUR)
- Eigener SEPA-XML-Generator (ISO 20022 pain.001.001.09)
- `@tiptap/react` für Newsletter
- Auth V1: User-Switcher mit Demo-Usern und kombinierbaren Rollen

## Rollen (kombinierbar)

- `mitglied` – eigenes Dashboard, eigene Anteile/Dokumente, Selbst-Kündigung, Anteilsverkauf/-spende anstoßen
- `mitgliederverwalter` – manuelle Mitglieder-Anlage, Stammdaten, Dokumenten-Upload, Bearbeitung Kündigungen/Übertragungen
- `vorstand` – Lese-/Auswertungszugriff
- `aufsichtsrat` – Lesezugriff, optional Mit-Freigabe (konfigurierbar)
- `mitgliedsbestaetiger` – Beitritts-Approval
- `zahlungspruefer` – Zahlungseingänge
- `kommunikation` – Kampagnen/Newsletter
- `auszahler` – Dividenden + SEPA + Anteilsrückzahlung
- `admin` – Konfiguration, Branding, Custom Fields, Workflow-Regeln, User & Rollen, globale Dokumente

Berechtigungen zentral in `src/lib/permissions.ts`.

## Konfigurierbare Workflows (Admin)

In `_app/admin.workflow.tsx`:

**Beitritt**
- Anzahl benötigter Mitgliedsbestätigungen (Default 3)
- Zahlungseingang Pflicht? Wer prüft?
- Aufsichtsrats-Mitfreigabe + Anzahl
- Doppel- und Self-Approval verhindern

**Kündigungsperioden** (getrennt einstellbar für Mitgliedschaft und einzelne Anteile):
- Pro Typ (`membership` / `share`):
  - Frist: Anzahl + Einheit (Monate/Jahre, Default 3 Monate / 2 Jahre)
  - Stichtag: Monatsende / Quartalsende / Halbjahresende / Jahresende / freier Tag
  - Mindesthaltedauer ab Beitritt/Zeichnung (Default 0 / 24 Monate)
  - Frühester Austrittstermin: berechnet aus Eingangsdatum + Frist, gerundet auf nächsten Stichtag, frühestens nach Mindesthaltedauer
  - Wer bestätigt (Rollen-Auswahl, Default `mitgliederverwalter` + `vorstand`)
  - Anzahl Bestätigungen
  - Auszahlung der Anteile bei Austritt: sofort am Stichtag / nach Bilanzfeststellung des Folgejahres
- Beispiel-UI: Live-Vorschau „Würde ein Mitglied heute kündigen, wäre Austritt zum: …"
- Übergangsregel: bestehende offene Kündigungen behalten ihren bei Einreichung berechneten Austrittstermin (Audit-Notiz)

**Anteilsübertragung**
- Verkauf erlaubt? Spende erlaubt? Wer bestätigt?

Audit-Log pro Mitglied speichert jede Aktion und Workflow-Konfig-Änderung.

## Mitglieder-Detailansicht

Route `_app/mitglieder.$id.tsx` mit Tabs:

1. **Stammdaten** – Felder + Custom Fields, Inline-Edit für `mitgliederverwalter`/`admin`
2. **Anteile** – alle Lots (Datum, Anzahl, Wert, Zahlungsstatus), Aktionen pro Lot:
   - „Weitere Anteile zeichnen"
   - „Anteile kündigen" (nutzt Kündigungsperiode `share`, Lot-Splitting bei Teilkündigung)
   - „Anteile verkaufen" → Käufer-Auswahl (existierendes/neues Mitglied) + Anzahl + Preis → Transfer `pending`
   - „Anteile spenden" → Empfänger + Zweck, Preis = 0
3. **Dokumente** – Upload/Download/Löschen, Sichtbarkeit pro Doc (intern / auch Mitglied)
4. **Approvals** – Beitritts-Workflow-Status, Buttons je Rolle
5. **Kündigung** – Status-Box:
   - Mitglied selbst: Button „Mitgliedschaft kündigen" → Modal mit auto-berechnetem frühestem Austrittsdatum (gemäß Admin-Konfig), optionalem späterem Wunschdatum, Begründung optional
   - `mitgliederverwalter`/`vorstand`: bestätigt/lehnt ab, kann im Auftrag erfassen
   - Status-Maschine: `active` → `terminating` (mit Austrittsdatum) → am Stichtag automatisch `terminated`; offene Anteile gemäß Auszahlungs-Regel als Posten in SEPA-Lauf (Rolle `auszahler`)
6. **Audit-Log** – chronologisch

Mitgliedsstatus: `pending` → `active` → `terminating` → `terminated` (oder `rejected`).
Lot-Status: `pending_payment` → `active` → `terminating` → `transferred` / `repaid`.

## Manuelles Anlegen von Mitgliedern

Route `_app/mitglieder.neu.tsx` (Rolle `mitgliederverwalter`/`admin`):
- Gleiches Formular wie öffentliche Anmeldung, mehrspaltig
- Optionen: „Sofort aktiv setzen" (überspringt Approval, Audit-Notiz), „Zahlung bereits eingegangen"
- Inline-Doc-Upload (z.B. unterschriebener Beitrittsantrag)

## Dokumenten-Modul

**Globale Dokumente** – Route `_app/dokumente.tsx` (Upload: `admin`, optional `kommunikation`):
- Felder: Titel, Beschreibung, Datei, Kategorie (Satzung, Geschäftsbericht, Protokoll, Sonstiges), `visibility`: `public` | `members` | `internal`
- `public` → erreichbar unter `/dokumente/$slug` ohne Login (z.B. Satzung) und einbettbar im Anmeldeformular
- `members` → nur eingeloggte Mitglieder
- `internal` → nur Verwaltungs-Rollen
- V1: einfacher Replace mit Versions-Notiz

**Mitglieds-Dokumente** – Tab im Mitglied-Detail:
- Zugriff: Mitglied selbst (nur als „mitgliedssichtbar" markierte), `mitgliederverwalter`, `vorstand`, `admin`
- Kategorien: Beitrittsantrag, Ausweiskopie, SEPA-Mandat, Kündigung, Sonstiges

**Speicherung V1**: Datei als `Blob` in IndexedDB (`documents` + `documentFiles`). Warnung bei >5 MB. Service-Interface so geschnitten, dass spätere Migration auf REST/S3-Signed-URLs nur den Service tauscht.

## Daten-Layer

```
src/services/
  db.ts                    # IndexedDB-Schema
  users.service.ts
  members.service.ts       # CRUD, Status-Maschine
  shares.service.ts        # Lots, Splitting, Statuswechsel
  transfers.service.ts     # Verkauf/Spende mit Approval
  terminations.service.ts  # Kündigungen für membership + share, Stichtagslogik
  documents.service.ts     # global + Mitglieds-Dokumente
  dividends.service.ts
  campaigns.service.ts
  sepa.service.ts          # inkl. Anteilsrückzahlung
  settings.service.ts      # Branding, Anteilswert, Workflow- & Kündigungs-Konfig
  customFields.service.ts
  audit.service.ts
  seed.ts
src/services/api/          # REST-Stubs
src/lib/termination.ts     # reine Funktion: berechne frühesten Austrittstermin aus Konfig + Eingangs-/Beitrittsdatum
```

Stores: `users`, `members`, `shareLots`, `shareTransfers`, `terminations`, `approvals`, `paymentConfirmations`, `documents`, `documentFiles`, `campaigns`, `dividends`, `settings`, `customFields`, `workflowConfig`, `auditLog`.

Hintergrund-Job (Client-seitig beim App-Start + nach Login): prüft `terminating`-Datensätze und setzt fällige auf `terminated`, erzeugt Auszahlungsposten gemäß Konfig.

## Routenstruktur

```
src/routes/
  __root.tsx
  index.tsx
  anmeldung.tsx
  embed.anmeldung.tsx
  dokumente.$slug.tsx                # öffentliche Dokumente
  _app.tsx
  _app/dashboard.tsx
  _app/mitglieder.index.tsx
  _app/mitglieder.neu.tsx
  _app/mitglieder.$id.tsx
  _app/anteile.tsx
  _app/dokumente.tsx
  _app/kommunikation.index.tsx
  _app/kommunikation.neu.tsx
  _app/dividenden.tsx
  _app/sepa.tsx
  _app/admin.branding.tsx
  _app/admin.anteile.tsx
  _app/admin.felder.tsx
  _app/admin.konto.tsx
  _app/admin.workflow.tsx            # inkl. getrennte Kündigungsperioden
  _app/admin.users.tsx
```

## Branding & Locale

`BrandingProvider` setzt CSS-Variablen aus Settings (Logo-Blob, Primär-/Akzentfarbe in oklch). UI deutsch, EUR via `Intl`. Land Dropdown DE/AT/CH (in Admin konfigurierbar). SEPA nutzt eingestelltes Land der Genossenschaft.

## Demo-Daten

- 1 Genossenschaft („Demo Energie eG"), Standard-Branding
- Workflow-Default: 3 Beitritts-Bestätigungen + Zahlung
- Kündigung Mitgliedschaft: 3 Monate zum Jahresende, Mindesthaltedauer 24 Monate, Auszahlung nach Bilanzfeststellung
- Kündigung Anteile: 3 Monate zum Quartalsende, Mindesthaltedauer 0, Auszahlung sofort
- 8 Demo-User: Anna Mitglied / Bernd Vorstand+Bestätiger+Auszahler / Clara Vorstand+Bestätiger / Dieter Vorstand+Bestätiger+Kommunikation / Eva Aufsichtsrat / Frank Zahlungsprüfer+Auszahler / Gabi Mitgliederverwalter / Greta Admin
- 25 Mitglieder gemischt (active/pending/terminating), ~50 Lots, 1 Dividendenlauf, 2 Newsletter, 3 globale Dokumente (Satzung public, Geschäftsbericht members, Protokoll internal)

## Akzeptanzdurchlauf

Anmeldung → 3 Bestätiger + Zahlung → aktiv → Greta verkürzt Anteils-Kündigungsfrist auf 1 Monat → Mitglied A kündigt 2 Anteile → Vorschau zeigt neuen Stichtag → Gabi bestätigt → SEPA-Lauf zahlt zurück → Mitglied B verkauft Anteile an Mitglied C → Mitglied C kündigt Mitgliedschaft zum Jahresende → Satzung unter `/dokumente/satzung` ohne Login erreichbar.

## Out of Scope V1

- Echtes Auth/SSO
- Tatsächlicher E-Mail-Versand
- Bank-Import
- Mehrsprachigkeit, Mehrmandantenfähigkeit
- Dokumenten-Versionsdiff

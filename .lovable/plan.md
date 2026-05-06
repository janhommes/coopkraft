# Custom Fields & Stammdaten neu strukturieren

## 1. Definitive Stammdaten (bleiben fest am Mitglied)

Diese Felder bleiben hart im `Member`-Datenmodell, weil sie für Geschäftsprozesse (SEPA, Steuerbescheinigung, Briefe, Anrede) zwingend gebraucht werden:

- **Identität**: Mitgliedsnummer, Status, Typ (Person/Firma), Anrede, Vorname, Nachname
- **Kontakt**: E-Mail
- **Adresse** (für Steuerbescheinigung & Post): Straße, Hausnummer, PLZ, Ort, Land
- **Bankverbindung** (für SEPA): IBAN, BIC, Kontoinhaber
- **Steuerblock** (für KapESt-Lauf): Freistellung, Konfession, Bundesland, Steuer-ID
- **System**: Beitritts-/Austrittsdatum, Kündigungsgrund

## 2. Verschoben in Custom Fields (System-Definitionen)

Diese bisher festen Felder werden zu System-Custom-Fields:
`titel`, `bevorzugteAnrede`, `firma`, `geburtsdatum`, `telefon`, `newsletter`

- Sie bleiben technisch im `Member`-Typ (kein Datenverlust, keine Migration), werden aber in der UI **nicht** mehr im festen Stammdaten-Block angezeigt.
- Beim ersten Start legt `seed.ts` passende `CustomFieldDef`-Einträge mit `system: true` an (Schlüssel = bisheriger Feldname). Der Save-Handler im Mitglied schreibt die Werte aus `customFields[key]` zurück in die nativen Felder, damit Anmeldeformular, SEPA, Newsletter etc. unverändert weiterlaufen.
- Bestehende Daten in `m.telefon` etc. werden beim Anzeigen automatisch als Initialwert für das Custom Field benutzt.

## 3. Anzeige im Mitglied (Stammdaten-Tab)

Unterhalb des bestehenden Adress-/Bank-Blocks und über dem Steuer-Block kommt eine neue Card **„Weitere Angaben"**:

- Listet alle `CustomFieldDef` (System + benutzerdefiniert) als passende Inputs (text/number/date/checkbox/select).
- Pflichtfelder mit `*` markiert.
- Beim Speichern werden Werte in `m.customFields[key]` geschrieben + bei System-Feldern in das native Feld gespiegelt.
- Wenn keine Custom Fields definiert sind, wird die Card ausgeblendet.

## 4. Required-Validierung (überall)

Neue zentrale Helper-Funktion `validateMember(m, defs)`:
- Prüft alle Pflicht-`CustomFieldDef` gegen `m.customFields[key]` (leerer String / undefined / leere Auswahl = fehlt; Checkbox-required = muss true sein).
- Wird benutzt in:
  - **`AnmeldungForm`** vor `submitJoinRequest`
  - **`StammForm`** vor `saveMember` im Mitglied-Detail
- Fehler werden als roter Hinweis pro Feld + Toast angezeigt; Speichern wird blockiert.
- Hartes Required gilt also auch für Bestandsmitglieder (gemäß Wunsch „Überall").

## 5. Custom-Felder-Admin (`/app/admin/felder`)

UI-Erweiterung:
- Spalte/Toggle **„Pflichtfeld"** im Anlage-Formular (Checkbox `required`) – ist im Datenmodell schon da, fehlt nur im UI.
- In der Liste neben dem Label Badges anzeigen: „Pflicht", „Anmeldung", „System".
- System-Felder können bearbeitet (Label, required, showOnSignup), aber **nicht gelöscht** werden (`system: true` im Datensatz, Löschen-Button ausgeblendet).
- Edit-Modus: aktuell ist nur Anlegen möglich – wir ergänzen Inline-Bearbeitung pro Zeile (Label, required, showOnSignup, Optionen).

## Technische Details

### Typen (`src/lib/types.ts`)
- `CustomFieldDef` bekommt optional `system?: boolean`.

### Service (`src/services/customFields.service.ts`)
- `deleteCustomField`: wirft Fehler, wenn `system === true`.
- Neue Helper `validateCustomFields(values, defs): { ok: boolean; errors: Record<string,string> }`.

### Seed (`src/services/seed.ts`)
- Beim Init zusätzlich 6 System-Custom-Fields anlegen (idempotent via fixe IDs `system-telefon`, `system-firma` …).
- Bei vorhandenen Mitgliedern: native Felder bleiben unverändert. Beim ersten Anzeigen im Mitglied wird `m.customFields[key] ?? m[key]` als Initialwert benutzt; nach erstem Speichern ist es synchronisiert.

### Mitglied-Detail (`src/routes/app.mitglieder.$id.tsx`)
- `StammForm` rendert nur noch die in Punkt 1 genannten festen Felder.
- Neue Subkomponente `CustomFieldsBlock` rendert alle Defs, validiert, ruft `onChange`.
- Vor `onSave`: `validateMember` aufrufen, bei Fehlern Toast + Inline-Hinweise.

### Anmeldeformular (`src/components/anmeldung/AnmeldungForm.tsx`)
- Bestehende native Felder Titel/Firma/Geburtsdatum/Telefon/Newsletter werden weiterhin gerendert (sie sind ja jetzt System-Custom-Fields mit `showOnSignup=true`) – aber über die generische Custom-Field-Renderschleife, **nicht** mehr hartcodiert. Damit greift Required automatisch.
- Validierung schon vorhanden, wird um Required-Check erweitert.

### Felder-Admin (`src/routes/app.admin.felder.tsx`)
- Required-Checkbox + Anmeldeformular-Checkbox sichtbar.
- System-Badge + Lösch-Schutz.
- Inline-Edit-Modus pro Zeile.

## Explizit ausgeschlossen

- Keine Daten-Migration alter Werte in `customFields` (gemäß Wunsch „Ignorieren").
- Adresse/IBAN/Steuerblock bleiben fest – nicht als Custom Fields verfügbar.
- Keine Änderungen an Dashboard-/Newsletter-/SEPA-Logik (nutzen weiter die nativen Felder).

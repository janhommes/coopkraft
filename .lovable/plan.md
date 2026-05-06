## Ziel

Bei jedem Dividendenlauf werden pro Mitglied die Steuern korrekt einbehalten und eine Steuerbescheinigung als PDF erzeugt, die in der Mitglieds-Akte (Dokumente) abgelegt und für das Mitglied sichtbar ist.

## 1. Datenmodell-Erweiterungen

**`Member`** – neue Felder (alle optional, Default = nichts ändern):
- `freistellung: boolean` – wenn `true`: keine Abzüge (voll freigestellt).
- `konfession: "keine" | "rk" | "ev" | "sonstige"` – nur informativ; "rk"/"ev" lösen KiSt aus.
- `bundesland: "BW" | "BY" | "BE" | "BB" | "HB" | "HH" | "HE" | "MV" | "NI" | "NW" | "RP" | "SL" | "SN" | "ST" | "SH" | "TH"` – steuert KiSt-Satz (BY/BW = 8 %, sonst 9 %).
- `steuerId?: string` – Steuer-Identifikationsnummer (für die Bescheinigung).

UI: Im Mitglieds-Detail neuer Block „Steuerliche Angaben" (editierbar mit `edit:member`/Self).

**`Settings.genossenschaft`** – neuer Block für die Bescheinigungs-Kopfzeile:
- `name`, `strasse`, `hausnummer`, `plz`, `ort`, `land`
- `steuernummer?`, `ustIdNr?`
- `vertretenDurch?` (z. B. „Vorstand: Max Mustermann")
- `registergericht?`, `registernummer?` (optional)

UI: **Neuer Tab „Stammdaten" im Admin** (`/app/admin/stammdaten`) für genau diese Felder. (Konto-Tab bleibt für Bankdaten.)

**`DividendRun.items`** – pro Item gespeichert:
- `gross: number` (bisher `amount`, semantisch „brutto")
- `kapest: number`
- `soli: number`
- `kist: number`
- `net: number` (`gross - kapest - soli - kist`)
- `freigestellt: boolean` (Snapshot, falls Flag später geändert wird)
- `kistRate: number` (8 oder 9, oder 0)
- `documentId?: string` (Verknüpfung zur erzeugten Bescheinigung)

`DividendRun` zusätzlich: `totals: { gross, kapest, soli, kist, net }`.

Bestehende `amount` bleibt aus Kompatibilität gleich Brutto; neue Felder additiv.

## 2. Berechnung

Pro Lot wie bisher Brutto = `kapital * rate% * tage/365`.

Pro Mitglied dann:
- `freistellung === true` → `kapest = soli = kist = 0`, `net = gross`.
- sonst:
  - `kapest = round2(gross * 0.25)`
  - `soli   = round2(kapest * 0.055)`
  - `kistRate = (konfession in {rk, ev}) ? (bundesland in {BY, BW} ? 8 : 9) : 0`
  - `kist   = round2(kapest * kistRate / 100)`
  - bei KiSt > 0: minimaler KapESt-Minderungs-Effekt (§ 32d EStG) wird **nicht** modelliert (zu komplex; wird in der Bescheinigung als „ohne Anrechnung KiSt-Sonderausgabe" hinweisen). Vereinfachung explizit dokumentieren.
- `net = gross - kapest - soli - kist`.

## 3. PDF-Bescheinigung

Pro Empfänger des Laufs ein PDF „Steuerbescheinigung Dividende GJ {jahr}" mit:
- Aussteller-Block (aus `Settings.genossenschaft`)
- Empfänger-Block (Mitglied: Anschrift, Mitgliedsnr., Steuer-ID falls vorhanden)
- Zeitraum, Anzahl Anteile, gehaltene Tage je Lot
- Tabelle: Brutto, KapESt 25 %, Soli 5,5 % auf KapESt, KiSt {0/8/9 %}, Auszahlungsbetrag (netto)
- Hinweis bei Freistellung („Freistellungsauftrag liegt vor")
- Datum, Ort, Hinweis „Diese Bescheinigung wurde elektronisch erzeugt"

Erzeugung: clientseitig mit `jspdf` + `jspdf-autotable` (passt zu IndexedDB-Architektur, keine Server-Round-Trips). Logo aus `Settings.logoDataUrl`, falls vorhanden.

Ablage: über bestehenden `documents.service.uploadDocument` als `DocumentRecord` mit:
- `memberId` = Empfänger
- `category: "Sonstiges"` (oder neue Kategorie `"Steuerbescheinigung"` ergänzen)
- `visibility: "internal"`, `visibleToMember: true`
- `title: "Steuerbescheinigung Dividende GJ {jahr}"`

`documentId` wird ins jeweilige `DividendRun.items[]` zurückgeschrieben.

## 4. UI-Änderungen

**Dividenden-Seite (`/app/dividenden`):**
- Vorschau zeigt jetzt vier Spalten je Mitglied: Brutto · KapESt+Soli · KiSt · Netto.
- „Berechnen & speichern" erzeugt Lauf + alle PDFs (Progress-Toast „PDFs werden erzeugt…").
- In der Lauf-Detailansicht: pro Mitglied ein Download-Button für die Bescheinigung.
- Lauf löschen: zugehörige Bescheinigungs-Dokumente werden mit gelöscht.

**Mitglieds-Detail:**
- Neuer Tab/Block „Steuer" (Freistellung, Konfession, Bundesland, Steuer-ID).
- In der Dividenden-Liste pro Mitglied: Spalten Brutto/Netto + Link auf PDF.

**Admin → Stammdaten (neu):**
- Eingabe der Aussteller-Daten gemäß Settings-Block oben.
- Wird in den Tab-Reiter oben eingereiht (zwischen „Konto" und „Branding").

## 5. Migration / Defaults

- Beim ersten Laden: bestehende Mitglieder bekommen `freistellung=false`, `konfession="keine"`, `bundesland` = Default `"NW"` (kann global im Settings-Tab gesetzt werden, ergänzen wir als Default-Wert).
- Bestehende Dividendenläufe: nicht rückwirkend neu berechnen. In der UI kennzeichnen als „ohne Steuerabzug (alt)" und Bescheinigungs-Button ausgeblendet.
- Settings.genossenschaft: leer → Hinweis-Banner auf Dividenden-Seite „Bitte zuerst Stammdaten der Genossenschaft pflegen, sonst keine korrekten Bescheinigungen".

## 6. Audit

- Pro Lauf: Audit-Eintrag wie bisher, zusätzlich „N Bescheinigungen erstellt" und Summen Brutto/Netto/Steuern.
- Pro PDF: kein extra Eintrag (zu lärmig); Lauf-Eintrag genügt.

## Technische Notizen

- Neue Dependency: `jspdf` + `jspdf-autotable` (clientseitig, keine Worker-Constraints relevant).
- `dividends.service.calcDividend` wird um Steuer-Berechnung erweitert; Member-Lookup wird in die Berechnung gezogen, weil Steuersätze pro Mitglied unterschiedlich sind.
- PDF-Erzeugung als eigene Datei `src/lib/dividend-certificate.ts` (pure function `buildCertificatePdf(...)` → `Blob`).
- Kategorie `"Steuerbescheinigung"` zu `DocCategory` ergänzen, sonst bleibt Dokumenten-Pipeline unverändert.
- Vereinfachungen, die wir dokumentieren: keine KapESt-Minderung durch KiSt-Sonderausgabenabzug, kein Sparer-Pauschbetrag, kein NV-Bescheinigungs-Workflow – diese Optionen können später nachgezogen werden.

## Offen / explizit ausgeklammert

- Zusammenveranlagung (2.000 €) – nicht modellierbar ohne Ehegatten-Verknüpfung.
- Sparer-Pauschbetrag in Euro – bewusst durch „Freistellung ja/nein" ersetzt (Wunsch).
- Echte elektronische Übermittlung an Finanzamt (BZSt) – out of scope.

# Community Connect

Ich möchte eine Energie genossenschaft Mitglieder verwaltungs software bauen. Diese sollte möglich generisch funktionieren, heißt das Branding und logo sollte anpassbar sein. Die Mitglieder haben folgende felder:
'typ'                     => 'Kontakttyp',

        'anrede'                  => 'Anrede',

'titel'                   => 'Titel',

'bevorzugteAnrede'        => 'Bevorzugte Anrede',

'vorname'                 => 'Vorname',

'nachname'                => 'Nachname',

'geburtsdatum'            => 'Geburtsdatum',

'organisation'            => 'Organisation',

'webseite'                => 'Webseite',

'telefon'                 => 'Telefon',

'mobil'                   => 'Mobil',

'email'                   => 'E-Mail',

'strasse'                 => 'Straße',

'plz'                     => 'PLZ',

'ort'                     => 'Ort',

'land'                    => 'Land',

'erzAnrede'               => 'Erz.-Ber. Anrede',

'erzVorname'              => 'Erz.-Ber. Vorname',

'erzNachname'             => 'Erz.-Ber. Nachname',

'erzEmail'                => 'Erz.-Ber. E-Mail',

'erzTelefon'              => 'Erz.-Ber. Telefon',

'erzStrasse'              => 'Erz.-Ber. Straße',

'erzPlz'                  => 'Erz.-Ber. PLZ',

'erzOrt'                  => 'Erz.-Ber. Ort',

'erzLand'                 => 'Erz.-Ber. Land',

'ansprechpartnerVorname'  => 'Ansprechpartner Vorname',

'ansprechpartnerNachname' => 'Ansprechpartner Nachname',

'ansprechpartnerEmail'    => 'Ansprechpartner E-Mail',

'ansprechpartnerTelefon'  => 'Ansprechpartner Telefon',

'steuerId'                => 'Steuer-ID',

'steuernummer'            => 'Steuernummer',

'ustId'                   => 'USt-ID',

'kontoinhaber'            => 'Kontoinhaber',

'iban'                    => 'IBAN',

'anteile'                 => 'Anzahl Anteile',

'satzungAkzeptiert'       => 'Satzung akzeptiert',

'newsletter'              => 'Newsletter',

Es sollte aber auch möglich sein, custom felder anzulegen.

Die funktionen der App sollten sein:
Offen:
Formular zur Anmeldung zur Einbettung im iFrame

Mitglieder:
1. Übersicht Dashboard -> für Mitglieder zeigen das aktuelle Kapital und die möglichkeit mehr zu zeichnen, für Vorstände das gezeichnete Kapital, Mitglieder entwicklung und mehr KPIs

Für Admins und Vorstände:
2. Mitglieder verwaltung -> prozess zum Mitglieder azeptieren (3 Vorstände müssen zustimmen + Geld msus eingegangen sein)
3. Zeichnen von Anteilen (+nach zeichnen) -> eigene tabelle (JSON datei?!) , da wichtig das unterschiedliche 
4. Kommunikation -> Newsletter mit HTML desing, Termine, Dividenden mitteilung und sonstiges im Branding der Genossenschaft
5. Dividenden berechnung
6. Mitglieder Sammelüberwisung SEPA XML nach ISO 20022 -> Benutzer kann mitglieder auswählen und dividenden ausschüttung oder sammel Überweisung mit fix-betrag

Für Admins:

7. Konfiguration:
Branding (farben + logo)
Konfigurierbarer Anteils wert, max anteile und min anteile pro Mitglied
Custom felder pro mitglied
Kontodaten der Genossenschaft


Login und Backend:
Es ist geplant eine SSO Anmeldung zu machen. In dieser ersten Version möchte ich erstmal nur ein UX haben welches mit lokalen JSON arbeitet (in indexDB oder localStorage). Eine Anbindung an ein richtiges Backend per REST schnittstelle sollte vorgesehen werden.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://coop-flourish-nexus.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/bc8803d2-e1cc-4166-9ede-5b8d6f4d9efc).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

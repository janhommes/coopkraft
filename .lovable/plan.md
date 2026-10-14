# Rollen über SSO-Gruppen statt E-Mail-Zuweisung

## Ist-Zustand
- Unter "Benutzer & Rollen" legt der Admin Benutzer (Name + E-Mail) an und hakt pro Person Rollen an.
- Das ist ein reiner Platzhalter: Es gibt keinen echten Login, nur den Rollen-Switcher zum Testen.

## Ziel (macht Sinn)
Wer jemand ist und zu welcher Gruppe er gehört, entscheidet der SSO-Anbieter (z. B. Keycloak, Entra ID, Authentik). In der App wird nur festgelegt, welche SSO-Gruppe welche Rollen bekommt. Ausnahme: "Mitglied" ergibt sich automatisch, wenn die Login-E-Mail zu einem Mitglied passt.

## Änderungen
1. **Seite "Rollen & SSO-Zuordnung"** (ersetzt "Benutzer & Rollen")
   - Tabelle: SSO-Gruppe/Claim-Wert (z. B. `egv-vorstand`) -> eine oder mehrere Rollen.
   - Einstellung: Name des Gruppen-Claims (Standard `groups`) und Verhalten bei unbekannten Gruppen (nur "Mitglied" oder kein Zugang).
   - Übersicht der Rollen mit Kurzbeschreibung, was sie dürfen (aus der bestehenden Berechtigungsmatrix, nur lesend).
2. **Rollenermittlung beim Login** an einer zentralen Stelle: Rollen = Vereinigung aller gemappten Gruppen + "Mitglied", wenn ein aktives Mitglied mit der E-Mail existiert.
3. **Optionale Notfall-Overrides**: kleine Liste "Zusätzliche Rollen für E-Mail" (z. B. erster Admin, bevor SSO-Gruppen existieren). Klar als Ausnahme gekennzeichnet.
4. **Test-Modus**: Der Rollen-Switcher wird zu "SSO simulieren": E-Mail + Gruppen eingeben, App zeigt die daraus berechneten Rollen und meldet sich so an. Demo-Personen bleiben als Schnellauswahl.
5. **Demo-Daten**: Beispiel-Zuordnungen (`egv-admin`, `egv-vorstand`, `egv-aufsichtsrat`, `egv-verwaltung`, `egv-finanzen`, `egv-kommunikation`).

## Technische Details
- Neuer Settings-Bereich `ssoRoleMapping: { claim, unknownPolicy, mappings: {group, roles[]}[], overrides: {email, roles[]}[] }`.
- `resolveRoles(identity: {email, groups[]}, settings, members)` in `src/lib/` – rein, testbar; später im Backend identisch nutzbar (REST: Token-Claims serverseitig auswerten, Frontend vertraut nicht selbst).
- `AuthProvider` hält `identity` statt fester `AppUser`-Rollen; `can()` bleibt unverändert.
- `users`-Store bleibt nur für Overrides/Anzeige "zuletzt angemeldet"; Route `app.admin.users` wird umgebaut, Navigationslabel angepasst.

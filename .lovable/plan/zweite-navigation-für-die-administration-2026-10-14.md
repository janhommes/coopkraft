# Zweite Navigation für die Administration

## Was sich ändert

- Die Tab-Leiste mit den Scroll-Pfeilen verschwindet komplett.
- Stattdessen erscheint eine senkrechte Unter-Navigation als **zweite Spalte links** neben dem Inhalt.
- Die neun Punkte sind in **vier Gruppen** mit Zwischenüberschriften gegliedert.
- Der gerade offene Punkt wird wie in der Haupt-Navigation markiert: hervorgehobener Hintergrund plus linker Farbbalken.
- Auf dem Handy bleibt das **Auswahlfeld** – es steht dann direkt über dem Inhalt.
- Über dem Inhalt steht künftig der Name der offenen Unterteilung (z. B. „Branding"), darüber klein „Administration". So weiß man auch ohne Tabs, wo man ist.

## Aufbau

```text
Desktop (ab md-Breite)
+------------------+------------------------------------------+
| Haupt-Navigation | Administration                           |
| (unverändert)    |                                          |
|                  |  AUFTRITT                                |
|  Dashboard       |  Branding            <- aktiv, markiert  |
|  Mitglieder      |  Beitrittsformular                       |
|  Anteile         |  Newsletter                              |
|  Dokumente       |                                          |
|  Kommunikation   |  MITGLIEDER & ANTEILE                    |
|  Dividenden      |  Anteile                                 |
|  SEPA-Lauf       |  Benutzerdefinierte Felder               |
|  Admin  (aktiv)  |                                          |
|                  |  FINANZEN                                |
|                  |  Bankkonto                               |
|                  |  Stammdaten                              |
|                  |                                          |
|                  |  SYSTEM                                  |
|                  |  Workflows & Kündigung                   |
|                  |  Benutzer & Rollen                       |
+------------------+------------------------------------------+

Mobil
+----------------------------------+
| Administration                   |
| Branding                         |
| [ Unterteilung auswählen  v ]    |
| Inhalt des gewählten Punkts      |
+----------------------------------+
```

## Gruppen

| Gruppe | Punkte |
| --- | --- |
| Auftritt | Branding, Beitrittsformular, Newsletter |
| Mitglieder & Anteile | Anteile, Benutzerdefinierte Felder |
| Finanzen | Bankkonto, Stammdaten |
| System | Workflows & Kündigung, Benutzer & Rollen |

## Feinschliff

- Die linke Spalte bleibt beim Scrollen stehen (klebt oben), die Liste scrollt bei Bedarf selbst.
- Lange Namen („Benutzerdefinierte Felder") dürfen in der Spalte umbrechen, damit nichts abgeschnitten wird.
- Die Spalte nutzt die bestehende Farb-Abstimmung (abgeleitet aus deinem konfigurierten Hintergrund), keine neuen Farben.
- Die Haupt-Navigation markiert „Admin" weiterhin als aktiv, egal welche Unterseite offen ist.

## Technische Umsetzung

- Geändert wird ausschließlich `src/routes/app.admin.tsx`. Die Unterseiten (`src/routes/app.admin.*.tsx`) bleiben unangetastet; URLs und Route-Struktur ändern sich nicht.
- `items` wird zu `groups`: `{ label, items: [{ to, label }] }`. Eine flache Liste davon dient dem Select und der Aktiv-Erkennung.
- Layout: `md:grid md:grid-cols-[220px_minmax(0,1fr)] md:gap-8`; linke Spalte `md:sticky md:top-6 md:max-h-[calc(100vh-3rem)] md:overflow-y-auto`, Inhaltsseite `min-w-0`.
- Gruppenüberschriften: `text-[11px] font-semibold uppercase tracking-wider text-muted-foreground`.
- Aktiver Link: `bg-sidebar-accent text-sidebar-accent-foreground` mit `border-l-2 border-primary`; Ruhezustand `hover:bg-accent`.
- Entfernt: `overflow`-State, `scrollerRef`, `activeRef`, Scroll-Pfeile, beide `useEffect`-Blöcke und die `ChevronLeft`/`ChevronRight`-Importe. `useLocation` und `useNavigate` bleiben für das Select.
- Titelblock: „Administration" als Eyebrow-Zeile, darunter `<h1>` mit dem Label des aktiven Punkts.

## Nicht enthalten

- Keine Änderungen an den einzelnen Verwaltungsseiten selbst.
- Keine Änderung an der Haupt-Sidebar oder am Header.

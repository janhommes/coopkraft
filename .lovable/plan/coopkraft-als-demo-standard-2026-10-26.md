# CoopKraft als Demo-Standard

## Was sich ändert
- Demo-Daten nutzen das CoopKraft-Logo (hell; dunkle Variante wird für dunkle Navigation/Header bereitgehalten) und den Namen "CoopKraft Energie eG".
- Demo-Farben:
  - Primärfarbe: Grün #9fb73f
  - Akzentfarbe: Teal #42a395 (Orange #d3a050 für Diagramme/Hinweise)
  - Hintergrund: #ffffff, Navigation: #ffffff mit Linien #e6e6e3
  - Textfarbe: #393838, gedämpfter Text: #666464
- Newsletter-Header/-Footer der Demo in CoopKraft-Farben.
- Standardfarben der App (vor dem Laden der Einstellungen) ebenfalls auf diese Palette, damit kein Farbsprung entsteht.
- Favicon aus dem Logo-Symbol.
- Wirksam nach "Demo-Daten zurücksetzen" (bestehende Daten bleiben unverändert).

## Technisch
- Logos per lovable-assets hochladen; in `seed.ts` `logoDataUrl` auf Asset-URL setzen, Farben/Namen/Newsletter-HTML anpassen.
- `styles.css` :root-Tokens (primary, accent, foreground, muted-foreground, border, chart-1..3) auf Palette.
- Favicon: `public/favicon.png` (quadratisch zugeschnitten), Link in `__root.tsx`, `favicon.ico` löschen.

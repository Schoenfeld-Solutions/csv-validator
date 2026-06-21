# Contributing

Dieses Projekt soll klein, auditierbar und statisch deploybar bleiben.

## Entwicklungsbaseline

- Node.js `25.6.1` oder kompatibel mit `>=25`.
- npm ist der Package Manager.
- TypeScript bleibt strict.
- Runtime-Code bleibt framework-arm: Astro fuer die statische Seite, Vanilla
  TypeScript fuer Interaktion und Web Worker fuer Datei-Parsing.

```bash
npm ci
npm run preflight
```

## Grenzen

- Keine Server-API und keine Upload-Funktion.
- Keine Analytics, Telemetrie oder externen Fonts.
- Keine DATEV-Logos, Markenassets, offiziellen ZIPs, XMLs, Screenshots,
  EXEs, HTML-Berichte, dekompilierten Inhalte oder raw Rule-Strings.
- Keine React-, Vue-, Svelte-, Tailwind- oder UI-Bibliotheks-Abhaengigkeit im
  MVP.

## Commits und Pull Requests

- Conventional Commits sind verpflichtend.
- Zulässige Form: `<type>(<scope>): <description>`.
- Beispiele: `feat(validator): add header checks`,
  `test(worker): cover invalid quotes`, `docs(readme): document privacy`.
- Pull Requests muessen `npm run preflight` gruen halten.

## Dokumentation

Oeffentliche Contract-, Datenschutz-, Sicherheits- und Deployment-Aenderungen
muessen in README, NOTICE, SECURITY oder den Contract-Dokumenten nachgezogen
werden.

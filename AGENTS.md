# Repository Working Rules

## Scope und Reihenfolge

- Diese Regeln gelten fuer das gesamte Repository.
- Falls spaeter tiefere `AGENTS.md`- oder `AGENTS.override.md`-Dateien
  entstehen, gelten die naechstgelegenen Regeln fuer ihren Teilbaum.
- Dieses Repository ist ein oeffentliches GitHub-Pages-Tool. Aenderungen sollen
  klein, pruefbar und ohne Server- oder Upload-Annahmen bleiben.

## Projektkarte

- `README.md`: Produktziel, Scope, Datenschutz- und Entwicklungsbaseline.
- `docs/contracts/`: oeffentliche Result- und Validator-Contracts.
- `docs/ops/`: Maintainer-, Release- und Governance-Runbooks.
- `src/lib/datev/`: DATEV-CSV-Lexing, Encoding, Contracts und Validierung.
- `src/components/`, `src/scripts/`, `src/workers/`: UI, Browser-Interaktion
  und Worker-Grenze.
- `tests/unit/` und `tests/e2e/`: Verhaltenstests fuer Core und Browser-Flow.
- `.github/`: CI, Pages, Dependabot und PR-Konventionen.
- `.local/`: ausschliesslich lokale, ignorierte Artefakte wie DATEV-
  Musterdateien, Reports und einmalige Test-Runner.

## Setup und Checks

- Node.js `25.6.1` ist die validierte Baseline; `package.json` erlaubt
  kompatible Node-25+-Versionen.
- Installation: `npm ci`.
- Schneller Arbeitscheck nach kleinen Doku-/Tooling-Aenderungen:
  `npm run check:governance`, `npm run format:check`, `git diff --check`.
- Kanonischer Gate vor Commit, Push oder PR-Update: `npm run preflight`.
- Browser-E2E-Tests laufen standardmaessig headless. Headful Playwright ist nur
  fuer bewusst beobachtete lokale Diagnose- oder Musterdatei-Laeufe gedacht.

## Git und Pull Requests

- `main` ist geschuetzt und wird nicht direkt beschrieben.
- Normale Arbeit laeuft ueber kurze `dev/<topic>`-Branches und Pull Requests.
- Commits und PR-Titel folgen Conventional Commits:
  `<type>(<scope>): <description>` oder `<type>: <description>`.
- Human-Merge-Grenze: Der Agent darf Branches, Commits und Draft-PRs
  vorbereiten. Review, Ready-Status und Squash-Merge sind menschliche
  Maintainer-Entscheidungen.
- Nach einem Merge wird der Remote-Branch geloescht, `main` lokal per
  Fast-Forward aktualisiert und der Feature-Branch lokal entfernt.

## Sicherheit und Datenschutz

- Keine Server-API, keine Upload-Funktion, keine Telemetrie, keine Analytics,
  kein Tracking und keine externen Fonts einfuehren.
- DATEV-Dateiinhalte sind untrusted input. Keine Rohdaten per `innerHTML`
  rendern und keine lokalen absoluten Pfade anzeigen.
- Keine offiziellen DATEV-ZIPs, XMLs, HTML-Berichte, Screenshots, EXEs,
  Musterdateien, dekompilierten Inhalte, raw Rule-Strings oder Markenassets
  committen.
- Neue Production-Dependencies brauchen eine begruendete Entscheidung und
  ausdrueckliche Zustimmung.
- GitHub-Actions-Permissions bleiben least-privilege; keine
  secret-abhaengigen PR-Gates ohne dokumentierten Sicherheitsgrund.

## Architekturgrenzen

- Domainlogik bleibt in `src/lib/datev/` und ist framework-unabhaengig testbar.
- UI und DOM-Zugriffe bleiben in Astro-Komponenten und `src/scripts/`.
- Datei-Lesen und Validierung laufen ueber den Web Worker, damit die UI bei
  groesseren Dateien reaktionsfaehig bleibt.
- Keine monolithischen Feature-Slices: Contract-, Core-, UI-, Tooling- und
  Doku-Aenderungen nur gemeinsam, wenn sie fuer ein pruefbares Ziel noetig sind.

## Artefakte

- `dist/`, `.astro/`, `coverage/`, Playwright-Reports, Test-Results, Logs,
  `.env*` und `.local/` bleiben ungetrackt.
- Lokale DATEV-Musterlaeufe duerfen Metadaten, Hashes, Status und
  Diagnostic-Codes berichten, aber keine CSV-Rohdaten in Git aufnehmen.

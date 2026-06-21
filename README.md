# DATEV CSV Validator

DATEV CSV Validator ist ein leichtgewichtiges, statisches GitHub-Pages-Tool zur
lokalen Strukturpruefung von DATEV-CSV-Dateien. Dateien werden nur im Browser
verarbeitet. Es gibt keinen Server-Upload, keine Telemetrie, keine Analytics
und kein Tracking.

Das Projekt ist ein unabhaengiges Open-Source-Tool. Es ist nicht mit DATEV eG
verbunden, nicht von DATEV eG autorisiert und ersetzt keine DATEV-
Produktdokumentation, keine steuerliche Beratung und keine Pruefung durch
offizielle DATEV-Werkzeuge.

## Funktionsumfang

Der MVP prueft lokale `.csv`- und `.txt`-Dateien gegen einen versionierten,
lokal implementierten DATEV-CSV-Strukturvertrag:

- CSV-Lexik mit Semikolon, doppeltem Texttrenner, korrekt geschlossenen Quotes,
  gedoppelten Quotes und konservativer Steuerzeichenpruefung.
- Encoding-Erkennung mit UTF-8-BOM als `utf-8-sig`; Dateien ohne BOM werden
  deterministisch als `windows-1252` verarbeitet.
- DATEV-Header mit Marker `EXTF`, enger `DTVF`-Ausnahme fuer
  `datev-debitor-kreditor-v5`, Header-Version `700`, Formatkategorie,
  Formatname und Formatversion.
- Caption-Zeile mit Feldanzahl und Feldreihenfolge gemaess lokalem Contract.
- Datenzeilen mit Feldanzahl, Pflichtfeldern, Typen `Text`, `Konto`, `Zahl`,
  `Betrag`, `Datum`, maximaler Laenge, Dezimalstellen sowie `TTMM`- und
  `TTMMJJJJ`-Datumsgrenzen.
- Ergebnisexport als JSON nur nach expliziter Nutzeraktion.

Die Meldung `valid` bedeutet nur:

> Valid against the implemented local structural DATEV CSV contract.

Sie bedeutet nicht, dass eine DATEV-Anwendung die Datei akzeptiert.

## Unterstuetzte Recognition-Codes

- `datev-booking-batch-v13`
- `datev-booking-batch-v12`
- `datev-booking-batch-v11`
- `datev-booking-batch-v10`
- `datev-recurring-bookings-v4`
- `datev-recurring-bookings-v3`
- `datev-debitor-kreditor-v5`
- `datev-gl-account-description-v3`
- `datev-payment-terms-v2`
- `datev-various-addresses-v2`
- `datev-natural-stack-v2`
- `datev-text-key-v2`

## Nicht im Scope

Nicht implementiert sind Server-Uploads, Speicherung, Account- oder Login-
Funktionen, offizielle DATEV-Blackbox-Laeufe, DATEV-Pruefprogramm-Automation,
generische CalculationRule-Engines, AdditionalValidationRules, Cross-Record-
oder Cross-Field-Buchungslogik, Business-Central-Importe und Garantien, dass
offizielle DATEV-Werkzeuge dieselbe Entscheidung treffen.

## Entwicklung

Voraussetzungen:

- Node.js `25.6.1` oder kompatibel mit `>=25`
- npm

Lokale Befehle:

```bash
npm ci
npm run dev -- --host 127.0.0.1 --port 4321
npm run preflight
```

Lokale Seiten:

- `http://127.0.0.1:4321/csv-validator/` automatische Spracherkennung und Redirect
- `http://127.0.0.1:4321/csv-validator/de/` deutscher Validator
- `http://127.0.0.1:4321/csv-validator/en/` englischer Validator

`npm run preflight` ist der kanonische lokale Gate. Er fuehrt einen vollstaendigen
Lockfile-Audit ab Severity `low`, Formatpruefung, Linting, Typecheck, Unit-Tests
mit Coverage, Produktionsbuild, Playwright-Smoke-Test und Lighthouse-Gate aus.

## Deployment

GitHub Pages veroeffentlicht die statische Astro-Seite unter:

`https://schoenfeld-solutions.github.io/csv-validator/`

Die Root-Seite erkennt die bevorzugte Browser-Sprache clientseitig und leitet
nach `/de/` oder `/en/` weiter. Nicht-deutsche Browser-Sprachen fallen auf
Englisch zurueck. Die Seite ist fuer einen statischen Build konfiguriert. Es
gibt keine API und keine serverseitige Verarbeitung von DATEV-Dateien.

## Datenschutz und Sicherheit

- Dateien bleiben im Browser.
- Es findet kein Upload statt.
- Ergebnisse bleiben lokal im Browser, bis Nutzer sie kopieren oder als JSON
  herunterladen.
- Dateiinhalte werden nicht als Rohdaten in der UI angezeigt.
- Dateinamen werden nur als Browser-`file.name` angezeigt, nie als lokaler Pfad.
- Die UI nutzt keine `innerHTML`-Einbindung fuer DATEV-Dateiinhalte.
- Telemetrie, Analytics und Tracking sind nicht vorhanden.

## Lizenz und Haftungsausschluss

Der Code steht unter Apache License 2.0. Siehe [LICENSE](LICENSE) und
[NOTICE.md](NOTICE.md).

Dieses Tool wird ohne Gewaehrleistung bereitgestellt. Nutzung erfolgt auf
eigenes Risiko und ausschliesslich als lokale, strukturelle Vorpruefung.

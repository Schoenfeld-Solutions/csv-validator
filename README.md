# DATEV CSV Validator

DATEV CSV Validator is a lightweight static GitHub Pages tool for local
structural validation of DATEV CSV files. Files are processed only in the
browser. There is no server upload, telemetry, analytics, or tracking.

This project is an independent open-source tool. It is not affiliated with or
authorized by DATEV eG, and it does not replace DATEV product documentation,
tax advice, accounting advice, or checks with official DATEV tools.

## Scope

The browser tool validates local `.csv` and `.txt` files against a versioned,
locally implemented DATEV CSV structural contract:

- CSV lexing with semicolon delimiter, double quote text qualifier, closed
  quotes, doubled quotes, and conservative control-character checks.
- Encoding detection with UTF-8 BOM as `utf-8-sig`, valid UTF-8 without a BOM
  as `utf-8`, and deterministic `windows-1252` fallback for non-UTF-8 files.
- DATEV header checks with marker `EXTF`, a narrow `DTVF` exception for
  `datev-debitor-kreditor-v5`, header version `700`, category, format name,
  and format version.
- Caption row checks for field count and field order according to the local
  contract.
- Data row checks for field count, required fields, types `Text`, `Konto`,
  `Zahl`, `Betrag`, `Datum`, maximum length, decimal places, and `TTMM` and
  `TTMMJJJJ` date bounds.
- Narrow observed runtime rules for payment terms percent fields,
  non-negative `Skonto`/`Basis-Umsatz` amounts, and selected booking batch
  optional full-date fields.
- Browser-side fail-closed rejection for files larger than the documented
  10 MiB processing limit.
- Browser-side fail-closed rejection for primary CSV/TXT validation files
  without `.csv` or `.txt` file names before parsing.
- Structured local report sections and JSON/HTML report export only after
  explicit user action.
- An optional local data preview for the first parsed rows after explicit user
  approval. Preview values are not exported.
- An advanced local project contract XML mode that lets users load
  session-local project contract XML files in the browser worker and explicitly
  validate CSV/TXT files against built-in, uploaded-only, mixed built-in plus
  uploaded, or edited session-local contract sources. Mixed mode uses uploaded
  matching signatures first and shows an override warning when uploaded project
  contract XML files replace built-in structural facts for the current session. Edited
  session-local contracts are cloned from the active local source, never mutate
  built-in defaults, and are discarded with the browser session. Project
  contract XML uploads must use `.xml` file names. Parsing accepts a single safe leading XML
  declaration and rejects DOCTYPE declarations, entities, external references,
  and arbitrary processing instructions before interpretation. The constrained
  parser also enforces document, node, depth, text, and attribute limits.

The status `valid` means only:

> Valid against the implemented local structural DATEV CSV contract.

It does not mean that a DATEV application will accept the file.

## Supported Recognition Codes

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

## Out Of Scope

This project does not implement server uploads, storage, account or login
features, official DATEV tool execution, DATEV check-program automation,
generic CalculationRule engines, AdditionalValidationRules, cross-record or
cross-field booking logic, unrestricted XML rule execution, persistence of
uploaded or edited session-local contracts, Business Central imports, or
guarantees that official DATEV tools will make the same decision.

## Development

Requirements:

- Node.js `26.5.0` or another compatible Node 26 release matching
  `>=26.0.0 <27`
- npm `11.9.0` or compatible with `>=11`

Local commands:

```bash
npm ci
npm run dev -- --host 127.0.0.1 --port 4321
npm run preflight
```

Canonical npm commands invoke Astro through the project wrapper with
`ASTRO_TELEMETRY_DISABLED=1`. The deployed site has no telemetry, analytics, or
tracking; direct ad-hoc Astro CLI use outside the project scripts follows the
developer's local Astro preference.

Local pages:

- `http://127.0.0.1:4321/csv-validator/` automatic language detection and redirect
- `http://127.0.0.1:4321/csv-validator/de/` German validator
- `http://127.0.0.1:4321/csv-validator/en/` English validator

`npm run preflight` is the canonical local gate. It runs the full lockfile
audit at severity `low`, governance checks, formatting checks, linting, type
checks, unit tests with coverage, production build, public copy checks,
Playwright smoke tests, and the Lighthouse gate.

## Deployment

GitHub Pages publishes the static Astro site at:

`https://schoenfeld-solutions.github.io/csv-validator/`

The root page detects the preferred browser language client-side and redirects
to `/de/` or `/en/`. Non-German browser languages fall back to English. The
site is configured for a static build. There is no API and no server-side
processing of DATEV files.

## Privacy And Security

- Files remain in the browser.
- No upload takes place.
- Results remain local in the browser until users copy JSON or download JSON
  and HTML reports.
- HTML reports are generated locally from metadata and diagnostics only.
- Reports may include a SHA-256 content fingerprint after the browser worker
  reads a file. The hash is not a raw data value, but it can identify the exact
  file if the report is shared.
- Uploaded project contract XML files are parsed locally in the browser worker,
  kept only for the current session, and never uploaded or stored by the site.
- Project contract XML files are interpreted only as a constrained local
  structural contract subset; raw XML is not rendered, exported, or persisted.
  Files without a `.xml` name are rejected before parsing. Parser resource
  limits fail closed before any contract source is activated.
- Primary CSV/TXT validation files without `.csv` or `.txt` names are rejected
  before parsing.
- Edited session-local contract copies are derived and applied only in browser
  memory. Built-in contract data is not modified.
- Contract-source labels, counts, and override warnings are local UI/report
  metadata and do not add raw XML or CSV/TXT values to JSON or HTML reports.
- File contents are not displayed as raw data in the UI by default.
- The optional data preview is disabled by default, stays in the browser, and
  is not included in JSON or HTML reports.
- File names are displayed as browser-provided base names, never as local
  paths.
- The UI does not render DATEV file contents through `innerHTML`.
- Telemetry, analytics, and tracking are not present.

## License And Disclaimer

The code is licensed under the Apache License 2.0. See [LICENSE](LICENSE) and
[NOTICE.md](NOTICE.md).

This tool is provided without warranty. Use it at your own risk and only as a
local structural pre-check.

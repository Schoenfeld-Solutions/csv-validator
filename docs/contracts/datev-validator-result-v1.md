# DATEV Validator Result Schema v1

The browser tool creates a stable JSON result with `schemaVersion: 1`. The
report contains only metadata, status, and diagnostics. Raw values from the
DATEV file are not emitted by default.

The browser UI may derive a local HTML validation report from this JSON result.
That HTML report is a user-facing rendering artifact, not a replacement for
the machine-readable result schema below. It must not include raw CSV/TXT data
values.

The browser worker may also use a session-local uploaded DATEV format XML
contract source, either uploaded-only or mixed with built-in contracts. It may
also use a session-local edited contract clone derived from the active local
source. Edited contracts are browser-session state, do not mutate built-in
defaults, and are discarded when the session ends. Contract-source labels,
counts, and override warnings are UI/report metadata and are intentionally
outside this stable JSON result schema.

The browser worker may also return a session-local data preview payload for
the current UI session. That preview is intentionally outside this JSON result
schema and outside generated reports because it can contain raw CSV/TXT values.
The UI may render it only after explicit user approval.

```ts
type DatevValidatorResult = {
  schemaVersion: 1;
  status: "valid" | "invalid" | "unsupported";
  source: {
    name: string;
    sizeBytes: number;
    processedInBrowser: true;
  };
  format?: {
    recognitionCode: string;
    marker: "EXTF" | "DTVF";
    category: string;
    name: string;
    version: string;
    dataKind: string;
  };
  csv: {
    encoding: "utf-8-sig" | "utf-8" | "windows-1252" | "unknown";
    delimiter: ";";
    quote: '"';
    physicalLineCount: number;
    dataRecordCount: number;
    fieldCount?: number;
  };
  summary: {
    errorCount: number;
    warningCount: number;
  };
  diagnostics: Array<{
    severity: "error" | "warning";
    code: string;
    message: string;
    line?: number;
    column?: number;
    fieldIndex?: number;
    fieldName?: string;
  }>;
};
```

`valid` means only: valid against the implemented local DATEV CSV structural
contract. It is not a promise that DATEV products will accept the file.

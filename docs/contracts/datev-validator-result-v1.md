# DATEV Validator Result Schema v1

The browser tool creates a stable JSON result with `schemaVersion: 1`. The
report contains only metadata, status, and diagnostics. Raw values from the
DATEV file are not emitted by default.

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
    encoding: "utf-8-sig" | "windows-1252" | "unknown";
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

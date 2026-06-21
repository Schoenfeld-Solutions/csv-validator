# DATEV Validator Result Schema v1

Das Browser-Tool erzeugt ein stabiles JSON-Ergebnis mit `schemaVersion: 1`.
Der Report enthaelt nur Metadaten, Status und Diagnostics. Rohwerte aus der
DATEV-Datei werden standardmaessig nicht ausgegeben.

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

`valid` bedeutet nur: gueltig gegen den implementierten lokalen DATEV-CSV-
Strukturvertrag. Es ist keine Zusage, dass DATEV-Produkte die Datei
akzeptieren.

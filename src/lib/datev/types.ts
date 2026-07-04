export type DatevMarker = "EXTF" | "DTVF";
export type DatevLiteStatus = "valid" | "invalid" | "unsupported";
export type DiagnosticSeverity = "error" | "warning";
export type CsvEncoding = "utf-8-sig" | "utf-8" | "windows-1252" | "unknown";
export type DatevFormatType = "Text" | "Konto" | "Zahl" | "Betrag" | "Datum";

export type DatevRecognitionCode =
  | "datev-booking-batch-v13"
  | "datev-booking-batch-v12"
  | "datev-booking-batch-v11"
  | "datev-booking-batch-v10"
  | "datev-recurring-bookings-v4"
  | "datev-recurring-bookings-v3"
  | "datev-debitor-kreditor-v5"
  | "datev-gl-account-description-v3"
  | "datev-payment-terms-v2"
  | "datev-various-addresses-v2"
  | "datev-natural-stack-v2"
  | "datev-text-key-v2";

export interface DatevLiteRecognitionContract {
  readonly recognitionCode: string;
  readonly formatCategory: string;
  readonly formatName: string;
  readonly formatVersion: string;
  readonly allowedDatevMarkers: readonly DatevMarker[];
  readonly requiredCaptions: readonly string[];
  readonly dataKind: string;
}

export interface DatevLiteFieldContract {
  readonly fieldNumber: number;
  readonly caption: string;
}

export interface DatevLiteFieldRuleContract {
  readonly fieldNumber: number;
  readonly formatType: DatevFormatType;
  readonly maxLength: number;
  readonly decimalPlaces: number;
  readonly necessary: boolean;
  readonly formatExpression: "" | "TTMM" | "TTMMJJJJ";
}

export interface DatevLiteContract {
  readonly schemaVersion: 1;
  readonly recognitions: readonly DatevLiteRecognitionContract[];
  readonly fieldsByCode: Readonly<
    Record<DatevRecognitionCode, readonly DatevLiteFieldContract[]>
  >;
  readonly rulesByCode: Readonly<
    Record<DatevRecognitionCode, readonly DatevLiteFieldRuleContract[]>
  >;
}

export type DatevContractSourceKind =
  "built-in" | "uploaded" | "edited-session";

export interface DatevContractSourceSummary {
  readonly kind: DatevContractSourceKind;
  readonly label: string;
  readonly contractCount: number;
  readonly overrideCount: number;
  readonly warningCount: number;
}

export interface DatevContractRepository {
  readonly summary: DatevContractSourceSummary;
  listRecognitions(): readonly DatevLiteRecognitionContract[];
  findRecognitionBySignature(
    category: string,
    name: string,
    version: string
  ): DatevLiteRecognitionContract | undefined;
  getFields(
    recognitionCode: string
  ): readonly DatevLiteFieldContract[] | undefined;
  getRules(
    recognitionCode: string
  ): readonly DatevLiteFieldRuleContract[] | undefined;
}

export interface DatevLiteDiagnostic {
  readonly severity: DiagnosticSeverity;
  readonly code: string;
  readonly message: string;
  readonly line?: number;
  readonly column?: number;
  readonly fieldIndex?: number;
  readonly fieldName?: string;
}

export interface DatevLiteValidationResult {
  readonly schemaVersion: 1;
  readonly status: DatevLiteStatus;
  readonly source: {
    readonly name: string;
    readonly sizeBytes: number;
    readonly processedInBrowser: true;
  };
  readonly format?: {
    readonly recognitionCode: string;
    readonly marker: DatevMarker;
    readonly category: string;
    readonly name: string;
    readonly version: string;
    readonly dataKind: string;
  };
  readonly csv: {
    readonly encoding: CsvEncoding;
    readonly delimiter: ";";
    readonly quote: '"';
    readonly physicalLineCount: number;
    readonly dataRecordCount: number;
    readonly fieldCount?: number;
  };
  readonly summary: {
    readonly errorCount: number;
    readonly warningCount: number;
  };
  readonly diagnostics: readonly DatevLiteDiagnostic[];
}

export interface ParsedCsvField {
  readonly value: string;
  readonly quoted: boolean;
  readonly line: number;
  readonly column: number;
}

export interface ParsedCsv {
  readonly rows: readonly (readonly ParsedCsvField[])[];
  readonly physicalLineCount: number;
  readonly diagnostics: readonly DatevLiteDiagnostic[];
}

export type DatevDataPreviewUnavailableReason =
  "csv-lexing-failed" | "no-caption-row" | "no-data-rows";

export interface DatevPreviewCell {
  readonly value: string;
  readonly line: number;
  readonly column: number;
}

export interface DatevPreviewRow {
  readonly line: number;
  readonly fieldCount: number;
  readonly cells: readonly DatevPreviewCell[];
}

export interface DatevDataPreview {
  readonly available: boolean;
  readonly reason?: DatevDataPreviewUnavailableReason;
  readonly rowLimit: 50;
  readonly totalDataRows: number;
  readonly shownDataRows: number;
  readonly truncated: boolean;
  readonly captionLine?: number;
  readonly captions: readonly DatevPreviewCell[];
  readonly rows: readonly DatevPreviewRow[];
}

export interface WorkerValidationRequest {
  readonly type: "validate";
  readonly file: File;
}

export type WorkerValidationResponse =
  | {
      readonly type: "progress";
      readonly message: string;
    }
  | {
      readonly type: "result";
      readonly result: DatevLiteValidationResult;
      readonly preview?: DatevDataPreview;
    };

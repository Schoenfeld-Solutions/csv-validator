export type DatevMarker = "EXTF" | "DTVF";
export type DatevValidationStatus = "valid" | "invalid" | "unsupported";
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

export interface DatevRecognitionContract {
  readonly recognitionCode: string;
  readonly formatCategory: string;
  readonly formatName: string;
  readonly formatVersion: string;
  readonly allowedDatevMarkers: readonly DatevMarker[];
  readonly requiredCaptions: readonly string[];
  readonly dataKind: string;
}

export interface DatevFieldContract {
  readonly fieldNumber: number;
  readonly caption: string;
}

export interface DatevFieldRuleContract {
  readonly fieldNumber: number;
  readonly formatType: DatevFormatType;
  readonly maxLength: number;
  readonly decimalPlaces: number;
  readonly necessary: boolean;
  readonly formatExpression: "" | "TTMM" | "TTMMJJJJ";
}

export interface DatevEditableFieldContractDraft {
  readonly fieldNumber: number;
  readonly caption: string;
  readonly formatType: DatevFormatType;
  readonly maxLength: number;
  readonly decimalPlaces: number;
  readonly necessary: boolean;
  readonly formatExpression: "" | "TTMM" | "TTMMJJJJ";
}

export interface DatevEditableContractDraft {
  readonly recognition: DatevRecognitionContract;
  readonly fields: readonly DatevEditableFieldContractDraft[];
}

export interface DatevStructuralContract {
  readonly schemaVersion: 1;
  readonly recognitions: readonly DatevRecognitionContract[];
  readonly fieldsByCode: Readonly<
    Record<DatevRecognitionCode, readonly DatevFieldContract[]>
  >;
  readonly rulesByCode: Readonly<
    Record<DatevRecognitionCode, readonly DatevFieldRuleContract[]>
  >;
}

export type DatevContractSourceKind =
  "built-in" | "uploaded" | "mixed" | "edited-session";

export interface DatevContractSourceSummary {
  readonly kind: DatevContractSourceKind;
  readonly label: string;
  readonly contractCount: number;
  readonly overrideCount: number;
  readonly warningCount: number;
}

export interface DatevContractRepository {
  readonly summary: DatevContractSourceSummary;
  listRecognitions(): readonly DatevRecognitionContract[];
  findRecognitionBySignature(
    category: string,
    name: string,
    version: string
  ): DatevRecognitionContract | undefined;
  getFields(recognitionCode: string): readonly DatevFieldContract[] | undefined;
  getRules(
    recognitionCode: string
  ): readonly DatevFieldRuleContract[] | undefined;
}

export interface DatevDiagnostic {
  readonly severity: DiagnosticSeverity;
  readonly code: string;
  readonly message: string;
  readonly line?: number;
  readonly column?: number;
  readonly fieldIndex?: number;
  readonly fieldName?: string;
}

export interface DatevValidationResult {
  readonly schemaVersion: 1;
  readonly status: DatevValidationStatus;
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
  readonly diagnostics: readonly DatevDiagnostic[];
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
  readonly diagnostics: readonly DatevDiagnostic[];
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

export type DatevActiveContractSourceKind =
  "built-in" | "uploaded" | "mixed" | "edited-session";

export type WorkerValidationRequest =
  | {
      readonly type: "validate";
      readonly file: File;
      readonly contractSource?: DatevActiveContractSourceKind;
    }
  | {
      readonly type: "load-contracts";
      readonly files: readonly File[];
    }
  | {
      readonly type: "create-editable-contract";
      readonly recognitionCode: string;
      readonly contractSource?: DatevActiveContractSourceKind;
    }
  | {
      readonly type: "save-editable-contract";
      readonly draft: DatevEditableContractDraft;
    }
  | {
      readonly type: "discard-editable-contract";
    };

export interface WorkerContractLoadResponse {
  readonly type: "contracts";
  readonly summary?: DatevContractSourceSummary;
  readonly mixedSummary?: DatevContractSourceSummary;
  readonly diagnostics: readonly DatevDiagnostic[];
}

export interface WorkerResultResponse {
  readonly type: "result";
  readonly result: DatevValidationResult;
  readonly preview?: DatevDataPreview;
  readonly contractSource?: DatevContractSourceSummary;
}

export interface WorkerEditableContractResponse {
  readonly type: "editable-contract";
  readonly draft?: DatevEditableContractDraft;
  readonly summary?: DatevContractSourceSummary;
  readonly diagnostics: readonly DatevDiagnostic[];
}

export type WorkerProgressCode =
  | "read-xml-contracts"
  | "build-xml-contract-source"
  | "read-file"
  | "decode-text"
  | "validate-structure";

export type WorkerValidationResponse =
  | {
      readonly type: "progress";
      readonly code: WorkerProgressCode;
    }
  | WorkerContractLoadResponse
  | WorkerEditableContractResponse
  | WorkerResultResponse;

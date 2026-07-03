import type {
  DatevLiteDiagnostic,
  DatevLiteStatus,
  DatevLiteValidationResult,
} from "./types";

export type ValidationReportSectionId =
  | "summary"
  | "source"
  | "privacy"
  | "contract"
  | "recognition"
  | "encodingCsv"
  | "header"
  | "captions"
  | "dataRows"
  | "fieldSemantics"
  | "unsupported"
  | "disclaimer";

export type ValidationReportSectionStatus =
  "passed" | "warning" | "failed" | "not-run";

export type ValidationReportActionId =
  "ready" | "reviewWarnings" | "fixErrors" | "unsupportedFormat";

export type ValidationReportRemediationCategory =
  | "fix-source"
  | "fix-encoding-or-csv"
  | "fix-header"
  | "fix-captions"
  | "fix-data-rows"
  | "fix-field-value"
  | "unsupported-format"
  | "review-warning";

export interface ValidationReportDiagnostic extends DatevLiteDiagnostic {
  readonly remediationCategory: ValidationReportRemediationCategory;
  readonly section: ValidationReportSectionId;
}

export interface ValidationReportSection {
  readonly id: ValidationReportSectionId;
  readonly status: ValidationReportSectionStatus;
  readonly errorCount: number;
  readonly warningCount: number;
  readonly diagnostics: readonly ValidationReportDiagnostic[];
}

export interface DatevValidationReport {
  readonly schemaVersion: 1;
  readonly generatedAt: string;
  readonly status: DatevLiteStatus;
  readonly contractSource: "built-in" | "none";
  readonly source: DatevLiteValidationResult["source"];
  readonly format: DatevLiteValidationResult["format"];
  readonly csv: DatevLiteValidationResult["csv"];
  readonly summary: DatevLiteValidationResult["summary"];
  readonly recommendedActions: readonly ValidationReportActionId[];
  readonly sections: readonly ValidationReportSection[];
}

export const reportSectionOrder: readonly ValidationReportSectionId[] = [
  "summary",
  "source",
  "privacy",
  "contract",
  "recognition",
  "encodingCsv",
  "header",
  "captions",
  "dataRows",
  "fieldSemantics",
  "unsupported",
  "disclaimer",
];

export const buildValidationReport = (
  result: DatevLiteValidationResult,
  generatedAt = new Date().toISOString()
): DatevValidationReport => {
  const diagnostics = result.diagnostics.map(toReportDiagnostic);
  return {
    contractSource: result.format ? "built-in" : "none",
    csv: result.csv,
    format: result.format,
    generatedAt,
    recommendedActions: getRecommendedActions(result),
    schemaVersion: 1,
    sections: reportSectionOrder.map((sectionId) =>
      buildSection(sectionId, result, diagnostics)
    ),
    source: result.source,
    status: result.status,
    summary: result.summary,
  };
};

export const toReportDiagnostic = (
  diagnostic: DatevLiteDiagnostic
): ValidationReportDiagnostic => {
  const section = getDiagnosticSection(diagnostic.code);
  return {
    ...diagnostic,
    remediationCategory: getRemediationCategory(diagnostic, section),
    section,
  };
};

const buildSection = (
  id: ValidationReportSectionId,
  result: DatevLiteValidationResult,
  diagnostics: readonly ValidationReportDiagnostic[]
): ValidationReportSection => {
  const sectionDiagnostics = diagnostics.filter(
    (diagnostic) => diagnostic.section === id
  );
  const errorCount = sectionDiagnostics.filter(
    (diagnostic) => diagnostic.severity === "error"
  ).length;
  const warningCount = sectionDiagnostics.filter(
    (diagnostic) => diagnostic.severity === "warning"
  ).length;
  return {
    diagnostics: sectionDiagnostics,
    errorCount,
    id,
    status: getSectionStatus(id, result, errorCount, warningCount),
    warningCount,
  };
};

const getSectionStatus = (
  id: ValidationReportSectionId,
  result: DatevLiteValidationResult,
  errorCount: number,
  warningCount: number
): ValidationReportSectionStatus => {
  if (
    result.status === "unsupported" &&
    ["captions", "dataRows", "fieldSemantics"].includes(id)
  ) {
    return "not-run";
  }
  if (result.status === "unsupported" && id === "recognition") {
    return "failed";
  }
  if (id === "unsupported") {
    return result.status === "unsupported" ? "failed" : "passed";
  }
  if (errorCount > 0) return "failed";
  if (warningCount > 0) return "warning";
  return "passed";
};

const getRecommendedActions = (
  result: DatevLiteValidationResult
): readonly ValidationReportActionId[] => {
  if (result.status === "unsupported") return ["unsupportedFormat"];
  if (result.summary.errorCount > 0) return ["fixErrors"];
  if (result.summary.warningCount > 0) return ["reviewWarnings"];
  return ["ready"];
};

const getDiagnosticSection = (code: string): ValidationReportSectionId => {
  if (code.startsWith("FILE_")) return "source";
  if (code.startsWith("ENCODING_") || code.startsWith("CSV_")) {
    return "encodingCsv";
  }
  if (code === "FORMAT_UNSUPPORTED") return "recognition";
  if (code.startsWith("HEADER_")) return "header";
  if (code.startsWith("CAPTION_")) return "captions";
  if (code.startsWith("DATA_")) return "dataRows";
  if (code.startsWith("FIELD_") || code.startsWith("TEXT_")) {
    return "fieldSemantics";
  }
  return "unsupported";
};

const getRemediationCategory = (
  diagnostic: DatevLiteDiagnostic,
  section: ValidationReportSectionId
): ValidationReportRemediationCategory => {
  if (diagnostic.severity === "warning") return "review-warning";
  switch (section) {
    case "source":
      return "fix-source";
    case "encodingCsv":
      return "fix-encoding-or-csv";
    case "recognition":
      return "unsupported-format";
    case "header":
      return "fix-header";
    case "captions":
      return "fix-captions";
    case "dataRows":
      return "fix-data-rows";
    case "fieldSemantics":
      return "fix-field-value";
    case "summary":
    case "privacy":
    case "contract":
    case "unsupported":
    case "disclaimer":
      return "unsupported-format";
  }
};

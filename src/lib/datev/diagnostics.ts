import type { DatevDiagnostic, DiagnosticSeverity } from "./types";

export const diagnostic = (
  severity: DiagnosticSeverity,
  code: string,
  message: string,
  details: Omit<DatevDiagnostic, "severity" | "code" | "message"> = {}
): DatevDiagnostic => ({
  severity,
  code,
  message,
  ...details,
});

export const summarizeDiagnostics = (
  diagnostics: readonly DatevDiagnostic[]
): { errorCount: number; warningCount: number } => ({
  errorCount: diagnostics.filter((item) => item.severity === "error").length,
  warningCount: diagnostics.filter((item) => item.severity === "warning")
    .length,
});

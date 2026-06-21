import type { DatevLiteDiagnostic, DiagnosticSeverity } from "./types";

export const diagnostic = (
  severity: DiagnosticSeverity,
  code: string,
  message: string,
  details: Omit<DatevLiteDiagnostic, "severity" | "code" | "message"> = {}
): DatevLiteDiagnostic => ({
  severity,
  code,
  message,
  ...details,
});

export const summarizeDiagnostics = (
  diagnostics: readonly DatevLiteDiagnostic[]
): { errorCount: number; warningCount: number } => ({
  errorCount: diagnostics.filter((item) => item.severity === "error").length,
  warningCount: diagnostics.filter((item) => item.severity === "warning")
    .length,
});

import { describe, expect, it } from "vitest";

import { buildValidationReport } from "../../src/lib/datev/report";
import { validateDatevContent } from "../../src/lib/datev/validator";
import {
  bookingBatchHeaderLine,
  bookingBatchRow,
  contractCaptionLine,
  csvLine,
  headerLine,
  validGlAccountDescriptionCsv,
} from "./datev-test-fixtures";

const validate = (content: string) =>
  validateDatevContent({
    content,
    encoding: "utf-8-sig",
    sizeBytes: content.length,
    sourceName: "/private/path/example.csv",
  });

const sectionById = (
  report: ReturnType<typeof buildValidationReport>,
  id: string
) => report.sections.find((section) => section.id === id);

describe("buildValidationReport", () => {
  it("builds a structured safe report from a valid result with warnings", () => {
    const result = validate(validGlAccountDescriptionCsv());
    const report = buildValidationReport(result, "2026-07-03T12:00:00.000Z");

    expect(report.schemaVersion).toBe(1);
    expect(report.generatedAt).toBe("2026-07-03T12:00:00.000Z");
    expect(report.contractSource).toBe("built-in");
    expect(report.recommendedActions).toEqual(["reviewWarnings"]);
    expect(sectionById(report, "fieldSemantics")).toMatchObject({
      status: "warning",
      warningCount: 3,
    });
    expect(JSON.stringify(report)).not.toContain("Kasse lang");
    expect(JSON.stringify(report)).not.toContain("/private/path");
  });

  it("creates a full unsupported report with checks-not-run sections", () => {
    const result = validate(
      [
        headerLine({ 2: "999", 3: "Unsupported", 4: "1" }),
        csvLine(["A", "B"]),
        csvLine(["1", "2"]),
      ].join("\r\n")
    );
    const report = buildValidationReport(result, "2026-07-03T12:00:00.000Z");

    expect(result.status).toBe("unsupported");
    expect(report.contractSource).toBe("none");
    expect(report.recommendedActions).toEqual(["unsupportedFormat"]);
    expect(sectionById(report, "recognition")).toMatchObject({
      status: "failed",
      warningCount: 1,
    });
    expect(sectionById(report, "captions")).toMatchObject({
      status: "not-run",
    });
    expect(sectionById(report, "fieldSemantics")).toMatchObject({
      status: "not-run",
    });
  });

  it("assigns invalid field diagnostics to actionable report categories", () => {
    const result = validate(
      [
        bookingBatchHeaderLine(),
        contractCaptionLine("datev-booking-batch-v13"),
        bookingBatchRow({ 6: "1000A" }),
      ].join("\r\n")
    );
    const report = buildValidationReport(result, "2026-07-03T12:00:00.000Z");
    const fieldSection = sectionById(report, "fieldSemantics");

    expect(result.status).toBe("invalid");
    expect(report.recommendedActions).toEqual(["fixErrors"]);
    expect(fieldSection).toMatchObject({
      errorCount: 1,
      status: "failed",
    });
    expect(
      fieldSection?.diagnostics.find(
        (diagnostic) => diagnostic.code === "FIELD_ACCOUNT_DIGITS"
      )
    ).toMatchObject({
      code: "FIELD_ACCOUNT_DIGITS",
      remediationCategory: "fix-field-value",
      section: "fieldSemantics",
    });
  });
});

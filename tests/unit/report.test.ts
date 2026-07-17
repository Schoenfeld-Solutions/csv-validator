import { describe, expect, it } from "vitest";

import {
  buildValidationReport,
  reportSectionOrder,
  toReportDiagnostic,
} from "../../src/lib/datev/report";
import { validateDatevContent } from "../../src/lib/datev/validator";
import {
  bookingBatchHeaderLine,
  bookingBatchRow,
  contractCaptionLine,
  csvLine,
  headerLine,
  validGlAccountDescriptionCsv,
} from "./datev-test-fixtures";
import type { DatevValidationResult } from "../../src/lib/datev/types";

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
  it("keeps deterministic sections and ready action for clean valid results", () => {
    const result = {
      csv: {
        dataRecordCount: 1,
        delimiter: ";",
        encoding: "utf-8-sig",
        fieldCount: 4,
        physicalLineCount: 3,
        quote: '"',
      },
      diagnostics: [],
      format: {
        category: "20",
        dataKind: "master",
        marker: "EXTF",
        name: "Kontenbeschriftungen",
        recognitionCode: "datev-gl-account-description-v3",
        version: "3",
      },
      schemaVersion: 1,
      source: {
        name: "clean.csv",
        processedInBrowser: true,
        sizeBytes: 128,
      },
      status: "valid",
      summary: {
        errorCount: 0,
        warningCount: 0,
      },
    } satisfies DatevValidationResult;
    const report = buildValidationReport(result, "2026-07-03T12:00:00.000Z");

    expect(report.recommendedActions).toEqual(["ready"]);
    expect(report.sections.map((section) => section.id)).toEqual(
      reportSectionOrder
    );
  });

  it("maps diagnostic code families to deterministic report sections and remediation", () => {
    const cases = [
      ["FILE_TOO_LARGE", "error", "source", "fix-source"],
      ["ENCODING_UNSUPPORTED", "error", "encodingCsv", "fix-encoding-or-csv"],
      ["CSV_UNCLOSED_QUOTE", "error", "encodingCsv", "fix-encoding-or-csv"],
      ["FORMAT_UNSUPPORTED", "warning", "recognition", "review-warning"],
      ["HEADER_MARKER", "error", "header", "fix-header"],
      ["CAPTION_FIELD_COUNT", "error", "captions", "fix-captions"],
      ["DATA_FIELD_COUNT", "error", "dataRows", "fix-data-rows"],
      ["FIELD_REQUIRED", "error", "fieldSemantics", "fix-field-value"],
      ["TEXT_QUOTE_UNESCAPED", "warning", "fieldSemantics", "review-warning"],
      [
        "XML_CONTRACT_ROOT_UNSUPPORTED",
        "error",
        "contract",
        "unsupported-format",
      ],
      ["CONTRACT_SOURCE_OVERRIDE", "warning", "contract", "review-warning"],
      [
        "EDIT_CONTRACT_FIELD_MISSING",
        "error",
        "contract",
        "unsupported-format",
      ],
      [
        "SYNTHETIC_UNKNOWN_DIAGNOSTIC",
        "error",
        "unsupported",
        "unsupported-format",
      ],
    ] as const;

    for (const [
      code,
      severity,
      expectedSection,
      expectedRemediationCategory,
    ] of cases) {
      expect(
        toReportDiagnostic({
          code,
          message: `Synthetic diagnostic for ${code}.`,
          severity,
        })
      ).toMatchObject({
        code,
        remediationCategory: expectedRemediationCategory,
        section: expectedSection,
      });
    }
  });

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

  it("keeps uploaded contract source metadata and groups XML diagnostics", () => {
    const result = {
      ...validate(validGlAccountDescriptionCsv()),
      diagnostics: [
        {
          code: "XML_CONTRACT_FILE_TOO_LARGE",
          message: "A local project contract XML file exceeds the limit.",
          severity: "error",
        },
      ],
      status: "invalid",
      summary: {
        errorCount: 1,
        warningCount: 0,
      },
    } satisfies DatevValidationResult;
    const report = buildValidationReport(result, "2026-07-03T12:00:00.000Z", {
      contractCount: 1,
      kind: "uploaded",
      label: "Uploaded project contract XML",
      overrideCount: 0,
      warningCount: 0,
    });

    expect(report.contractSource).toBe("uploaded");
    expect(report.contractSourceSummary).toMatchObject({
      contractCount: 1,
      kind: "uploaded",
    });
    expect(sectionById(report, "contract")).toMatchObject({
      errorCount: 1,
      status: "failed",
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

  it("routes unknown diagnostic codes to a failed unsupported review bucket", () => {
    const validResult = validate(validGlAccountDescriptionCsv());
    const result = {
      ...validResult,
      diagnostics: [
        ...validResult.diagnostics,
        {
          code: "SYNTHETIC_UNKNOWN_DIAGNOSTIC",
          message: "Synthetic unknown diagnostic for report bucket coverage.",
          severity: "error",
        },
      ],
      status: "invalid",
      summary: {
        errorCount: validResult.summary.errorCount + 1,
        warningCount: validResult.summary.warningCount,
      },
    } satisfies DatevValidationResult;

    const report = buildValidationReport(result, "2026-07-03T12:00:00.000Z");
    const unsupportedSection = sectionById(report, "unsupported");

    expect(report.recommendedActions).toEqual(["fixErrors"]);
    expect(unsupportedSection).toMatchObject({
      errorCount: 1,
      status: "failed",
      warningCount: 0,
    });
    expect(unsupportedSection?.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "SYNTHETIC_UNKNOWN_DIAGNOSTIC",
        remediationCategory: "unsupported-format",
        section: "unsupported",
      })
    );
  });
});

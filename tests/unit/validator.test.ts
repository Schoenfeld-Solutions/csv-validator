import { describe, expect, it } from "vitest";

import { getFields } from "../../src/lib/datev/contracts";
import { diagnostic } from "../../src/lib/datev/diagnostics";
import { validateDatevContent } from "../../src/lib/datev/validator";
import {
  bookingBatchHeaderLine,
  bookingBatchRow,
  contractCaptionLine,
  csvLine,
  headerFor,
  headerLine,
  naturalStackHeaderLine,
  naturalStackRow,
  recurringBookingsHeaderLine,
  recurringBookingsRow,
  validGlAccountDescriptionCsv,
} from "./datev-test-fixtures";

const validate = (content: string) =>
  validateDatevContent({
    content,
    encoding: "utf-8-sig",
    sizeBytes: content.length,
    sourceName: "/private/path/example.csv",
  });

const diagnosticCodes = (content: string): string[] =>
  validate(content).diagnostics.map((item) => item.code);

describe("validateDatevContent", () => {
  it("returns valid for a minimal GL account description file", () => {
    const result = validate(validGlAccountDescriptionCsv());

    expect(result.status).toBe("valid");
    expect(result.source.name).toBe("example.csv");
    expect(result.format?.recognitionCode).toBe(
      "datev-gl-account-description-v3"
    );
    expect(result.csv.dataRecordCount).toBe(1);
    expect(result.summary.errorCount).toBe(0);
  });

  it("warns for non-empty unquoted text fields without leaking values", () => {
    const result = validate(validGlAccountDescriptionCsv());

    expect(result.summary.warningCount).toBeGreaterThan(0);
    expect(JSON.stringify(result.diagnostics)).not.toContain("Kasse lang");
  });

  it("rejects DTVF outside the narrow supported Debitoren/Kreditoren contract", () => {
    const result = validate(
      [
        headerLine({ 0: '"DTVF"' }),
        contractCaptionLine("datev-gl-account-description-v3"),
        csvLine(["1000", '"Kasse"', '"de"', '"Kasse lang"']),
      ].join("\r\n")
    );

    expect(result.status).toBe("invalid");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "HEADER_MARKER_NOT_ALLOWED" })
    );
  });

  it("recognizes the narrow DTVF Debitoren/Kreditoren allowance", () => {
    const fields = getFields("datev-debitor-kreditor-v5").map(() => "");
    fields[0] = "10000";
    fields[1] = "Example GmbH";
    const result = validate(
      [
        headerFor("16", "Debitoren/Kreditoren", "5", { 0: '"DTVF"' }),
        contractCaptionLine("datev-debitor-kreditor-v5"),
        csvLine(fields),
      ].join("\r\n")
    );

    expect(result.format?.marker).toBe("DTVF");
    expect(result.diagnostics).not.toContainEqual(
      expect.objectContaining({ code: "HEADER_MARKER_NOT_ALLOWED" })
    );
  });

  it("returns unsupported for a DATEV-shaped unsupported signature", () => {
    const result = validate(
      [
        headerLine({ 2: "999", 3: "Nicht unterstuetzt", 4: "1" }),
        "A;B",
        "1;2",
      ].join("\r\n")
    );

    expect(result.status).toBe("unsupported");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "FORMAT_UNSUPPORTED" })
    );
  });

  it("validates TTMM date bounds for booking batch field 10", () => {
    const result = validate(
      [
        bookingBatchHeaderLine(),
        contractCaptionLine("datev-booking-batch-v13"),
        bookingBatchRow({ 9: "3102" }),
      ].join("\r\n")
    );

    expect(result.status).toBe("invalid");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "FIELD_DATE_INVALID",
        fieldName: getFields("datev-booking-batch-v13")[9]?.caption,
      })
    );
  });

  it("returns header and caption diagnostics fail-closed", () => {
    const codes = diagnosticCodes(
      [
        headerLine({
          1: "600",
          10: "",
          11: "abc",
          12: "20240231",
          13: "9",
          14: "20240101",
          15: "20250101",
        }),
        csvLine(["Wrong", "Caption"]),
        csvLine(["1000"]),
      ].join("\r\n")
    );

    expect(codes).toEqual(
      expect.arrayContaining([
        "HEADER_VERSION_UNSUPPORTED",
        "HEADER_REQUIRED",
        "HEADER_NUMERIC",
        "HEADER_DATE_INVALID",
        "HEADER_ACCOUNT_LENGTH_RANGE",
        "HEADER_DATE_RANGE_YEAR",
        "CAPTION_FIELD_COUNT",
        "CAPTION_ANCHOR_MISSING",
        "CAPTION_ORDER",
        "DATA_FIELD_COUNT",
      ])
    );
  });

  it("rejects missing header, missing captions, malformed header count and empty data rows", () => {
    expect(validate("").diagnostics).toContainEqual(
      expect.objectContaining({ code: "HEADER_MISSING" })
    );
    expect(validate(headerLine()).diagnostics).toContainEqual(
      expect.objectContaining({ code: "CAPTIONS_MISSING" })
    );
    expect(validate('"EXTF";700').diagnostics).toContainEqual(
      expect.objectContaining({ code: "HEADER_FIELD_COUNT" })
    );
    expect(
      validate(
        [
          headerLine(),
          contractCaptionLine("datev-gl-account-description-v3"),
          ";;;",
        ].join("\r\n")
      ).diagnostics
    ).toContainEqual(expect.objectContaining({ code: "DATA_ROW_EMPTY" }));
  });

  it("rejects invalid marker, unquoted marker and invalid header primitives", () => {
    const invalidMarker = validate(
      [
        headerLine({ 0: "NOPE" }),
        contractCaptionLine("datev-gl-account-description-v3"),
      ].join("\r\n")
    );
    expect(invalidMarker.diagnostics).toContainEqual(
      expect.objectContaining({ code: "HEADER_MARKER_INVALID" })
    );

    const unquotedMarker = validate(
      [
        headerLine({}, false),
        contractCaptionLine("datev-gl-account-description-v3"),
      ].join("\r\n")
    );
    expect(unquotedMarker.diagnostics).toContainEqual(
      expect.objectContaining({ code: "HEADER_MARKER_UNQUOTED" })
    );

    const invalidDateSyntax = validate(
      [
        headerLine({ 12: "2024-01-01", 13: "abcd", 14: "2024010x" }),
        contractCaptionLine("datev-gl-account-description-v3"),
      ].join("\r\n")
    );
    expect(invalidDateSyntax.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining(["HEADER_DATE_YYYYMMDD", "HEADER_NUMERIC"])
    );
  });

  it("rejects numeric, amount, account and text field semantic violations", () => {
    const result = validate(
      [
        bookingBatchHeaderLine(),
        contractCaptionLine("datev-booking-batch-v13"),
        bookingBatchRow({
          0: "-",
          1: "SH",
          3: "-1",
          4: "12345678901,00",
          6: "1000A",
          7: "1234567890",
          14: "1,0",
          16: "1,2,3",
          17: "A",
          18: "123",
          38: "1,23456",
        }),
      ].join("\r\n")
    );

    expect(result.status).toBe("invalid");
    expect(result.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "FIELD_NUMBER_EMPTY",
        "FIELD_TEXT_MAX_LENGTH",
        "FIELD_NUMBER_SIGN",
        "FIELD_NUMBER_INTEGER_MAX_LENGTH",
        "FIELD_ACCOUNT_DIGITS",
        "FIELD_ACCOUNT_MAX_LENGTH",
        "FIELD_NUMBER_DECIMALS_NOT_ALLOWED",
        "FIELD_NUMBER_DECIMAL_COMMA",
        "FIELD_NUMBER_INTEGER_DIGITS",
        "FIELD_NUMBER_DECIMAL_PLACES",
      ])
    );
  });

  it("rejects decimal digit and date expression violations", () => {
    const bookingResult = validate(
      [
        bookingBatchHeaderLine(),
        contractCaptionLine("datev-booking-batch-v13"),
        bookingBatchRow({
          3: "1,A",
          9: "101",
          92: "2024010A",
        }),
      ].join("\r\n")
    );
    expect(bookingResult.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "FIELD_NUMBER_DECIMAL_DIGITS",
        "FIELD_DATE_TTMM",
        "FIELD_DATE_DIGITS",
      ])
    );

    const recurringResult = validate(
      [
        recurringBookingsHeaderLine(),
        contractCaptionLine("datev-recurring-bookings-v4"),
        recurringBookingsRow({ 11: "31022024" }),
        recurringBookingsRow({ 11: "0101202" }),
      ].join("\r\n")
    );
    expect(recurringResult.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining(["FIELD_DATE_INVALID", "FIELD_DATE_TTMMJJJJ"])
    );

    const naturalResult = validate(
      [
        naturalStackHeaderLine(),
        contractCaptionLine("datev-natural-stack-v2"),
        naturalStackRow({ 5: "123456789" }),
      ].join("\r\n")
    );
    expect(naturalResult.diagnostics).toContainEqual(
      expect.objectContaining({ code: "FIELD_DATE_MAX_LENGTH" })
    );
  });

  it("carries preflight diagnostics and keeps source names path-safe", () => {
    const result = validateDatevContent({
      content: validGlAccountDescriptionCsv(),
      encoding: "windows-1252",
      preflightDiagnostics: [
        diagnostic(
          "warning",
          "ENCODING_ASSUMED_WINDOWS_1252",
          "Assumed encoding."
        ),
      ],
      sizeBytes: 12,
      sourceName: "nested\\accounts.csv",
    });

    expect(result.source.name).toBe("accounts.csv");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "ENCODING_ASSUMED_WINDOWS_1252" })
    );
  });
});

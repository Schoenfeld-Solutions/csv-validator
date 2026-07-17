import { describe, expect, it } from "vitest";

import type { DatevRecognitionCode } from "../../src/lib/datev/types";
import { validateDatevContent } from "../../src/lib/datev/validator";
import { syntheticGoldenCsv } from "./datev-test-fixtures";

type GoldenPair = {
  readonly candidateFieldNumber: number;
  readonly expectedError: string;
  readonly invalidValue: string;
  readonly recognitionCode: DatevRecognitionCode;
};

const goldenPairs: readonly GoldenPair[] = [
  {
    candidateFieldNumber: 1,
    expectedError: "FIELD_REQUIRED",
    invalidValue: "",
    recognitionCode: "datev-booking-batch-v13",
  },
  {
    candidateFieldNumber: 1,
    expectedError: "FIELD_REQUIRED",
    invalidValue: "",
    recognitionCode: "datev-booking-batch-v12",
  },
  {
    candidateFieldNumber: 1,
    expectedError: "FIELD_REQUIRED",
    invalidValue: "",
    recognitionCode: "datev-booking-batch-v11",
  },
  {
    candidateFieldNumber: 1,
    expectedError: "FIELD_REQUIRED",
    invalidValue: "",
    recognitionCode: "datev-booking-batch-v10",
  },
  {
    candidateFieldNumber: 1,
    expectedError: "FIELD_NUMBER_INTEGER_DIGITS",
    invalidValue: "X",
    recognitionCode: "datev-recurring-bookings-v4",
  },
  {
    candidateFieldNumber: 1,
    expectedError: "FIELD_NUMBER_INTEGER_DIGITS",
    invalidValue: "X",
    recognitionCode: "datev-recurring-bookings-v3",
  },
  {
    candidateFieldNumber: 1,
    expectedError: "FIELD_REQUIRED",
    invalidValue: "",
    recognitionCode: "datev-debitor-kreditor-v5",
  },
  {
    candidateFieldNumber: 1,
    expectedError: "FIELD_REQUIRED",
    invalidValue: "",
    recognitionCode: "datev-gl-account-description-v3",
  },
  {
    candidateFieldNumber: 1,
    expectedError: "FIELD_REQUIRED",
    invalidValue: "",
    recognitionCode: "datev-payment-terms-v2",
  },
  {
    candidateFieldNumber: 2,
    expectedError: "FIELD_ACCOUNT_DIGITS",
    invalidValue: "X",
    recognitionCode: "datev-various-addresses-v2",
  },
  {
    candidateFieldNumber: 1,
    expectedError: "FIELD_NUMBER_INTEGER_DIGITS",
    invalidValue: "X",
    recognitionCode: "datev-natural-stack-v2",
  },
  {
    candidateFieldNumber: 1,
    expectedError: "FIELD_REQUIRED",
    invalidValue: "",
    recognitionCode: "datev-text-key-v2",
  },
];

const validate = (content: string, caseId: string) =>
  validateDatevContent({
    content,
    encoding: "utf-8-sig",
    sizeBytes: content.length,
    sourceName: `${caseId}.csv`,
  });

describe("12-format synthetic golden corpus", () => {
  it("pins exactly one pair for every built-in recognition code", () => {
    expect(goldenPairs).toHaveLength(12);
    expect(new Set(goldenPairs.map((item) => item.recognitionCode)).size).toBe(
      12
    );
  });

  it.each(goldenPairs)(
    "accepts the minimal valid $recognitionCode case",
    ({ candidateFieldNumber, recognitionCode }) => {
      const result = validate(
        syntheticGoldenCsv(recognitionCode, candidateFieldNumber),
        `${recognitionCode}-valid`
      );

      expect(result).toMatchObject({
        format: { recognitionCode },
        status: "valid",
        summary: { errorCount: 0, warningCount: 0 },
      });
      expect(result.diagnostics).toEqual([]);
    }
  );

  it.each(goldenPairs)(
    "rejects the pinned invalid $recognitionCode case",
    ({
      candidateFieldNumber,
      expectedError,
      invalidValue,
      recognitionCode,
    }) => {
      const result = validate(
        syntheticGoldenCsv(recognitionCode, candidateFieldNumber, invalidValue),
        `${recognitionCode}-invalid`
      );

      expect(result).toMatchObject({
        format: { recognitionCode },
        status: "invalid",
        summary: { errorCount: 1, warningCount: 0 },
      });
      expect(result.diagnostics).toEqual([
        expect.objectContaining({
          code: expectedError,
          fieldIndex: candidateFieldNumber,
          line: 3,
          severity: "error",
        }),
      ]);
    }
  );
});

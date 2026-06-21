import { describe, expect, it } from "vitest";

import { parseDatevCsvContent } from "../../src/lib/datev/csv";

describe("parseDatevCsvContent", () => {
  it("parses semicolon-delimited DATEV CSV rows with doubled quotes", () => {
    const parsed = parseDatevCsvContent('"EXTF";"A ""quoted"" value"\r\n1;2');

    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.physicalLineCount).toBe(2);
    expect(parsed.rows[0]?.[0]).toMatchObject({ quoted: true, value: "EXTF" });
    expect(parsed.rows[0]?.[1]).toMatchObject({
      quoted: true,
      value: 'A "quoted" value',
    });
  });

  it("fails closed on unclosed quotes", () => {
    const parsed = parseDatevCsvContent('"EXTF;700');

    expect(parsed.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "CSV_UNCLOSED_QUOTE",
        severity: "error",
      })
    );
  });

  it("fails closed on unsupported control characters", () => {
    const parsed = parseDatevCsvContent("a;\u0001");

    expect(parsed.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "CSV_CONTROL_CHARACTER",
        severity: "error",
      })
    );
  });
});

import { describe, expect, it } from "vitest";

import { validateDatevContent } from "../../src/lib/datev/validator";
import { syntheticSizedGlAccountDescriptionCsv } from "./datev-test-fixtures";

describe("synthetic performance fixture", () => {
  it.each([1_024, 64 * 1_024])(
    "creates a deterministic valid CSV no larger than %i bytes",
    (targetBytes) => {
      const fixture = syntheticSizedGlAccountDescriptionCsv(targetBytes);
      const repeated = syntheticSizedGlAccountDescriptionCsv(targetBytes);

      expect(repeated).toEqual(fixture);
      expect(fixture.sizeBytes).toBeLessThanOrEqual(targetBytes);
      expect(targetBytes - fixture.sizeBytes).toBeLessThan(128);

      const result = validateDatevContent({
        content: fixture.content,
        encoding: "utf-8",
        sizeBytes: fixture.sizeBytes,
        sourceName: "synthetic-performance.csv",
      });

      expect(result.status).toBe("valid");
      expect(result.summary).toEqual({ errorCount: 0, warningCount: 0 });
      expect(result.csv.dataRecordCount).toBe(fixture.dataRecordCount);
      expect(result.csv.physicalLineCount).toBe(fixture.dataRecordCount + 2);
      expect(result.source.sizeBytes).toBe(fixture.sizeBytes);
    }
  );
});

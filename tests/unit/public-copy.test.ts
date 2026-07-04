import { describe, expect, it } from "vitest";

import {
  assertNoLegacySourceIdentifiers,
  assertPublicCopy,
} from "../../scripts/check-public-copy.mjs";

describe("public copy checks", () => {
  it("accepts current project wording", () => {
    expect(() =>
      assertPublicCopy(
        "DATEV CSV Validator is a browser-only structural validator. It does not guarantee acceptance by DATEV products.",
        "sample.md"
      )
    ).not.toThrow();
  });

  it("rejects outdated MVP wording in public copy", () => {
    expect(() => assertPublicCopy("This is the MVP.", "sample.md")).toThrow(
      /outdated MVP wording/
    );
  });

  it("rejects legacy visible naming in public copy", () => {
    expect(() =>
      assertPublicCopy("DATEV CSV Validator Lite", "sample.md")
    ).toThrow(/legacy Lite naming/);
  });

  it("rejects official acceptance claims in public copy", () => {
    for (const claim of [
      "DATEV accepted",
      "DATEV-approved",
      "official DATEV validator",
      "guaranteed DATEV acceptance",
    ]) {
      expect(() => assertPublicCopy(claim, "sample.md")).toThrow(
        /official acceptance claim/
      );
    }
  });

  it("rejects legacy source identifiers in tracked source", () => {
    const legacyIdentifier = "Datev" + "Lite";

    expect(() =>
      assertNoLegacySourceIdentifiers(
        `const name = '${legacyIdentifier}';`,
        "sample.ts"
      )
    ).toThrow(/legacy validator name/);
  });
});

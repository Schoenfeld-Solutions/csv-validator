import { describe, expect, it } from "vitest";

import {
  assertNoLegacySourceIdentifiers,
  assertPublicCopy,
} from "../../scripts/check-public-copy.mjs";

describe("public copy checks", () => {
  it("accepts current project wording", () => {
    expect(() =>
      assertPublicCopy(
        "DATEV CSV Validator is a browser-only structural validator.",
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

  it("rejects legacy source identifiers in tracked source", () => {
    expect(() =>
      assertNoLegacySourceIdentifiers("const name = 'DatevLite';", "sample.ts")
    ).toThrow(/legacy validator name/);
  });
});

import { describe, expect, it } from "vitest";

import {
  assertNoLegacySourceIdentifiers,
  assertPublicCopy,
  isPublicSourceFile,
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
    const outdatedScopeLabel = "M" + "V" + "P";

    expect(() =>
      assertPublicCopy(`This is the ${outdatedScopeLabel}.`, "sample.md")
    ).toThrow(/outdated MVP wording/);
  });

  it("rejects legacy visible naming in public copy", () => {
    const legacyVisibleName = "DATEV CSV Validator " + "Lite";

    expect(() => assertPublicCopy(legacyVisibleName, "sample.md")).toThrow(
      /legacy Lite naming/
    );
  });

  it("rejects official acceptance claims in public copy", () => {
    for (const claim of [
      ["DATEV", "accepted"].join(" "),
      ["DATEV", "approved"].join("-"),
      ["official", "DATEV", "validator"].join(" "),
      ["guaranteed", "DATEV", "acceptance"].join(" "),
    ]) {
      expect(() => assertPublicCopy(claim, "sample.md")).toThrow(
        /official acceptance claim/
      );
    }
  });

  it("treats src files as public source copy", () => {
    expect(isPublicSourceFile("src/lib/i18n.ts")).toBe(true);
    expect(isPublicSourceFile("src/components/ValidatorApp.astro")).toBe(true);
    expect(isPublicSourceFile("tests/unit/public-copy.test.ts")).toBe(false);
    expect(isPublicSourceFile("scripts/check-public-copy.mjs")).toBe(false);
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

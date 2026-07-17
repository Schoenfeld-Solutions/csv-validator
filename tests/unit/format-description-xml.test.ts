import { describe, expect, it } from "vitest";

import {
  BUILT_IN_CONTRACT_REPOSITORY,
  createMixedContractRepository,
} from "../../src/lib/datev/contracts";
import { importDatevXmlContractSet } from "../../src/lib/datev/custom-xml";
import type {
  DatevFieldContract,
  DatevFieldRuleContract,
  DatevRecognitionContract,
} from "../../src/lib/datev/types";

interface SyntheticFieldPatch {
  readonly decimalPlaces?: string;
  readonly extraLeaf?: string;
  readonly formatExpression?: string;
  readonly formatType?: string;
  readonly label?: string;
  readonly length?: string;
  readonly necessary?: string;
  readonly ordinal?: string;
}

interface SyntheticDescriptionOptions {
  readonly csvDelimiter?: string;
  readonly csvDoubleQuote?: string;
  readonly csvQuote?: string;
  readonly fieldNodes?: readonly string[];
  readonly fieldPatches?: Readonly<Record<number, SyntheticFieldPatch>>;
  readonly formatExtraLeaf?: string;
  readonly formatName?: string;
  readonly formatVersion?: string;
  readonly reverseFields?: boolean;
  readonly rootExtraChild?: string;
}

const recognitions = BUILT_IN_CONTRACT_REPOSITORY.listRecognitions();

const escapeXml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const element = (name: string, value: string): string =>
  `<${name}>${escapeXml(value)}</${name}>`;

const recognitionByCode = (
  recognitionCode: string
): DatevRecognitionContract => {
  const recognition = recognitions.find(
    (item) => item.recognitionCode === recognitionCode
  );
  if (!recognition)
    throw new Error(`Missing test recognition: ${recognitionCode}`);
  return recognition;
};

const builtInFacts = (
  recognitionCode: string
): {
  readonly recognition: DatevRecognitionContract;
  readonly fields: readonly DatevFieldContract[];
  readonly rules: readonly DatevFieldRuleContract[];
} => {
  const recognition = recognitionByCode(recognitionCode);
  const fields = BUILT_IN_CONTRACT_REPOSITORY.getFields(recognitionCode);
  const rules = BUILT_IN_CONTRACT_REPOSITORY.getRules(recognitionCode);
  if (!fields || !rules) {
    throw new Error(`Missing built-in test facts: ${recognitionCode}`);
  }
  return { fields, recognition, rules };
};

const syntheticField = (
  field: DatevFieldContract,
  rule: DatevFieldRuleContract,
  index: number,
  patch: SyntheticFieldPatch = {}
): string => {
  const expression = patch.formatExpression ?? rule.formatExpression;
  return [
    "<Field>",
    element("OrdinalNumber", patch.ordinal ?? String(index)),
    element("Label", patch.label ?? field.caption),
    element("FormatType", patch.formatType ?? rule.formatType),
    element("Length", patch.length ?? String(rule.maxLength)),
    element("DecimalPlaces", patch.decimalPlaces ?? String(rule.decimalPlaces)),
    element("Necessary", patch.necessary ?? (rule.necessary ? "1" : "0")),
    expression ? element("FormatExpression", expression) : "",
    patch.extraLeaf ?? "",
    "</Field>",
  ].join("");
};

const syntheticDescription = (
  recognitionCode: string,
  options: SyntheticDescriptionOptions = {}
): string => {
  const { fields, recognition, rules } = builtInFacts(recognitionCode);
  const generatedFields = fields.map((field, index) => {
    const rule = rules[index];
    if (!rule) throw new Error(`Missing test field rule: ${recognitionCode}`);
    return syntheticField(field, rule, index, options.fieldPatches?.[index]);
  });
  const fieldNodes = [...(options.fieldNodes ?? generatedFields)];
  if (options.reverseFields) fieldNodes.reverse();

  return [
    "<FormatDescription>",
    "<Format>",
    element("Name", options.formatName ?? recognition.formatName),
    element("Version", options.formatVersion ?? recognition.formatVersion),
    options.formatExtraLeaf ?? "",
    "</Format>",
    "<CsvFormatProperties>",
    element("SeperatorField", options.csvDelimiter ?? ";"),
    element("SeperatorText", options.csvQuote ?? '"'),
    element("DoubleTextSeperator", options.csvDoubleQuote ?? "1"),
    "</CsvFormatProperties>",
    ...fieldNodes,
    options.rootExtraChild ?? "",
    "</FormatDescription>",
  ].join("");
};

const diagnosticCodes = (xml: string): readonly string[] =>
  importDatevXmlContractSet([xml]).diagnostics.map((item) => item.code);

describe("DATEV format-description XML built-in fallback", () => {
  it.each(recognitions)(
    "maps a synthetic $recognitionCode description to exact built-in facts",
    (recognition) => {
      const imported = importDatevXmlContractSet([
        syntheticDescription(recognition.recognitionCode),
      ]);

      expect(imported.diagnostics).toEqual([
        expect.objectContaining({
          code: "XML_FORMAT_DESCRIPTION_BUILT_IN_FALLBACK",
          severity: "warning",
        }),
      ]);
      expect(imported.repository?.summary).toMatchObject({
        contractCount: 1,
        formatDescriptionFallbackCount: 1,
        kind: "uploaded",
        warningCount: 1,
      });
      expect(imported.repository?.listRecognitions()).toEqual([recognition]);
      expect(
        imported.repository?.getFields(recognition.recognitionCode)
      ).toEqual(
        BUILT_IN_CONTRACT_REPOSITORY.getFields(recognition.recognitionCode)
      );
      expect(
        imported.repository?.getRules(recognition.recognitionCode)
      ).toEqual(
        BUILT_IN_CONTRACT_REPOSITORY.getRules(recognition.recognitionCode)
      );
    }
  );

  it("accepts the explicit format-name alias and keeps captions and rule text non-authoritative", () => {
    const rawSentinel = "synthetic-rule-content-must-not-leak";
    const xml = syntheticDescription("datev-text-key-v2", {
      fieldPatches: {
        0: {
          extraLeaf: element("CalculationRule", rawSentinel),
          label: "Synthetic changed caption",
        },
      },
      formatName: "Textschl\u00fcssel",
    });
    const imported = importDatevXmlContractSet([xml]);

    expect(imported.repository?.listRecognitions()[0]?.recognitionCode).toBe(
      "datev-text-key-v2"
    );
    expect(JSON.stringify(imported.diagnostics)).not.toContain(rawSentinel);
    expect(imported.diagnostics.map((item) => item.code)).toEqual([
      "XML_FORMAT_DESCRIPTION_BUILT_IN_FALLBACK",
    ]);
  });

  it("sorts fields by their complete zero-based ordinal set", () => {
    const imported = importDatevXmlContractSet([
      syntheticDescription("datev-gl-account-description-v3", {
        reverseFields: true,
      }),
    ]);

    expect(imported.repository?.listRecognitions()[0]?.recognitionCode).toBe(
      "datev-gl-account-description-v3"
    );
  });

  it("combines multiple mapped descriptions and counts each fallback", () => {
    const imported = importDatevXmlContractSet([
      syntheticDescription("datev-gl-account-description-v3"),
      syntheticDescription("datev-text-key-v2"),
    ]);

    expect(imported.repository?.summary).toMatchObject({
      contractCount: 2,
      formatDescriptionFallbackCount: 2,
      warningCount: 2,
    });
  });

  it("keeps exact built-in fallback contracts authoritative in mixed mode", () => {
    const recognition = recognitionByCode("datev-gl-account-description-v3");
    const imported = importDatevXmlContractSet([
      syntheticDescription(recognition.recognitionCode),
    ]);
    if (!imported.repository) {
      throw new Error("Missing imported format-description repository");
    }

    const mixed = createMixedContractRepository(
      BUILT_IN_CONTRACT_REPOSITORY,
      imported.repository
    );

    expect(mixed.summary).toMatchObject({
      contractCount: recognitions.length,
      formatDescriptionFallbackCount: 1,
      overrideCount: 0,
      warningCount: 1,
    });
    expect(
      mixed.findRecognitionBySignature(
        recognition.formatCategory,
        recognition.formatName,
        recognition.formatVersion
      )
    ).toBe(recognition);
    expect(mixed.getFields(recognition.recognitionCode)).toBe(
      BUILT_IN_CONTRACT_REPOSITORY.getFields(recognition.recognitionCode)
    );
    expect(mixed.getRules(recognition.recognitionCode)).toBe(
      BUILT_IN_CONTRACT_REPOSITORY.getRules(recognition.recognitionCode)
    );
  });

  it.each([
    { formatName: "Unmapped synthetic format" },
    { formatVersion: "999" },
  ])("keeps an unmapped identity inactive", (options) => {
    expect(
      diagnosticCodes(
        syntheticDescription("datev-gl-account-description-v3", options)
      )
    ).toContain("XML_FORMAT_DESCRIPTION_MAPPING_REQUIRED");
  });

  it.each([
    { fieldPatches: { 0: { formatType: "Zahl" } } },
    { fieldPatches: { 0: { length: "999" } } },
    { fieldPatches: { 0: { decimalPlaces: "9" } } },
    { fieldPatches: { 0: { necessary: "unexpected" } } },
    { fieldPatches: { 0: { formatExpression: "unsupported" } } },
  ])("rejects a non-equivalent field fact", (options) => {
    expect(
      diagnosticCodes(
        syntheticDescription("datev-gl-account-description-v3", options)
      )
    ).toContain("XML_FORMAT_DESCRIPTION_NOT_EQUIVALENT");
  });

  it("rejects a non-equivalent field count", () => {
    const { fields, rules } = builtInFacts("datev-gl-account-description-v3");
    const fieldNodes = fields.slice(0, -1).map((field, index) => {
      const rule = rules[index];
      if (!rule) throw new Error("Missing test field rule");
      return syntheticField(field, rule, index);
    });

    expect(
      diagnosticCodes(
        syntheticDescription("datev-gl-account-description-v3", { fieldNodes })
      )
    ).toContain("XML_FORMAT_DESCRIPTION_NOT_EQUIVALENT");
  });

  it.each(["0", "3", "-1", "1.5", "9007199254740992"])(
    "rejects duplicate, gapped, or unsafe field ordinals (%s)",
    (ordinal) => {
      expect(
        diagnosticCodes(
          syntheticDescription("datev-gl-account-description-v3", {
            fieldPatches: { 1: { ordinal } },
          })
        )
      ).toContain("XML_FORMAT_DESCRIPTION_FIELD_ORDER");
    }
  );

  it.each([
    { formatExtraLeaf: "<Unknown />" },
    { formatExtraLeaf: element("Name", "Duplicate") },
    { fieldPatches: { 0: { extraLeaf: "<Unknown />" } } },
  ])("rejects an unknown or duplicate structural leaf", (options) => {
    expect(
      diagnosticCodes(
        syntheticDescription("datev-gl-account-description-v3", options)
      )
    ).toContain("XML_FORMAT_DESCRIPTION_STRUCTURE_UNSUPPORTED");
  });

  it.each([{ csvDelimiter: "," }, { csvQuote: "'" }, { csvDoubleQuote: "0" }])(
    "rejects unsupported CSV properties",
    (options) => {
      expect(
        diagnosticCodes(
          syntheticDescription("datev-gl-account-description-v3", options)
        )
      ).toContain("XML_FORMAT_DESCRIPTION_CSV_UNSUPPORTED");
    }
  );

  it("rejects descriptions above the adapter field limit", () => {
    const { fields, rules } = builtInFacts("datev-gl-account-description-v3");
    const field = fields[0];
    const rule = rules[0];
    if (!field || !rule) throw new Error("Missing test field facts");
    const fieldNodes = Array.from({ length: 401 }, (_, index) =>
      syntheticField(field, rule, index, { ordinal: String(index) })
    );

    expect(
      diagnosticCodes(
        syntheticDescription("datev-gl-account-description-v3", { fieldNodes })
      )
    ).toContain("XML_FORMAT_DESCRIPTION_FIELD_LIMIT");
  });
});

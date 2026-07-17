import { describe, expect, it } from "vitest";

import {
  BUILT_IN_CONTRACT_REPOSITORY,
  createEditableContractDraft,
  createEditedSessionContractRepository,
  createMixedContractRepository,
} from "../../src/lib/datev/contracts";
import { importDatevXmlContractSet } from "../../src/lib/datev/custom-xml";
import { validateDatevContent } from "../../src/lib/datev/validator";
import { parseXmlSubset } from "../../src/lib/datev/xml-subset";
import {
  csvLine,
  headerFor,
  validGlAccountDescriptionCsv,
} from "./datev-test-fixtures";
import type {
  DatevContractRepository,
  DatevEditableContractDraft,
} from "../../src/lib/datev/types";

const validCustomContractXml = (
  overrides: Partial<{
    formatCategory: string;
    formatName: string;
    formatVersion: string;
    recognitionCode: string;
  }> = {}
): string => {
  const {
    formatCategory = "99",
    formatName = "Synthetic Format",
    formatVersion = "1",
    recognitionCode = "synthetic-format-v1",
  } = overrides;
  return [
    '<datev-format-contracts version="1">',
    `<contract recognitionCode="${recognitionCode}" formatCategory="${formatCategory}" formatName="${formatName}" formatVersion="${formatVersion}" markers="EXTF" requiredCaptions="Konto,Beschriftung" dataKind="synthetic">`,
    '<field number="1" caption="Konto" type="Konto" maxLength="9" decimalPlaces="0" necessary="true" formatExpression="" />',
    '<field number="2" caption="Beschriftung" type="Text" maxLength="20" decimalPlaces="0" necessary="true" formatExpression="" />',
    '<field number="3" caption="Datum" type="Datum" maxLength="4" decimalPlaces="0" necessary="false" formatExpression="TTMM" />',
    "</contract>",
    "</datev-format-contracts>",
  ].join("");
};

const customCsv = (): string =>
  [
    headerFor("99", "Synthetic Format", "1"),
    csvLine(["Konto", "Beschriftung", "Datum"]),
    csvLine(["1000", "Kasse", "0101"]),
  ].join("\r\n");

const customGlAccountOverrideCsv = (): string =>
  [
    headerFor("20", "Kontenbeschriftungen", "3"),
    csvLine(["Konto", "Beschriftung", "Datum"]),
    csvLine(["1000", "Override", "0101"]),
  ].join("\r\n");

const diagnosticCodes = (xml: string): readonly string[] =>
  importDatevXmlContractSet([xml]).diagnostics.map((item) => item.code);

const withXmlDeclaration = (xml: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?>${xml}`;

const expectRepository = (
  repository: DatevContractRepository | undefined
): DatevContractRepository => {
  expect(repository).toBeDefined();
  return repository as DatevContractRepository;
};

const expectEditableDraft = (
  draft: DatevEditableContractDraft | undefined
): DatevEditableContractDraft => {
  expect(draft).toBeDefined();
  return draft as DatevEditableContractDraft;
};

describe("parseXmlSubset", () => {
  it("parses text-only leaf nodes and standard character references", () => {
    const parsed = parseXmlSubset(
      "<FormatDescription><Format><Name> Example &amp; Co </Name><Version>13</Version></Format></FormatDescription>"
    );

    expect(parsed).toMatchObject({
      limitExceeded: undefined,
      trailingText: false,
      unsupportedNode: false,
    });
    expect(parsed.root?.text).toBe("");
    expect(parsed.root?.children[0]?.children).toEqual([
      expect.objectContaining({ name: "Name", text: "Example & Co" }),
      expect.objectContaining({ name: "Version", text: "13" }),
    ]);
  });

  it("rejects mixed content and unsupported text references", () => {
    expect(parseXmlSubset("<root>before<child />after</root>")).toMatchObject({
      unsupportedNode: true,
    });
    expect(parseXmlSubset("<root>unsupported &copy;</root>")).toMatchObject({
      unsupportedNode: true,
    });
  });

  it.each([
    {
      expected: "document-length",
      limits: { maximumDocumentLength: 1 },
      xml: "<root />",
    },
    {
      expected: "node-count",
      limits: { maximumNodeCount: 1 },
      xml: "<root><child /></root>",
    },
    {
      expected: "depth",
      limits: { maximumDepth: 1 },
      xml: "<root><child /></root>",
    },
    {
      expected: "text-length",
      limits: { maximumTextLength: 3 },
      xml: "<root>four</root>",
    },
    {
      expected: "total-text-length",
      limits: { maximumTextLength: 10, maximumTotalTextLength: 3 },
      xml: "<root><first>ab</first><second>cd</second></root>",
    },
    {
      expected: "attribute-count",
      limits: { maximumAttributesPerNode: 1 },
      xml: '<root first="1" second="2" />',
    },
    {
      expected: "attribute-length",
      limits: { maximumAttributeLength: 1 },
      xml: '<root value="12" />',
    },
  ])("reports the $expected parser limit", ({ expected, limits, xml }) => {
    expect(parseXmlSubset(xml, limits).limitExceeded).toBe(expected);
  });
});

describe("importDatevXmlContractSet", () => {
  it("builds an uploaded contract repository from synthetic XML", () => {
    const imported = importDatevXmlContractSet([validCustomContractXml()]);

    expect(imported.diagnostics).toEqual([]);
    expect(imported.repository?.summary).toMatchObject({
      contractCount: 1,
      kind: "uploaded",
      overrideCount: 0,
      warningCount: 0,
    });
    const recognition = imported.repository?.findRecognitionBySignature(
      "99",
      "Synthetic Format",
      "1"
    );
    expect(recognition).toMatchObject({
      dataKind: "synthetic",
      recognitionCode: "synthetic-format-v1",
    });
    expect(imported.repository?.getFields("synthetic-format-v1")).toEqual([
      { caption: "Konto", fieldNumber: 1 },
      { caption: "Beschriftung", fieldNumber: 2 },
      { caption: "Datum", fieldNumber: 3 },
    ]);
    expect(imported.repository?.getRules("synthetic-format-v1")).toEqual([
      {
        decimalPlaces: 0,
        fieldNumber: 1,
        formatExpression: "",
        formatType: "Konto",
        maxLength: 9,
        necessary: true,
      },
      {
        decimalPlaces: 0,
        fieldNumber: 2,
        formatExpression: "",
        formatType: "Text",
        maxLength: 20,
        necessary: true,
      },
      {
        decimalPlaces: 0,
        fieldNumber: 3,
        formatExpression: "TTMM",
        formatType: "Datum",
        maxLength: 4,
        necessary: false,
      },
    ]);
  });

  it("accepts a safe XML declaration before the contract root", () => {
    const imported = importDatevXmlContractSet([
      withXmlDeclaration(validCustomContractXml()),
    ]);

    expect(imported.diagnostics).toEqual([]);
    expect(imported.repository?.summary.contractCount).toBe(1);
    expect(
      imported.repository?.findRecognitionBySignature(
        "99",
        "Synthetic Format",
        "1"
      )
    ).toMatchObject({ recognitionCode: "synthetic-format-v1" });
  });

  it("accepts single-quoted XML attributes and standard character references", () => {
    const xml = [
      "<datev-format-contracts version='1'>",
      "<contract recognitionCode='synthetic-entity-v1' formatCategory='99' formatName='Synthetic &amp; Entity' formatVersion='1' markers='EXTF' requiredCaptions='Konto,Name &quot;kurz&quot; &amp; Nummer &#35;1' dataKind='synthetic'>",
      "<field number='1' caption='Konto' type='Konto' maxLength='9' decimalPlaces='0' necessary='true' formatExpression='' />",
      "<field number='2' caption='Name &quot;kurz&quot; &amp; Nummer &#35;1' type='Text' maxLength='30' decimalPlaces='0' necessary='true' formatExpression='' />",
      "<field number='3' caption='Datum' type='Datum' maxLength='4' decimalPlaces='0' necessary='false' formatExpression='TTMM' />",
      "</contract>",
      "</datev-format-contracts>",
    ].join("");

    const imported = importDatevXmlContractSet([xml]);

    expect(imported.diagnostics).toEqual([]);
    expect(
      imported.repository?.findRecognitionBySignature(
        "99",
        "Synthetic & Entity",
        "1"
      )
    ).toMatchObject({ recognitionCode: "synthetic-entity-v1" });
    expect(imported.repository?.getFields("synthetic-entity-v1")?.[1]).toEqual({
      caption: 'Name "kurz" & Nummer #1',
      fieldNumber: 2,
    });
  });

  it("validates CSV content against a synthetic custom contract repository", () => {
    const imported = importDatevXmlContractSet([validCustomContractXml()]);
    const repository = expectRepository(imported.repository);

    const result = validateDatevContent({
      content: customCsv(),
      contractRepository: repository,
      encoding: "utf-8",
      sizeBytes: customCsv().length,
      sourceName: "custom.csv",
    });

    expect(result.status).toBe("valid");
    expect(result.format).toMatchObject({
      category: "99",
      name: "Synthetic Format",
      recognitionCode: "synthetic-format-v1",
      version: "1",
    });
  });

  it("builds a mixed repository with built-in fallback and uploaded custom signatures", () => {
    const imported = importDatevXmlContractSet([validCustomContractXml()]);
    const repository = expectRepository(imported.repository);

    const mixed = createMixedContractRepository(
      BUILT_IN_CONTRACT_REPOSITORY,
      repository
    );

    expect(mixed.summary).toMatchObject({
      kind: "mixed",
      overrideCount: 0,
      warningCount: 0,
    });

    const builtInFallbackResult = validateDatevContent({
      content: validGlAccountDescriptionCsv(),
      contractRepository: mixed,
      encoding: "utf-8",
      sizeBytes: validGlAccountDescriptionCsv().length,
      sourceName: "accounts.csv",
    });
    expect(builtInFallbackResult.status).toBe("valid");
    expect(builtInFallbackResult.format?.recognitionCode).toBe(
      "datev-gl-account-description-v3"
    );

    const customResult = validateDatevContent({
      content: customCsv(),
      contractRepository: mixed,
      encoding: "utf-8",
      sizeBytes: customCsv().length,
      sourceName: "synthetic.csv",
    });
    expect(customResult.status).toBe("valid");
    expect(customResult.format?.recognitionCode).toBe("synthetic-format-v1");
  });

  it("lets uploaded signatures override matching built-in signatures in mixed mode", () => {
    const imported = importDatevXmlContractSet([
      validCustomContractXml({
        formatCategory: "20",
        formatName: "Kontenbeschriftungen",
        formatVersion: "3",
        recognitionCode: "custom-gl-account-description-v3",
      }),
    ]);
    const repository = expectRepository(imported.repository);
    const mixed = createMixedContractRepository(
      BUILT_IN_CONTRACT_REPOSITORY,
      repository
    );

    expect(mixed.summary).toMatchObject({
      kind: "mixed",
      overrideCount: 1,
      warningCount: 1,
    });
    expect(
      mixed.findRecognitionBySignature("20", "Kontenbeschriftungen", "3")
    ).toMatchObject({
      recognitionCode: "custom-gl-account-description-v3",
    });

    const overrideResult = validateDatevContent({
      content: customGlAccountOverrideCsv(),
      contractRepository: mixed,
      encoding: "utf-8",
      sizeBytes: customGlAccountOverrideCsv().length,
      sourceName: "override.csv",
    });
    expect(overrideResult.status).toBe("valid");
    expect(overrideResult.format?.recognitionCode).toBe(
      "custom-gl-account-description-v3"
    );
  });

  it("fails closed when an uploaded recognition code collides with an unrelated built-in signature", () => {
    const imported = importDatevXmlContractSet([
      validCustomContractXml({
        formatCategory: "99",
        formatName: "Collision Format",
        recognitionCode: "datev-gl-account-description-v3",
      }),
    ]);
    const repository = expectRepository(imported.repository);
    const mixed = createMixedContractRepository(
      BUILT_IN_CONTRACT_REPOSITORY,
      repository
    );

    const result = validateDatevContent({
      content: validGlAccountDescriptionCsv(),
      contractRepository: mixed,
      encoding: "utf-8",
      sizeBytes: validGlAccountDescriptionCsv().length,
      sourceName: "accounts.csv",
    });

    expect(result.status).toBe("unsupported");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "FORMAT_UNSUPPORTED" })
    );
  });

  it("combines multiple synthetic XML files into one contract set", () => {
    const imported = importDatevXmlContractSet([
      validCustomContractXml(),
      validCustomContractXml({
        formatCategory: "98",
        formatName: "Second Synthetic Format",
        recognitionCode: "synthetic-format-v2",
      }),
    ]);

    expect(imported.diagnostics).toEqual([]);
    expect(imported.repository?.summary.contractCount).toBe(2);
    expect(
      imported.repository?.findRecognitionBySignature(
        "98",
        "Second Synthetic Format",
        "1"
      )
    ).toMatchObject({ recognitionCode: "synthetic-format-v2" });
  });

  it("rejects malformed XML, unsupported roots, and missing field inventories", () => {
    expect(
      diagnosticCodes('<datev-format-contracts version="1"><contract')
    ).toContain("XML_CONTRACT_MALFORMED");
    expect(diagnosticCodes("<contracts />")).toEqual(
      expect.arrayContaining([
        "XML_CONTRACT_ROOT_UNSUPPORTED",
        "XML_CONTRACT_VERSION_UNSUPPORTED",
      ])
    );
    expect(
      diagnosticCodes(
        '<datev-format-contracts version="1"><contract recognitionCode="x" formatCategory="1" formatName="Missing Fields" formatVersion="1" markers="EXTF" requiredCaptions="A" dataKind="synthetic"></contract></datev-format-contracts>'
      )
    ).toContain("XML_CONTRACT_FIELDS_MISSING");
  });

  it("rejects duplicate format signatures fail-closed", () => {
    const imported = importDatevXmlContractSet([
      validCustomContractXml(),
      validCustomContractXml({ recognitionCode: "synthetic-format-v1-copy" }),
    ]);

    expect(imported.repository).toBeUndefined();
    expect(imported.diagnostics).toContainEqual(
      expect.objectContaining({ code: "XML_CONTRACT_DUPLICATE_SIGNATURE" })
    );
  });

  it("rejects unsupported field expressions and rule classes", () => {
    const xml = validCustomContractXml()
      .replace('formatExpression="TTMM"', 'formatExpression="YYYY-MM-DD"')
      .replace(
        'caption="Beschriftung"',
        'caption="Beschriftung" ruleClass="cross-field"'
      );

    expect(diagnosticCodes(xml)).toEqual(
      expect.arrayContaining([
        "XML_CONTRACT_EXPRESSION_UNSUPPORTED",
        "XML_CONTRACT_RULE_CLASS_UNSUPPORTED",
      ])
    );
  });

  it("rejects unsupported XML elements instead of ignoring them", () => {
    const xml = validCustomContractXml().replace(
      "</contract>",
      '<calculationRule expression="ignored" /></contract>'
    );

    expect(diagnosticCodes(xml)).toContain("XML_CONTRACT_NODE_UNSUPPORTED");
  });

  it("rejects XML that exceeds a bounded parser limit", () => {
    const oversizedCaption = "A".repeat(4_097);
    const xml = validCustomContractXml().replace(
      'caption="Konto"',
      `caption="${oversizedCaption}"`
    );

    expect(diagnosticCodes(xml)).toContain("XML_CONTRACT_LIMIT_EXCEEDED");
  });

  it("rejects unsupported or raw XML attribute references fail-closed", () => {
    for (const xml of [
      validCustomContractXml().replace(
        'formatName="Synthetic Format"',
        'formatName="Synthetic &copy; Format"'
      ),
      validCustomContractXml().replace(
        'formatName="Synthetic Format"',
        'formatName="Synthetic & Format"'
      ),
      validCustomContractXml().replace(
        'formatName="Synthetic Format"',
        'formatName="Synthetic &#0; Format"'
      ),
    ]) {
      expect(diagnosticCodes(xml)).toContain("XML_CONTRACT_NODE_UNSUPPORTED");
    }
  });

  it("rejects entities, external references, and processing instructions before interpretation", () => {
    for (const xml of [
      '<!DOCTYPE root SYSTEM "file:///tmp/example"><datev-format-contracts version="1" />',
      '<!ENTITY xxe SYSTEM "file:///tmp/example"><datev-format-contracts version="1" />',
      '<?xml-stylesheet type="text/xsl" href="file:///tmp/example"?><datev-format-contracts version="1" />',
      `${validCustomContractXml()}<?processing instruction?>`,
    ]) {
      expect(diagnosticCodes(xml)).toContain(
        "XML_CONTRACT_SECURITY_UNSUPPORTED"
      );
    }
  });

  it("rejects unsupported field order and primitive attributes", () => {
    const xml = validCustomContractXml()
      .replace('number="2"', 'number="4"')
      .replace('type="Datum"', 'type="Unsupported"')
      .replace('necessary="false"', 'necessary="maybe"');

    expect(diagnosticCodes(xml)).toEqual(
      expect.arrayContaining([
        "XML_CONTRACT_FIELD_ORDER",
        "XML_CONTRACT_FIELD_TYPE_UNSUPPORTED",
        "XML_CONTRACT_FIELD_REQUIRED_FLAG",
      ])
    );
  });

  it("creates session-local edited contracts without mutating built-in defaults", () => {
    const editable = createEditableContractDraft(
      BUILT_IN_CONTRACT_REPOSITORY,
      "datev-gl-account-description-v3"
    );
    expect(editable.diagnostics).toEqual([]);
    const draft = expectEditableDraft(editable.draft);
    const editedDraft: DatevEditableContractDraft = {
      ...draft,
      fields: draft.fields.map((field) =>
        field.fieldNumber === 4 ? { ...field, maxLength: 4 } : field
      ),
    };

    const edited = createEditedSessionContractRepository(editedDraft);
    const editedRepository = expectRepository(edited.repository);
    expect(edited.diagnostics).toEqual([]);
    expect(editedRepository.summary).toMatchObject({
      kind: "edited-session",
      overrideCount: 1,
      warningCount: 1,
    });

    const editedResult = validateDatevContent({
      content: validGlAccountDescriptionCsv(),
      contractRepository: editedRepository,
      encoding: "utf-8",
      sizeBytes: validGlAccountDescriptionCsv().length,
      sourceName: "accounts.csv",
    });
    expect(editedResult.status).toBe("invalid");
    expect(editedResult.diagnostics).toContainEqual(
      expect.objectContaining({ code: "FIELD_TEXT_MAX_LENGTH", fieldIndex: 4 })
    );

    const builtInResult = validateDatevContent({
      content: validGlAccountDescriptionCsv(),
      contractRepository: BUILT_IN_CONTRACT_REPOSITORY,
      encoding: "utf-8",
      sizeBytes: validGlAccountDescriptionCsv().length,
      sourceName: "accounts.csv",
    });
    expect(builtInResult.status).toBe("valid");
    expect(builtInResult.diagnostics).not.toContainEqual(
      expect.objectContaining({ code: "FIELD_TEXT_MAX_LENGTH", fieldIndex: 4 })
    );
  });

  it("rejects invalid edited session contract drafts fail-closed", () => {
    const draft = expectEditableDraft(
      createEditableContractDraft(
        BUILT_IN_CONTRACT_REPOSITORY,
        "datev-gl-account-description-v3"
      ).draft
    );
    const invalidDraft: DatevEditableContractDraft = {
      ...draft,
      fields: draft.fields.map((field, index) =>
        index === 1 ? { ...field, fieldNumber: 1, maxLength: -1 } : field
      ),
    };

    const edited = createEditedSessionContractRepository(invalidDraft);

    expect(edited.repository).toBeUndefined();
    expect(edited.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "EDIT_CONTRACT_FIELD_DUPLICATE" }),
        expect.objectContaining({ code: "EDIT_CONTRACT_FIELD_ORDER" }),
        expect.objectContaining({ code: "EDIT_CONTRACT_MAX_LENGTH" }),
      ])
    );
  });
});

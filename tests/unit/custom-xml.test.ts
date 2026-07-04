import { describe, expect, it } from "vitest";

import { importDatevXmlContractSet } from "../../src/lib/datev/custom-xml";
import { validateDatevContent } from "../../src/lib/datev/validator";
import { csvLine, headerFor } from "./datev-test-fixtures";

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

const diagnosticCodes = (xml: string): readonly string[] =>
  importDatevXmlContractSet([xml]).diagnostics.map((item) => item.code);

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

  it("validates CSV content against a synthetic custom contract repository", () => {
    const imported = importDatevXmlContractSet([validCustomContractXml()]);
    expect(imported.repository).toBeDefined();

    const result = validateDatevContent({
      content: customCsv(),
      contractRepository: imported.repository,
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

  it("rejects declarations, entities, and external references before interpretation", () => {
    for (const xml of [
      '<?xml version="1.0"?><datev-format-contracts version="1" />',
      '<!DOCTYPE root SYSTEM "file:///tmp/example"><datev-format-contracts version="1" />',
      '<!ENTITY xxe SYSTEM "file:///tmp/example"><datev-format-contracts version="1" />',
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
});

import { diagnostic } from "./diagnostics";
import { parseXmlSubset, type XmlNode } from "./xml-subset";
import type {
  DatevContractRepository,
  DatevDiagnostic,
  DatevFieldContract,
  DatevFieldRuleContract,
  DatevRecognitionContract,
  DatevMarker,
  DatevFormatType,
} from "./types";

const SUPPORTED_ROOT = "datev-format-contracts";
const SUPPORTED_CONTRACT_VERSION = "1";
const SUPPORTED_FIELD_TYPES = new Set<DatevFormatType>([
  "Text",
  "Konto",
  "Zahl",
  "Betrag",
  "Datum",
]);
const SUPPORTED_FORMAT_EXPRESSIONS = new Set(["", "TTMM", "TTMMJJJJ"]);
const XML_SECURITY_PATTERN =
  /<!DOCTYPE|<!ENTITY|SYSTEM\s+["']|PUBLIC\s+["']|<\?/i;
const SAFE_XML_DECLARATION_PATTERN =
  /^\s*<\?xml\s+version\s*=\s*(["'])1\.[0-9]+\1(?:\s+encoding\s*=\s*(["'])[A-Za-z][A-Za-z0-9._-]*\2)?(?:\s+standalone\s*=\s*(["'])(?:yes|no)\3)?\s*\?>/i;

export interface DatevXmlContractImportResult {
  readonly repository?: DatevContractRepository;
  readonly diagnostics: readonly DatevDiagnostic[];
}

export const importDatevXmlContractSet = (
  xmlFiles: readonly string[],
  label = "Uploaded DATEV XML contracts"
): DatevXmlContractImportResult => {
  const diagnostics: DatevDiagnostic[] = [];
  const recognitions: DatevRecognitionContract[] = [];
  const fieldsByCode = new Map<string, readonly DatevFieldContract[]>();
  const rulesByCode = new Map<string, readonly DatevFieldRuleContract[]>();
  const seenSignatures = new Set<string>();

  if (xmlFiles.length === 0) {
    return {
      diagnostics: [
        diagnostic(
          "error",
          "XML_CONTRACT_SET_EMPTY",
          "At least one local DATEV XML contract file is required."
        ),
      ],
    };
  }

  for (const [fileIndex, xml] of xmlFiles.entries()) {
    const parsed = parseSupportedXml(xml, fileIndex + 1);
    diagnostics.push(...parsed.diagnostics);
    if (!parsed.root) continue;

    for (const contract of childrenNamed(parsed.root, "contract")) {
      const converted = convertContract(contract, fileIndex + 1);
      diagnostics.push(...converted.diagnostics);
      if (!converted.contract) continue;

      const { fields, recognition, rules } = converted.contract;
      const signature = [
        recognition.formatCategory,
        recognition.formatName,
        recognition.formatVersion,
      ].join("\u0000");
      if (seenSignatures.has(signature)) {
        diagnostics.push(
          diagnostic(
            "error",
            "XML_CONTRACT_DUPLICATE_SIGNATURE",
            "A local DATEV XML contract set must not contain duplicate format signatures."
          )
        );
        continue;
      }
      seenSignatures.add(signature);
      recognitions.push(recognition);
      fieldsByCode.set(recognition.recognitionCode, fields);
      rulesByCode.set(recognition.recognitionCode, rules);
    }
  }

  if (diagnostics.some((item) => item.severity === "error")) {
    return { diagnostics };
  }

  if (recognitions.length === 0) {
    return {
      diagnostics: [
        diagnostic(
          "error",
          "XML_CONTRACT_NONE_SUPPORTED",
          "No supported DATEV XML contracts were found."
        ),
      ],
    };
  }

  return {
    diagnostics,
    repository: {
      findRecognitionBySignature: (
        category: string,
        name: string,
        version: string
      ): DatevRecognitionContract | undefined =>
        recognitions.find(
          (recognition) =>
            recognition.formatCategory === category &&
            recognition.formatName === name &&
            recognition.formatVersion === version
        ),
      getFields: (recognitionCode: string) => fieldsByCode.get(recognitionCode),
      getRules: (recognitionCode: string) => rulesByCode.get(recognitionCode),
      listRecognitions: () => recognitions,
      summary: {
        contractCount: recognitions.length,
        kind: "uploaded",
        label,
        overrideCount: 0,
        warningCount: diagnostics.filter((item) => item.severity === "warning")
          .length,
      },
    },
  };
};

const parseSupportedXml = (
  xml: string,
  fileIndex: number
): {
  readonly root?: XmlNode;
  readonly diagnostics: readonly DatevDiagnostic[];
} => {
  const diagnostics: DatevDiagnostic[] = [];
  const xmlWithoutDeclaration = stripSafeXmlDeclaration(xml);
  if (XML_SECURITY_PATTERN.test(xmlWithoutDeclaration)) {
    return {
      diagnostics: [
        diagnostic(
          "error",
          "XML_CONTRACT_SECURITY_UNSUPPORTED",
          "Local DATEV XML contracts must not contain declarations, entities, or external references."
        ),
      ],
    };
  }

  const parsed = parseXmlSubset(xmlWithoutDeclaration);
  if (!parsed.root) {
    return {
      diagnostics: [
        diagnostic(
          "error",
          "XML_CONTRACT_MALFORMED",
          "The local DATEV XML contract could not be parsed."
        ),
      ],
    };
  }
  if (parsed.root.name !== SUPPORTED_ROOT) {
    diagnostics.push(
      diagnostic(
        "error",
        "XML_CONTRACT_ROOT_UNSUPPORTED",
        "The local DATEV XML contract root element is not supported."
      )
    );
  }
  if (parsed.root.attributes.version !== SUPPORTED_CONTRACT_VERSION) {
    diagnostics.push(
      diagnostic(
        "error",
        "XML_CONTRACT_VERSION_UNSUPPORTED",
        "The local DATEV XML contract version is not supported."
      )
    );
  }
  if (parsed.trailingText) {
    diagnostics.push(
      diagnostic(
        "error",
        "XML_CONTRACT_MALFORMED",
        "The local DATEV XML contract contains content outside the root element."
      )
    );
  }
  if (parsed.unsupportedNode) {
    diagnostics.push(
      diagnostic(
        "error",
        "XML_CONTRACT_NODE_UNSUPPORTED",
        "The local DATEV XML contract contains unsupported XML node syntax."
      )
    );
  }
  if (parsed.root && childrenNamed(parsed.root, "contract").length === 0) {
    diagnostics.push(
      diagnostic(
        "error",
        "XML_CONTRACT_MISSING_CONTRACT",
        "The local DATEV XML contract file does not contain a supported contract element."
      )
    );
  }
  if (
    parsed.root?.children.some((child) => child.name !== "contract") === true ||
    parsed.root?.children.some((contract) =>
      contract.children.some((child) => child.name !== "field")
    ) === true
  ) {
    diagnostics.push(
      diagnostic(
        "error",
        "XML_CONTRACT_NODE_UNSUPPORTED",
        "The local DATEV XML contract contains unsupported elements."
      )
    );
  }

  return {
    diagnostics: diagnostics.map((item) => ({
      ...item,
      fieldName: item.fieldName ?? `xml-file-${fileIndex}`,
    })),
    root: diagnostics.some((item) => item.severity === "error")
      ? undefined
      : parsed.root,
  };
};

const stripSafeXmlDeclaration = (xml: string): string =>
  xml.replace(SAFE_XML_DECLARATION_PATTERN, "");

const convertContract = (
  contract: XmlNode,
  fileIndex: number
): {
  readonly contract?: {
    readonly recognition: DatevRecognitionContract;
    readonly fields: readonly DatevFieldContract[];
    readonly rules: readonly DatevFieldRuleContract[];
  };
  readonly diagnostics: readonly DatevDiagnostic[];
} => {
  const diagnostics: DatevDiagnostic[] = [];
  const recognitionCode = requireRecognitionCode(
    contract.attributes.recognitionCode,
    diagnostics
  );
  const dataKind = requireAttribute(contract, "dataKind", diagnostics);
  const formatCategory = requireAttribute(
    contract,
    "formatCategory",
    diagnostics
  );
  const formatName = requireAttribute(contract, "formatName", diagnostics);
  const formatVersion = requireAttribute(
    contract,
    "formatVersion",
    diagnostics
  );
  const markerAttributes = splitList(contract.attributes.markers);
  const allowedDatevMarkers = markerAttributes.filter(isDatevMarker);
  if (markerAttributes.length === 0 || allowedDatevMarkers.length === 0) {
    diagnostics.push(
      diagnostic(
        "error",
        "XML_CONTRACT_MARKERS_UNSUPPORTED",
        "The local DATEV XML contract must declare at least one supported marker."
      )
    );
  }
  const requiredCaptions = splitList(contract.attributes.requiredCaptions);
  const fields = childrenNamed(contract, "field");
  if (fields.length === 0) {
    diagnostics.push(
      diagnostic(
        "error",
        "XML_CONTRACT_FIELDS_MISSING",
        "The local DATEV XML contract must contain a field inventory."
      )
    );
  }
  const fieldContracts: DatevFieldContract[] = [];
  const ruleContracts: DatevFieldRuleContract[] = [];

  for (const [index, field] of fields.entries()) {
    const converted = convertField(field, index + 1);
    diagnostics.push(...converted.diagnostics);
    if (!converted.field || !converted.rule) continue;
    fieldContracts.push(converted.field);
    ruleContracts.push(converted.rule);
  }

  if (
    !recognitionCode ||
    !dataKind ||
    !formatCategory ||
    !formatName ||
    !formatVersion ||
    diagnostics.some((item) => item.severity === "error")
  ) {
    return {
      diagnostics: diagnostics.map((item) => ({
        ...item,
        fieldName: item.fieldName ?? `xml-file-${fileIndex}`,
      })),
    };
  }

  return {
    contract: {
      fields: fieldContracts,
      recognition: {
        allowedDatevMarkers,
        dataKind,
        formatCategory,
        formatName,
        formatVersion,
        recognitionCode,
        requiredCaptions,
      },
      rules: ruleContracts,
    },
    diagnostics,
  };
};

const convertField = (
  field: XmlNode,
  expectedFieldNumber: number
): {
  readonly field?: DatevFieldContract;
  readonly rule?: DatevFieldRuleContract;
  readonly diagnostics: readonly DatevDiagnostic[];
} => {
  const diagnostics: DatevDiagnostic[] = [];
  const fieldNumber = parsePositiveInteger(
    field.attributes.number,
    "XML_CONTRACT_FIELD_NUMBER",
    "A local DATEV XML field number must be a positive integer.",
    diagnostics
  );
  if (fieldNumber !== undefined && fieldNumber !== expectedFieldNumber) {
    diagnostics.push(
      diagnostic(
        "error",
        "XML_CONTRACT_FIELD_ORDER",
        "Local DATEV XML fields must be ordered without gaps.",
        { fieldIndex: expectedFieldNumber }
      )
    );
  }
  const caption = requireAttribute(field, "caption", diagnostics);
  const type = requireFieldType(field.attributes.type, diagnostics);
  const maxLength = parseNonNegativeInteger(
    field.attributes.maxLength,
    "XML_CONTRACT_FIELD_MAX_LENGTH",
    "A local DATEV XML field maxLength must be a non-negative integer.",
    diagnostics
  );
  const decimalPlaces = parseNonNegativeInteger(
    field.attributes.decimalPlaces,
    "XML_CONTRACT_FIELD_DECIMAL_PLACES",
    "A local DATEV XML field decimalPlaces must be a non-negative integer.",
    diagnostics
  );
  const necessary = parseBoolean(field.attributes.necessary, diagnostics);
  const formatExpression = requireFormatExpression(
    field.attributes.formatExpression ?? "",
    diagnostics
  );
  const unsupportedRuleClass = field.attributes.ruleClass;
  if (unsupportedRuleClass && unsupportedRuleClass !== "field") {
    diagnostics.push(
      diagnostic(
        "error",
        "XML_CONTRACT_RULE_CLASS_UNSUPPORTED",
        "The local DATEV XML contract contains an unsupported rule class.",
        { fieldIndex: fieldNumber }
      )
    );
  }

  if (
    fieldNumber === undefined ||
    caption === undefined ||
    type === undefined ||
    maxLength === undefined ||
    decimalPlaces === undefined ||
    necessary === undefined ||
    formatExpression === undefined ||
    diagnostics.some((item) => item.severity === "error")
  ) {
    return { diagnostics };
  }

  return {
    diagnostics,
    field: {
      caption,
      fieldNumber,
    },
    rule: {
      decimalPlaces,
      fieldNumber,
      formatExpression,
      formatType: type,
      maxLength,
      necessary,
    },
  };
};

const childrenNamed = (node: XmlNode, name: string): readonly XmlNode[] =>
  node.children.filter((child) => child.name === name);

const splitList = (value: string | undefined): readonly string[] =>
  value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

const isDatevMarker = (value: string): value is DatevMarker =>
  value === "EXTF" || value === "DTVF";

const requireAttribute = (
  node: XmlNode,
  attributeName: string,
  diagnostics: DatevDiagnostic[]
): string | undefined => {
  const value = node.attributes[attributeName]?.trim();
  if (!value) {
    diagnostics.push(
      diagnostic(
        "error",
        "XML_CONTRACT_ATTRIBUTE_MISSING",
        "A required local DATEV XML contract attribute is missing.",
        { fieldName: attributeName }
      )
    );
    return undefined;
  }
  return value;
};

const requireRecognitionCode = (
  value: string | undefined,
  diagnostics: DatevDiagnostic[]
): string | undefined => {
  if (!value) {
    diagnostics.push(
      diagnostic(
        "error",
        "XML_CONTRACT_ATTRIBUTE_MISSING",
        "A required local DATEV XML contract attribute is missing.",
        { fieldName: "recognitionCode" }
      )
    );
    return undefined;
  }
  return value;
};

const requireFieldType = (
  value: string | undefined,
  diagnostics: DatevDiagnostic[]
): DatevFormatType | undefined => {
  if (!value || !SUPPORTED_FIELD_TYPES.has(value as DatevFormatType)) {
    diagnostics.push(
      diagnostic(
        "error",
        "XML_CONTRACT_FIELD_TYPE_UNSUPPORTED",
        "The local DATEV XML contract contains an unsupported field type."
      )
    );
    return undefined;
  }
  return value as DatevFormatType;
};

const requireFormatExpression = (
  value: string,
  diagnostics: DatevDiagnostic[]
): "" | "TTMM" | "TTMMJJJJ" | undefined => {
  if (!SUPPORTED_FORMAT_EXPRESSIONS.has(value)) {
    diagnostics.push(
      diagnostic(
        "error",
        "XML_CONTRACT_EXPRESSION_UNSUPPORTED",
        "The local DATEV XML contract contains an unsupported format expression."
      )
    );
    return undefined;
  }
  return value as "" | "TTMM" | "TTMMJJJJ";
};

const parseBoolean = (
  value: string | undefined,
  diagnostics: DatevDiagnostic[]
): boolean | undefined => {
  if (value === "true") return true;
  if (value === "false") return false;
  diagnostics.push(
    diagnostic(
      "error",
      "XML_CONTRACT_FIELD_REQUIRED_FLAG",
      "A local DATEV XML field necessary flag must be true or false."
    )
  );
  return undefined;
};

const parsePositiveInteger = (
  value: string | undefined,
  code: string,
  message: string,
  diagnostics: DatevDiagnostic[]
): number | undefined => {
  const parsed = parseNonNegativeInteger(value, code, message, diagnostics);
  if (parsed === undefined) return undefined;
  if (parsed < 1) {
    diagnostics.push(diagnostic("error", code, message));
    return undefined;
  }
  return parsed;
};

const parseNonNegativeInteger = (
  value: string | undefined,
  code: string,
  message: string,
  diagnostics: DatevDiagnostic[]
): number | undefined => {
  if (!value || !/^[0-9]+$/.test(value)) {
    diagnostics.push(diagnostic("error", code, message));
    return undefined;
  }
  return Number(value);
};

import { BUILT_IN_CONTRACT_REPOSITORY } from "./contracts";
import { diagnostic } from "./diagnostics";
import type { XmlNode } from "./xml-subset";
import type {
  DatevDiagnostic,
  DatevFieldContract,
  DatevFieldRuleContract,
  DatevRecognitionContract,
} from "./types";

const FORMAT_DESCRIPTION_ROOT = "FormatDescription";
const MAXIMUM_FIELDS_PER_DESCRIPTION = 400;

const ROOT_CHILDREN = new Set(["Format", "CsvFormatProperties", "Field"]);
const FORMAT_CHILDREN = new Set([
  "CurrencySignExpression",
  "DataCategory",
  "DataExtendedZone",
  "DateFormatExpression",
  "DateFormatSeperator",
  "DecimalSeperator",
  "Description",
  "DirectoryName",
  "Exportable",
  "FileName",
  "FormatId",
  "GroupSeperator",
  "Importable",
  "IsDefaultFormat",
  "Name",
  "StandardType",
  "Version",
]);
const CSV_CHILDREN = new Set([
  "Alignment",
  "Coding",
  "CsvFormatPropertiesId",
  "DoubleTextSeperator",
  "EndLineWithSeperatorText",
  "FormatId",
  "Header",
  "Headline",
  "LayoutStyle",
  "RowFrom",
  "RowTo",
  "SeperatorField",
  "SeperatorText",
  "ZeilenumbruecheLoeschen",
]);
const FIELD_CHILDREN = new Set([
  "AddCreditDebitSign",
  "BaseFieldId",
  "CalculationRule",
  "CreditDebitSign",
  "DecimalPlaces",
  "DecimalsEditable",
  "Default",
  "DisplayGroupId",
  "DisplayOptions",
  "Exportable",
  "FieldId",
  "FixedLength",
  "FormatExpression",
  "FormatType",
  "GroupingSymbol",
  "Importable",
  "IsFormatable",
  "Label",
  "LabelAlias",
  "Length",
  "MaxCount",
  "Necessary",
  "OrdinalNumber",
]);

const FORMAT_REQUIRED_CHILDREN = ["Name", "Version"] as const;
const CSV_REQUIRED_CHILDREN = [
  "SeperatorField",
  "SeperatorText",
  "DoubleTextSeperator",
] as const;
const FIELD_REQUIRED_CHILDREN = [
  "OrdinalNumber",
  "Label",
  "FormatType",
  "Length",
  "DecimalPlaces",
  "Necessary",
] as const;

const FORMAT_NAME_ALIASES = new Map([["Textschl\u00fcssel", "Textschluessel"]]);

export interface DatevFormatDescriptionContract {
  readonly recognition: DatevRecognitionContract;
  readonly fields: readonly DatevFieldContract[];
  readonly rules: readonly DatevFieldRuleContract[];
}

export interface DatevFormatDescriptionImportResult {
  readonly contract?: DatevFormatDescriptionContract;
  readonly diagnostics: readonly DatevDiagnostic[];
}

export const isDatevFormatDescriptionRoot = (root: XmlNode): boolean =>
  root.name === FORMAT_DESCRIPTION_ROOT;

export const importDatevFormatDescription = (
  root: XmlNode,
  fileIndex: number
): DatevFormatDescriptionImportResult => {
  const diagnostics: DatevDiagnostic[] = [];
  const fileDetails = { fieldName: `xml-file-${fileIndex}` };

  if (
    root.name !== FORMAT_DESCRIPTION_ROOT ||
    root.text !== "" ||
    Object.keys(root.attributes).length > 0 ||
    root.children.some((child) => !ROOT_CHILDREN.has(child.name))
  ) {
    diagnostics.push(structureDiagnostic(fileIndex));
    return { diagnostics };
  }

  const formatNodes = childrenNamed(root, "Format");
  const csvNodes = childrenNamed(root, "CsvFormatProperties");
  const fields = childrenNamed(root, "Field");
  if (
    formatNodes.length !== 1 ||
    csvNodes.length !== 1 ||
    fields.length === 0
  ) {
    diagnostics.push(structureDiagnostic(fileIndex));
    return { diagnostics };
  }
  if (fields.length > MAXIMUM_FIELDS_PER_DESCRIPTION) {
    diagnostics.push(
      diagnostic(
        "error",
        "XML_FORMAT_DESCRIPTION_FIELD_LIMIT",
        "The local format-description XML exceeds the supported field limit.",
        fileDetails
      )
    );
    return { diagnostics };
  }

  const format = formatNodes[0];
  const csv = csvNodes[0];
  if (!format || !csv) {
    diagnostics.push(structureDiagnostic(fileIndex));
    return { diagnostics };
  }
  if (
    !validateLeafContainer(format, FORMAT_CHILDREN, FORMAT_REQUIRED_CHILDREN) ||
    !validateLeafContainer(csv, CSV_CHILDREN, CSV_REQUIRED_CHILDREN) ||
    fields.some(
      (field) =>
        !validateLeafContainer(field, FIELD_CHILDREN, FIELD_REQUIRED_CHILDREN)
    )
  ) {
    diagnostics.push(structureDiagnostic(fileIndex));
    return { diagnostics };
  }

  if (
    leafText(csv, "SeperatorField") !== ";" ||
    leafText(csv, "SeperatorText") !== '"' ||
    leafText(csv, "DoubleTextSeperator") !== "1"
  ) {
    diagnostics.push(
      diagnostic(
        "error",
        "XML_FORMAT_DESCRIPTION_CSV_UNSUPPORTED",
        "The local format-description XML declares unsupported CSV properties.",
        fileDetails
      )
    );
    return { diagnostics };
  }

  const formatName = normalizeFormatName(leafText(format, "Name"));
  const formatVersion = leafText(format, "Version");
  if (!formatName || !formatVersion) {
    diagnostics.push(structureDiagnostic(fileIndex));
    return { diagnostics };
  }

  const recognitions = BUILT_IN_CONTRACT_REPOSITORY.listRecognitions().filter(
    (recognition) =>
      recognition.formatName === formatName &&
      recognition.formatVersion === formatVersion
  );
  if (recognitions.length !== 1) {
    diagnostics.push(
      diagnostic(
        "error",
        "XML_FORMAT_DESCRIPTION_MAPPING_REQUIRED",
        "The local format-description XML does not have an exact built-in recognition mapping.",
        fileDetails
      )
    );
    return { diagnostics };
  }

  const recognition = recognitions[0];
  if (!recognition) {
    diagnostics.push(
      diagnostic(
        "error",
        "XML_FORMAT_DESCRIPTION_MAPPING_REQUIRED",
        "The local format-description XML does not have an exact built-in recognition mapping.",
        fileDetails
      )
    );
    return { diagnostics };
  }
  const builtInFields = BUILT_IN_CONTRACT_REPOSITORY.getFields(
    recognition.recognitionCode
  );
  const builtInRules = BUILT_IN_CONTRACT_REPOSITORY.getRules(
    recognition.recognitionCode
  );
  if (!builtInFields || !builtInRules) {
    diagnostics.push(notEquivalentDiagnostic(fileIndex));
    return { diagnostics };
  }

  const orderedFields = orderFields(fields);
  if (!orderedFields) {
    diagnostics.push(
      diagnostic(
        "error",
        "XML_FORMAT_DESCRIPTION_FIELD_ORDER",
        "The local format-description XML field ordinals must be unique, safe, and gap-free.",
        fileDetails
      )
    );
    return { diagnostics };
  }

  if (
    orderedFields.length !== builtInFields.length ||
    orderedFields.length !== builtInRules.length
  ) {
    diagnostics.push(notEquivalentDiagnostic(fileIndex));
    return { diagnostics };
  }

  for (const [index, field] of orderedFields.entries()) {
    const rule = builtInRules[index];
    if (!rule || !matchesBuiltInRule(field, rule)) {
      diagnostics.push(notEquivalentDiagnostic(fileIndex, index + 1));
      return { diagnostics };
    }
  }

  diagnostics.push(
    diagnostic(
      "warning",
      "XML_FORMAT_DESCRIPTION_BUILT_IN_FALLBACK",
      "The local format-description XML matched a built-in structural contract; built-in captions and runtime rules remain authoritative.",
      fileDetails
    )
  );
  return {
    contract: { fields: builtInFields, recognition, rules: builtInRules },
    diagnostics,
  };
};

const validateLeafContainer = (
  node: XmlNode,
  allowedChildren: ReadonlySet<string>,
  requiredChildren: readonly string[]
): boolean => {
  if (node.text !== "" || Object.keys(node.attributes).length > 0) return false;
  const counts = new Map<string, number>();
  for (const child of node.children) {
    if (
      !allowedChildren.has(child.name) ||
      child.children.length > 0 ||
      Object.keys(child.attributes).length > 0
    ) {
      return false;
    }
    const count = (counts.get(child.name) ?? 0) + 1;
    if (count > 1) return false;
    counts.set(child.name, count);
  }
  return requiredChildren.every((name) => counts.get(name) === 1);
};

const orderFields = (
  fields: readonly XmlNode[]
): readonly XmlNode[] | undefined => {
  const byOrdinal = new Map<number, XmlNode>();
  for (const field of fields) {
    const ordinal = parseNonNegativeSafeInteger(
      leafText(field, "OrdinalNumber")
    );
    if (ordinal === undefined || byOrdinal.has(ordinal)) return undefined;
    byOrdinal.set(ordinal, field);
  }
  const ordered = Array.from({ length: fields.length }, (_, index) =>
    byOrdinal.get(index)
  );
  return ordered.every((field) => field !== undefined)
    ? (ordered as XmlNode[])
    : undefined;
};

const matchesBuiltInRule = (
  field: XmlNode,
  rule: DatevFieldRuleContract
): boolean => {
  const maximumLength = parseNonNegativeSafeInteger(leafText(field, "Length"));
  const decimalPlaces = parseNonNegativeSafeInteger(
    leafText(field, "DecimalPlaces")
  );
  const necessary = leafText(field, "Necessary");
  return (
    leafText(field, "Label") !== "" &&
    leafText(field, "FormatType") === rule.formatType &&
    maximumLength === rule.maxLength &&
    decimalPlaces === rule.decimalPlaces &&
    (necessary === "1" || necessary === "0") &&
    (necessary === "1") === rule.necessary &&
    leafText(field, "FormatExpression") === rule.formatExpression
  );
};

const parseNonNegativeSafeInteger = (value: string): number | undefined => {
  if (!/^(?:0|[1-9][0-9]*)$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
};

const normalizeFormatName = (value: string): string =>
  FORMAT_NAME_ALIASES.get(value) ?? value;

const childrenNamed = (node: XmlNode, name: string): readonly XmlNode[] =>
  node.children.filter((child) => child.name === name);

const leafText = (node: XmlNode, name: string): string =>
  childrenNamed(node, name)[0]?.text ?? "";

const structureDiagnostic = (fileIndex: number): DatevDiagnostic =>
  diagnostic(
    "error",
    "XML_FORMAT_DESCRIPTION_STRUCTURE_UNSUPPORTED",
    "The local format-description XML structure is not supported.",
    { fieldName: `xml-file-${fileIndex}` }
  );

const notEquivalentDiagnostic = (
  fileIndex: number,
  fieldIndex?: number
): DatevDiagnostic =>
  diagnostic(
    "error",
    "XML_FORMAT_DESCRIPTION_NOT_EQUIVALENT",
    "The local format-description XML does not exactly match the selected built-in structural facts.",
    { fieldIndex, fieldName: `xml-file-${fileIndex}` }
  );

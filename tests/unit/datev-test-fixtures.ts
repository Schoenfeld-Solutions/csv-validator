import {
  getFields,
  getRules,
  SUPPORTED_FORMATS,
} from "../../src/lib/datev/contracts";
import type {
  DatevFieldRuleContract,
  DatevRecognitionCode,
} from "../../src/lib/datev/types";

export const csvLine = (fields: readonly string[]): string =>
  fields
    .map((field) =>
      /[;"\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field
    )
    .join(";");

export const headerLine = (
  overrides: Partial<Record<number, string>> = {},
  quotedMarker = true
): string => {
  const fields = Array.from({ length: 31 }, () => "");
  fields[0] = quotedMarker ? '"EXTF"' : "EXTF";
  fields[1] = "700";
  fields[2] = "20";
  fields[3] = "Kontenbeschriftungen";
  fields[4] = "3";
  fields[10] = "12345";
  fields[11] = "10000";
  fields[12] = "20240101";
  fields[13] = "4";
  fields[14] = "20240101";
  fields[15] = "20241231";
  for (const [index, value] of Object.entries(overrides) as [
    string,
    string,
  ][]) {
    fields[Number(index)] = value;
  }
  return fields.join(";");
};

export const contractCaptionLine = (
  recognitionCode: DatevRecognitionCode
): string => csvLine(getFields(recognitionCode).map((field) => field.caption));

export const headerFor = (
  category: string,
  name: string,
  version: string,
  overrides: Partial<Record<number, string>> = {}
): string =>
  headerLine({
    2: category,
    3: name,
    4: version,
    ...overrides,
  });

export const validGlAccountDescriptionCsv = (): string =>
  [
    headerLine(),
    contractCaptionLine("datev-gl-account-description-v3"),
    csvLine(["1000", "Kasse", "de", "Kasse lang"]),
  ].join("\r\n");

export interface SyntheticSizedCsv {
  readonly content: string;
  readonly dataRecordCount: number;
  readonly sizeBytes: number;
  readonly targetBytes: number;
}

export const syntheticSizedGlAccountDescriptionCsv = (
  targetBytes: number
): SyntheticSizedCsv => {
  if (!Number.isSafeInteger(targetBytes) || targetBytes <= 0) {
    throw new Error(
      "Synthetic CSV target size must be a positive safe integer"
    );
  }

  const prefix = [
    headerLine(),
    contractCaptionLine("datev-gl-account-description-v3"),
    "",
  ].join("\r\n");
  const dataRow = '1;"Synthetic performance row";;"X"';
  const firstRecordBytes = Buffer.byteLength(`${prefix}${dataRow}`, "utf8");
  if (targetBytes < firstRecordBytes) {
    throw new Error(
      "Synthetic CSV target size is smaller than one valid record"
    );
  }

  const additionalRecord = `\r\n${dataRow}`;
  const additionalRecordBytes = Buffer.byteLength(additionalRecord, "utf8");
  const dataRecordCount =
    1 + Math.floor((targetBytes - firstRecordBytes) / additionalRecordBytes);
  const content = `${prefix}${dataRow}${additionalRecord.repeat(
    dataRecordCount - 1
  )}`;

  return {
    content,
    dataRecordCount,
    sizeBytes: Buffer.byteLength(content, "utf8"),
    targetBytes,
  };
};

export const bookingBatchHeaderLine = (): string =>
  headerFor("21", "Buchungsstapel", "13");

export const bookingBatchRow = (
  overrides: Partial<Record<number, string>> = {}
): string => {
  const fields = getFields("datev-booking-batch-v13").map(() => "");
  fields[0] = "1,00";
  fields[1] = "S";
  fields[6] = "1000";
  fields[7] = "1200";
  fields[9] = "0101";
  for (const [index, value] of Object.entries(overrides) as [
    string,
    string,
  ][]) {
    fields[Number(index)] = value;
  }
  return csvLine(fields);
};

export const recurringBookingsHeaderLine = (): string =>
  headerFor("65", "Wiederkehrende Buchungen", "4");

export const recurringBookingsRow = (
  overrides: Partial<Record<number, string>> = {}
): string => {
  const fields = getFields("datev-recurring-bookings-v4").map(() => "");
  for (const [index, value] of Object.entries(overrides) as [
    string,
    string,
  ][]) {
    fields[Number(index)] = value;
  }
  return csvLine(fields);
};

export const naturalStackHeaderLine = (): string =>
  headerFor("66", "Natural-Stapel", "2");

export const naturalStackRow = (
  overrides: Partial<Record<number, string>> = {}
): string => {
  const fields = getFields("datev-natural-stack-v2").map(() => "");
  for (const [index, value] of Object.entries(overrides) as [
    string,
    string,
  ][]) {
    fields[Number(index)] = value;
  }
  return csvLine(fields);
};

export const paymentTermsHeaderLine = (): string =>
  headerFor("46", "Zahlungsbedingungen", "2");

export const paymentTermsRow = (
  overrides: Partial<Record<number, string>> = {}
): string => {
  const fields = getFields("datev-payment-terms-v2").map(() => "");
  fields[0] = "1";
  for (const [index, value] of Object.entries(overrides) as [
    string,
    string,
  ][]) {
    fields[Number(index)] = value;
  }
  return csvLine(fields);
};

const smallestValidFieldValue = (rule: DatevFieldRuleContract): string => {
  if (rule.formatType === "Text") return "X";
  if (rule.formatType === "Datum") {
    if (rule.formatExpression === "TTMM") return "0101";
    if (rule.formatExpression === "TTMMJJJJ") return "01012024";
  }
  return rule.formatType === "Konto" ? "1" : "0";
};

const csvLineWithQuotedText = (
  values: readonly string[],
  rules: readonly DatevFieldRuleContract[]
): string =>
  values
    .map((value, index) => {
      const forceQuote =
        value.length > 0 && rules[index]?.formatType === "Text";
      return forceQuote || /[;"\r\n]/.test(value)
        ? `"${value.replaceAll('"', '""')}"`
        : value;
    })
    .join(";");

export const syntheticGoldenCsv = (
  recognitionCode: DatevRecognitionCode,
  candidateFieldNumber: number,
  candidateValue?: string
): string => {
  const recognition = SUPPORTED_FORMATS.find(
    (item) => item.recognitionCode === recognitionCode
  );
  if (!recognition) {
    throw new Error(`Missing recognition contract for ${recognitionCode}`);
  }

  const rules = getRules(recognitionCode);
  const candidateRule = rules[candidateFieldNumber - 1];
  if (!candidateRule) {
    throw new Error(
      `Missing field ${candidateFieldNumber} for ${recognitionCode}`
    );
  }

  const values = rules.map((rule) =>
    rule.necessary ? smallestValidFieldValue(rule) : ""
  );
  values[candidateFieldNumber - 1] =
    candidateValue ?? smallestValidFieldValue(candidateRule);
  if (values.filter(Boolean).length < 2) {
    const companionIndex = rules.findIndex(
      (rule, index) => index !== candidateFieldNumber - 1 && rule.maxLength > 0
    );
    const companionRule = rules[companionIndex];
    if (!companionRule) {
      throw new Error(`Missing companion field for ${recognitionCode}`);
    }
    values[companionIndex] = smallestValidFieldValue(companionRule);
  }

  return [
    headerFor(
      recognition.formatCategory,
      recognition.formatName,
      recognition.formatVersion
    ),
    contractCaptionLine(recognitionCode),
    csvLineWithQuotedText(values, rules),
  ].join("\r\n");
};

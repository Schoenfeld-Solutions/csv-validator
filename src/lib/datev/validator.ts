import { BUILT_IN_CONTRACT_REPOSITORY, isAllowedMarker } from "./contracts";
import { parseDatevCsvContent } from "./csv";
import { diagnostic, summarizeDiagnostics } from "./diagnostics";
import type {
  CsvEncoding,
  DatevContractRepository,
  DatevDiagnostic,
  DatevFieldContract,
  DatevFieldRuleContract,
  DatevRecognitionContract,
  DatevValidationResult,
  DatevMarker,
  ParsedCsvField,
} from "./types";

const HEADER_FIELD_COUNT = 31;
const SUPPORTED_HEADER_VERSION = "700";
const HEADER_VERSION_INDEX = 1;
const HEADER_CATEGORY_INDEX = 2;
const HEADER_NAME_INDEX = 3;
const HEADER_FORMAT_VERSION_INDEX = 4;
const HEADER_CONSULTANT_INDEX = 10;
const HEADER_CLIENT_INDEX = 11;
const HEADER_FISCAL_YEAR_START_INDEX = 12;
const HEADER_ACCOUNT_LENGTH_INDEX = 13;
const HEADER_DATE_FROM_INDEX = 14;
const HEADER_DATE_TO_INDEX = 15;
const PAYMENT_TERMS_PERCENT_INTEGER_DIGITS = 4;

type RuntimeRule =
  "paymentTermsPercent" | "nonNegativeAmount" | "bookingBatchOptionalFullDate";

const PAYMENT_TERMS_PERCENT_FIELDS = new Set<string>([
  "datev-payment-terms-v2:4",
  "datev-payment-terms-v2:6",
]);

const NON_NEGATIVE_AMOUNT_FIELDS = new Set<string>([
  "datev-booking-batch-v13:5",
  "datev-booking-batch-v13:13",
  "datev-booking-batch-v12:5",
  "datev-booking-batch-v12:13",
  "datev-booking-batch-v11:5",
  "datev-booking-batch-v11:13",
  "datev-booking-batch-v10:5",
  "datev-booking-batch-v10:13",
  "datev-recurring-bookings-v4:6",
  "datev-recurring-bookings-v4:19",
  "datev-recurring-bookings-v3:6",
  "datev-recurring-bookings-v3:19",
]);

const BOOKING_BATCH_OPTIONAL_FULL_DATE_FIELDS = new Set<string>([
  "datev-booking-batch-v13:93",
  "datev-booking-batch-v13:115",
  "datev-booking-batch-v13:116",
  "datev-booking-batch-v12:93",
  "datev-booking-batch-v12:115",
  "datev-booking-batch-v12:116",
  "datev-booking-batch-v11:93",
  "datev-booking-batch-v11:115",
  "datev-booking-batch-v11:116",
  "datev-booking-batch-v10:93",
  "datev-booking-batch-v10:115",
  "datev-booking-batch-v10:116",
]);

export interface ValidateDatevContentInput {
  readonly sourceName: string;
  readonly sizeBytes: number;
  readonly sourceSha256?: string;
  readonly content: string;
  readonly encoding: CsvEncoding;
  readonly contractRepository?: DatevContractRepository;
  readonly preflightDiagnostics?: readonly DatevDiagnostic[];
}

export const validateDatevContent = ({
  content,
  contractRepository = BUILT_IN_CONTRACT_REPOSITORY,
  encoding,
  preflightDiagnostics = [],
  sizeBytes,
  sourceSha256,
  sourceName,
}: ValidateDatevContentInput): DatevValidationResult => {
  const safeName = safeSourceName(sourceName);
  const parsed = parseDatevCsvContent(content);
  const diagnostics: DatevDiagnostic[] = [
    ...preflightDiagnostics,
    ...parsed.diagnostics,
  ];
  const rows = parsed.rows;
  const header = rows[0];
  const captions = rows[1];
  let recognition: DatevRecognitionContract | undefined;
  let marker: DatevMarker | undefined;
  let fieldCount: number | undefined;
  let dataRecordCount = 0;

  if (!header) {
    diagnostics.push(
      diagnostic(
        "error",
        "HEADER_MISSING",
        "A DATEV CSV file must contain a header row.",
        {
          line: 1,
        }
      )
    );
  } else {
    const headerValues = values(header);
    marker = parseMarker(headerValues[0]);
    recognition = detectRecognition(headerValues, contractRepository);
    diagnostics.push(...validateHeader(header, recognition, marker));
  }

  if (recognition) {
    const fields = contractRepository.getFields(recognition.recognitionCode);
    const rules = contractRepository.getRules(recognition.recognitionCode);
    if (!fields || !rules) {
      diagnostics.push(
        diagnostic(
          "error",
          "CONTRACT_SOURCE_INCOMPLETE",
          "The selected local DATEV CSV contract source is incomplete.",
          { line: 1 }
        )
      );
    } else if (fields.length !== rules.length) {
      diagnostics.push(
        diagnostic(
          "error",
          "CONTRACT_SOURCE_INCONSISTENT",
          "The selected local DATEV CSV contract source has inconsistent field and rule counts.",
          { line: 1 }
        )
      );
    } else {
      fieldCount = fields.length;
      if (!captions) {
        diagnostics.push(
          diagnostic(
            "error",
            "CAPTIONS_MISSING",
            "A DATEV CSV file must contain a caption row after the header.",
            { line: 2 }
          )
        );
      } else {
        diagnostics.push(...validateCaptions(captions, fields, recognition));
      }
      const dataRows = rows.slice(2);
      for (const [offset, row] of dataRows.entries()) {
        const line = offset + 3;
        if (!row.some((field) => field.value !== "")) {
          diagnostics.push(
            diagnostic(
              "error",
              "DATA_ROW_EMPTY",
              "Data rows must not be empty.",
              { line }
            )
          );
          continue;
        }
        dataRecordCount += 1;
        diagnostics.push(
          ...validateDataRow(
            row,
            fields,
            rules,
            recognition.recognitionCode,
            line
          )
        );
      }
    }
  } else if (header && parsed.diagnostics.length === 0) {
    const values = rows[0] ? rows[0].map((field) => field.value) : [];
    const hasDatevShape =
      values[0] === "EXTF" ||
      values[0] === "DTVF" ||
      values.length >= HEADER_FIELD_COUNT;
    diagnostics.push(
      diagnostic(
        hasDatevShape ? "warning" : "error",
        hasDatevShape ? "FORMAT_UNSUPPORTED" : "HEADER_MARKER_INVALID",
        hasDatevShape
          ? "The DATEV format signature is not supported by this local contract."
          : "The first header field must be the DATEV marker EXTF or DTVF.",
        { line: 1, column: 1 }
      )
    );
  }

  const summary = summarizeDiagnostics(diagnostics);
  const status = determineStatus(summary.errorCount, diagnostics, recognition);

  return {
    csv: {
      dataRecordCount,
      delimiter: ";",
      encoding,
      fieldCount,
      physicalLineCount: parsed.physicalLineCount,
      quote: '"',
    },
    diagnostics,
    format:
      recognition && marker
        ? {
            category: recognition.formatCategory,
            dataKind: recognition.dataKind,
            marker,
            name: recognition.formatName,
            recognitionCode: recognition.recognitionCode,
            version: recognition.formatVersion,
          }
        : undefined,
    schemaVersion: 1,
    source: {
      name: safeName,
      processedInBrowser: true,
      ...(sourceSha256 ? { sha256: sourceSha256 } : {}),
      sizeBytes,
    },
    status,
    summary,
  };
};

export const createRejectedResult = (
  sourceName: string,
  sizeBytes: number,
  encoding: CsvEncoding,
  diagnostics: readonly DatevDiagnostic[],
  sourceSha256?: string
): DatevValidationResult => ({
  csv: {
    dataRecordCount: 0,
    delimiter: ";",
    encoding,
    physicalLineCount: 0,
    quote: '"',
  },
  diagnostics,
  schemaVersion: 1,
  source: {
    name: safeSourceName(sourceName),
    processedInBrowser: true,
    ...(sourceSha256 ? { sha256: sourceSha256 } : {}),
    sizeBytes,
  },
  status: "invalid",
  summary: summarizeDiagnostics(diagnostics),
});

const determineStatus = (
  errorCount: number,
  diagnostics: readonly DatevDiagnostic[],
  recognition: DatevRecognitionContract | undefined
): DatevValidationResult["status"] => {
  if (
    !recognition &&
    diagnostics.some((item) => item.code === "FORMAT_UNSUPPORTED")
  ) {
    return "unsupported";
  }
  return errorCount > 0 ? "invalid" : "valid";
};

const safeSourceName = (sourceName: string): string => {
  const normalized = sourceName.split(/[\\/]/).pop()?.trim() ?? "";
  return normalized || "selected-file";
};

const values = (row: readonly ParsedCsvField[]): string[] =>
  row.map((field) => field.value);

const parseMarker = (value: string | undefined): DatevMarker | undefined =>
  value === "EXTF" || value === "DTVF" ? value : undefined;

const detectRecognition = (
  headerValues: readonly string[],
  contractRepository: DatevContractRepository
): DatevRecognitionContract | undefined =>
  contractRepository.findRecognitionBySignature(
    headerValues[HEADER_CATEGORY_INDEX] ?? "",
    headerValues[HEADER_NAME_INDEX] ?? "",
    headerValues[HEADER_FORMAT_VERSION_INDEX] ?? ""
  );

const validateHeader = (
  header: readonly ParsedCsvField[],
  recognition: DatevRecognitionContract | undefined,
  marker: DatevMarker | undefined
): DatevDiagnostic[] => {
  const diagnostics: DatevDiagnostic[] = [];
  const headerValues = values(header);

  if (!marker) {
    diagnostics.push(
      diagnostic(
        "error",
        "HEADER_MARKER_INVALID",
        "The DATEV marker must be EXTF or DTVF.",
        {
          column: 1,
          line: 1,
        }
      )
    );
  }

  if (header.length !== HEADER_FIELD_COUNT) {
    diagnostics.push(
      diagnostic(
        "error",
        "HEADER_FIELD_COUNT",
        "The DATEV header must contain exactly 31 fields.",
        { line: 1 }
      )
    );
    return diagnostics;
  }

  if (!header[0]?.quoted) {
    diagnostics.push(
      diagnostic(
        "error",
        "HEADER_MARKER_UNQUOTED",
        "The DATEV marker field must be quoted.",
        { fieldIndex: 1, fieldName: "Kennzeichen", line: 1 }
      )
    );
  }

  if (recognition && marker && !isAllowedMarker(recognition, marker)) {
    diagnostics.push(
      diagnostic(
        "error",
        "HEADER_MARKER_NOT_ALLOWED",
        "The marker is not allowed for the recognized local DATEV CSV contract.",
        { fieldIndex: 1, fieldName: "Kennzeichen", line: 1 }
      )
    );
  }

  if (headerValues[HEADER_VERSION_INDEX] !== SUPPORTED_HEADER_VERSION) {
    diagnostics.push(
      diagnostic(
        "error",
        "HEADER_VERSION_UNSUPPORTED",
        "The DATEV header version must be 700 for this local contract.",
        { fieldIndex: 2, fieldName: "Versionsnummer", line: 1 }
      )
    );
  }

  validateRequiredNumber(
    headerValues[HEADER_CONSULTANT_INDEX],
    "Beraternummer",
    11,
    diagnostics
  );
  validateRequiredNumber(
    headerValues[HEADER_CLIENT_INDEX],
    "Mandantennummer",
    12,
    diagnostics
  );
  validateFiscalYearStart(
    headerValues[HEADER_FISCAL_YEAR_START_INDEX],
    diagnostics
  );
  validateAccountLength(headerValues[HEADER_ACCOUNT_LENGTH_INDEX], diagnostics);
  const dateFrom = validateOptionalHeaderDate(
    headerValues[HEADER_DATE_FROM_INDEX],
    "Datum von",
    15,
    diagnostics
  );
  const dateTo = validateOptionalHeaderDate(
    headerValues[HEADER_DATE_TO_INDEX],
    "Datum bis",
    16,
    diagnostics
  );
  if (
    dateFrom &&
    dateTo &&
    dateFrom.getUTCFullYear() !== dateTo.getUTCFullYear()
  ) {
    diagnostics.push(
      diagnostic(
        "error",
        "HEADER_DATE_RANGE_YEAR",
        "Header date range fields must use the same year.",
        { line: 1 }
      )
    );
  }

  return diagnostics;
};

const validateRequiredNumber = (
  value: string | undefined,
  fieldName: string,
  fieldIndex: number,
  diagnostics: DatevDiagnostic[]
): void => {
  if (!value) {
    diagnostics.push(
      diagnostic(
        "error",
        "HEADER_REQUIRED",
        "A required DATEV header field is empty.",
        {
          fieldIndex,
          fieldName,
          line: 1,
        }
      )
    );
    return;
  }
  if (!/^[0-9]+$/.test(value)) {
    diagnostics.push(
      diagnostic(
        "error",
        "HEADER_NUMERIC",
        "A DATEV header field must be numeric.",
        {
          fieldIndex,
          fieldName,
          line: 1,
        }
      )
    );
  }
};

const validateFiscalYearStart = (
  value: string | undefined,
  diagnostics: DatevDiagnostic[]
): void => {
  if (!value) {
    diagnostics.push(
      diagnostic(
        "error",
        "HEADER_REQUIRED",
        "A required DATEV header field is empty.",
        {
          fieldIndex: 13,
          fieldName: "WJ-Beginn",
          line: 1,
        }
      )
    );
    return;
  }
  validateHeaderDate(value, "WJ-Beginn", 13, diagnostics);
};

const validateAccountLength = (
  value: string | undefined,
  diagnostics: DatevDiagnostic[]
): void => {
  if (!value) {
    diagnostics.push(
      diagnostic(
        "error",
        "HEADER_REQUIRED",
        "A required DATEV header field is empty.",
        {
          fieldIndex: 14,
          fieldName: "Sachkontenlaenge",
          line: 1,
        }
      )
    );
    return;
  }
  if (!/^[0-9]+$/.test(value)) {
    diagnostics.push(
      diagnostic(
        "error",
        "HEADER_NUMERIC",
        "A DATEV header field must be numeric.",
        {
          fieldIndex: 14,
          fieldName: "Sachkontenlaenge",
          line: 1,
        }
      )
    );
    return;
  }
  const parsed = Number(value);
  if (parsed < 4 || parsed > 8) {
    diagnostics.push(
      diagnostic(
        "error",
        "HEADER_ACCOUNT_LENGTH_RANGE",
        "Sachkontenlaenge must be between 4 and 8.",
        { fieldIndex: 14, fieldName: "Sachkontenlaenge", line: 1 }
      )
    );
  }
};

const validateOptionalHeaderDate = (
  value: string | undefined,
  fieldName: string,
  fieldIndex: number,
  diagnostics: DatevDiagnostic[]
): Date | undefined => {
  if (!value) return undefined;
  return validateHeaderDate(value, fieldName, fieldIndex, diagnostics);
};

const validateHeaderDate = (
  value: string,
  fieldName: string,
  fieldIndex: number,
  diagnostics: DatevDiagnostic[]
): Date | undefined => {
  if (!/^[0-9]{8}$/.test(value)) {
    diagnostics.push(
      diagnostic(
        "error",
        "HEADER_DATE_YYYYMMDD",
        "A DATEV header date must be YYYYMMDD.",
        {
          fieldIndex,
          fieldName,
          line: 1,
        }
      )
    );
    return undefined;
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  if (!isValidUtcDate(year, month, day)) {
    diagnostics.push(
      diagnostic(
        "error",
        "HEADER_DATE_INVALID",
        "A DATEV header date must be valid.",
        {
          fieldIndex,
          fieldName,
          line: 1,
        }
      )
    );
    return undefined;
  }
  return new Date(Date.UTC(year, month - 1, day));
};

const validateCaptions = (
  captions: readonly ParsedCsvField[],
  fields: readonly DatevFieldContract[],
  recognition: DatevRecognitionContract
): DatevDiagnostic[] => {
  const diagnostics: DatevDiagnostic[] = [];
  if (captions.length !== fields.length) {
    diagnostics.push(
      diagnostic(
        "error",
        "CAPTION_FIELD_COUNT",
        "The caption row field count does not match the local DATEV CSV contract.",
        { line: 2 }
      )
    );
  }

  for (const requiredCaption of recognition.requiredCaptions) {
    if (!captions.some((field) => field.value === requiredCaption)) {
      diagnostics.push(
        diagnostic(
          "error",
          "CAPTION_ANCHOR_MISSING",
          "A required caption anchor is missing from the caption row.",
          { fieldName: requiredCaption, line: 2 }
        )
      );
    }
  }

  for (
    let index = 0;
    index < Math.min(captions.length, fields.length);
    index += 1
  ) {
    if (captions[index]?.value !== fields[index]?.caption) {
      diagnostics.push(
        diagnostic(
          "error",
          "CAPTION_ORDER",
          "The caption row order does not match the local DATEV CSV contract.",
          {
            fieldIndex: index + 1,
            fieldName: fields[index]?.caption,
            line: 2,
          }
        )
      );
      break;
    }
  }
  return diagnostics;
};

const validateDataRow = (
  row: readonly ParsedCsvField[],
  fields: readonly DatevFieldContract[],
  rules: readonly DatevFieldRuleContract[],
  recognitionCode: string,
  line: number
): DatevDiagnostic[] => {
  const diagnostics: DatevDiagnostic[] = [];
  if (row.length !== fields.length) {
    diagnostics.push(
      diagnostic(
        "error",
        "DATA_FIELD_COUNT",
        "The data row field count does not match the local DATEV CSV contract.",
        { line }
      )
    );
    return diagnostics;
  }

  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index];
    const rule = rules[index];
    const cell = row[index];
    if (!field || !rule || !cell) continue;
    diagnostics.push(...validateCell(cell, field, rule, recognitionCode, line));
  }
  return diagnostics;
};

const validateCell = (
  cell: ParsedCsvField,
  field: DatevFieldContract,
  rule: DatevFieldRuleContract,
  recognitionCode: string,
  line: number
): DatevDiagnostic[] => {
  const diagnostics: DatevDiagnostic[] = [];
  const common = {
    fieldIndex: field.fieldNumber,
    fieldName: field.caption,
    line,
  };
  if (!cell.value) {
    if (rule.necessary) {
      diagnostics.push(
        diagnostic(
          "error",
          "FIELD_REQUIRED",
          "A required field is empty.",
          common
        )
      );
    }
    return diagnostics;
  }

  if (rule.formatType === "Text" && !cell.quoted) {
    diagnostics.push(
      diagnostic(
        "warning",
        "TEXT_UNQUOTED",
        "A non-empty text field is not quoted.",
        common
      )
    );
  }

  const validationMessage = validateValue(
    cell.value,
    rule,
    getRuntimeRule(recognitionCode, field.fieldNumber)
  );
  if (validationMessage) {
    diagnostics.push(
      diagnostic(
        "error",
        validationMessage.code,
        validationMessage.message,
        common
      )
    );
  }
  return diagnostics;
};

const validateValue = (
  value: string,
  rule: DatevFieldRuleContract,
  runtimeRule?: RuntimeRule
): { code: string; message: string } | undefined => {
  if (runtimeRule === "paymentTermsPercent") {
    return validatePaymentTermsPercent(value, rule);
  }
  if (
    runtimeRule === "bookingBatchOptionalFullDate" &&
    rule.formatType === "Datum" &&
    rule.maxLength === 8 &&
    rule.decimalPlaces === 0
  ) {
    return validateFullDate(value);
  }

  let validationMessage: { code: string; message: string } | undefined;
  switch (rule.formatType) {
    case "Text":
      validationMessage =
        value.length > rule.maxLength
          ? {
              code: "FIELD_TEXT_MAX_LENGTH",
              message: `Text fields must be at most ${rule.maxLength} characters.`,
            }
          : undefined;
      break;
    case "Konto":
      validationMessage = validateAccount(value, rule);
      break;
    case "Zahl":
      validationMessage = validateDecimal(value, rule, false);
      break;
    case "Betrag":
      validationMessage = validateDecimal(value, rule, true);
      break;
    case "Datum":
      validationMessage = validateDateValue(value, rule);
      break;
  }
  if (validationMessage) return validationMessage;

  if (runtimeRule === "nonNegativeAmount" && value.startsWith("-")) {
    return {
      code: "FIELD_AMOUNT_NEGATIVE_NOT_ALLOWED",
      message: "This amount field must not be negative.",
    };
  }

  return undefined;
};

const validateAccount = (
  value: string,
  rule: DatevFieldRuleContract
): { code: string; message: string } | undefined => {
  if (!/^[0-9]+$/.test(value)) {
    return {
      code: "FIELD_ACCOUNT_DIGITS",
      message: "Account fields must contain only digits.",
    };
  }
  if (value.length > rule.maxLength) {
    return {
      code: "FIELD_ACCOUNT_MAX_LENGTH",
      message: `Account fields must be at most ${rule.maxLength} digits.`,
    };
  }
  return undefined;
};

const validateDecimal = (
  value: string,
  rule: DatevFieldRuleContract,
  allowSign: boolean
): { code: string; message: string } | undefined => {
  let unsigned = value;
  if (value.startsWith("-")) {
    if (!allowSign) {
      return {
        code: "FIELD_NUMBER_SIGN",
        message: "Number fields must not include a sign.",
      };
    }
    unsigned = value.slice(1);
  }
  if (!unsigned) {
    return {
      code: "FIELD_NUMBER_EMPTY",
      message: "Numeric fields must contain digits.",
    };
  }
  if ((unsigned.match(/,/g) ?? []).length > 1) {
    return {
      code: "FIELD_NUMBER_DECIMAL_COMMA",
      message: "Numeric fields must use at most one decimal comma.",
    };
  }
  const [integerPart = "", decimalPart] = unsigned.split(",");
  if (!/^[0-9]+$/.test(integerPart)) {
    return {
      code: "FIELD_NUMBER_INTEGER_DIGITS",
      message: "Numeric fields must contain digits before the decimal comma.",
    };
  }
  if (integerPart.length > rule.maxLength) {
    return {
      code: "FIELD_NUMBER_INTEGER_MAX_LENGTH",
      message: `The integer part must be at most ${rule.maxLength} digits.`,
    };
  }
  if (decimalPart === undefined) return undefined;
  if (rule.decimalPlaces === 0) {
    return {
      code: "FIELD_NUMBER_DECIMALS_NOT_ALLOWED",
      message: "This numeric field must not include decimal places.",
    };
  }
  if (!/^[0-9]+$/.test(decimalPart)) {
    return {
      code: "FIELD_NUMBER_DECIMAL_DIGITS",
      message: "Decimal places must contain only digits.",
    };
  }
  if (decimalPart.length > rule.decimalPlaces) {
    return {
      code: "FIELD_NUMBER_DECIMAL_PLACES",
      message: `This numeric field allows at most ${rule.decimalPlaces} decimal places.`,
    };
  }
  return undefined;
};

const validatePaymentTermsPercent = (
  value: string,
  rule: DatevFieldRuleContract
): { code: string; message: string } | undefined => {
  if (value.startsWith("-")) {
    return {
      code: "FIELD_NUMBER_SIGN",
      message: "Number fields must not include a sign.",
    };
  }
  if ((value.match(/,/g) ?? []).length > 1) {
    return {
      code: "FIELD_NUMBER_DECIMAL_COMMA",
      message: "Numeric fields must use at most one decimal comma.",
    };
  }
  const [integerPart = "", decimalPart] = value.split(",");
  if (!/^[0-9]+$/.test(integerPart)) {
    return {
      code: "FIELD_NUMBER_INTEGER_DIGITS",
      message: "Numeric fields must contain digits before the decimal comma.",
    };
  }
  if (integerPart.length > PAYMENT_TERMS_PERCENT_INTEGER_DIGITS) {
    return {
      code: "FIELD_NUMBER_INTEGER_MAX_LENGTH",
      message: `The integer part must be at most ${PAYMENT_TERMS_PERCENT_INTEGER_DIGITS} digits.`,
    };
  }
  if (decimalPart === undefined) return undefined;
  if (!/^[0-9]+$/.test(decimalPart)) {
    return {
      code: "FIELD_NUMBER_DECIMAL_DIGITS",
      message: "Decimal places must contain only digits.",
    };
  }
  if (decimalPart.length > rule.decimalPlaces) {
    return {
      code: "FIELD_NUMBER_DECIMAL_PLACES",
      message: `This numeric field allows at most ${rule.decimalPlaces} decimal places.`,
    };
  }
  if (/^0+$/.test(integerPart) && /^0+$/.test(decimalPart)) return undefined;
  return {
    code: "FIELD_PAYMENT_TERMS_PERCENT_DECIMAL_NOT_ALLOWED",
    message:
      "Payment terms percent fields must use unsigned whole-number notation or zero decimal-comma notation.",
  };
};

const getRuntimeRule = (
  recognitionCode: string,
  fieldNumber: number
): RuntimeRule | undefined => {
  const key = `${recognitionCode}:${fieldNumber}`;
  if (PAYMENT_TERMS_PERCENT_FIELDS.has(key)) return "paymentTermsPercent";
  if (NON_NEGATIVE_AMOUNT_FIELDS.has(key)) return "nonNegativeAmount";
  if (BOOKING_BATCH_OPTIONAL_FULL_DATE_FIELDS.has(key)) {
    return "bookingBatchOptionalFullDate";
  }
  return undefined;
};

const validateDateValue = (
  value: string,
  rule: DatevFieldRuleContract
): { code: string; message: string } | undefined => {
  if (rule.formatExpression === "TTMM") {
    if (!/^[0-9]{4}$/.test(value)) {
      return {
        code: "FIELD_DATE_TTMM",
        message: "Date fields with TTMM must use four digits.",
      };
    }
    const day = Number(value.slice(0, 2));
    const month = Number(value.slice(2, 4));
    return isValidUtcDate(2000, month, day)
      ? undefined
      : {
          code: "FIELD_DATE_INVALID",
          message: "Date fields must contain a valid date.",
        };
  }
  if (rule.formatExpression === "TTMMJJJJ") {
    return validateFullDate(value);
  }
  if (!/^[0-9]+$/.test(value)) {
    return {
      code: "FIELD_DATE_DIGITS",
      message: "Date fields must contain only digits.",
    };
  }
  return value.length > rule.maxLength
    ? {
        code: "FIELD_DATE_MAX_LENGTH",
        message: `Date fields must be at most ${rule.maxLength} digits.`,
      }
    : undefined;
};

const validateFullDate = (
  value: string
): { code: string; message: string } | undefined => {
  if (!/^[0-9]{8}$/.test(value)) {
    return {
      code: "FIELD_DATE_TTMMJJJJ",
      message: "Date fields with TTMMJJJJ must use eight digits.",
    };
  }
  const day = Number(value.slice(0, 2));
  const month = Number(value.slice(2, 4));
  const year = Number(value.slice(4, 8));
  return isValidUtcDate(year, month, day)
    ? undefined
    : {
        code: "FIELD_DATE_INVALID",
        message: "Date fields must contain a valid date.",
      };
};

const isValidUtcDate = (year: number, month: number, day: number): boolean => {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

import { getFields } from "../../src/lib/datev/contracts";
import type { DatevRecognitionCode } from "../../src/lib/datev/types";

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

import { SUPPORTED_FORMATS } from '../contracts/recognition';

export interface FormatRecognition {
  readonly recognized: boolean;
  readonly delimiter: ';' | ',' | '\t';
  readonly version?: string;
  readonly formatId?: string;
}

export function detectDelimiter(firstLine: string): ';' | ',' | '\t' {
  if (firstLine.includes(';')) {
    return ';';
  }
  if (firstLine.includes(',')) {
    return ',';
  }
  return '\t';
}

export function recognizeFormat(headers: readonly string[], delimiter: ';' | ',' | '\t'): FormatRecognition {
  const normalized = headers.map((header) => header.trim().toLowerCase());

  for (const format of SUPPORTED_FORMATS) {
    if (format.delimiter !== delimiter) {
      continue;
    }

    const hasAllHeaders = format.requiredHeaders.every((requiredHeader) => normalized.includes(requiredHeader));
    if (hasAllHeaders) {
      return {
        recognized: true,
        delimiter,
        version: format.version,
        formatId: format.id
      };
    }
  }

  return { recognized: false, delimiter };
}

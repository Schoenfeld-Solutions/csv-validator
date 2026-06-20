import type { Diagnostic } from './diagnostics';

export interface CsvLexResult {
  readonly headers: string[];
  readonly rows: string[][];
  readonly diagnostics: Diagnostic[];
}

export function lexCsv(input: string, delimiter = ';'): CsvLexResult {
  const text = input.replace(/\r\n/g, '\n').trim();
  if (text.length === 0) {
    return {
      headers: [],
      rows: [],
      diagnostics: [{ code: 'CSV_EMPTY', message: 'CSV content is empty.', severity: 'error' }]
    };
  }

  const lines = text.split('\n');
  const rows = lines.map((line) => line.split(delimiter));
  const [headers, ...dataRows] = rows;
  const diagnostics: Diagnostic[] = [];

  dataRows.forEach((row, idx) => {
    if (row.length !== headers.length) {
      diagnostics.push({
        code: 'CSV_COLUMNS_MISMATCH',
        message: 'Column count mismatch detected.',
        severity: 'error',
        row: idx + 2
      });
    }
  });

  return { headers, rows: dataRows, diagnostics };
}

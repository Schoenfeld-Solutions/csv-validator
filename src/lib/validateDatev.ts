import { lexCsv } from './csvLexer';
import { decodeBytes } from './decode';
import type { Diagnostic } from './diagnostics';
import { sortDiagnostics } from './diagnostics';
import { validateFields } from './fieldValidation';
import { recognizeFormat, detectDelimiter } from './recognize';
import { DISCLAIMER_TEXT, type ValidationResult } from './resultSchema';

export async function validateDatevFile(file: File): Promise<ValidationResult> {
  const buffer = await file.arrayBuffer();
  const decoded = decodeBytes(buffer);
  return validateDatevText(decoded.text, decoded.encoding);
}

export function validateDatevText(text: string, encoding: 'utf-8' | 'windows-1252' = 'utf-8'): ValidationResult {
  const firstLine = text.replace(/\r\n/g, '\n').split('\n', 1)[0] ?? '';
  const delimiter = detectDelimiter(firstLine);
  const lexed = lexCsv(text, delimiter);

  const diagnostics: Diagnostic[] = [...lexed.diagnostics];
  const recognition = recognizeFormat(lexed.headers, delimiter);

  if (!recognition.recognized) {
    diagnostics.push({
      code: 'FORMAT_UNSUPPORTED',
      message: 'Unsupported CSV shape. Validation failed closed.',
      severity: 'error'
    });

    return {
      status: 'unsupported',
      deterministic: true,
      failClosed: true,
      disclaimer: DISCLAIMER_TEXT,
      metadata: {
        delimiter,
        rowCount: lexed.rows.length,
        encoding
      },
      diagnostics: sortDiagnostics(diagnostics)
    };
  }

  diagnostics.push(...validateFields(lexed.headers, lexed.rows));

  return {
    status: diagnostics.some((item) => item.severity === 'error') ? 'invalid' : 'valid',
    deterministic: true,
    failClosed: true,
    disclaimer: DISCLAIMER_TEXT,
    metadata: {
      delimiter,
      rowCount: lexed.rows.length,
      encoding,
      formatId: recognition.formatId,
      contractVersion: recognition.version
    },
    diagnostics: sortDiagnostics(diagnostics)
  };
}

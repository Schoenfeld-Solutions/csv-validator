import { FIELD_RULES } from '../contracts/fieldRules';
import type { Diagnostic } from './diagnostics';

export function validateFields(headers: readonly string[], rows: readonly string[][]): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const normalizedHeaders = headers.map((h) => h.trim().toLowerCase());

  const fieldIndexes = {
    belegdatum: normalizedHeaders.indexOf('belegdatum'),
    konto: normalizedHeaders.indexOf('konto'),
    umsatz: normalizedHeaders.indexOf('umsatz')
  };

  for (const [key, index] of Object.entries(fieldIndexes)) {
    if (index === -1) {
      diagnostics.push({
        code: 'FIELD_MISSING',
        message: `Required field missing: ${key}`,
        field: key,
        severity: 'error'
      });
    }
  }

  rows.forEach((row, rowIndex) => {
    for (const [field, index] of Object.entries(fieldIndexes)) {
      if (index < 0) {
        continue;
      }
      const value = (row[index] ?? '').trim();
      if (!FIELD_RULES[field as keyof typeof FIELD_RULES].test(value)) {
        diagnostics.push({
          code: 'FIELD_INVALID',
          message: `Invalid value for ${field}: ${value || '(empty)'}`,
          field,
          severity: 'error',
          row: rowIndex + 2
        });
      }
    }
  });

  return diagnostics;
}

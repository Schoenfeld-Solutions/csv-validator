import { describe, expect, it } from 'vitest';
import { lexCsv } from '../../src/lib/csvLexer';

describe('lexCsv', () => {
  it('returns error diagnostic for empty content', () => {
    const result = lexCsv('');
    expect(result.diagnostics[0]?.code).toBe('CSV_EMPTY');
  });

  it('detects mismatched columns', () => {
    const result = lexCsv('belegdatum;konto;umsatz\n20240101;1000');
    expect(result.diagnostics.some((d) => d.code === 'CSV_COLUMNS_MISMATCH')).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { validateFields } from '../../src/lib/fieldValidation';

describe('validateFields', () => {
  it('flags invalid required values', () => {
    const diagnostics = validateFields(
      ['belegdatum', 'konto', 'umsatz'],
      [['2024-01-01', 'A100', 'abc']]
    );
    expect(diagnostics.filter((d) => d.code === 'FIELD_INVALID')).toHaveLength(3);
  });
});

import { describe, expect, it } from 'vitest';
import { validateDatevText } from '../../src/lib/validateDatev';

describe('validateDatevText', () => {
  it('returns unsupported on unknown format', () => {
    const result = validateDatevText('a,b,c\n1,2,3');
    expect(result.status).toBe('unsupported');
    expect(result.failClosed).toBe(true);
  });

  it('returns valid for matching contract rows', () => {
    const result = validateDatevText('belegdatum;konto;umsatz\n20240101;1000;10,00');
    expect(result.status).toBe('valid');
    expect(result.metadata.contractVersion).toBe('1.0.0');
  });
});

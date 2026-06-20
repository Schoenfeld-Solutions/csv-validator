import { describe, expect, it } from 'vitest';
import { recognizeFormat } from '../../src/lib/recognize';

describe('recognizeFormat', () => {
  it('recognizes contract headers', () => {
    const result = recognizeFormat(['Belegdatum', 'Konto', 'Umsatz'], ';');
    expect(result.recognized).toBe(true);
    expect(result.version).toBe('1.0.0');
  });

  it('fails closed for unknown shape', () => {
    const result = recognizeFormat(['foo', 'bar'], ';');
    expect(result.recognized).toBe(false);
  });
});

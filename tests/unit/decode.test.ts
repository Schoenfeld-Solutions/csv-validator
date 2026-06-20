import { describe, expect, it } from 'vitest';
import { decodeBytes } from '../../src/lib/decode';

describe('decodeBytes', () => {
  it('prefers utf-8 when possible', () => {
    const input = new TextEncoder().encode('konto').buffer;
    const result = decodeBytes(input);
    expect(result.encoding).toBe('utf-8');
  });
});

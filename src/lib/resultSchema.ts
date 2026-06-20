import type { Diagnostic } from './diagnostics';

export interface ValidationResult {
  readonly status: 'valid' | 'invalid' | 'unsupported';
  readonly deterministic: true;
  readonly failClosed: true;
  readonly disclaimer: string;
  readonly metadata: {
    readonly formatId?: string;
    readonly contractVersion?: string;
    readonly delimiter: string;
    readonly rowCount: number;
    readonly encoding: string;
  };
  readonly diagnostics: Diagnostic[];
}

export const DISCLAIMER_TEXT =
  'Independent open-source tool. Not affiliated with DATEV eG. Provided as-is and without warranty.';

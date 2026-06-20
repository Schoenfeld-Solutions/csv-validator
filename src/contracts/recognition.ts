export interface SupportedFormat {
  readonly id: string;
  readonly label: string;
  readonly version: string;
  readonly delimiter: ';';
  readonly requiredHeaders: readonly string[];
}

export const SUPPORTED_FORMATS: readonly SupportedFormat[] = [
  {
    id: 'datev-csv-generic-v1',
    label: 'DATEV CSV (generic contract)',
    version: '1.0.0',
    delimiter: ';',
    requiredHeaders: ['belegdatum', 'konto', 'umsatz']
  }
] as const;

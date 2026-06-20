export interface FieldDefinition {
  readonly key: string;
  readonly label: string;
  readonly required: boolean;
  readonly description: string;
}

export const FIELD_DEFINITIONS: readonly FieldDefinition[] = [
  {
    key: 'belegdatum',
    label: 'Belegdatum',
    required: true,
    description: 'Date in YYYYMMDD format.'
  },
  {
    key: 'konto',
    label: 'Konto',
    required: true,
    description: 'Numeric account identifier.'
  },
  {
    key: 'umsatz',
    label: 'Umsatz',
    required: true,
    description: 'Signed decimal amount, comma or dot separator.'
  }
] as const;

export const FIELD_RULES = {
  belegdatum: /^\d{8}$/,
  konto: /^\d+$/,
  umsatz: /^-?\d+(?:[.,]\d{1,2})?$/
} as const;

export type Severity = 'error' | 'warning' | 'info';

export interface Diagnostic {
  readonly code: string;
  readonly message: string;
  readonly severity: Severity;
  readonly row?: number;
  readonly field?: string;
}

export function sortDiagnostics(items: readonly Diagnostic[]): Diagnostic[] {
  return [...items].sort((a, b) => {
    const rowA = a.row ?? 0;
    const rowB = b.row ?? 0;
    if (rowA !== rowB) {
      return rowA - rowB;
    }
    return a.code.localeCompare(b.code);
  });
}

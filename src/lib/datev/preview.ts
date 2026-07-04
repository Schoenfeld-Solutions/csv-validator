import { parseDatevCsvContent } from "./csv";
import type {
  DatevDataPreview,
  DatevDataPreviewUnavailableReason,
  DatevPreviewCell,
  DatevPreviewRow,
  ParsedCsvField,
} from "./types";

export const DATA_PREVIEW_ROW_LIMIT = 50 as const;

export const buildDatevDataPreview = (content: string): DatevDataPreview => {
  const parsed = parseDatevCsvContent(content);
  if (parsed.diagnostics.length > 0) {
    return unavailablePreview("csv-lexing-failed");
  }

  const captions = parsed.rows[1];
  if (!captions) {
    return unavailablePreview("no-caption-row");
  }

  const dataRows = parsed.rows.slice(2);
  if (dataRows.length === 0) {
    return unavailablePreview("no-data-rows");
  }

  const rows = dataRows.slice(0, DATA_PREVIEW_ROW_LIMIT).map(toPreviewRow);

  return {
    available: true,
    captionLine: captions[0]?.line ?? 2,
    captions: captions.map(toPreviewCell),
    rowLimit: DATA_PREVIEW_ROW_LIMIT,
    rows,
    shownDataRows: rows.length,
    totalDataRows: dataRows.length,
    truncated: dataRows.length > rows.length,
  };
};

const unavailablePreview = (
  reason: DatevDataPreviewUnavailableReason
): DatevDataPreview => ({
  available: false,
  captions: [],
  reason,
  rowLimit: DATA_PREVIEW_ROW_LIMIT,
  rows: [],
  shownDataRows: 0,
  totalDataRows: 0,
  truncated: false,
});

const toPreviewRow = (
  row: readonly ParsedCsvField[],
  index: number
): DatevPreviewRow => ({
  cells: row.map(toPreviewCell),
  fieldCount: row.length,
  line: row[0]?.line ?? index + 3,
});

const toPreviewCell = (field: ParsedCsvField): DatevPreviewCell => ({
  column: field.column,
  line: field.line,
  value: field.value,
});

import { diagnostic } from "./diagnostics";
import type { DatevDiagnostic, ParsedCsv, ParsedCsvField } from "./types";

const DATEV_DELIMITER = ";";
const DATEV_QUOTE = '"';

export const parseDatevCsvContent = (content: string): ParsedCsv => {
  const diagnostics: DatevDiagnostic[] = [];
  const rows: ParsedCsvField[][] = [];
  let currentRow: ParsedCsvField[] = [];
  let currentValue = "";
  let fieldLine = 1;
  let fieldColumn = 1;
  let line = 1;
  let column = 1;
  let index = 0;
  let inQuotes = false;
  let afterClosingQuote = false;
  let atFieldStart = true;
  let currentFieldWasQuoted = false;
  let quoteStartLine = 1;
  let quoteStartColumn = 1;
  let fatal = false;

  const addDiagnostic = (item: DatevDiagnostic): void => {
    diagnostics.push(item);
    fatal = true;
  };

  const appendField = (): void => {
    currentRow.push({
      column: fieldColumn,
      line: fieldLine,
      quoted: currentFieldWasQuoted,
      value: currentValue,
    });
    currentValue = "";
    currentFieldWasQuoted = false;
    atFieldStart = true;
    afterClosingQuote = false;
    fieldLine = line;
    fieldColumn = column;
  };

  const appendRow = (): void => {
    appendField();
    rows.push(currentRow);
    currentRow = [];
    fieldLine = line + 1;
    fieldColumn = 1;
  };

  while (index < content.length && !fatal) {
    const character = content[index] ?? "";
    const next = content[index + 1];

    if (character === "\r" || character === "\n") {
      if (inQuotes) {
        addDiagnostic(
          diagnostic(
            "error",
            "CSV_QUOTED_LINE_BREAK",
            "Quoted fields must not contain line breaks.",
            { column: quoteStartColumn, line: quoteStartLine }
          )
        );
        break;
      }
      appendRow();
      if (character === "\r" && next === "\n") {
        index += 2;
      } else {
        index += 1;
      }
      line += 1;
      column = 1;
      fieldLine = line;
      fieldColumn = 1;
      continue;
    }

    if (isUnsupportedControlCharacter(character)) {
      addDiagnostic(
        diagnostic(
          "error",
          "CSV_CONTROL_CHARACTER",
          "Fields must not contain unsupported control characters.",
          { column, line }
        )
      );
      break;
    }

    if (inQuotes) {
      if (character === DATEV_QUOTE) {
        if (next === DATEV_QUOTE) {
          currentValue += DATEV_QUOTE;
          index += 2;
          column += 2;
          continue;
        }
        inQuotes = false;
        afterClosingQuote = true;
      } else {
        currentValue += character;
      }
      index += 1;
      column += 1;
      continue;
    }

    if (afterClosingQuote) {
      if (character === DATEV_DELIMITER) {
        appendField();
        index += 1;
        column += 1;
        fieldColumn = column;
        continue;
      }
      addDiagnostic(
        diagnostic(
          "error",
          "CSV_DATA_AFTER_QUOTE",
          "A quoted field must end before the next delimiter or line break.",
          { column, line }
        )
      );
      break;
    }

    if (character === DATEV_DELIMITER) {
      appendField();
      index += 1;
      column += 1;
      fieldColumn = column;
      continue;
    }

    if (character === DATEV_QUOTE) {
      if (!atFieldStart) {
        addDiagnostic(
          diagnostic(
            "error",
            "CSV_QUOTE_POSITION",
            "A text separator must appear at the start of a field or be doubled inside a quoted field.",
            { column, line }
          )
        );
        break;
      }
      inQuotes = true;
      currentFieldWasQuoted = true;
      quoteStartLine = line;
      quoteStartColumn = column;
      atFieldStart = false;
      index += 1;
      column += 1;
      continue;
    }

    currentValue += character;
    atFieldStart = false;
    index += 1;
    column += 1;
  }

  if (inQuotes && !fatal) {
    diagnostics.push(
      diagnostic(
        "error",
        "CSV_UNCLOSED_QUOTE",
        "A quoted field is not closed.",
        {
          column: quoteStartColumn,
          line: quoteStartLine,
        }
      )
    );
  } else if (
    !fatal &&
    content.length > 0 &&
    !content.endsWith("\n") &&
    !content.endsWith("\r")
  ) {
    appendField();
    rows.push(currentRow);
  }

  return {
    diagnostics,
    physicalLineCount: rows.length,
    rows,
  };
};

const isUnsupportedControlCharacter = (character: string): boolean =>
  character.charCodeAt(0) < 32 && character !== "\r" && character !== "\n";

import { describe, expect, it } from "vitest";

import {
  buildDatevDataPreview,
  DATA_PREVIEW_ROW_LIMIT,
} from "../../src/lib/datev/preview";
import {
  bookingBatchHeaderLine,
  bookingBatchRow,
  contractCaptionLine,
  csvLine,
  headerLine,
} from "./datev-test-fixtures";

describe("buildDatevDataPreview", () => {
  it("extracts bounded rows using the DATEV CSV lexer", () => {
    const content = [
      headerLine(),
      contractCaptionLine("datev-gl-account-description-v3"),
      ...Array.from({ length: DATA_PREVIEW_ROW_LIMIT + 2 }, (_, index) =>
        csvLine([
          String(1000 + index),
          `Account ${index}`,
          "de",
          `Long account ${index}`,
        ])
      ),
    ].join("\r\n");

    const preview = buildDatevDataPreview(content);

    expect(preview.available).toBe(true);
    expect(preview.rowLimit).toBe(DATA_PREVIEW_ROW_LIMIT);
    expect(preview.totalDataRows).toBe(DATA_PREVIEW_ROW_LIMIT + 2);
    expect(preview.shownDataRows).toBe(DATA_PREVIEW_ROW_LIMIT);
    expect(preview.truncated).toBe(true);
    expect(preview.captions[0]).toMatchObject({
      column: 1,
      line: 2,
      value: "Konto",
    });
    expect(preview.rows[0]).toMatchObject({
      fieldCount: 4,
      line: 3,
    });
    expect(preview.rows[0]?.cells[3]).toMatchObject({
      value: "Long account 0",
    });
  });

  it("keeps preview available when semantic validation would fail", () => {
    const content = [
      bookingBatchHeaderLine(),
      contractCaptionLine("datev-booking-batch-v13"),
      bookingBatchRow({ 6: "1000A" }),
    ].join("\r\n");

    const preview = buildDatevDataPreview(content);

    expect(preview.available).toBe(true);
    expect(preview.rows[0]?.cells[6]).toMatchObject({
      value: "1000A",
    });
  });

  it("omits raw values when CSV lexing fails", () => {
    const preview = buildDatevDataPreview('"EXTF;700\r\nsensitive;value');

    expect(preview.available).toBe(false);
    expect(preview.reason).toBe("csv-lexing-failed");
    expect(preview.captions).toEqual([]);
    expect(preview.rows).toEqual([]);
    expect(JSON.stringify(preview)).not.toContain("sensitive");
  });

  it("returns safe unavailable states for missing captions or data", () => {
    expect(buildDatevDataPreview(headerLine()).reason).toBe("no-caption-row");
    expect(
      buildDatevDataPreview(
        [
          headerLine(),
          contractCaptionLine("datev-gl-account-description-v3"),
        ].join("\r\n")
      ).reason
    ).toBe("no-data-rows");
  });
});

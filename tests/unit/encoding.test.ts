import { describe, expect, it } from "vitest";

import { detectAndDecodeBytes } from "../../src/lib/datev/encoding";
import {
  createRejectedResult,
  validateDatevContent,
} from "../../src/lib/datev/validator";
import {
  bookingBatchHeaderLine,
  bookingBatchRow,
  contractCaptionLine,
  paymentTermsHeaderLine,
  paymentTermsRow,
} from "./datev-test-fixtures";

describe("detectAndDecodeBytes", () => {
  it("detects UTF-8 with BOM", () => {
    const result = detectAndDecodeBytes(
      new Uint8Array([0xef, 0xbb, 0xbf, 0x45, 0x58, 0x54, 0x46])
    );

    expect(result.encoding).toBe("utf-8-sig");
    expect(result.content).toBe("EXTF");
    expect(result.diagnostics).toEqual([]);
  });

  it("detects valid UTF-8 without BOM before the Windows-1252 fallback", () => {
    const result = detectAndDecodeBytes(
      new TextEncoder().encode("Gegenkonto (ohne BU-Schlüssel)")
    );

    expect(result.encoding).toBe("utf-8");
    expect(result.content).toBe("Gegenkonto (ohne BU-Schlüssel)");
    expect(result.diagnostics).toEqual([]);
  });

  it("falls back to Windows-1252 when BOM-less bytes are not valid UTF-8", () => {
    const result = detectAndDecodeBytes(new Uint8Array([0x80]));

    expect(result.encoding).toBe("windows-1252");
    expect(result.content).toBe("€");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "ENCODING_ASSUMED_WINDOWS_1252" })
    );
  });

  it("keeps UTF-8 without BOM caption rows valid for umlaut-heavy supported formats", () => {
    const bookingBatchContent = [
      bookingBatchHeaderLine(),
      contractCaptionLine("datev-booking-batch-v13"),
      bookingBatchRow(),
    ].join("\r\n");
    const paymentTermsContent = [
      paymentTermsHeaderLine(),
      contractCaptionLine("datev-payment-terms-v2"),
      paymentTermsRow(),
    ].join("\r\n");

    for (const [sourceName, content] of [
      ["booking.csv", bookingBatchContent],
      ["payment-terms.csv", paymentTermsContent],
    ] as const) {
      const decoded = detectAndDecodeBytes(new TextEncoder().encode(content));
      const result = validateDatevContent({
        content: decoded.content,
        encoding: decoded.encoding,
        preflightDiagnostics: decoded.diagnostics,
        sizeBytes: content.length,
        sourceName,
      });

      expect(decoded.encoding).toBe("utf-8");
      expect(result.diagnostics).not.toContainEqual(
        expect.objectContaining({ code: "CAPTION_ANCHOR_MISSING" })
      );
      expect(result.diagnostics).not.toContainEqual(
        expect.objectContaining({ code: "CAPTION_ORDER" })
      );
    }
  });

  it("rejects UTF-16 and binary-looking files fail-closed", () => {
    expect(
      detectAndDecodeBytes(new Uint8Array([0xff, 0xfe])).diagnostics
    ).toContainEqual(expect.objectContaining({ code: "ENCODING_UNSUPPORTED" }));
    expect(
      detectAndDecodeBytes(new Uint8Array([0x45, 0x00])).diagnostics
    ).toContainEqual(expect.objectContaining({ code: "ENCODING_BINARY" }));
  });

  it("creates rejected reports without local path leakage", () => {
    const result = createRejectedResult(
      "/tmp/private/accounts.csv",
      5,
      "unknown",
      [
        {
          code: "FILE_TOO_LARGE",
          message: "Too large.",
          severity: "error",
        },
      ]
    );

    expect(result.status).toBe("invalid");
    expect(result.source.name).toBe("accounts.csv");
    expect(result.summary.errorCount).toBe(1);
  });
});

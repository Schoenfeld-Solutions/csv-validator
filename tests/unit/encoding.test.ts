import { describe, expect, it } from "vitest";

import { detectAndDecodeBytes } from "../../src/lib/datev/encoding";
import { createRejectedResult } from "../../src/lib/datev/validator";

describe("detectAndDecodeBytes", () => {
  it("detects UTF-8 with BOM", () => {
    const result = detectAndDecodeBytes(
      new Uint8Array([0xef, 0xbb, 0xbf, 0x45, 0x58, 0x54, 0x46])
    );

    expect(result.encoding).toBe("utf-8-sig");
    expect(result.content).toBe("EXTF");
    expect(result.diagnostics).toEqual([]);
  });

  it("assumes Windows-1252 without BOM", () => {
    const result = detectAndDecodeBytes(new Uint8Array([0x80]));

    expect(result.encoding).toBe("windows-1252");
    expect(result.content).toBe("€");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "ENCODING_ASSUMED_WINDOWS_1252" })
    );
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

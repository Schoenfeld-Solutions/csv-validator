import { diagnostic } from "./diagnostics";
import type { CsvEncoding, DatevLiteDiagnostic } from "./types";

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export interface DecodeResult {
  readonly encoding: CsvEncoding;
  readonly content: string;
  readonly diagnostics: readonly DatevLiteDiagnostic[];
}

export const detectAndDecodeBytes = (bytes: Uint8Array): DecodeResult => {
  if (bytes.length >= 2) {
    const first = bytes[0];
    const second = bytes[1];
    if (
      (first === 0xff && second === 0xfe) ||
      (first === 0xfe && second === 0xff)
    ) {
      return {
        content: "",
        diagnostics: [
          diagnostic(
            "error",
            "ENCODING_UNSUPPORTED",
            "UTF-16 encoded files are not supported by this browser validator."
          ),
        ],
        encoding: "unknown",
      };
    }
  }

  const prefix = bytes.subarray(0, Math.min(bytes.length, 1024));
  if (prefix.includes(0)) {
    return {
      content: "",
      diagnostics: [
        diagnostic(
          "error",
          "ENCODING_BINARY",
          "The file contains null bytes and is not treated as a supported DATEV CSV text file."
        ),
      ],
      encoding: "unknown",
    };
  }

  if (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    return {
      content: new TextDecoder("utf-8", { fatal: true }).decode(
        bytes.subarray(3)
      ),
      diagnostics: [],
      encoding: "utf-8-sig",
    };
  }

  return {
    content: new TextDecoder("windows-1252").decode(bytes),
    diagnostics: [
      diagnostic(
        "warning",
        "ENCODING_ASSUMED_WINDOWS_1252",
        "No UTF-8 BOM was found. The file was decoded deterministically as Windows-1252."
      ),
    ],
    encoding: "windows-1252",
  };
};

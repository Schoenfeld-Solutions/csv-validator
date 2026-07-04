import { diagnostic } from "../lib/datev/diagnostics";
import {
  detectAndDecodeBytes,
  MAX_FILE_SIZE_BYTES,
} from "../lib/datev/encoding";
import {
  createRejectedResult,
  validateDatevContent,
} from "../lib/datev/validator";
import { buildDatevDataPreview } from "../lib/datev/preview";
import type {
  WorkerValidationRequest,
  WorkerValidationResponse,
} from "../lib/datev/types";

const post = (message: WorkerValidationResponse): void => {
  self.postMessage(message);
};

const readFileBytes = async (file: File): Promise<Uint8Array> => {
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  const reader = file.stream().getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_FILE_SIZE_BYTES) {
      throw new Error("FILE_TOO_LARGE");
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
};

self.addEventListener(
  "message",
  (event: MessageEvent<WorkerValidationRequest>) => {
    const request = event.data;
    if (request.type !== "validate") return;

    void (async () => {
      const { file } = request;
      if (file.size > MAX_FILE_SIZE_BYTES) {
        post({
          result: createRejectedResult(file.name, file.size, "unknown", [
            diagnostic(
              "error",
              "FILE_TOO_LARGE",
              "The selected file is larger than the documented 10 MiB browser limit."
            ),
          ]),
          type: "result",
        });
        return;
      }

      post({ message: "Reading file in the browser worker", type: "progress" });
      let bytes: Uint8Array;
      try {
        bytes = await readFileBytes(file);
      } catch (error) {
        post({
          result: createRejectedResult(file.name, file.size, "unknown", [
            diagnostic(
              "error",
              error instanceof Error && error.message === "FILE_TOO_LARGE"
                ? "FILE_TOO_LARGE"
                : "FILE_READ_FAILED",
              "The selected file could not be read locally in the browser worker."
            ),
          ]),
          type: "result",
        });
        return;
      }

      post({ message: "Decoding text deterministically", type: "progress" });
      const decoded = detectAndDecodeBytes(bytes);
      if (decoded.encoding === "unknown") {
        post({
          result: createRejectedResult(
            file.name,
            file.size,
            decoded.encoding,
            decoded.diagnostics
          ),
          type: "result",
        });
        return;
      }

      post({
        message: "Validating local DATEV CSV structure",
        type: "progress",
      });
      post({
        result: validateDatevContent({
          content: decoded.content,
          encoding: decoded.encoding,
          preflightDiagnostics: decoded.diagnostics,
          sizeBytes: file.size,
          sourceName: file.name,
        }),
        preview: buildDatevDataPreview(decoded.content),
        type: "result",
      });
    })();
  }
);

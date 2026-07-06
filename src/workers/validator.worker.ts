import { diagnostic } from "../lib/datev/diagnostics";
import {
  detectAndDecodeBytes,
  MAX_FILE_SIZE_BYTES,
} from "../lib/datev/encoding";
import {
  BUILT_IN_CONTRACT_REPOSITORY,
  createEditableContractDraft,
  createEditedSessionContractRepository,
  createMixedContractRepository,
} from "../lib/datev/contracts";
import { importDatevXmlContractSet } from "../lib/datev/custom-xml";
import {
  createRejectedResult,
  validateDatevContent,
} from "../lib/datev/validator";
import { buildDatevDataPreview } from "../lib/datev/preview";
import type {
  DatevActiveContractSourceKind,
  DatevContractRepository,
  DatevEditableContractDraft,
  DatevDiagnostic,
  WorkerValidationRequest,
  WorkerValidationResponse,
} from "../lib/datev/types";

const MAX_XML_CONTRACT_FILES = 20;
const MAX_XML_CONTRACT_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_XML_CONTRACT_TOTAL_SIZE_BYTES = 10 * 1024 * 1024;

const post = (message: WorkerValidationResponse): void => {
  self.postMessage(message);
};

let uploadedContractRepository: DatevContractRepository | undefined;
let mixedContractRepository: DatevContractRepository | undefined;
let editedSessionContractRepository: DatevContractRepository | undefined;

const readFileBytes = async (
  file: File,
  byteLimit = MAX_FILE_SIZE_BYTES
): Promise<Uint8Array> => {
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  const reader = file.stream().getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > byteLimit) {
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

const createSha256Hex = async (
  bytes: Uint8Array
): Promise<string | undefined> => {
  if (!globalThis.crypto?.subtle) return undefined;
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
};

const safeFileName = (fileName: string): string =>
  fileName.split(/[\\/]/).pop()?.trim() || "selected-file";

const isDatevCsvFileName = (fileName: string): boolean => {
  const safeName = safeFileName(fileName).toLowerCase();
  return safeName.endsWith(".csv") || safeName.endsWith(".txt");
};

const isXmlContractFileName = (fileName: string): boolean =>
  safeFileName(fileName).toLowerCase().endsWith(".xml");

const getContractRepository = (
  source: DatevActiveContractSourceKind | undefined
): DatevContractRepository | undefined =>
  source === "uploaded"
    ? uploadedContractRepository
    : source === "mixed"
      ? mixedContractRepository
      : source === "edited-session"
        ? editedSessionContractRepository
        : BUILT_IN_CONTRACT_REPOSITORY;

const loadContractFiles = async (files: readonly File[]): Promise<void> => {
  if (files.length === 0) {
    uploadedContractRepository = undefined;
    mixedContractRepository = undefined;
    post({
      diagnostics: [
        diagnostic(
          "error",
          "XML_CONTRACT_SET_EMPTY",
          "At least one local DATEV XML contract file is required."
        ),
      ],
      type: "contracts",
    });
    return;
  }

  if (files.length > MAX_XML_CONTRACT_FILES) {
    uploadedContractRepository = undefined;
    mixedContractRepository = undefined;
    post({
      diagnostics: [
        diagnostic(
          "error",
          "XML_CONTRACT_FILE_LIMIT",
          "The selected local DATEV XML contract set contains too many files."
        ),
      ],
      type: "contracts",
    });
    return;
  }

  let totalBytes = 0;
  const sizeDiagnostics: DatevDiagnostic[] = [];
  for (const file of files) {
    if (!isXmlContractFileName(file.name)) {
      sizeDiagnostics.push(
        diagnostic(
          "error",
          "XML_CONTRACT_FILE_TYPE_UNSUPPORTED",
          "Local DATEV XML contract uploads must use .xml files.",
          { fieldName: safeFileName(file.name) }
        )
      );
    }
    totalBytes += file.size;
    if (file.size > MAX_XML_CONTRACT_FILE_SIZE_BYTES) {
      sizeDiagnostics.push(
        diagnostic(
          "error",
          "XML_CONTRACT_FILE_TOO_LARGE",
          "A local DATEV XML contract file exceeds the documented 2 MiB limit.",
          { fieldName: safeFileName(file.name) }
        )
      );
    }
  }
  if (totalBytes > MAX_XML_CONTRACT_TOTAL_SIZE_BYTES) {
    sizeDiagnostics.push(
      diagnostic(
        "error",
        "XML_CONTRACT_SET_TOO_LARGE",
        "The local DATEV XML contract set exceeds the documented 10 MiB limit."
      )
    );
  }
  if (sizeDiagnostics.length > 0) {
    uploadedContractRepository = undefined;
    mixedContractRepository = undefined;
    post({ diagnostics: sizeDiagnostics, type: "contracts" });
    return;
  }

  post({ code: "read-xml-contracts", type: "progress" });
  const xmlContents: string[] = [];
  const diagnostics: DatevDiagnostic[] = [];
  for (const file of files) {
    try {
      const decoded = detectAndDecodeBytes(
        await readFileBytes(file, MAX_XML_CONTRACT_FILE_SIZE_BYTES)
      );
      if (decoded.encoding === "unknown") {
        diagnostics.push(
          ...decoded.diagnostics.map((item) => ({
            ...item,
            fieldName: item.fieldName ?? safeFileName(file.name),
          }))
        );
      } else {
        xmlContents.push(decoded.content);
      }
    } catch {
      diagnostics.push(
        diagnostic(
          "error",
          "XML_CONTRACT_READ_FAILED",
          "A local DATEV XML contract file could not be read in the browser worker.",
          { fieldName: safeFileName(file.name) }
        )
      );
    }
  }

  if (diagnostics.some((item) => item.severity === "error")) {
    uploadedContractRepository = undefined;
    mixedContractRepository = undefined;
    post({ diagnostics, type: "contracts" });
    return;
  }

  post({ code: "build-xml-contract-source", type: "progress" });
  const imported = importDatevXmlContractSet(xmlContents);
  uploadedContractRepository = imported.repository;
  mixedContractRepository = imported.repository
    ? createMixedContractRepository(
        BUILT_IN_CONTRACT_REPOSITORY,
        imported.repository
      )
    : undefined;
  post({
    diagnostics: imported.diagnostics,
    mixedSummary: mixedContractRepository?.summary,
    summary: imported.repository?.summary,
    type: "contracts",
  });
};

const createEditableContract = (
  recognitionCode: string,
  source: DatevActiveContractSourceKind | undefined
): void => {
  const repository = getContractRepository(source);
  if (!repository) {
    post({
      diagnostics: [
        diagnostic(
          "error",
          "EDIT_CONTRACT_SOURCE_MISSING",
          "The selected local contract source is not available for editing."
        ),
      ],
      type: "editable-contract",
    });
    return;
  }

  const editable = createEditableContractDraft(repository, recognitionCode);
  post({
    diagnostics: editable.diagnostics,
    draft: editable.draft,
    type: "editable-contract",
  });
};

const saveEditableContract = (draft: DatevEditableContractDraft): void => {
  const edited = createEditedSessionContractRepository(draft);
  if (edited.repository) {
    editedSessionContractRepository = edited.repository;
  }
  post({
    diagnostics: edited.diagnostics,
    draft: edited.repository ? draft : undefined,
    summary: edited.repository?.summary,
    type: "editable-contract",
  });
};

const discardEditableContract = (): void => {
  editedSessionContractRepository = undefined;
  post({
    diagnostics: [],
    type: "editable-contract",
  });
};

const validateFile = async (
  file: File,
  contractSource: DatevActiveContractSourceKind | undefined
): Promise<void> => {
  const repository = getContractRepository(contractSource);
  const sourceSummary = repository?.summary;
  if (!repository) {
    post({
      contractSource: sourceSummary,
      result: createRejectedResult(file.name, file.size, "unknown", [
        diagnostic(
          "error",
          "CONTRACT_SOURCE_MISSING",
          "The selected local DATEV XML contract source is not available."
        ),
      ]),
      type: "result",
    });
    return;
  }

  if (!isDatevCsvFileName(file.name)) {
    post({
      contractSource: sourceSummary,
      result: createRejectedResult(file.name, file.size, "unknown", [
        diagnostic(
          "error",
          "FILE_TYPE_UNSUPPORTED",
          "Local DATEV CSV validation accepts only .csv and .txt files."
        ),
      ]),
      type: "result",
    });
    return;
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    post({
      contractSource: sourceSummary,
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

  post({ code: "read-file", type: "progress" });
  let bytes: Uint8Array;
  try {
    bytes = await readFileBytes(file);
  } catch (error) {
    post({
      contractSource: sourceSummary,
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

  const sourceSha256 = await createSha256Hex(bytes);
  post({ code: "decode-text", type: "progress" });
  const decoded = detectAndDecodeBytes(bytes);
  if (decoded.encoding === "unknown") {
    post({
      contractSource: sourceSummary,
      result: createRejectedResult(
        file.name,
        file.size,
        decoded.encoding,
        decoded.diagnostics,
        sourceSha256
      ),
      type: "result",
    });
    return;
  }

  post({ code: "validate-structure", type: "progress" });
  post({
    contractSource: sourceSummary,
    result: validateDatevContent({
      content: decoded.content,
      contractRepository: repository,
      encoding: decoded.encoding,
      preflightDiagnostics: decoded.diagnostics,
      sizeBytes: file.size,
      sourceSha256,
      sourceName: file.name,
    }),
    preview: buildDatevDataPreview(decoded.content),
    type: "result",
  });
};

self.addEventListener(
  "message",
  (event: MessageEvent<WorkerValidationRequest>) => {
    const request = event.data;
    void (async () => {
      if (request.type === "load-contracts") {
        await loadContractFiles(request.files);
        return;
      }
      if (request.type === "create-editable-contract") {
        createEditableContract(request.recognitionCode, request.contractSource);
        return;
      }
      if (request.type === "save-editable-contract") {
        saveEditableContract(request.draft);
        return;
      }
      if (request.type === "discard-editable-contract") {
        discardEditableContract();
        return;
      }
      await validateFile(request.file, request.contractSource);
    })();
  }
);

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
import { createLatestOperationIdTracker } from "../lib/datev/operation-correlation";
import type {
  DatevActiveContractSourceKind,
  DatevContractRepository,
  DatevEditableContractDraft,
  DatevDiagnostic,
  WorkerContractLoadResponse,
  WorkerOperationReference,
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
const latestContractLoad = createLatestOperationIdTracker();

type ContractLoadOperation = WorkerOperationReference<"contract-load">;
type ContractEditOperation = WorkerOperationReference<"contract-edit">;
type ValidationOperation = WorkerOperationReference<"validation">;

const publishContractLoad = (
  operation: ContractLoadOperation,
  response: Omit<WorkerContractLoadResponse, keyof WorkerOperationReference>,
  repositories?: {
    readonly uploaded: DatevContractRepository | undefined;
    readonly mixed: DatevContractRepository | undefined;
  }
): boolean => {
  if (!latestContractLoad.isCurrent(operation.operationId)) return false;
  uploadedContractRepository = repositories?.uploaded;
  mixedContractRepository = repositories?.mixed;
  post({ ...operation, ...response });
  return true;
};

const postContractLoadProgress = (
  operation: ContractLoadOperation,
  code: "read-xml-contracts" | "build-xml-contract-source"
): boolean => {
  if (!latestContractLoad.isCurrent(operation.operationId)) return false;
  post({ ...operation, code, type: "progress" });
  return true;
};

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

const loadContractFiles = async (
  files: readonly File[],
  operation: ContractLoadOperation
): Promise<void> => {
  if (files.length === 0) {
    publishContractLoad(operation, {
      diagnostics: [
        diagnostic(
          "error",
          "XML_CONTRACT_SET_EMPTY",
          "At least one local contract XML file is required."
        ),
      ],
      type: "contracts",
    });
    return;
  }

  if (files.length > MAX_XML_CONTRACT_FILES) {
    publishContractLoad(operation, {
      diagnostics: [
        diagnostic(
          "error",
          "XML_CONTRACT_FILE_LIMIT",
          "The selected local contract XML set contains too many files."
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
          "Local contract XML uploads must use .xml files.",
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
          "A local contract XML file exceeds the documented 2 MiB limit.",
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
        "The local contract XML set exceeds the documented 10 MiB limit."
      )
    );
  }
  if (sizeDiagnostics.length > 0) {
    publishContractLoad(operation, {
      diagnostics: sizeDiagnostics,
      type: "contracts",
    });
    return;
  }

  if (!postContractLoadProgress(operation, "read-xml-contracts")) return;
  const xmlContents: string[] = [];
  const diagnostics: DatevDiagnostic[] = [];
  for (const file of files) {
    try {
      const decoded = detectAndDecodeBytes(
        await readFileBytes(file, MAX_XML_CONTRACT_FILE_SIZE_BYTES)
      );
      if (!latestContractLoad.isCurrent(operation.operationId)) return;
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
          "A local contract XML file could not be read in the browser worker.",
          { fieldName: safeFileName(file.name) }
        )
      );
    }
  }

  if (diagnostics.some((item) => item.severity === "error")) {
    publishContractLoad(operation, { diagnostics, type: "contracts" });
    return;
  }

  if (!postContractLoadProgress(operation, "build-xml-contract-source")) {
    return;
  }
  const imported = importDatevXmlContractSet(xmlContents);
  const uploadedRepository = imported.repository;
  const mixedRepository = imported.repository
    ? createMixedContractRepository(
        BUILT_IN_CONTRACT_REPOSITORY,
        imported.repository
      )
    : undefined;
  publishContractLoad(
    operation,
    {
      diagnostics: imported.diagnostics,
      mixedSummary: mixedRepository?.summary,
      summary: uploadedRepository?.summary,
      type: "contracts",
    },
    { mixed: mixedRepository, uploaded: uploadedRepository }
  );
};

const createEditableContract = (
  recognitionCode: string,
  source: DatevActiveContractSourceKind | undefined,
  operation: ContractEditOperation
): void => {
  const repository = getContractRepository(source);
  if (!repository) {
    post({
      ...operation,
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
    ...operation,
    diagnostics: editable.diagnostics,
    draft: editable.draft,
    type: "editable-contract",
  });
};

const saveEditableContract = (
  draft: DatevEditableContractDraft,
  operation: ContractEditOperation
): void => {
  const edited = createEditedSessionContractRepository(draft);
  if (edited.repository) {
    editedSessionContractRepository = edited.repository;
  }
  post({
    ...operation,
    diagnostics: edited.diagnostics,
    draft: edited.repository ? draft : undefined,
    summary: edited.repository?.summary,
    type: "editable-contract",
  });
};

const discardEditableContract = (operation: ContractEditOperation): void => {
  editedSessionContractRepository = undefined;
  post({
    ...operation,
    diagnostics: [],
    type: "editable-contract",
  });
};

const validateFile = async (
  file: File,
  contractSource: DatevActiveContractSourceKind | undefined,
  operation: ValidationOperation
): Promise<void> => {
  // Keep the repository stable for the complete validation operation.
  const repository = getContractRepository(contractSource);
  const sourceSummary = repository?.summary;
  if (!repository) {
    post({
      ...operation,
      contractSource: sourceSummary,
      result: createRejectedResult(file.name, file.size, "unknown", [
        diagnostic(
          "error",
          "CONTRACT_SOURCE_MISSING",
          "The selected local project contract XML source is not available."
        ),
      ]),
      type: "result",
    });
    return;
  }

  if (!isDatevCsvFileName(file.name)) {
    post({
      ...operation,
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
      ...operation,
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

  post({ ...operation, code: "read-file", type: "progress" });
  let bytes: Uint8Array;
  try {
    bytes = await readFileBytes(file);
  } catch (error) {
    post({
      ...operation,
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
  post({ ...operation, code: "decode-text", type: "progress" });
  const decoded = detectAndDecodeBytes(bytes);
  if (decoded.encoding === "unknown") {
    post({
      ...operation,
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

  post({ ...operation, code: "validate-structure", type: "progress" });
  post({
    ...operation,
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
    if (request.type === "load-contracts") {
      latestContractLoad.begin(request.operationId);
      void loadContractFiles(request.files, request);
      return;
    }
    if (request.type === "create-editable-contract") {
      createEditableContract(
        request.recognitionCode,
        request.contractSource,
        request
      );
      return;
    }
    if (request.type === "save-editable-contract") {
      saveEditableContract(request.draft, request);
      return;
    }
    if (request.type === "discard-editable-contract") {
      discardEditableContract(request);
      return;
    }
    void validateFile(request.file, request.contractSource, request);
  }
);

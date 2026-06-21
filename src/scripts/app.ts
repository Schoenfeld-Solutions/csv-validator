import type {
  DatevLiteDiagnostic,
  DatevLiteValidationResult,
  WorkerValidationRequest,
  WorkerValidationResponse,
} from "../lib/datev/types";
import { appCopy, type Locale } from "../lib/i18n";

const getElement = <T extends HTMLElement>(id: string, typeName: string): T => {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing ${typeName} #${id}`);
  }
  return element as T;
};

const fileInput = getElement<HTMLInputElement>("fileInput", "input");
const dropzone = getElement<HTMLLabelElement>("dropzone", "label");
const statusLine = getElement<HTMLDivElement>("statusLine", "div");
const resultPanel = getElement<HTMLElement>("resultPanel", "section");
const resultBadge = getElement<HTMLSpanElement>("resultBadge", "span");
const resultStatement = getElement<HTMLParagraphElement>(
  "resultStatement",
  "p"
);
const metaRecognition = getElement<HTMLElement>("metaRecognition", "dd");
const metaFormat = getElement<HTMLElement>("metaFormat", "dd");
const metaMarker = getElement<HTMLElement>("metaMarker", "dd");
const metaEncoding = getElement<HTMLElement>("metaEncoding", "dd");
const metaDelimiter = getElement<HTMLElement>("metaDelimiter", "dd");
const metaRows = getElement<HTMLElement>("metaRows", "dd");
const metaDataRows = getElement<HTMLElement>("metaDataRows", "dd");
const metaFields = getElement<HTMLElement>("metaFields", "dd");
const diagnosticSummary = getElement<HTMLSpanElement>(
  "diagnosticSummary",
  "span"
);
const diagnosticsBody = getElement<HTMLTableSectionElement>(
  "diagnosticsBody",
  "tbody"
);
const copyJsonButton = getElement<HTMLButtonElement>(
  "copyJsonButton",
  "button"
);
const downloadJsonButton = getElement<HTMLButtonElement>(
  "downloadJsonButton",
  "button"
);
const copyStatus = getElement<HTMLSpanElement>("copyStatus", "span");
const locale: Locale = document.documentElement.lang
  .toLowerCase()
  .startsWith("de")
  ? "de"
  : "en";
const copy = appCopy[locale];
const badgeLabels = {
  de: {
    invalid: "Ungültig",
    unsupported: "Nicht unterstützt",
    valid: "Gültig",
    warning: "Warnung",
  },
  en: {
    invalid: "Invalid",
    unsupported: "Unsupported",
    valid: "Valid",
    warning: "Warning",
  },
} as const;

const worker = new Worker(
  new URL("../workers/validator.worker.ts", import.meta.url),
  {
    type: "module",
  }
);

let latestResult: DatevLiteValidationResult | undefined;

const setText = (element: HTMLElement, value: string): void => {
  element.textContent = value;
};

const formatBytes = (bytes: number): string => {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-US", {
    maximumFractionDigits: value >= 10 ? 0 : 1,
  }).format(value)} ${units[unitIndex]}`;
};

const validateFile = (file: File): void => {
  latestResult = undefined;
  copyJsonButton.disabled = true;
  downloadJsonButton.disabled = true;
  copyStatus.textContent = "";
  resultPanel.hidden = true;
  statusLine.textContent =
    locale === "de"
      ? `${file.name} (${formatBytes(file.size)}) ${copy.processing}...`
      : `${file.name} (${formatBytes(file.size)}) ${copy.processing}...`;
  const request: WorkerValidationRequest = { file, type: "validate" };
  worker.postMessage(request);
};

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) validateFile(file);
});

for (const eventName of ["dragenter", "dragover"]) {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add("is-dragging");
  });
}

for (const eventName of ["dragleave", "drop"]) {
  dropzone.addEventListener(eventName, () => {
    dropzone.classList.remove("is-dragging");
  });
}

dropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  const file = event.dataTransfer?.files[0];
  if (file) validateFile(file);
});

worker.addEventListener(
  "message",
  (event: MessageEvent<WorkerValidationResponse>) => {
    const message = event.data;
    if (message.type === "progress") {
      statusLine.textContent = message.message;
      return;
    }
    latestResult = message.result;
    renderResult(message.result);
  }
);

const renderResult = (result: DatevLiteValidationResult): void => {
  resultPanel.hidden = false;
  copyJsonButton.disabled = false;
  downloadJsonButton.disabled = false;
  statusLine.textContent = `${result.source.name} ${copy.processed}.`;
  renderBadge(result);
  renderMetadata(result);
  renderDiagnostics(result.diagnostics);
  diagnosticSummary.textContent = copy.diagnostics.summary(
    result.summary.errorCount,
    result.summary.warningCount
  );
};

const renderBadge = (result: DatevLiteValidationResult): void => {
  resultBadge.className = "result-badge";
  let label: keyof (typeof badgeLabels)["en"] = result.status;
  if (result.status === "valid" && result.summary.warningCount > 0) {
    label = "warning";
  }
  resultBadge.textContent = badgeLabels[locale][label];
  resultBadge.classList.add(`is-${label}`);
  resultStatement.textContent =
    result.status === "valid"
      ? copy.valid
      : result.status === "unsupported"
        ? copy.unsupported
        : copy.invalid;
};

const renderMetadata = (result: DatevLiteValidationResult): void => {
  setText(metaRecognition, result.format?.recognitionCode ?? "-");
  setText(
    metaFormat,
    result.format
      ? `${result.format.name} / category ${result.format.category} / v${result.format.version}`
      : "-"
  );
  setText(metaMarker, result.format?.marker ?? "-");
  setText(metaEncoding, result.csv.encoding);
  setText(metaDelimiter, result.csv.delimiter);
  setText(metaRows, String(result.csv.physicalLineCount));
  setText(metaDataRows, String(result.csv.dataRecordCount));
  setText(
    metaFields,
    result.csv.fieldCount === undefined ? "-" : String(result.csv.fieldCount)
  );
};

const renderDiagnostics = (
  diagnostics: readonly DatevLiteDiagnostic[]
): void => {
  diagnosticsBody.replaceChildren();
  if (diagnostics.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.textContent = copy.diagnostics.empty;
    row.append(cell);
    diagnosticsBody.append(row);
    return;
  }

  for (const diagnostic of diagnostics) {
    const row = document.createElement("tr");
    appendCell(row, diagnostic.severity);
    appendCell(row, diagnostic.code);
    appendCell(
      row,
      diagnostic.line === undefined ? "-" : String(diagnostic.line)
    );
    appendCell(
      row,
      diagnostic.column === undefined ? "-" : String(diagnostic.column)
    );
    appendCell(
      row,
      diagnostic.fieldName ??
        (diagnostic.fieldIndex === undefined
          ? "-"
          : String(diagnostic.fieldIndex))
    );
    appendCell(row, diagnostic.message);
    diagnosticsBody.append(row);
  }
};

const appendCell = (row: HTMLTableRowElement, value: string): void => {
  const cell = document.createElement("td");
  cell.textContent = value;
  row.append(cell);
};

copyJsonButton.addEventListener("click", async () => {
  if (!latestResult) return;
  try {
    await navigator.clipboard.writeText(JSON.stringify(latestResult, null, 2));
    copyStatus.textContent = copy.actions.copied;
  } catch {
    copyStatus.textContent = copy.actions.copyFailed;
  }
});

downloadJsonButton.addEventListener("click", () => {
  if (!latestResult) return;
  const blob = new Blob([JSON.stringify(latestResult, null, 2)], {
    type: "application/json",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${latestResult.source.name.replace(/[^a-zA-Z0-9._-]/g, "_")}.datev-validator-report.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 0);
});

import type {
  DatevActiveContractSourceKind,
  DatevContractSourceSummary,
  DatevDataPreview,
  DatevLiteDiagnostic,
  DatevLiteValidationResult,
  WorkerValidationRequest,
  WorkerValidationResponse,
} from "../lib/datev/types";
import {
  buildValidationReport,
  type DatevValidationReport,
  type ValidationReportActionId,
  type ValidationReportDiagnostic,
} from "../lib/datev/report";
import { appCopy, type Locale } from "../lib/i18n";

const getElement = <T extends HTMLElement>(id: string, typeName: string): T => {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing ${typeName} #${id}`);
  }
  return element as T;
};

const fileInput = getElement<HTMLInputElement>("fileInput", "input");
const xmlContractInput = getElement<HTMLInputElement>(
  "xmlContractInput",
  "input"
);
const contractSourceSelect = getElement<HTMLSelectElement>(
  "contractSourceSelect",
  "select"
);
const xmlContractStatus = getElement<HTMLParagraphElement>(
  "xmlContractStatus",
  "p"
);
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
const metaContractSource = getElement<HTMLElement>("metaContractSource", "dd");
const contractSourceWarning = getElement<HTMLParagraphElement>(
  "contractSourceWarning",
  "p"
);
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
const downloadHtmlReportButton = getElement<HTMLButtonElement>(
  "downloadHtmlReportButton",
  "button"
);
const copyStatus = getElement<HTMLSpanElement>("copyStatus", "span");
const reportGeneratedAt = getElement<HTMLSpanElement>(
  "reportGeneratedAt",
  "span"
);
const reportIntro = getElement<HTMLParagraphElement>("reportIntro", "p");
const reportFacts = getElement<HTMLDListElement>("reportFacts", "dl");
const reportSectionsList = getElement<HTMLDivElement>(
  "reportSectionsList",
  "div"
);
const reportActionsList = getElement<HTMLUListElement>(
  "reportActionsList",
  "ul"
);
const analysisTab = getElement<HTMLButtonElement>("analysisTab", "button");
const dataTab = getElement<HTMLButtonElement>("dataTab", "button");
const analysisPanel = getElement<HTMLElement>("analysisPanel", "section");
const dataPanel = getElement<HTMLElement>("dataPanel", "section");
const dataPreviewStatus = getElement<HTMLParagraphElement>(
  "dataPreviewStatus",
  "p"
);
const enableDataPreviewButton = getElement<HTMLButtonElement>(
  "enableDataPreviewButton",
  "button"
);
const dataPreviewContent = getElement<HTMLDivElement>(
  "dataPreviewContent",
  "div"
);
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
let latestReport: DatevValidationReport | undefined;
let latestPreview: DatevDataPreview | undefined;
let latestFile: File | undefined;
let uploadedContractSource: DatevContractSourceSummary | undefined;
let mixedContractSource: DatevContractSourceSummary | undefined;
let activeContractSource: DatevActiveContractSourceKind = "built-in";
let isDataPreviewEnabled = false;

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

const formatContractSource = (
  summary: DatevContractSourceSummary | undefined
): string => {
  if (!summary) return "-";
  const base =
    summary.kind === "uploaded"
      ? copy.contractSource.uploadedSummary(summary.contractCount)
      : summary.kind === "mixed"
        ? copy.contractSource.mixedSummary(summary.contractCount)
        : summary.kind === "built-in"
          ? copy.contractSource.builtInSummary
          : copy.report.contractSource[summary.kind];
  const details = copy.contractSource.summaryDetails(
    summary.overrideCount,
    summary.warningCount
  );
  return details ? `${base} (${details})` : base;
};

const syncContractSourceControl = (): void => {
  const uploadedOption = contractSourceSelect.querySelector(
    'option[value="uploaded"]'
  );
  if (uploadedOption instanceof HTMLOptionElement) {
    uploadedOption.disabled = uploadedContractSource === undefined;
    uploadedOption.textContent = uploadedContractSource
      ? copy.contractSource.uploadedOption(uploadedContractSource.contractCount)
      : copy.contractSource.uploadedUnavailable;
  }
  const mixedOption = contractSourceSelect.querySelector(
    'option[value="mixed"]'
  );
  if (mixedOption instanceof HTMLOptionElement) {
    mixedOption.disabled = mixedContractSource === undefined;
    mixedOption.textContent = mixedContractSource
      ? copy.contractSource.mixedOption(
          mixedContractSource.contractCount,
          mixedContractSource.overrideCount
        )
      : copy.contractSource.mixedUnavailable;
  }
  if (
    (activeContractSource === "uploaded" && !uploadedContractSource) ||
    (activeContractSource === "mixed" && !mixedContractSource)
  ) {
    activeContractSource = "built-in";
  }
  contractSourceSelect.value = activeContractSource;
};

const validateFile = (file: File): void => {
  latestResult = undefined;
  latestReport = undefined;
  latestPreview = undefined;
  latestFile = file;
  isDataPreviewEnabled = false;
  copyJsonButton.disabled = true;
  downloadJsonButton.disabled = true;
  downloadHtmlReportButton.disabled = true;
  copyStatus.textContent = "";
  resetDataPreview();
  selectResultTab("analysis");
  resultPanel.hidden = true;
  statusLine.textContent =
    locale === "de"
      ? `${file.name} (${formatBytes(file.size)}) ${copy.processing}...`
      : `${file.name} (${formatBytes(file.size)}) ${copy.processing}...`;
  const request: WorkerValidationRequest = {
    contractSource: activeContractSource,
    file,
    type: "validate",
  };
  worker.postMessage(request);
};

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) validateFile(file);
});

xmlContractInput.addEventListener("change", () => {
  const files = Array.from(xmlContractInput.files ?? []);
  if (files.length === 0) return;
  xmlContractStatus.textContent = copy.contractSource.loading(files.length);
  const request: WorkerValidationRequest = {
    files,
    type: "load-contracts",
  };
  worker.postMessage(request);
  xmlContractInput.value = "";
});

contractSourceSelect.addEventListener("change", () => {
  activeContractSource =
    contractSourceSelect.value === "uploaded"
      ? "uploaded"
      : contractSourceSelect.value === "mixed"
        ? "mixed"
        : "built-in";
  syncContractSourceControl();
  if (latestFile) {
    validateFile(latestFile);
  }
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
    if (message.type === "contracts") {
      if (message.summary) {
        uploadedContractSource = message.summary;
        mixedContractSource = message.mixedSummary;
        activeContractSource = mixedContractSource ? "mixed" : "uploaded";
        xmlContractStatus.textContent = copy.contractSource.loaded(
          message.summary.contractCount,
          message.summary.warningCount
        );
        syncContractSourceControl();
        if (latestFile) validateFile(latestFile);
        return;
      }
      uploadedContractSource = undefined;
      mixedContractSource = undefined;
      activeContractSource = "built-in";
      syncContractSourceControl();
      xmlContractStatus.textContent = copy.contractSource.rejected(
        [...new Set(message.diagnostics.map((item) => item.code))].join(", ")
      );
      if (latestFile) validateFile(latestFile);
      return;
    }
    latestResult = message.result;
    latestPreview = message.preview;
    renderResult(message.result, message.preview, message.contractSource);
  }
);

const renderResult = (
  result: DatevLiteValidationResult,
  preview: DatevDataPreview | undefined,
  contractSource: DatevContractSourceSummary | undefined
): void => {
  latestReport = buildValidationReport(result, undefined, contractSource);
  isDataPreviewEnabled = false;
  resultPanel.hidden = false;
  copyJsonButton.disabled = false;
  downloadJsonButton.disabled = false;
  downloadHtmlReportButton.disabled = false;
  statusLine.textContent = `${result.source.name} ${copy.processed}.`;
  renderBadge(result);
  renderMetadata(result, contractSource);
  renderContractSourceWarning(contractSource);
  renderValidationReport(latestReport, result);
  renderDiagnostics(result.diagnostics);
  renderDataPreviewGate(result, preview);
  diagnosticSummary.textContent = copy.diagnostics.summary(
    result.summary.errorCount,
    result.summary.warningCount
  );
};

type ResultTab = "analysis" | "data";

const selectResultTab = (tab: ResultTab): void => {
  const entries: readonly [ResultTab, HTMLButtonElement, HTMLElement][] = [
    ["analysis", analysisTab, analysisPanel],
    ["data", dataTab, dataPanel],
  ];
  for (const [key, button, panel] of entries) {
    const isSelected = key === tab;
    button.classList.toggle("is-active", isSelected);
    button.setAttribute("aria-selected", String(isSelected));
    button.tabIndex = isSelected ? 0 : -1;
    panel.hidden = !isSelected;
    panel.classList.toggle("is-active", isSelected);
  }
};

const handleTabKeydown = (event: KeyboardEvent): void => {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  const nextTab =
    document.activeElement === analysisTab && event.key === "ArrowRight"
      ? dataTab
      : document.activeElement === dataTab && event.key === "ArrowLeft"
        ? analysisTab
        : document.activeElement === analysisTab
          ? dataTab
          : analysisTab;
  nextTab.focus();
  selectResultTab(nextTab === analysisTab ? "analysis" : "data");
};

analysisTab.addEventListener("click", () => selectResultTab("analysis"));
dataTab.addEventListener("click", () => selectResultTab("data"));
analysisTab.addEventListener("keydown", handleTabKeydown);
dataTab.addEventListener("keydown", handleTabKeydown);

const resetDataPreview = (): void => {
  dataPreviewStatus.textContent = "";
  dataPreviewContent.replaceChildren();
  enableDataPreviewButton.disabled = true;
  enableDataPreviewButton.hidden = false;
};

const renderDataPreviewGate = (
  result: DatevLiteValidationResult,
  preview: DatevDataPreview | undefined
): void => {
  dataPreviewContent.replaceChildren();
  enableDataPreviewButton.hidden = false;
  isDataPreviewEnabled = false;

  if (!preview) {
    dataPreviewStatus.textContent = copy.dataPreview.unavailable.generic;
    enableDataPreviewButton.disabled = true;
    return;
  }

  if (!preview.available) {
    dataPreviewStatus.textContent =
      copy.dataPreview.unavailable[preview.reason ?? "generic"];
    enableDataPreviewButton.disabled = true;
    return;
  }

  dataPreviewStatus.textContent = copy.dataPreview.summary(
    preview.shownDataRows,
    preview.totalDataRows,
    preview.rowLimit
  );
  if (result.status === "unsupported") {
    dataPreviewStatus.textContent += ` ${copy.dataPreview.unsupportedNotice}`;
  }
  enableDataPreviewButton.disabled = false;
};

enableDataPreviewButton.addEventListener("click", () => {
  if (!latestPreview?.available || !latestResult) return;
  isDataPreviewEnabled = true;
  enableDataPreviewButton.hidden = true;
  renderEnabledDataPreview(latestResult, latestPreview);
});

const renderEnabledDataPreview = (
  result: DatevLiteValidationResult,
  preview: DatevDataPreview
): void => {
  dataPreviewContent.replaceChildren();
  if (!isDataPreviewEnabled) return;

  if (result.status === "unsupported") {
    const notice = document.createElement("p");
    notice.className = "data-preview-notice";
    notice.textContent = copy.dataPreview.unsupportedNotice;
    dataPreviewContent.append(notice);
  }

  if (preview.truncated) {
    const truncated = document.createElement("p");
    truncated.className = "data-preview-notice";
    truncated.textContent = copy.dataPreview.truncated(
      preview.shownDataRows,
      preview.totalDataRows
    );
    dataPreviewContent.append(truncated);
  }

  const wrap = document.createElement("div");
  wrap.className = "table-wrap data-preview-table-wrap";
  const table = document.createElement("table");
  table.className = "data-preview-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  appendHeaderCell(headRow, copy.dataPreview.line);
  appendHeaderCell(headRow, copy.dataPreview.fieldCount);
  const fieldCount = Math.max(
    preview.captions.length,
    ...preview.rows.map((row) => row.cells.length)
  );
  for (let index = 0; index < fieldCount; index += 1) {
    appendHeaderCell(
      headRow,
      preview.captions[index]?.value || copy.dataPreview.field(index + 1)
    );
  }
  thead.append(headRow);
  table.append(thead);

  const tbody = document.createElement("tbody");
  for (const row of preview.rows) {
    const tableRow = document.createElement("tr");
    appendCell(tableRow, String(row.line));
    appendCell(tableRow, String(row.fieldCount));
    for (let index = 0; index < fieldCount; index += 1) {
      appendCell(tableRow, row.cells[index]?.value ?? "");
    }
    tbody.append(tableRow);
  }
  table.append(tbody);
  wrap.append(table);
  dataPreviewContent.append(wrap);
};

const appendHeaderCell = (row: HTMLTableRowElement, value: string): void => {
  const cell = document.createElement("th");
  cell.scope = "col";
  cell.textContent = value;
  row.append(cell);
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

const renderMetadata = (
  result: DatevLiteValidationResult,
  contractSource: DatevContractSourceSummary | undefined
): void => {
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
  setText(metaContractSource, formatContractSource(contractSource));
};

const renderContractSourceWarning = (
  contractSource: DatevContractSourceSummary | undefined
): void => {
  const overrideCount = contractSource?.overrideCount ?? 0;
  if (contractSource?.kind === "mixed" && overrideCount > 0) {
    contractSourceWarning.hidden = false;
    contractSourceWarning.textContent =
      copy.contractSource.overrideWarning(overrideCount);
    return;
  }
  contractSourceWarning.hidden = true;
  contractSourceWarning.textContent = "";
};

const renderValidationReport = (
  report: DatevValidationReport,
  result: DatevLiteValidationResult
): void => {
  reportGeneratedAt.textContent = `${copy.report.generatedAt}: ${formatDateTime(report.generatedAt)}`;
  reportIntro.textContent = copy.report.intro;
  renderReportFacts(report, result);
  renderReportSections(report);
  renderReportActions(report.recommendedActions);
};

const renderReportFacts = (
  report: DatevValidationReport,
  result: DatevLiteValidationResult
): void => {
  reportFacts.replaceChildren();
  appendFact(reportFacts, copy.report.sourceAndPrivacy, result.source.name);
  appendFact(reportFacts, copy.metadata.encoding, result.csv.encoding);
  appendFact(
    reportFacts,
    copy.report.sections.contract,
    copy.report.contractSource[report.contractSource]
  );
  appendFact(
    reportFacts,
    copy.metadata.contractSource,
    formatContractSource(report.contractSourceSummary)
  );
  if (
    report.contractSourceSummary?.kind === "mixed" &&
    report.contractSourceSummary.overrideCount > 0
  ) {
    appendFact(
      reportFacts,
      copy.contractSource.overrideWarningLabel,
      copy.contractSource.overrideWarning(
        report.contractSourceSummary.overrideCount
      )
    );
  }
  appendFact(
    reportFacts,
    copy.metadata.recognition,
    result.format?.recognitionCode ?? "-"
  );
};

const renderReportSections = (report: DatevValidationReport): void => {
  reportSectionsList.replaceChildren();
  for (const section of report.sections) {
    const item = document.createElement("section");
    item.className = "report-section";

    const heading = document.createElement("div");
    heading.className = "report-section-heading";

    const title = document.createElement("h4");
    title.textContent = copy.report.sections[section.id];
    const status = document.createElement("span");
    status.className = `report-section-status is-${section.status}`;
    status.textContent = copy.report.status[section.status];

    heading.append(title, status);
    item.append(heading);

    const description = document.createElement("p");
    description.textContent = copy.report.sectionDescriptions[section.id];
    item.append(description);

    const counts = document.createElement("p");
    counts.className = "report-section-counts";
    counts.textContent = copy.diagnostics.summary(
      section.errorCount,
      section.warningCount
    );
    item.append(counts);

    if (section.diagnostics.length > 0) {
      item.append(createReportDiagnosticList(section.diagnostics));
    }

    reportSectionsList.append(item);
  }
};

const createReportDiagnosticList = (
  diagnostics: readonly ValidationReportDiagnostic[]
): HTMLUListElement => {
  const list = document.createElement("ul");
  list.className = "report-diagnostic-list";
  for (const diagnostic of diagnostics) {
    const item = document.createElement("li");
    const location = formatDiagnosticLocation(diagnostic);
    const remediation = copy.report.remediation[diagnostic.remediationCategory];
    item.textContent = `${diagnostic.severity.toUpperCase()} ${diagnostic.code}${location}: ${remediation}`;
    list.append(item);
  }
  return list;
};

const renderReportActions = (
  actions: readonly ValidationReportActionId[]
): void => {
  reportActionsList.replaceChildren();
  for (const action of actions) {
    const item = document.createElement("li");
    item.textContent = copy.report.actions[action];
    reportActionsList.append(item);
  }
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

const appendFact = (
  list: HTMLDListElement,
  term: string,
  description: string
): void => {
  const wrapper = document.createElement("div");
  const termElement = document.createElement("dt");
  const descriptionElement = document.createElement("dd");
  termElement.textContent = term;
  descriptionElement.textContent = description;
  wrapper.append(termElement, descriptionElement);
  list.append(wrapper);
};

const formatDateTime = (isoValue: string): string =>
  new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(isoValue));

const formatDiagnosticLocation = (
  diagnostic: Pick<
    DatevLiteDiagnostic,
    "column" | "fieldIndex" | "fieldName" | "line"
  >
): string => {
  const parts = [
    diagnostic.line === undefined
      ? undefined
      : `${copy.diagnostics.line} ${diagnostic.line}`,
    diagnostic.column === undefined
      ? undefined
      : `${copy.diagnostics.column} ${diagnostic.column}`,
    diagnostic.fieldName ??
      (diagnostic.fieldIndex === undefined
        ? undefined
        : `${copy.diagnostics.field} ${diagnostic.fieldIndex}`),
  ].filter(Boolean);
  return parts.length === 0 ? "" : ` (${parts.join(", ")})`;
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

downloadHtmlReportButton.addEventListener("click", () => {
  if (!latestReport || !latestResult) return;
  const blob = new Blob([createHtmlReport(latestReport, latestResult)], {
    type: "text/html;charset=utf-8",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${latestResult.source.name.replace(/[^a-zA-Z0-9._-]/g, "_")}.${copy.report.downloadName}.html`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 0);
});

const createHtmlReport = (
  report: DatevValidationReport,
  result: DatevLiteValidationResult
): string => `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(copy.report.htmlTitle)}</title>
  <style>
    :root { color-scheme: light; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { color: #102033; line-height: 1.5; margin: 0; padding: 32px; }
    main { margin: 0 auto; max-width: 980px; }
    h1, h2, h3, p { margin: 0; }
    h1 { font-size: 2rem; line-height: 1.1; }
    h2 { border-bottom: 1px solid #d7e4dc; font-size: 1.1rem; margin-top: 28px; padding-bottom: 6px; }
    .summary { color: #5b6b7d; margin-top: 8px; }
    dl { display: grid; gap: 8px; grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 18px 0; }
    dl div, section { border: 1px solid #d7e4dc; border-radius: 8px; padding: 12px; }
    dt { color: #5b6b7d; font-size: .78rem; font-weight: 800; text-transform: uppercase; }
    dd { font-weight: 700; margin: 2px 0 0; overflow-wrap: anywhere; }
    .section-heading { align-items: center; display: flex; gap: 12px; justify-content: space-between; }
    .status { border: 1px solid #aec7ba; border-radius: 999px; font-size: .78rem; font-weight: 800; padding: 3px 8px; }
    .failed { border-color: #b42318; color: #b42318; }
    .warning { border-color: #9a5b00; color: #9a5b00; }
    .passed { border-color: #176b5b; color: #176b5b; }
    .not-run { color: #5b6b7d; }
    ul { margin: 8px 0 0; padding-left: 20px; }
    li { margin: 4px 0; }
    footer { border-top: 1px solid #d7e4dc; color: #5b6b7d; margin-top: 32px; padding-top: 12px; }
    @media print { body { padding: 0; } section, dl div { break-inside: avoid; } }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(copy.report.htmlTitle)}</h1>
    <p class="summary">${escapeHtml(resultStatement.textContent ?? "")}</p>
    <dl>
      ${createFactHtml(copy.report.generatedAt, formatDateTime(report.generatedAt))}
      ${createFactHtml(copy.report.sourceAndPrivacy, result.source.name)}
      ${createFactHtml(copy.metadata.encoding, result.csv.encoding)}
      ${createFactHtml(copy.metadata.rows, String(result.csv.physicalLineCount))}
      ${createFactHtml(copy.metadata.dataRows, String(result.csv.dataRecordCount))}
      ${createFactHtml(copy.metadata.fields, result.csv.fieldCount === undefined ? "-" : String(result.csv.fieldCount))}
      ${createFactHtml(copy.report.sections.contract, copy.report.contractSource[report.contractSource])}
      ${createFactHtml(copy.metadata.contractSource, formatContractSource(report.contractSourceSummary))}
      ${
        report.contractSourceSummary?.kind === "mixed" &&
        report.contractSourceSummary.overrideCount > 0
          ? createFactHtml(
              copy.contractSource.overrideWarningLabel,
              copy.contractSource.overrideWarning(
                report.contractSourceSummary.overrideCount
              )
            )
          : ""
      }
      ${createFactHtml(copy.metadata.recognition, result.format?.recognitionCode ?? "-")}
    </dl>
    <h2>${escapeHtml(copy.report.nextActions)}</h2>
    <ul>
      ${report.recommendedActions
        .map((action) => `<li>${escapeHtml(copy.report.actions[action])}</li>`)
        .join("")}
    </ul>
    <h2>${escapeHtml(copy.report.sectionsLabel)}</h2>
    ${report.sections.map(createSectionHtml).join("")}
    <footer>
      <p>${escapeHtml(copy.report.intro)}</p>
      <p>${escapeHtml(copy.trust.intro)}</p>
    </footer>
  </main>
</body>
</html>
`;

const createSectionHtml = (
  section: DatevValidationReport["sections"][number]
): string => `<section>
  <div class="section-heading">
    <h3>${escapeHtml(copy.report.sections[section.id])}</h3>
    <span class="status ${section.status}">${escapeHtml(copy.report.status[section.status])}</span>
  </div>
  <p>${escapeHtml(copy.report.sectionDescriptions[section.id])}</p>
  <p>${escapeHtml(copy.diagnostics.summary(section.errorCount, section.warningCount))}</p>
  ${section.diagnostics.length === 0 ? "" : `<ul>${section.diagnostics.map(createDiagnosticHtml).join("")}</ul>`}
</section>`;

const createDiagnosticHtml = (diagnostic: ValidationReportDiagnostic): string =>
  `<li>${escapeHtml(diagnostic.severity.toUpperCase())} ${escapeHtml(diagnostic.code)}${escapeHtml(formatDiagnosticLocation(diagnostic))}: ${escapeHtml(copy.report.remediation[diagnostic.remediationCategory])}</li>`;

const createFactHtml = (term: string, description: string): string =>
  `<div><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(description)}</dd></div>`;

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

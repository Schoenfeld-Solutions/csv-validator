import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

import {
  csvLine,
  headerFor,
  headerLine,
  validGlAccountDescriptionCsv,
} from "../unit/datev-test-fixtures";

const appOrigin = "http://127.0.0.1:4321";

const validCustomContractXml = (
  overrides: Partial<{
    formatCategory: string;
    formatName: string;
    formatVersion: string;
    recognitionCode: string;
  }> = {}
): string => {
  const {
    formatCategory = "99",
    formatName = "Synthetic Format",
    formatVersion = "1",
    recognitionCode = "synthetic-format-v1",
  } = overrides;
  return [
    '<datev-format-contracts version="1">',
    `<contract recognitionCode="${recognitionCode}" formatCategory="${formatCategory}" formatName="${formatName}" formatVersion="${formatVersion}" markers="EXTF" requiredCaptions="Konto,Beschriftung" dataKind="synthetic">`,
    '<field number="1" caption="Konto" type="Konto" maxLength="9" decimalPlaces="0" necessary="true" formatExpression="" />',
    '<field number="2" caption="Beschriftung" type="Text" maxLength="40" decimalPlaces="0" necessary="true" formatExpression="" />',
    '<field number="3" caption="Datum" type="Datum" maxLength="4" decimalPlaces="0" necessary="false" formatExpression="TTMM" />',
    "</contract>",
    "</datev-format-contracts>",
  ].join("");
};

const validCustomContractCsv = (): string =>
  [
    headerFor("99", "Synthetic Format", "1"),
    csvLine(["Konto", "Beschriftung", "Datum"]),
    csvLine(["1000", "custom-hidden-value", "0101"]),
  ].join("\r\n");

const overridingGlAccountContractXml = (): string =>
  validCustomContractXml({
    formatCategory: "20",
    formatName: "Kontenbeschriftungen",
    formatVersion: "3",
    recognitionCode: "custom-gl-account-description-v3",
  });

const overridingGlAccountCsv = (): string =>
  [
    headerFor("20", "Kontenbeschriftungen", "3"),
    csvLine(["Konto", "Beschriftung", "Datum"]),
    csvLine(["1000", "override-hidden-value", "0101"]),
  ].join("\r\n");

const expectHtmlReportToBeLocalOnly = (htmlReport: string): void => {
  expect(htmlReport).not.toMatch(/<script\b/i);
  expect(htmlReport).not.toMatch(/<link\b[^>]+rel=["']?stylesheet/i);
  expect(htmlReport).not.toMatch(/\s(?:href|src)=["'](?:https?:)?\/\//i);
  expect(htmlReport).not.toMatch(/@import\s+url\(["']?(?:https?:)?\/\//i);
  expect(htmlReport).not.toMatch(
    /\b(?:gtag\s*\(|googletagmanager|google-analytics|plausible\.io|analytics\.js)\b/i
  );
};

const downloadJsonReport = async (page: Page): Promise<string> => {
  const jsonDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON report" }).click();
  const jsonDownload = await jsonDownloadPromise;
  const jsonPath = await jsonDownload.path();
  expect(jsonPath).toBeTruthy();
  return readFile(jsonPath ?? "", "utf8");
};

const dropCsvOnValidator = async (
  page: Page,
  content: string,
  name: string
): Promise<void> => {
  await page.evaluate(
    ({ csvContent, fileName }) => {
      const dropzone = document.getElementById("dropzone");
      if (!dropzone) throw new Error("dropzone missing");
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(
        new File([csvContent], fileName, { type: "text/csv" })
      );
      dropzone.dispatchEvent(
        new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          dataTransfer,
        })
      );
    },
    { csvContent: content, fileName: name }
  );
};

const expectBuiltInFallbackExportsSafe = async (
  page: Page,
  forbiddenValues: readonly string[]
): Promise<void> => {
  await expect(
    page.getByText(
      "Unsupported by the implemented local structural DATEV CSV contract."
    )
  ).toBeVisible();
  await expect(page.locator("#metaRecognition")).toHaveText("-");
  await expect(page.locator("#metaContractSource")).toContainText(
    "Built-in local contracts"
  );
  for (const forbiddenValue of forbiddenValues) {
    await expect(page.locator("body")).not.toContainText(forbiddenValue);
  }

  await page.evaluate(() => {
    const writableWindow = window as Window & { __copiedJson?: string };
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          writableWindow.__copiedJson = value;
        },
      },
    });
  });
  await page.getByRole("button", { name: "Copy JSON result" }).click();
  const copiedJson = await page.evaluate(
    () => (window as Window & { __copiedJson?: string }).__copiedJson ?? ""
  );
  expect(copiedJson).toContain("FORMAT_UNSUPPORTED");
  expect(copiedJson).not.toContain("datev-format-contracts");
  for (const forbiddenValue of forbiddenValues) {
    expect(copiedJson).not.toContain(forbiddenValue);
  }

  const jsonReport = await downloadJsonReport(page);
  expect(jsonReport).toContain("FORMAT_UNSUPPORTED");
  expect(jsonReport).not.toContain("datev-format-contracts");
  for (const forbiddenValue of forbiddenValues) {
    expect(jsonReport).not.toContain(forbiddenValue);
  }

  const htmlDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download HTML report" }).click();
  const htmlDownload = await htmlDownloadPromise;
  const htmlPath = await htmlDownload.path();
  expect(htmlPath).toBeTruthy();
  const htmlReport = await readFile(htmlPath ?? "", "utf8");
  expectHtmlReportToBeLocalOnly(htmlReport);
  expect(htmlReport).toContain("Built-in local contracts");
  expect(htmlReport).not.toContain("datev-format-contracts");
  for (const forbiddenValue of forbiddenValues) {
    expect(htmlReport).not.toContain(forbiddenValue);
  }
};

test("root redirects German browser locale to German validator", async ({
  browser,
}) => {
  const context = await browser.newContext({ locale: "de-DE" });
  const page = await context.newPage();

  await page.goto(`${appOrigin}/csv-validator/`);

  await expect(page).toHaveURL(`${appOrigin}/csv-validator/de/`);
  await expect(
    page.getByRole("heading", { name: "DATEV CSV-Dateien lokal prüfen" })
  ).toBeVisible();
  await context.close();
});

test("root redirects non-German browser locale to English validator and keeps URL state", async ({
  browser,
}) => {
  const context = await browser.newContext({ locale: "fr-FR" });
  const page = await context.newPage();

  await page.goto(`${appOrigin}/csv-validator/?source=e2e#dropzone`);

  await expect(page).toHaveURL(
    `${appOrigin}/csv-validator/en/?source=e2e#dropzone`
  );
  await expect(
    page.getByRole("heading", { name: "Validate DATEV CSV files locally" })
  ).toBeVisible();
  await context.close();
});

test("loads German and English validator routes with language switch", async ({
  page,
}) => {
  await page.goto("/csv-validator/de/");
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(
    page.getByRole("heading", { name: "DATEV CSV-Dateien lokal prüfen" })
  ).toBeVisible();
  await expect(
    page.getByText(
      "Maximale Größe: 10 MiB. UTF-8 mit oder ohne BOM oder Windows-1252."
    )
  ).toBeVisible();

  await page
    .getByRole("link", { name: "Sprache auf Englisch wechseln" })
    .click();
  await expect(page).toHaveURL(/\/csv-validator\/en\/$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("heading", { name: "Validate DATEV CSV files locally" })
  ).toBeVisible();
  await expect(
    page.getByText(
      "Maximum size: 10 MiB. UTF-8 with or without BOM or Windows-1252."
    )
  ).toBeVisible();
});

test("renders worker progress messages in the active language", async ({
  page,
}) => {
  await page.addInitScript(() => {
    class LocalizedProgressWorker {
      private readonly listeners = new Set<EventListener>();

      addEventListener(type: string, listener: EventListener): void {
        if (type === "message") this.listeners.add(listener);
      }

      removeEventListener(type: string, listener: EventListener): void {
        if (type === "message") this.listeners.delete(listener);
      }

      postMessage(message: unknown): void {
        const request = message as { readonly type?: string };
        if (request.type !== "validate") return;
        queueMicrotask(() => {
          const event = new MessageEvent("message", {
            data: { code: "read-file", type: "progress" },
          });
          for (const listener of this.listeners) listener(event);
        });
      }

      terminate(): void {
        this.listeners.clear();
      }
    }

    Object.defineProperty(window, "Worker", {
      configurable: true,
      value: LocalizedProgressWorker,
    });
  });
  await page.goto("/csv-validator/de/");

  await page.evaluate((content) => {
    const dropzone = document.getElementById("dropzone");
    if (!dropzone) throw new Error("dropzone missing");
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(
      new File([content], "lokal.csv", { type: "text/csv" })
    );
    dropzone.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      })
    );
  }, validGlAccountDescriptionCsv());

  await expect(page.locator("#statusLine")).toHaveText(
    "Datei wird im Browser-Worker gelesen."
  );
});

test("keeps legal links only in the footer", async ({ page }) => {
  await page.goto("/csv-validator/de/");

  const headerNavigation = page.locator(".site-nav");
  const footer = page.locator(".site-footer");

  await expect(
    headerNavigation.getByRole("link", { exact: true, name: "Validator" })
  ).toBeVisible();
  await expect(
    headerNavigation.getByRole("link", { exact: true, name: "Formate" })
  ).toBeVisible();
  await expect(
    headerNavigation.getByRole("link", { exact: true, name: "Datenschutz" })
  ).toHaveCount(0);
  await expect(
    headerNavigation.getByRole("link", { exact: true, name: "Haftung" })
  ).toHaveCount(0);
  await expect(
    headerNavigation.getByRole("link", { exact: true, name: "Impressum" })
  ).toHaveCount(0);

  await expect(
    footer.getByRole("link", { name: "Datenschutz" })
  ).toHaveAttribute("href", "/csv-validator/de/datenschutz/");
  await expect(footer.getByRole("link", { name: "Haftung" })).toHaveAttribute(
    "href",
    "/csv-validator/de/haftung/"
  );
  await expect(footer.getByRole("link", { name: "Impressum" })).toHaveAttribute(
    "href",
    "/csv-validator/de/impressum/"
  );
});

test("shows the opposite theme icon for the effective system theme", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => {
    localStorage.removeItem("csv-validator-theme");
  });
  await page.goto("/csv-validator/de/");

  const themeToggle = page.getByRole("button", {
    name: "Hell-/Dunkelmodus umschalten",
  });

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(themeToggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".theme-icon-sun")).toBeVisible();
  await expect(page.locator(".theme-icon-moon")).toBeHidden();

  await themeToggle.click();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(themeToggle).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".theme-icon-sun")).toBeHidden();
  await expect(page.locator(".theme-icon-moon")).toBeVisible();
});

test("keeps report export controls disabled until validation completes", async ({
  page,
}) => {
  await page.addInitScript(() => {
    class PendingValidationWorker {
      private readonly listeners = new Set<EventListener>();

      constructor() {
        (
          window as Window & {
            __completeValidation?: (sourceName?: string) => void;
          }
        ).__completeValidation = (sourceName = "pending.csv") => {
          const event = new MessageEvent("message", {
            data: {
              result: {
                csv: {
                  dataRecordCount: 0,
                  delimiter: ";",
                  encoding: "utf-8-sig",
                  fieldCount: 4,
                  physicalLineCount: 2,
                  quote: '"',
                },
                diagnostics: [],
                format: {
                  category: "20",
                  dataKind: "master",
                  marker: "EXTF",
                  name: "Kontenbeschriftungen",
                  recognitionCode: "datev-gl-account-description-v3",
                  version: "3",
                },
                schemaVersion: 1,
                source: {
                  name: sourceName,
                  processedInBrowser: true,
                  sizeBytes: 128,
                },
                status: "valid",
                summary: {
                  errorCount: 0,
                  warningCount: 0,
                },
              },
              type: "result",
            },
          });
          for (const listener of this.listeners) listener(event);
        };
      }

      addEventListener(type: string, listener: EventListener): void {
        if (type === "message") this.listeners.add(listener);
      }

      removeEventListener(type: string, listener: EventListener): void {
        if (type === "message") this.listeners.delete(listener);
      }

      postMessage(message: unknown): void {
        const request = message as { readonly type?: string };
        if (request.type !== "validate") return;
        const event = new MessageEvent("message", {
          data: { code: "read-file", type: "progress" },
        });
        for (const listener of this.listeners) listener(event);
      }

      terminate(): void {
        this.listeners.clear();
      }
    }

    Object.defineProperty(window, "Worker", {
      configurable: true,
      value: PendingValidationWorker,
    });
  });
  await page.goto("/csv-validator/en/");

  const copyButton = page.locator("#copyJsonButton");
  const jsonButton = page.locator("#downloadJsonButton");
  const htmlButton = page.locator("#downloadHtmlReportButton");

  await expect(copyButton).toBeDisabled();
  await expect(jsonButton).toBeDisabled();
  await expect(htmlButton).toBeDisabled();

  await page.evaluate((content) => {
    const dropzone = document.getElementById("dropzone");
    if (!dropzone) throw new Error("dropzone missing");
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(
      new File([content], "pending.csv", { type: "text/csv" })
    );
    dropzone.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      })
    );
  }, validGlAccountDescriptionCsv());

  await expect(copyButton).toBeDisabled();
  await expect(jsonButton).toBeDisabled();
  await expect(htmlButton).toBeDisabled();

  await page.evaluate(() => {
    (
      window as Window & {
        __completeValidation?: (sourceName?: string) => void;
      }
    ).__completeValidation?.("pending.csv");
  });

  await expect(copyButton).toBeEnabled();
  await expect(jsonButton).toBeEnabled();
  await expect(htmlButton).toBeEnabled();

  await page.evaluate((content) => {
    const dropzone = document.getElementById("dropzone");
    if (!dropzone) throw new Error("dropzone missing");
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(
      new File([content], "pending-second.csv", { type: "text/csv" })
    );
    dropzone.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      })
    );
  }, validGlAccountDescriptionCsv());

  await expect(copyButton).toBeDisabled();
  await expect(jsonButton).toBeDisabled();
  await expect(htmlButton).toBeDisabled();
});

test("clears stale validation exports while XML contracts are loading", async ({
  page,
}) => {
  await page.addInitScript(() => {
    class PendingContractLoadWorker {
      private readonly listeners = new Set<EventListener>();

      addEventListener(type: string, listener: EventListener): void {
        if (type === "message") this.listeners.add(listener);
      }

      removeEventListener(type: string, listener: EventListener): void {
        if (type === "message") this.listeners.delete(listener);
      }

      postMessage(message: unknown): void {
        const request = message as {
          readonly file?: File;
          readonly type?: string;
        };
        if (request.type === "validate") {
          const sourceName = request.file?.name ?? "previous.csv";
          queueMicrotask(() => {
            this.emit({
              result: {
                csv: {
                  dataRecordCount: 1,
                  delimiter: ";",
                  encoding: "utf-8",
                  fieldCount: 2,
                  physicalLineCount: 3,
                  quote: '"',
                },
                diagnostics: [],
                format: {
                  category: "20",
                  dataKind: "master",
                  marker: "EXTF",
                  name: "Kontenbeschriftungen",
                  recognitionCode: "datev-gl-account-description-v3",
                  version: "3",
                },
                schemaVersion: 1,
                source: {
                  name: sourceName,
                  processedInBrowser: true,
                  sizeBytes: 128,
                },
                status: "valid",
                summary: {
                  errorCount: 0,
                  warningCount: 0,
                },
              },
              type: "result",
            });
          });
          return;
        }
        if (request.type === "load-contracts") {
          queueMicrotask(() => {
            this.emit({ code: "read-xml-contracts", type: "progress" });
          });
        }
      }

      terminate(): void {
        this.listeners.clear();
      }

      private emit(data: unknown): void {
        const event = new MessageEvent("message", { data });
        for (const listener of this.listeners) listener(event);
      }
    }

    Object.defineProperty(window, "Worker", {
      configurable: true,
      value: PendingContractLoadWorker,
    });
  });
  await page.goto("/csv-validator/en/");

  const copyButton = page.locator("#copyJsonButton");
  const jsonButton = page.locator("#downloadJsonButton");
  const htmlButton = page.locator("#downloadHtmlReportButton");

  await page.locator("#fileInput").setInputFiles({
    buffer: Buffer.from(validGlAccountDescriptionCsv(), "utf8"),
    mimeType: "text/csv",
    name: "previous-result.csv",
  });

  await expect(page.locator("#resultPanel")).toBeVisible();
  await expect(copyButton).toBeEnabled();
  await expect(jsonButton).toBeEnabled();
  await expect(htmlButton).toBeEnabled();

  await page.locator("#xmlContractInput").setInputFiles({
    buffer: Buffer.from(validCustomContractXml(), "utf8"),
    mimeType: "application/xml",
    name: "pending-contract.xml",
  });

  await expect(page.locator("#resultPanel")).toBeHidden();
  await expect(copyButton).toBeDisabled();
  await expect(jsonButton).toBeDisabled();
  await expect(htmlButton).toBeDisabled();
  await expect(page.locator("#statusLine")).toHaveText(
    "Reading local DATEV XML contracts."
  );
  await expect(page.locator("#xmlContractStatus")).toContainText(
    "Loading 1 XML file locally"
  );
});

test("clears stale validation exports while contract source revalidation is pending", async ({
  page,
}) => {
  await page.addInitScript(() => {
    class PendingSourceSwitchWorker {
      private readonly listeners = new Set<EventListener>();
      private validationCount = 0;

      addEventListener(type: string, listener: EventListener): void {
        if (type === "message") this.listeners.add(listener);
      }

      removeEventListener(type: string, listener: EventListener): void {
        if (type === "message") this.listeners.delete(listener);
      }

      postMessage(message: unknown): void {
        const request = message as {
          readonly contractSource?: "built-in" | "mixed" | "uploaded";
          readonly file?: File;
          readonly type?: string;
        };
        if (request.type === "validate") {
          const currentValidation = this.validationCount;
          this.validationCount += 1;
          if (currentValidation >= 2) {
            queueMicrotask(() => {
              this.emit({ code: "read-file", type: "progress" });
            });
            return;
          }
          const sourceName = request.file?.name ?? "source-switch.csv";
          const contractSource =
            request.contractSource === "mixed"
              ? {
                  contractCount: 1,
                  kind: "mixed",
                  label: "Built-in plus XML contracts",
                  overrideCount: 0,
                  warningCount: 0,
                }
              : {
                  contractCount: 12,
                  kind: "built-in",
                  label: "Built-in local contracts",
                  overrideCount: 0,
                  warningCount: 0,
                };
          queueMicrotask(() => {
            this.emit({
              contractSource,
              result: {
                csv: {
                  dataRecordCount: 1,
                  delimiter: ";",
                  encoding: "utf-8",
                  fieldCount: 2,
                  physicalLineCount: 3,
                  quote: '"',
                },
                diagnostics: [],
                format: {
                  category: "20",
                  dataKind: "master",
                  marker: "EXTF",
                  name: "Kontenbeschriftungen",
                  recognitionCode: "datev-gl-account-description-v3",
                  version: "3",
                },
                schemaVersion: 1,
                source: {
                  name: sourceName,
                  processedInBrowser: true,
                  sizeBytes: 128,
                },
                status: "valid",
                summary: {
                  errorCount: 0,
                  warningCount: 0,
                },
              },
              type: "result",
            });
          });
          return;
        }
        if (request.type === "load-contracts") {
          queueMicrotask(() => {
            this.emit({
              diagnostics: [],
              mixedSummary: {
                contractCount: 1,
                kind: "mixed",
                label: "Built-in plus XML contracts",
                overrideCount: 0,
                warningCount: 0,
              },
              summary: {
                contractCount: 1,
                kind: "uploaded",
                label: "Loaded XML contracts",
                overrideCount: 0,
                warningCount: 0,
              },
              type: "contracts",
            });
          });
        }
      }

      terminate(): void {
        this.listeners.clear();
      }

      private emit(data: unknown): void {
        const event = new MessageEvent("message", { data });
        for (const listener of this.listeners) listener(event);
      }
    }

    Object.defineProperty(window, "Worker", {
      configurable: true,
      value: PendingSourceSwitchWorker,
    });
  });
  await page.goto("/csv-validator/en/");

  const copyButton = page.locator("#copyJsonButton");
  const jsonButton = page.locator("#downloadJsonButton");
  const htmlButton = page.locator("#downloadHtmlReportButton");

  await page.locator("#fileInput").setInputFiles({
    buffer: Buffer.from(validGlAccountDescriptionCsv(), "utf8"),
    mimeType: "text/csv",
    name: "source-switch.csv",
  });

  await expect(page.locator("#resultPanel")).toBeVisible();
  await expect(copyButton).toBeEnabled();
  await expect(jsonButton).toBeEnabled();
  await expect(htmlButton).toBeEnabled();

  await page.locator("#xmlContractInput").setInputFiles({
    buffer: Buffer.from(validCustomContractXml(), "utf8"),
    mimeType: "application/xml",
    name: "source-switch-contract.xml",
  });

  await expect(page.locator("#contractSourceSelect")).toHaveValue("mixed");
  await expect(page.locator("#metaContractSource")).toContainText(
    "Built-in plus loaded XML contracts"
  );
  await expect(copyButton).toBeEnabled();
  await expect(jsonButton).toBeEnabled();
  await expect(htmlButton).toBeEnabled();

  await page.locator("#contractSourceSelect").selectOption("built-in");

  await expect(page.locator("#resultPanel")).toBeHidden();
  await expect(copyButton).toBeDisabled();
  await expect(jsonButton).toBeDisabled();
  await expect(htmlButton).toBeDisabled();
  await expect(page.locator("#statusLine")).toHaveText(
    "Reading file in the browser worker."
  );
});

test("validates a local CSV selected with the file picker", async ({
  page,
}) => {
  await page.goto("/csv-validator/en/");

  await page.locator("#fileInput").setInputFiles({
    buffer: Buffer.from(validGlAccountDescriptionCsv(), "utf8"),
    mimeType: "text/csv",
    name: "picker-accounts.csv",
  });

  await expect(
    page.getByText(
      "Valid against the implemented local structural DATEV CSV contract."
    )
  ).toBeVisible();
  await expect(page.locator("#metaRecognition")).toHaveText(
    "datev-gl-account-description-v3"
  );
  await expect(page.locator("#metaContractSource")).toContainText(
    "Built-in local contracts"
  );
  await expect(page.locator("#statusLine")).toContainText(
    "picker-accounts.csv processed locally in the browser."
  );
  await expect(page.locator("body")).not.toContainText("Kasse lang");
});

test("validates a dropped local CSV file and toggles theme", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => {
    const created: Array<{ size: number; type: string; url: string }> = [];
    const revoked: string[] = [];
    const originalCreateObjectUrl = URL.createObjectURL.bind(URL);
    const originalRevokeObjectUrl = URL.revokeObjectURL.bind(URL);

    Object.defineProperty(window, "__reportObjectUrlEvents", {
      configurable: true,
      value: { created, revoked },
    });

    URL.createObjectURL = (object: Blob | MediaSource): string => {
      const url = originalCreateObjectUrl(object);
      created.push({
        size: object instanceof Blob ? object.size : -1,
        type: object instanceof Blob ? object.type : "",
        url,
      });
      return url;
    };

    URL.revokeObjectURL = (url: string): void => {
      revoked.push(url);
      originalRevokeObjectUrl(url);
    };
  });
  await page.goto("/csv-validator/en/");

  await page.evaluate((content) => {
    const dropzone = document.getElementById("dropzone");
    if (!dropzone) throw new Error("dropzone missing");
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(
      new File([content], "accounts.csv", { type: "text/csv" })
    );
    dropzone.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      })
    );
  }, validGlAccountDescriptionCsv());

  await expect(
    page.getByText(
      "Valid against the implemented local structural DATEV CSV contract."
    )
  ).toBeVisible();
  await expect(page.locator("#metaRecognition")).toHaveText(
    "datev-gl-account-description-v3"
  );
  await expect(
    page.getByRole("heading", { name: "Structured validation report" })
  ).toBeVisible();
  await expect(page.getByText("Field semantics")).toBeVisible();
  await expect(page.getByText("Recommended next actions")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Kasse lang");
  await expect(page.locator(".trust-icon")).toHaveCount(3);

  await page.getByRole("tab", { name: "Analysis" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Data" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await expect(page.locator("body")).not.toContainText("Kasse lang");

  await page.getByRole("button", { name: "Show data preview" }).click();
  await expect(
    page.getByRole("columnheader", { exact: true, name: "Konto" })
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: "Kasse lang" })).toBeVisible();

  await page.getByRole("tab", { name: "Analysis" }).click();
  await page.evaluate(() => {
    const writableWindow = window as Window & { __copiedJson?: string };
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          writableWindow.__copiedJson = value;
        },
      },
    });
  });
  await page.getByRole("button", { name: "Copy JSON result" }).click();
  const copiedJson = await page.evaluate(
    () => (window as Window & { __copiedJson?: string }).__copiedJson ?? ""
  );
  expect(copiedJson).toContain("datev-gl-account-description-v3");
  expect(copiedJson).not.toContain("Kasse lang");

  const jsonDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON report" }).click();
  const jsonDownload = await jsonDownloadPromise;
  const jsonPath = await jsonDownload.path();
  expect(jsonPath).toBeTruthy();
  const jsonReport = await readFile(jsonPath ?? "", "utf8");
  expect(jsonReport).not.toContain("Kasse lang");

  const htmlDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download HTML report" }).click();
  const htmlDownload = await htmlDownloadPromise;
  const htmlPath = await htmlDownload.path();
  expect(htmlPath).toBeTruthy();
  const htmlReport = await readFile(htmlPath ?? "", "utf8");
  expectHtmlReportToBeLocalOnly(htmlReport);
  expect(htmlReport).toContain("DATEV CSV Validator Report");
  expect(htmlReport).toContain("No upload");
  expect(htmlReport).toContain("datev-gl-account-description-v3");
  expect(htmlReport).not.toContain("Kasse lang");

  await page.waitForFunction(() => {
    const events = (
      window as Window & {
        __reportObjectUrlEvents?: {
          created: readonly unknown[];
          revoked: readonly unknown[];
        };
      }
    ).__reportObjectUrlEvents;
    return (
      events !== undefined &&
      events.created.length >= 2 &&
      events.revoked.length >= 2
    );
  });
  const objectUrlEvents = await page.evaluate(
    () =>
      (
        window as Window & {
          __reportObjectUrlEvents?: {
            created: Array<{ size: number; type: string; url: string }>;
            revoked: string[];
          };
        }
      ).__reportObjectUrlEvents
  );
  expect(objectUrlEvents?.created.map((item) => item.type)).toEqual([
    "application/json",
    "text/html;charset=utf-8",
  ]);
  expect(
    objectUrlEvents?.created.every((item) => item.url.startsWith("blob:"))
  ).toBe(true);
  expect(objectUrlEvents?.created.every((item) => item.size > 0)).toBe(true);
  expect(objectUrlEvents?.revoked).toEqual(
    objectUrlEvents?.created.map((item) => item.url)
  );

  await page.getByRole("tab", { name: "Data" }).click();
  await expect(page.getByRole("cell", { name: "Kasse lang" })).toBeVisible();

  await page.evaluate(
    (content) => {
      const dropzone = document.getElementById("dropzone");
      if (!dropzone) throw new Error("dropzone missing");
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(
        new File([content], "accounts-second.csv", { type: "text/csv" })
      );
      dropzone.dispatchEvent(
        new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          dataTransfer,
        })
      );
    },
    validGlAccountDescriptionCsv().replace("Kasse lang", "Second hidden value")
  );

  await expect(page.locator("#metaRecognition")).toHaveText(
    "datev-gl-account-description-v3"
  );
  await expect(page.getByRole("tab", { name: "Analysis" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await expect(page.getByRole("tab", { name: "Data" })).toHaveAttribute(
    "aria-selected",
    "false"
  );
  await expect(page.locator("body")).not.toContainText("Kasse lang");
  await page.getByRole("tab", { name: "Data" }).click();
  await expect(page.locator("body")).not.toContainText("Second hidden value");
  await expect(
    page.getByRole("button", { name: "Show data preview" })
  ).toBeVisible();

  const themeToggle = page.getByRole("button", {
    name: "Toggle light and dark mode",
  });
  await themeToggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("rejects unsupported primary file names before reading content", async ({
  page,
}) => {
  await page.goto("/csv-validator/en/");

  await page.evaluate((content) => {
    const dropzone = document.getElementById("dropzone");
    if (!dropzone) throw new Error("dropzone missing");
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(
      new File([content], "not-a-datev-file.json", {
        type: "application/json",
      })
    );
    dropzone.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      })
    );
  }, `{"hidden":"primary-secret-value"}`);

  await expect(
    page.getByText(
      "Invalid against the implemented local structural DATEV CSV contract."
    )
  ).toBeVisible();
  await expect(page.locator("#diagnosticsBody")).toContainText(
    "FILE_TYPE_UNSUPPORTED"
  );
  await expect(page.locator("body")).not.toContainText("primary-secret-value");

  const htmlDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download HTML report" }).click();
  const htmlDownload = await htmlDownloadPromise;
  const htmlPath = await htmlDownload.path();
  expect(htmlPath).toBeTruthy();
  const htmlReport = await readFile(htmlPath ?? "", "utf8");
  expectHtmlReportToBeLocalOnly(htmlReport);
  expect(htmlReport).toContain("FILE_TYPE_UNSUPPORTED");
  expect(htmlReport).not.toContain("primary-secret-value");
});

test("does not show path-like file names while processing starts", async ({
  page,
}) => {
  await page.goto("/csv-validator/en/");

  const immediateStatus = await page.evaluate((content) => {
    const dropzone = document.getElementById("dropzone");
    const statusLine = document.getElementById("statusLine");
    if (!dropzone) throw new Error("dropzone missing");
    if (!statusLine) throw new Error("status line missing");
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(
      new File([content], "/private/path/safe-name.csv", { type: "text/csv" })
    );
    dropzone.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      })
    );
    return statusLine.textContent ?? "";
  }, validGlAccountDescriptionCsv());

  expect(immediateStatus).toContain("safe-name.csv");
  expect(immediateStatus).not.toContain("/private/path");
  expect(immediateStatus).not.toContain("\\private\\path");

  await expect(page.locator("#statusLine")).toContainText(
    "safe-name.csv processed locally in the browser."
  );
  await expect(page.locator("#statusLine")).not.toContainText("/private/path");
});

test("escapes browser file names in downloaded HTML reports", async ({
  page,
}) => {
  await page.goto("/csv-validator/en/");

  const fileName = "report-<img src=x onerror=alert(1)>.csv";

  await page.evaluate(
    ({ content, name }) => {
      const dropzone = document.getElementById("dropzone");
      if (!dropzone) throw new Error("dropzone missing");
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(new File([content], name, { type: "text/csv" }));
      dropzone.dispatchEvent(
        new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          dataTransfer,
        })
      );
    },
    { content: validGlAccountDescriptionCsv(), name: fileName }
  );

  await expect(
    page.getByText(
      "Valid against the implemented local structural DATEV CSV contract."
    )
  ).toBeVisible();

  const htmlDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download HTML report" }).click();
  const htmlDownload = await htmlDownloadPromise;
  expect(htmlDownload.suggestedFilename()).not.toContain("<");
  expect(htmlDownload.suggestedFilename()).not.toContain(">");
  const htmlPath = await htmlDownload.path();
  expect(htmlPath).toBeTruthy();
  const htmlReport = await readFile(htmlPath ?? "", "utf8");
  expectHtmlReportToBeLocalOnly(htmlReport);
  expect(htmlReport).toContain("report-&lt;img src=x onerror=alert(1)&gt;.csv");
  expect(htmlReport).not.toContain(fileName);
  expect(htmlReport).not.toContain("<img src=x");
});

test("loads synthetic XML contracts locally and validates with mixed source fallback", async ({
  page,
}) => {
  await page.goto("/csv-validator/en/");

  await page.locator("#xmlContractInput").setInputFiles({
    buffer: Buffer.from(
      `<?xml version="1.0" encoding="UTF-8"?>${validCustomContractXml()}`,
      "utf8"
    ),
    mimeType: "application/xml",
    name: "synthetic-contract.xml",
  });

  await expect(page.locator("#xmlContractStatus")).toContainText(
    "1 XML contract loaded locally"
  );
  await expect(page.locator("#contractSourceSelect")).toHaveValue("mixed");

  await page.evaluate((content) => {
    const dropzone = document.getElementById("dropzone");
    if (!dropzone) throw new Error("dropzone missing");
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(
      new File([content], "custom-contract-file.csv", { type: "text/csv" })
    );
    dropzone.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      })
    );
  }, validCustomContractCsv());

  await expect(
    page.getByText(
      "Valid against the implemented local structural DATEV CSV contract."
    )
  ).toBeVisible();
  await expect(page.locator("#metaRecognition")).toHaveText(
    "synthetic-format-v1"
  );
  await expect(page.locator("#metaContractSource")).toContainText(
    "Built-in plus loaded XML contracts"
  );
  await expect(page.locator("body")).not.toContainText("custom-hidden-value");

  await page.evaluate(() => {
    const writableWindow = window as Window & { __copiedJson?: string };
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          writableWindow.__copiedJson = value;
        },
      },
    });
  });
  await page.getByRole("button", { name: "Copy JSON result" }).click();
  const copiedJson = await page.evaluate(
    () => (window as Window & { __copiedJson?: string }).__copiedJson ?? ""
  );
  expect(copiedJson).toContain("synthetic-format-v1");
  expect(copiedJson).not.toContain("custom-hidden-value");
  expect(copiedJson).not.toContain("datev-format-contracts");

  const jsonReport = await downloadJsonReport(page);
  expect(jsonReport).toContain("synthetic-format-v1");
  expect(jsonReport).not.toContain("custom-hidden-value");
  expect(jsonReport).not.toContain("datev-format-contracts");

  const htmlDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download HTML report" }).click();
  const htmlDownload = await htmlDownloadPromise;
  const htmlPath = await htmlDownload.path();
  expect(htmlPath).toBeTruthy();
  const htmlReport = await readFile(htmlPath ?? "", "utf8");
  expectHtmlReportToBeLocalOnly(htmlReport);
  expect(htmlReport).toContain("Built-in plus loaded XML contracts");
  expect(htmlReport).not.toContain("custom-hidden-value");
  expect(htmlReport).not.toContain("datev-format-contracts");

  await page.evaluate((content) => {
    const dropzone = document.getElementById("dropzone");
    if (!dropzone) throw new Error("dropzone missing");
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(
      new File([content], "built-in-fallback.csv", { type: "text/csv" })
    );
    dropzone.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      })
    );
  }, validGlAccountDescriptionCsv());

  await expect(page.locator("#metaRecognition")).toHaveText(
    "datev-gl-account-description-v3"
  );
  await expect(page.locator("#metaContractSource")).toContainText(
    "Built-in plus loaded XML contracts"
  );
  await expect(page.locator("#contractSourceWarning")).toBeHidden();

  await page.locator("#contractSourceSelect").selectOption("uploaded");
  await expect(page.locator("#contractSourceSelect")).toHaveValue("uploaded");

  await page.evaluate((content) => {
    const dropzone = document.getElementById("dropzone");
    if (!dropzone) throw new Error("dropzone missing");
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(
      new File([content], "custom-only.csv", { type: "text/csv" })
    );
    dropzone.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      })
    );
  }, validCustomContractCsv());

  await expect(page.locator("#metaContractSource")).toContainText(
    "Loaded XML contracts (1)"
  );

  await page.locator("#contractSourceSelect").selectOption("built-in");

  await expect(
    page.getByText(
      "Unsupported by the implemented local structural DATEV CSV contract."
    )
  ).toBeVisible();
  await expect(page.locator("#metaRecognition")).toHaveText("-");
  await expect(page.locator("#metaContractSource")).toContainText(
    "Built-in local contracts"
  );
});

test("applies and discards a session-local contract edit without exposing raw values", async ({
  page,
}) => {
  await page.goto("/csv-validator/en/");

  await page.evaluate((content) => {
    const dropzone = document.getElementById("dropzone");
    if (!dropzone) throw new Error("dropzone missing");
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(
      new File([content], "editable-session.csv", { type: "text/csv" })
    );
    dropzone.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      })
    );
  }, validGlAccountDescriptionCsv());

  await expect(
    page.getByText(
      "Valid against the implemented local structural DATEV CSV contract."
    )
  ).toBeVisible();

  await page.getByRole("button", { name: "Create editable copy" }).click();
  await expect(
    page.getByRole("heading", { name: "Edit local contract copy" })
  ).toBeVisible();

  await page.locator("#editableFieldMaxLength-4").fill("4");
  await page.getByRole("button", { name: "Apply session edit" }).click();

  await expect(page.locator("#contractSourceSelect")).toHaveValue(
    "edited-session"
  );
  await expect(page.locator("#metaContractSource")).toContainText(
    "Edited session contract"
  );
  await expect(page.locator("#contractSourceWarning")).toContainText(
    "Built-in default contracts remain unchanged"
  );
  await expect(
    page.getByText(
      "Invalid against the implemented local structural DATEV CSV contract."
    )
  ).toBeVisible();
  await expect(page.locator("#diagnosticsBody")).toContainText(
    "FIELD_TEXT_MAX_LENGTH"
  );
  await expect(page.locator("body")).not.toContainText("Kasse lang");

  await page.evaluate(() => {
    const writableWindow = window as Window & { __editedJson?: string };
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          writableWindow.__editedJson = value;
        },
      },
    });
  });
  await page.getByRole("button", { name: "Copy JSON result" }).click();
  const copiedJson = await page.evaluate(
    () => (window as Window & { __editedJson?: string }).__editedJson ?? ""
  );
  expect(copiedJson).toContain("FIELD_TEXT_MAX_LENGTH");
  expect(copiedJson).not.toContain("Kasse lang");

  const jsonReport = await downloadJsonReport(page);
  expect(jsonReport).toContain("FIELD_TEXT_MAX_LENGTH");
  expect(jsonReport).not.toContain("Kasse lang");

  await page.getByRole("button", { name: "Discard edit" }).click();
  await expect(page.locator("#contractSourceSelect")).toHaveValue("built-in");
  await expect(page.locator("#contractSourceWarning")).toBeHidden();
  await expect(
    page.getByText(
      "Valid against the implemented local structural DATEV CSV contract."
    )
  ).toBeVisible();
});

test("rejects invalid session-local contract edits without replacing the active edit", async ({
  page,
}) => {
  await page.goto("/csv-validator/en/");

  await dropCsvOnValidator(
    page,
    validGlAccountDescriptionCsv(),
    "invalid-edit-session.csv"
  );
  await expect(
    page.getByText(
      "Valid against the implemented local structural DATEV CSV contract."
    )
  ).toBeVisible();

  await page.getByRole("button", { name: "Create editable copy" }).click();
  await expect(
    page.getByRole("heading", { name: "Edit local contract copy" })
  ).toBeVisible();

  await page.locator("#editableFieldMaxLength-4").fill("4");
  await page.getByRole("button", { name: "Apply session edit" }).click();

  await expect(page.locator("#contractSourceSelect")).toHaveValue(
    "edited-session"
  );
  await expect(page.locator("#metaContractSource")).toContainText(
    "Edited session contract"
  );
  await expect(
    page.getByText(
      "Invalid against the implemented local structural DATEV CSV contract."
    )
  ).toBeVisible();
  await expect(page.locator("#diagnosticsBody")).toContainText(
    "FIELD_TEXT_MAX_LENGTH"
  );

  await page.locator("#editableFieldMaxLength-4").fill("-1");
  await page.getByRole("button", { name: "Apply session edit" }).click();

  await expect(page.locator("#contractEditorStatus")).toContainText(
    "EDIT_CONTRACT_MAX_LENGTH"
  );
  await expect(page.locator("#contractSourceSelect")).toHaveValue(
    "edited-session"
  );
  await expect(page.locator("#metaContractSource")).toContainText(
    "Edited session contract"
  );
  await expect(page.locator("#diagnosticsBody")).toContainText(
    "FIELD_TEXT_MAX_LENGTH"
  );
  await expect(page.locator("body")).not.toContainText("Kasse lang");

  await page.evaluate(() => {
    const writableWindow = window as Window & { __invalidEditJson?: string };
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          writableWindow.__invalidEditJson = value;
        },
      },
    });
  });
  await page.getByRole("button", { name: "Copy JSON result" }).click();
  const copiedJson = await page.evaluate(
    () =>
      (window as Window & { __invalidEditJson?: string }).__invalidEditJson ??
      ""
  );
  expect(copiedJson).toContain("FIELD_TEXT_MAX_LENGTH");
  expect(copiedJson).not.toContain("EDIT_CONTRACT_MAX_LENGTH");
  expect(copiedJson).not.toContain("Kasse lang");

  const jsonDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON report" }).click();
  const jsonDownload = await jsonDownloadPromise;
  const jsonPath = await jsonDownload.path();
  expect(jsonPath).toBeTruthy();
  const jsonReport = await readFile(jsonPath ?? "", "utf8");
  expect(jsonReport).toContain("FIELD_TEXT_MAX_LENGTH");
  expect(jsonReport).not.toContain("EDIT_CONTRACT_MAX_LENGTH");
  expect(jsonReport).not.toContain("Kasse lang");

  const htmlDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download HTML report" }).click();
  const htmlDownload = await htmlDownloadPromise;
  const htmlPath = await htmlDownload.path();
  expect(htmlPath).toBeTruthy();
  const htmlReport = await readFile(htmlPath ?? "", "utf8");
  expectHtmlReportToBeLocalOnly(htmlReport);
  expect(htmlReport).toContain("Edited session contract");
  expect(htmlReport).toContain("FIELD_TEXT_MAX_LENGTH");
  expect(htmlReport).not.toContain("EDIT_CONTRACT_MAX_LENGTH");
  expect(htmlReport).not.toContain("Kasse lang");
});

test("guards session edit exports while save or discard is pending", async ({
  page,
}) => {
  await page.addInitScript(() => {
    class PendingEditorWorker {
      private readonly listeners = new Set<EventListener>();

      addEventListener(type: string, listener: EventListener): void {
        if (type === "message") this.listeners.add(listener);
      }

      removeEventListener(type: string, listener: EventListener): void {
        if (type === "message") this.listeners.delete(listener);
      }

      postMessage(message: unknown): void {
        const request = message as {
          readonly draft?: {
            readonly fields?: readonly { readonly maxLength?: number }[];
          };
          readonly file?: File;
          readonly type?: string;
        };
        if (request.type === "validate") {
          const sourceName = request.file?.name ?? "editable-pending.csv";
          queueMicrotask(() => {
            this.emit({
              result: {
                csv: {
                  dataRecordCount: 1,
                  delimiter: ";",
                  encoding: "utf-8",
                  fieldCount: 2,
                  physicalLineCount: 3,
                  quote: '"',
                },
                diagnostics: [],
                format: {
                  category: "20",
                  dataKind: "master",
                  marker: "EXTF",
                  name: "Kontenbeschriftungen",
                  recognitionCode: "datev-gl-account-description-v3",
                  version: "3",
                },
                schemaVersion: 1,
                source: {
                  name: sourceName,
                  processedInBrowser: true,
                  sizeBytes: 128,
                },
                status: "valid",
                summary: {
                  errorCount: 0,
                  warningCount: 0,
                },
              },
              type: "result",
            });
          });
          return;
        }
        if (request.type === "create-editable-contract") {
          queueMicrotask(() => {
            this.emit({
              diagnostics: [],
              draft: {
                fields: [
                  {
                    caption: "Konto",
                    decimalPlaces: 0,
                    fieldNumber: 1,
                    formatExpression: "",
                    formatType: "Konto",
                    maxLength: 9,
                    necessary: true,
                  },
                  {
                    caption: "Beschriftung",
                    decimalPlaces: 0,
                    fieldNumber: 2,
                    formatExpression: "",
                    formatType: "Text",
                    maxLength: 40,
                    necessary: true,
                  },
                ],
                recognition: {
                  allowedDatevMarkers: ["EXTF"],
                  dataKind: "master",
                  formatCategory: "20",
                  formatName: "Kontenbeschriftungen",
                  formatVersion: "3",
                  recognitionCode: "datev-gl-account-description-v3",
                  requiredCaptions: ["Konto", "Beschriftung"],
                },
              },
              type: "editable-contract",
            });
          });
          return;
        }
        if (request.type === "save-editable-contract") {
          const hasInvalidField = request.draft?.fields?.some(
            (field) => (field.maxLength ?? 0) < 0
          );
          if (hasInvalidField) {
            queueMicrotask(() => {
              this.emit({
                diagnostics: [
                  {
                    code: "EDIT_CONTRACT_MAX_LENGTH",
                    message: "The edited contract field max length is invalid.",
                    severity: "error",
                  },
                ],
                type: "editable-contract",
              });
            });
          }
          return;
        }
        if (request.type === "discard-editable-contract") {
          return;
        }
      }

      terminate(): void {
        this.listeners.clear();
      }

      private emit(data: unknown): void {
        const event = new MessageEvent("message", { data });
        for (const listener of this.listeners) listener(event);
      }
    }

    Object.defineProperty(window, "Worker", {
      configurable: true,
      value: PendingEditorWorker,
    });
  });
  await page.goto("/csv-validator/en/");

  const copyButton = page.locator("#copyJsonButton");
  const jsonButton = page.locator("#downloadJsonButton");
  const htmlButton = page.locator("#downloadHtmlReportButton");

  await page.locator("#fileInput").setInputFiles({
    buffer: Buffer.from(validGlAccountDescriptionCsv(), "utf8"),
    mimeType: "text/csv",
    name: "editable-pending.csv",
  });

  await expect(page.locator("#resultPanel")).toBeVisible();
  await expect(copyButton).toBeEnabled();
  await expect(jsonButton).toBeEnabled();
  await expect(htmlButton).toBeEnabled();

  await page.getByRole("button", { name: "Create editable copy" }).click();
  await expect(
    page.getByRole("heading", { name: "Edit local contract copy" })
  ).toBeVisible();

  await page.getByRole("button", { name: "Apply session edit" }).click();

  await expect(page.locator("#resultPanel")).toBeVisible();
  await expect(copyButton).toBeDisabled();
  await expect(jsonButton).toBeDisabled();
  await expect(htmlButton).toBeDisabled();
  await expect(page.locator("#contractEditorStatus")).toContainText(
    "Checking edited session contract"
  );

  await page.locator("#editableFieldMaxLength-2").fill("-1");
  await page.getByRole("button", { name: "Apply session edit" }).click();

  await expect(page.locator("#contractEditorStatus")).toContainText(
    "EDIT_CONTRACT_MAX_LENGTH"
  );
  await expect(copyButton).toBeEnabled();
  await expect(jsonButton).toBeEnabled();
  await expect(htmlButton).toBeEnabled();

  await page.getByRole("button", { name: "Discard edit" }).click();

  await expect(page.locator("#resultPanel")).toBeHidden();
  await expect(copyButton).toBeDisabled();
  await expect(jsonButton).toBeDisabled();
  await expect(htmlButton).toBeDisabled();
  await expect(page.locator("#contractEditorStatus")).toContainText(
    "Discarding edited session contract"
  );
});

test("rejects oversized XML contracts before interpretation", async ({
  page,
}) => {
  await page.goto("/csv-validator/en/");

  await page.locator("#xmlContractInput").setInputFiles({
    buffer: Buffer.alloc(2 * 1024 * 1024 + 1, "x"),
    mimeType: "application/xml",
    name: "too-large.xml",
  });

  await expect(page.locator("#xmlContractStatus")).toContainText(
    "XML_CONTRACT_FILE_TOO_LARGE"
  );
  await expect(page.locator("#contractSourceSelect")).toHaveValue("built-in");
});

test("rejects XML contract count and set size limits before interpretation", async ({
  page,
}) => {
  await page.goto("/csv-validator/en/");

  await page.locator("#xmlContractInput").setInputFiles(
    Array.from({ length: 21 }, (_, index) => ({
      buffer: Buffer.from(
        validCustomContractXml({
          formatCategory: String(900 + index),
          formatName: `secret-count-limit-format-${index}`,
          recognitionCode: `secret-count-limit-v${index}`,
        }),
        "utf8"
      ),
      mimeType: "application/xml",
      name: `contract-${index}.xml`,
    }))
  );

  await expect(page.locator("#xmlContractStatus")).toContainText(
    "XML_CONTRACT_FILE_LIMIT"
  );
  await expect(page.locator("#contractSourceSelect")).toHaveValue("built-in");
  await expect(page.locator("body")).not.toContainText(
    "secret-count-limit-format"
  );

  await page.locator("#xmlContractInput").setInputFiles(
    Array.from({ length: 11 }, (_, index) => ({
      buffer: Buffer.concat([
        Buffer.from(`secret-total-limit-format-${index}`),
        Buffer.alloc(1024 * 1024, "x"),
      ]),
      mimeType: "application/xml",
      name: `total-limit-${index}.xml`,
    }))
  );

  await expect(page.locator("#xmlContractStatus")).toContainText(
    "XML_CONTRACT_SET_TOO_LARGE"
  );
  await expect(page.locator("#contractSourceSelect")).toHaveValue("built-in");
  await expect(page.locator("body")).not.toContainText(
    "secret-total-limit-format"
  );
});

test("clears loaded XML contracts after XML upload size-limit rejection", async ({
  page,
}) => {
  await page.goto("/csv-validator/en/");

  await page.locator("#xmlContractInput").setInputFiles({
    buffer: Buffer.from(validCustomContractXml(), "utf8"),
    mimeType: "application/xml",
    name: "valid-contract-before-size-reject.xml",
  });
  await expect(page.locator("#contractSourceSelect")).toHaveValue("mixed");

  await page.evaluate((content) => {
    const dropzone = document.getElementById("dropzone");
    if (!dropzone) throw new Error("dropzone missing");
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(
      new File([content], "before-size-reject.csv", {
        type: "text/csv",
      })
    );
    dropzone.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      })
    );
  }, validCustomContractCsv());

  await expect(page.locator("#metaRecognition")).toHaveText(
    "synthetic-format-v1"
  );

  const rawSizeSecret = "raw-xml-size-limit-secret-value";
  await page.locator("#xmlContractInput").setInputFiles({
    buffer: Buffer.concat([
      Buffer.from(
        validCustomContractXml({
          formatName: rawSizeSecret,
          recognitionCode: "raw-size-limit-secret-v1",
        }),
        "utf8"
      ),
      Buffer.alloc(2 * 1024 * 1024 + 1, "x"),
    ]),
    mimeType: "application/xml",
    name: "too-large-after-custom.xml",
  });

  await expect(page.locator("#xmlContractStatus")).toContainText(
    "XML_CONTRACT_FILE_TOO_LARGE"
  );
  await expect(page.locator("#contractSourceSelect")).toHaveValue("built-in");
  await expect(page.locator("body")).not.toContainText(rawSizeSecret);
  await expect(page.locator("body")).not.toContainText(
    "raw-size-limit-secret-v1"
  );

  await page.evaluate((content) => {
    const dropzone = document.getElementById("dropzone");
    if (!dropzone) throw new Error("dropzone missing");
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(
      new File([content], "after-size-reject.csv", {
        type: "text/csv",
      })
    );
    dropzone.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      })
    );
  }, validCustomContractCsv());

  await expect(
    page.getByText(
      "Unsupported by the implemented local structural DATEV CSV contract."
    )
  ).toBeVisible();
  await expect(page.locator("#metaRecognition")).toHaveText("-");
  await expect(page.locator("#metaContractSource")).toContainText(
    "Built-in local contracts"
  );
  await expect(page.locator("body")).not.toContainText(rawSizeSecret);
  await expect(page.locator("body")).not.toContainText("custom-hidden-value");

  await page.evaluate(() => {
    const writableWindow = window as Window & { __copiedJson?: string };
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          writableWindow.__copiedJson = value;
        },
      },
    });
  });
  await page.getByRole("button", { name: "Copy JSON result" }).click();
  const copiedJson = await page.evaluate(
    () => (window as Window & { __copiedJson?: string }).__copiedJson ?? ""
  );
  expect(copiedJson).toContain("FORMAT_UNSUPPORTED");
  expect(copiedJson).not.toContain(rawSizeSecret);
  expect(copiedJson).not.toContain("raw-size-limit-secret-v1");
  expect(copiedJson).not.toContain("custom-hidden-value");
  expect(copiedJson).not.toContain("datev-format-contracts");

  const jsonReport = await downloadJsonReport(page);
  expect(jsonReport).toContain("FORMAT_UNSUPPORTED");
  expect(jsonReport).not.toContain(rawSizeSecret);
  expect(jsonReport).not.toContain("raw-size-limit-secret-v1");
  expect(jsonReport).not.toContain("custom-hidden-value");
  expect(jsonReport).not.toContain("datev-format-contracts");

  const htmlDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download HTML report" }).click();
  const htmlDownload = await htmlDownloadPromise;
  const htmlPath = await htmlDownload.path();
  expect(htmlPath).toBeTruthy();
  const htmlReport = await readFile(htmlPath ?? "", "utf8");
  expectHtmlReportToBeLocalOnly(htmlReport);
  expect(htmlReport).toContain("Built-in local contracts");
  expect(htmlReport).not.toContain(rawSizeSecret);
  expect(htmlReport).not.toContain("raw-size-limit-secret-v1");
  expect(htmlReport).not.toContain("custom-hidden-value");
  expect(htmlReport).not.toContain("datev-format-contracts");
});

test("clears loaded XML contracts after XML contract set-limit rejection", async ({
  page,
}) => {
  await page.goto("/csv-validator/en/");

  await page.locator("#xmlContractInput").setInputFiles({
    buffer: Buffer.from(validCustomContractXml(), "utf8"),
    mimeType: "application/xml",
    name: "valid-contract-before-set-limit-reject.xml",
  });
  await expect(page.locator("#contractSourceSelect")).toHaveValue("mixed");

  await dropCsvOnValidator(
    page,
    validCustomContractCsv(),
    "before-set-limit-reject.csv"
  );
  await expect(page.locator("#metaRecognition")).toHaveText(
    "synthetic-format-v1"
  );

  const rawCountSecret = "raw-xml-count-limit-secret-value";
  await page.locator("#xmlContractInput").setInputFiles(
    Array.from({ length: 21 }, (_, index) => ({
      buffer: Buffer.from(
        validCustomContractXml({
          formatCategory: String(910 + index),
          formatName: `${rawCountSecret}-${index}`,
          recognitionCode: `raw-count-limit-secret-v${index}`,
        }),
        "utf8"
      ),
      mimeType: "application/xml",
      name: `too-many-after-custom-${index}.xml`,
    }))
  );

  await expect(page.locator("#xmlContractStatus")).toContainText(
    "XML_CONTRACT_FILE_LIMIT"
  );
  await expect(page.locator("#contractSourceSelect")).toHaveValue("built-in");
  await expect(page.locator("body")).not.toContainText(rawCountSecret);

  await dropCsvOnValidator(
    page,
    validCustomContractCsv(),
    "after-count-limit-reject.csv"
  );
  await expectBuiltInFallbackExportsSafe(page, [
    rawCountSecret,
    "raw-count-limit-secret-v",
    "custom-hidden-value",
  ]);

  await page.locator("#xmlContractInput").setInputFiles({
    buffer: Buffer.from(validCustomContractXml(), "utf8"),
    mimeType: "application/xml",
    name: "valid-contract-before-total-limit-reject.xml",
  });
  await expect(page.locator("#contractSourceSelect")).toHaveValue("mixed");
  await expect(page.locator("#metaRecognition")).toHaveText(
    "synthetic-format-v1"
  );

  const rawTotalSecret = "raw-xml-total-limit-secret-value";
  await page.locator("#xmlContractInput").setInputFiles(
    Array.from({ length: 11 }, (_, index) => ({
      buffer: Buffer.concat([
        Buffer.from(
          validCustomContractXml({
            formatCategory: String(950 + index),
            formatName: `${rawTotalSecret}-${index}`,
            recognitionCode: `raw-total-limit-secret-v${index}`,
          }),
          "utf8"
        ),
        Buffer.alloc(1024 * 1024, "x"),
      ]),
      mimeType: "application/xml",
      name: `total-limit-after-custom-${index}.xml`,
    }))
  );

  await expect(page.locator("#xmlContractStatus")).toContainText(
    "XML_CONTRACT_SET_TOO_LARGE"
  );
  await expect(page.locator("#contractSourceSelect")).toHaveValue("built-in");
  await expect(page.locator("body")).not.toContainText(rawTotalSecret);

  await dropCsvOnValidator(
    page,
    validCustomContractCsv(),
    "after-total-limit-reject.csv"
  );
  await expectBuiltInFallbackExportsSafe(page, [
    rawCountSecret,
    "raw-count-limit-secret-v",
    rawTotalSecret,
    "raw-total-limit-secret-v",
    "custom-hidden-value",
  ]);
});

test("rejects non-XML contract filenames before interpretation", async ({
  page,
}) => {
  await page.goto("/csv-validator/en/");

  await page.locator("#xmlContractInput").setInputFiles({
    buffer: Buffer.from(validCustomContractXml(), "utf8"),
    mimeType: "text/plain",
    name: "not-a-contract.txt",
  });

  await expect(page.locator("#xmlContractStatus")).toContainText(
    "XML_CONTRACT_FILE_TYPE_UNSUPPORTED"
  );
  await expect(page.locator("#contractSourceSelect")).toHaveValue("built-in");
  await expect(page.locator("body")).not.toContainText(
    "datev-format-contracts"
  );
});

test("clears loaded XML contracts after non-XML contract filename rejection", async ({
  page,
}) => {
  await page.goto("/csv-validator/en/");

  await page.locator("#xmlContractInput").setInputFiles({
    buffer: Buffer.from(validCustomContractXml(), "utf8"),
    mimeType: "application/xml",
    name: "valid-contract-before-filetype-reject.xml",
  });
  await expect(page.locator("#contractSourceSelect")).toHaveValue("mixed");

  await page.evaluate((content) => {
    const dropzone = document.getElementById("dropzone");
    if (!dropzone) throw new Error("dropzone missing");
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(
      new File([content], "before-filetype-reject.csv", {
        type: "text/csv",
      })
    );
    dropzone.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      })
    );
  }, validCustomContractCsv());

  await expect(page.locator("#metaRecognition")).toHaveText(
    "synthetic-format-v1"
  );

  const rawFileTypeSecret = "raw-xml-filetype-secret-value";
  await page.locator("#xmlContractInput").setInputFiles({
    buffer: Buffer.from(
      validCustomContractXml({
        formatName: rawFileTypeSecret,
        recognitionCode: "raw-filetype-secret-v1",
      }),
      "utf8"
    ),
    mimeType: "text/plain",
    name: "not-an-xml-contract.txt",
  });

  await expect(page.locator("#xmlContractStatus")).toContainText(
    "XML_CONTRACT_FILE_TYPE_UNSUPPORTED"
  );
  await expect(page.locator("#contractSourceSelect")).toHaveValue("built-in");
  await expect(page.locator("body")).not.toContainText(rawFileTypeSecret);
  await expect(page.locator("body")).not.toContainText(
    "raw-filetype-secret-v1"
  );

  await page.evaluate((content) => {
    const dropzone = document.getElementById("dropzone");
    if (!dropzone) throw new Error("dropzone missing");
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(
      new File([content], "after-filetype-reject.csv", {
        type: "text/csv",
      })
    );
    dropzone.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      })
    );
  }, validCustomContractCsv());

  await expect(
    page.getByText(
      "Unsupported by the implemented local structural DATEV CSV contract."
    )
  ).toBeVisible();
  await expect(page.locator("#metaRecognition")).toHaveText("-");
  await expect(page.locator("#metaContractSource")).toContainText(
    "Built-in local contracts"
  );
  await expect(page.locator("body")).not.toContainText(rawFileTypeSecret);
  await expect(page.locator("body")).not.toContainText("custom-hidden-value");

  await page.evaluate(() => {
    const writableWindow = window as Window & { __copiedJson?: string };
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          writableWindow.__copiedJson = value;
        },
      },
    });
  });
  await page.getByRole("button", { name: "Copy JSON result" }).click();
  const copiedJson = await page.evaluate(
    () => (window as Window & { __copiedJson?: string }).__copiedJson ?? ""
  );
  expect(copiedJson).toContain("FORMAT_UNSUPPORTED");
  expect(copiedJson).not.toContain(rawFileTypeSecret);
  expect(copiedJson).not.toContain("raw-filetype-secret-v1");
  expect(copiedJson).not.toContain("custom-hidden-value");
  expect(copiedJson).not.toContain("datev-format-contracts");

  const jsonReport = await downloadJsonReport(page);
  expect(jsonReport).toContain("FORMAT_UNSUPPORTED");
  expect(jsonReport).not.toContain(rawFileTypeSecret);
  expect(jsonReport).not.toContain("raw-filetype-secret-v1");
  expect(jsonReport).not.toContain("custom-hidden-value");
  expect(jsonReport).not.toContain("datev-format-contracts");

  const htmlDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download HTML report" }).click();
  const htmlDownload = await htmlDownloadPromise;
  const htmlPath = await htmlDownload.path();
  expect(htmlPath).toBeTruthy();
  const htmlReport = await readFile(htmlPath ?? "", "utf8");
  expectHtmlReportToBeLocalOnly(htmlReport);
  expect(htmlReport).toContain("Built-in local contracts");
  expect(htmlReport).not.toContain(rawFileTypeSecret);
  expect(htmlReport).not.toContain("raw-filetype-secret-v1");
  expect(htmlReport).not.toContain("custom-hidden-value");
  expect(htmlReport).not.toContain("datev-format-contracts");
});

test("rejects unsupported XML contract content without exposing raw values", async ({
  page,
}) => {
  await page.goto("/csv-validator/en/");

  const rawXmlSecret = "raw-xml-secret-value";
  const unsupportedXml = [
    '<datev-format-contracts version="1">',
    `<unsupported-contract-shape secret="${rawXmlSecret}" />`,
    "</datev-format-contracts>",
  ].join("");

  await page.locator("#xmlContractInput").setInputFiles({
    buffer: Buffer.from(unsupportedXml, "utf8"),
    mimeType: "application/xml",
    name: "unsupported-contract-shape.xml",
  });

  await expect(page.locator("#xmlContractStatus")).toContainText(
    "XML_CONTRACT_NODE_UNSUPPORTED"
  );
  await expect(page.locator("#contractSourceSelect")).toHaveValue("built-in");
  await expect(page.locator("body")).not.toContainText(rawXmlSecret);
  await expect(page.locator("body")).not.toContainText(
    "unsupported-contract-shape"
  );

  await page.evaluate((content) => {
    const dropzone = document.getElementById("dropzone");
    if (!dropzone) throw new Error("dropzone missing");
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(
      new File([content], "built-in-after-xml-rejection.csv", {
        type: "text/csv",
      })
    );
    dropzone.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      })
    );
  }, validGlAccountDescriptionCsv());

  await expect(
    page.getByText(
      "Valid against the implemented local structural DATEV CSV contract."
    )
  ).toBeVisible();
  await expect(page.locator("#metaContractSource")).toContainText(
    "Built-in local contracts"
  );
  await expect(page.locator("body")).not.toContainText(rawXmlSecret);

  await page.evaluate(() => {
    const writableWindow = window as Window & { __copiedJson?: string };
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          writableWindow.__copiedJson = value;
        },
      },
    });
  });
  await page.getByRole("button", { name: "Copy JSON result" }).click();
  const copiedJson = await page.evaluate(
    () => (window as Window & { __copiedJson?: string }).__copiedJson ?? ""
  );
  expect(copiedJson).toContain("datev-gl-account-description-v3");
  expect(copiedJson).not.toContain(rawXmlSecret);
  expect(copiedJson).not.toContain("unsupported-contract-shape");

  const jsonReport = await downloadJsonReport(page);
  expect(jsonReport).toContain("datev-gl-account-description-v3");
  expect(jsonReport).not.toContain(rawXmlSecret);
  expect(jsonReport).not.toContain("unsupported-contract-shape");

  const htmlDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download HTML report" }).click();
  const htmlDownload = await htmlDownloadPromise;
  const htmlPath = await htmlDownload.path();
  expect(htmlPath).toBeTruthy();
  const htmlReport = await readFile(htmlPath ?? "", "utf8");
  expectHtmlReportToBeLocalOnly(htmlReport);
  expect(htmlReport).toContain("Built-in local contracts");
  expect(htmlReport).not.toContain(rawXmlSecret);
  expect(htmlReport).not.toContain("unsupported-contract-shape");
});

test("clears loaded XML contracts after malformed XML contract content", async ({
  page,
}) => {
  await page.goto("/csv-validator/en/");

  await page.locator("#xmlContractInput").setInputFiles({
    buffer: Buffer.from(validCustomContractXml(), "utf8"),
    mimeType: "application/xml",
    name: "valid-contract-before-malformed-reject.xml",
  });
  await expect(page.locator("#contractSourceSelect")).toHaveValue("mixed");

  await dropCsvOnValidator(
    page,
    validCustomContractCsv(),
    "before-malformed-reject.csv"
  );
  await expect(page.locator("#metaRecognition")).toHaveText(
    "synthetic-format-v1"
  );

  const rawMalformedSecret = "raw-xml-malformed-secret-value";
  const malformedXml = [
    '<datev-format-contracts version="1">',
    `<contract recognitionCode="raw-malformed-secret-v1" formatCategory="99" formatName="${rawMalformedSecret}"`,
  ].join("");

  await page.locator("#xmlContractInput").setInputFiles({
    buffer: Buffer.from(malformedXml, "utf8"),
    mimeType: "application/xml",
    name: "malformed-after-custom.xml",
  });

  await expect(page.locator("#xmlContractStatus")).toContainText(
    "XML_CONTRACT_MALFORMED"
  );
  await expect(page.locator("#contractSourceSelect")).toHaveValue("built-in");
  await expect(page.locator("body")).not.toContainText(rawMalformedSecret);
  await expect(page.locator("body")).not.toContainText(
    "raw-malformed-secret-v1"
  );

  await dropCsvOnValidator(
    page,
    validCustomContractCsv(),
    "after-malformed-reject.csv"
  );
  await expectBuiltInFallbackExportsSafe(page, [
    rawMalformedSecret,
    "raw-malformed-secret-v1",
    "custom-hidden-value",
  ]);
});

test("clears loaded XML contracts after security-rejected XML content", async ({
  page,
}) => {
  await page.goto("/csv-validator/en/");

  await page.locator("#xmlContractInput").setInputFiles({
    buffer: Buffer.from(validCustomContractXml(), "utf8"),
    mimeType: "application/xml",
    name: "first-valid-contract.xml",
  });
  await expect(page.locator("#contractSourceSelect")).toHaveValue("mixed");

  await page.evaluate((content) => {
    const dropzone = document.getElementById("dropzone");
    if (!dropzone) throw new Error("dropzone missing");
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(
      new File([content], "before-security-reject.csv", {
        type: "text/csv",
      })
    );
    dropzone.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      })
    );
  }, validCustomContractCsv());

  await expect(page.locator("#metaRecognition")).toHaveText(
    "synthetic-format-v1"
  );

  const rawSecuritySecret = "raw-xml-security-secret-value";
  const securityRejectedXml = [
    `<!DOCTYPE root SYSTEM "file:///tmp/${rawSecuritySecret}">`,
    '<datev-format-contracts version="1" />',
  ].join("");

  await page.locator("#xmlContractInput").setInputFiles({
    buffer: Buffer.from(securityRejectedXml, "utf8"),
    mimeType: "application/xml",
    name: "security-rejected.xml",
  });

  await expect(page.locator("#xmlContractStatus")).toContainText(
    "XML_CONTRACT_SECURITY_UNSUPPORTED"
  );
  await expect(page.locator("#contractSourceSelect")).toHaveValue("built-in");
  await expect(page.locator("body")).not.toContainText(rawSecuritySecret);

  await page.evaluate((content) => {
    const dropzone = document.getElementById("dropzone");
    if (!dropzone) throw new Error("dropzone missing");
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(
      new File([content], "after-security-reject.csv", {
        type: "text/csv",
      })
    );
    dropzone.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      })
    );
  }, validCustomContractCsv());

  await expect(
    page.getByText(
      "Unsupported by the implemented local structural DATEV CSV contract."
    )
  ).toBeVisible();
  await expect(page.locator("#metaRecognition")).toHaveText("-");
  await expect(page.locator("#metaContractSource")).toContainText(
    "Built-in local contracts"
  );
  await expect(page.locator("body")).not.toContainText(rawSecuritySecret);
  await expect(page.locator("body")).not.toContainText("custom-hidden-value");

  await page.evaluate(() => {
    const writableWindow = window as Window & { __copiedJson?: string };
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          writableWindow.__copiedJson = value;
        },
      },
    });
  });
  await page.getByRole("button", { name: "Copy JSON result" }).click();
  const copiedJson = await page.evaluate(
    () => (window as Window & { __copiedJson?: string }).__copiedJson ?? ""
  );
  expect(copiedJson).toContain("FORMAT_UNSUPPORTED");
  expect(copiedJson).not.toContain(rawSecuritySecret);
  expect(copiedJson).not.toContain("custom-hidden-value");
  expect(copiedJson).not.toContain("datev-format-contracts");

  const jsonReport = await downloadJsonReport(page);
  expect(jsonReport).toContain("FORMAT_UNSUPPORTED");
  expect(jsonReport).not.toContain(rawSecuritySecret);
  expect(jsonReport).not.toContain("custom-hidden-value");
  expect(jsonReport).not.toContain("datev-format-contracts");

  const htmlDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download HTML report" }).click();
  const htmlDownload = await htmlDownloadPromise;
  const htmlPath = await htmlDownload.path();
  expect(htmlPath).toBeTruthy();
  const htmlReport = await readFile(htmlPath ?? "", "utf8");
  expectHtmlReportToBeLocalOnly(htmlReport);
  expect(htmlReport).toContain("Built-in local contracts");
  expect(htmlReport).not.toContain(rawSecuritySecret);
  expect(htmlReport).not.toContain("custom-hidden-value");
  expect(htmlReport).not.toContain("datev-format-contracts");
});

test("shows a warning when mixed XML contracts override built-in signatures", async ({
  page,
}) => {
  await page.goto("/csv-validator/en/");

  await page.locator("#xmlContractInput").setInputFiles({
    buffer: Buffer.from(overridingGlAccountContractXml(), "utf8"),
    mimeType: "application/xml",
    name: "gl-override.xml",
  });

  await expect(page.locator("#contractSourceSelect")).toHaveValue("mixed");
  await expect(page.locator("#contractSourceSelect")).toContainText(
    "1 override"
  );

  await page.evaluate((content) => {
    const dropzone = document.getElementById("dropzone");
    if (!dropzone) throw new Error("dropzone missing");
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(
      new File([content], "override.csv", { type: "text/csv" })
    );
    dropzone.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      })
    );
  }, overridingGlAccountCsv());

  await expect(page.locator("#metaRecognition")).toHaveText(
    "custom-gl-account-description-v3"
  );
  await expect(page.locator("#contractSourceWarning")).toContainText(
    "override built-in local contract data"
  );
  await expect(page.locator("body")).not.toContainText("override-hidden-value");

  await page.evaluate(() => {
    const writableWindow = window as Window & { __overrideJson?: string };
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          writableWindow.__overrideJson = value;
        },
      },
    });
  });
  await page.getByRole("button", { name: "Copy JSON result" }).click();
  const copiedJson = await page.evaluate(
    () => (window as Window & { __overrideJson?: string }).__overrideJson ?? ""
  );
  expect(copiedJson).toContain("custom-gl-account-description-v3");
  expect(copiedJson).not.toContain("override-hidden-value");
  expect(copiedJson).not.toContain("datev-format-contracts");

  const jsonReport = await downloadJsonReport(page);
  expect(jsonReport).toContain("custom-gl-account-description-v3");
  expect(jsonReport).not.toContain("override-hidden-value");
  expect(jsonReport).not.toContain("datev-format-contracts");

  const htmlDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download HTML report" }).click();
  const htmlDownload = await htmlDownloadPromise;
  const htmlPath = await htmlDownload.path();
  expect(htmlPath).toBeTruthy();
  const htmlReport = await readFile(htmlPath ?? "", "utf8");
  expectHtmlReportToBeLocalOnly(htmlReport);
  expect(htmlReport).toContain("Override warning");
  expect(htmlReport).toContain("override built-in local contract data");
  expect(htmlReport).not.toContain("override-hidden-value");
  expect(htmlReport).not.toContain("datev-format-contracts");
});

test("creates a structured report for unsupported local CSV files", async ({
  page,
}) => {
  await page.goto("/csv-validator/en/");

  const unsupportedCsv = [
    headerLine({ 2: "999", 3: "Unsupported", 4: "1" }),
    csvLine(["Unsupported caption", "B"]),
    csvLine(["preview-secret", "2"]),
  ].join("\r\n");
  const expectedFileSize = `${Buffer.byteLength(unsupportedCsv, "utf8")} B`;

  await page.evaluate((content) => {
    const dropzone = document.getElementById("dropzone");
    if (!dropzone) throw new Error("dropzone missing");
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(
      new File([content], "unsupported.csv", { type: "text/csv" })
    );
    dropzone.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      })
    );
  }, unsupportedCsv);

  await expect(
    page.getByText(
      "Unsupported by the implemented local structural DATEV CSV contract."
    )
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Structured validation report" })
  ).toBeVisible();
  await expect(page.locator("#reportFacts")).toContainText("File size");
  await expect(page.locator("#reportFacts")).toContainText(expectedFileSize);
  await expect(page.getByText("Unsupported checks")).toBeVisible();
  await expect(page.getByText("Not run").first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText("preview-secret");

  await page.getByRole("tab", { name: "Data" }).click();
  await expect(page.locator("body")).not.toContainText("preview-secret");
  await page.getByRole("button", { name: "Show data preview" }).click();
  await expect(
    page
      .locator("#dataPreviewContent")
      .getByText(
        "No supported local contract matched this file; this is a raw parsed CSV preview only."
      )
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "preview-secret" })
  ).toBeVisible();

  await page.getByRole("tab", { name: "Analysis" }).click();
  await page.evaluate(() => {
    const writableWindow = window as Window & { __copiedJson?: string };
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          writableWindow.__copiedJson = value;
        },
      },
    });
  });
  await page.getByRole("button", { name: "Copy JSON result" }).click();
  const copiedJson = await page.evaluate(
    () => (window as Window & { __copiedJson?: string }).__copiedJson ?? ""
  );
  expect(copiedJson).toContain("FORMAT_UNSUPPORTED");
  expect(copiedJson).not.toContain("EXTF;");
  expect(copiedJson).not.toContain("preview-secret");

  const jsonDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON report" }).click();
  const jsonDownload = await jsonDownloadPromise;
  const jsonPath = await jsonDownload.path();
  expect(jsonPath).toBeTruthy();
  const jsonReport = await readFile(jsonPath ?? "", "utf8");
  expect(jsonReport).toContain("FORMAT_UNSUPPORTED");
  expect(jsonReport).not.toContain("EXTF;");
  expect(jsonReport).not.toContain("preview-secret");

  const htmlDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download HTML report" }).click();
  const htmlDownload = await htmlDownloadPromise;
  const htmlPath = await htmlDownload.path();
  expect(htmlPath).toBeTruthy();
  const htmlReport = await readFile(htmlPath ?? "", "utf8");
  expectHtmlReportToBeLocalOnly(htmlReport);
  expect(htmlReport).toContain("File size");
  expect(htmlReport).toContain(expectedFileSize);
  expect(htmlReport).toContain("Recommended next actions");
  expect(htmlReport).toContain(
    "Check the format version or use a later custom-contract mode."
  );
  expect(htmlReport).toContain("Unsupported checks");
  expect(htmlReport).toContain('<span class="status failed">Failed</span>');
  expect(htmlReport).toContain('<span class="status not-run">Not run</span>');
  expect(htmlReport).toContain("No supported local contract");
  expect(htmlReport).not.toContain("EXTF;");
  expect(htmlReport).not.toContain("preview-secret");
});

test("keeps malformed CSV preview values out of UI and exports", async ({
  page,
}) => {
  await page.goto("/csv-validator/en/");

  const malformedCsv = `${validGlAccountDescriptionCsv()}\r\n"lexing-secret-value`;

  await page.evaluate((content) => {
    const dropzone = document.getElementById("dropzone");
    if (!dropzone) throw new Error("dropzone missing");
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(
      new File([content], "malformed.csv", { type: "text/csv" })
    );
    dropzone.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      })
    );
  }, malformedCsv);

  await expect(
    page.getByText(
      "Invalid against the implemented local structural DATEV CSV contract."
    )
  ).toBeVisible();
  await expect(page.locator("#diagnosticsBody")).toContainText(
    "CSV_UNCLOSED_QUOTE"
  );
  await expect(page.locator("body")).not.toContainText("lexing-secret-value");

  await page.getByRole("tab", { name: "Data" }).click();
  await expect(page.locator("#dataPreviewStatus")).toContainText(
    "CSV lexing failed; raw values are not displayed."
  );
  await expect(
    page.getByRole("button", { name: "Show data preview" })
  ).toBeDisabled();
  await expect(page.locator("body")).not.toContainText("lexing-secret-value");

  await page.getByRole("tab", { name: "Analysis" }).click();
  await page.evaluate(() => {
    const writableWindow = window as Window & { __copiedJson?: string };
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          writableWindow.__copiedJson = value;
        },
      },
    });
  });
  await page.getByRole("button", { name: "Copy JSON result" }).click();
  const copiedJson = await page.evaluate(
    () => (window as Window & { __copiedJson?: string }).__copiedJson ?? ""
  );
  expect(copiedJson).toContain("CSV_UNCLOSED_QUOTE");
  expect(copiedJson).not.toContain("lexing-secret-value");

  const jsonDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON report" }).click();
  const jsonDownload = await jsonDownloadPromise;
  const jsonPath = await jsonDownload.path();
  expect(jsonPath).toBeTruthy();
  const jsonReport = await readFile(jsonPath ?? "", "utf8");
  expect(jsonReport).toContain("CSV_UNCLOSED_QUOTE");
  expect(jsonReport).not.toContain("lexing-secret-value");

  const htmlDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download HTML report" }).click();
  const htmlDownload = await htmlDownloadPromise;
  const htmlPath = await htmlDownload.path();
  expect(htmlPath).toBeTruthy();
  const htmlReport = await readFile(htmlPath ?? "", "utf8");
  expectHtmlReportToBeLocalOnly(htmlReport);
  expect(htmlReport).toContain("CSV_UNCLOSED_QUOTE");
  expect(htmlReport).not.toContain("lexing-secret-value");
});

test("keeps no-data-row preview values out of UI and exports", async ({
  page,
}) => {
  await page.goto("/csv-validator/en/");

  const noDataRowsCsv = [
    headerLine(),
    csvLine(["1000", "no-data-secret-value", "de", "hidden long text"]),
  ].join("\r\n");

  await page.evaluate((content) => {
    const dropzone = document.getElementById("dropzone");
    if (!dropzone) throw new Error("dropzone missing");
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(
      new File([content], "no-data-rows.csv", { type: "text/csv" })
    );
    dropzone.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      })
    );
  }, noDataRowsCsv);

  await expect(
    page.getByText(
      "Invalid against the implemented local structural DATEV CSV contract."
    )
  ).toBeVisible();
  await expect(page.locator("#diagnosticsBody")).toContainText("CAPTION_ORDER");
  await expect(page.locator("body")).not.toContainText("no-data-secret-value");
  await expect(page.locator("body")).not.toContainText("hidden long text");

  await page.getByRole("tab", { name: "Data" }).click();
  await expect(page.locator("#dataPreviewStatus")).toContainText(
    "No data rows were found for a table view."
  );
  await expect(
    page.getByRole("button", { name: "Show data preview" })
  ).toBeDisabled();
  await expect(page.locator("body")).not.toContainText("no-data-secret-value");
  await expect(page.locator("body")).not.toContainText("hidden long text");

  await page.getByRole("tab", { name: "Analysis" }).click();
  await page.evaluate(() => {
    const writableWindow = window as Window & { __copiedJson?: string };
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          writableWindow.__copiedJson = value;
        },
      },
    });
  });
  await page.getByRole("button", { name: "Copy JSON result" }).click();
  const copiedJson = await page.evaluate(
    () => (window as Window & { __copiedJson?: string }).__copiedJson ?? ""
  );
  expect(copiedJson).toContain("CAPTION_ORDER");
  expect(copiedJson).not.toContain("no-data-secret-value");
  expect(copiedJson).not.toContain("hidden long text");

  const jsonDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON report" }).click();
  const jsonDownload = await jsonDownloadPromise;
  const jsonPath = await jsonDownload.path();
  expect(jsonPath).toBeTruthy();
  const jsonReport = await readFile(jsonPath ?? "", "utf8");
  expect(jsonReport).toContain("CAPTION_ORDER");
  expect(jsonReport).not.toContain("no-data-secret-value");
  expect(jsonReport).not.toContain("hidden long text");

  const htmlDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download HTML report" }).click();
  const htmlDownload = await htmlDownloadPromise;
  const htmlPath = await htmlDownload.path();
  expect(htmlPath).toBeTruthy();
  const htmlReport = await readFile(htmlPath ?? "", "utf8");
  expectHtmlReportToBeLocalOnly(htmlReport);
  expect(htmlReport).toContain("CAPTION_ORDER");
  expect(htmlReport).not.toContain("no-data-secret-value");
  expect(htmlReport).not.toContain("hidden long text");
});

test("keeps no-caption-row preview values out of UI and exports", async ({
  page,
}) => {
  await page.goto("/csv-validator/en/");

  const noCaptionRowsCsv = headerLine({
    20: "no-caption-secret-value",
    21: "hidden header note",
  });

  await page.evaluate((content) => {
    const dropzone = document.getElementById("dropzone");
    if (!dropzone) throw new Error("dropzone missing");
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(
      new File([content], "no-caption-rows.csv", { type: "text/csv" })
    );
    dropzone.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      })
    );
  }, noCaptionRowsCsv);

  await expect(
    page.getByText(
      "Invalid against the implemented local structural DATEV CSV contract."
    )
  ).toBeVisible();
  await expect(page.locator("#diagnosticsBody")).toContainText(
    "CAPTIONS_MISSING"
  );
  await expect(page.locator("body")).not.toContainText(
    "no-caption-secret-value"
  );
  await expect(page.locator("body")).not.toContainText("hidden header note");

  await page.getByRole("tab", { name: "Data" }).click();
  await expect(page.locator("#dataPreviewStatus")).toContainText(
    "No caption row was found for a table view."
  );
  await expect(
    page.getByRole("button", { name: "Show data preview" })
  ).toBeDisabled();
  await expect(page.locator("body")).not.toContainText(
    "no-caption-secret-value"
  );
  await expect(page.locator("body")).not.toContainText("hidden header note");

  await page.getByRole("tab", { name: "Analysis" }).click();
  await page.evaluate(() => {
    const writableWindow = window as Window & { __copiedJson?: string };
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          writableWindow.__copiedJson = value;
        },
      },
    });
  });
  await page.getByRole("button", { name: "Copy JSON result" }).click();
  const copiedJson = await page.evaluate(
    () => (window as Window & { __copiedJson?: string }).__copiedJson ?? ""
  );
  expect(copiedJson).toContain("CAPTIONS_MISSING");
  expect(copiedJson).not.toContain("no-caption-secret-value");
  expect(copiedJson).not.toContain("hidden header note");

  const jsonDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON report" }).click();
  const jsonDownload = await jsonDownloadPromise;
  const jsonPath = await jsonDownload.path();
  expect(jsonPath).toBeTruthy();
  const jsonReport = await readFile(jsonPath ?? "", "utf8");
  expect(jsonReport).toContain("CAPTIONS_MISSING");
  expect(jsonReport).not.toContain("no-caption-secret-value");
  expect(jsonReport).not.toContain("hidden header note");

  const htmlDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download HTML report" }).click();
  const htmlDownload = await htmlDownloadPromise;
  const htmlPath = await htmlDownload.path();
  expect(htmlPath).toBeTruthy();
  const htmlReport = await readFile(htmlPath ?? "", "utf8");
  expectHtmlReportToBeLocalOnly(htmlReport);
  expect(htmlReport).toContain("CAPTIONS_MISSING");
  expect(htmlReport).not.toContain("no-caption-secret-value");
  expect(htmlReport).not.toContain("hidden header note");
});

test("legal pages are available without placeholders", async ({ page }) => {
  const legalRoutes = [
    ["/csv-validator/de/datenschutz/", "Datenschutz", "de"],
    ["/csv-validator/de/impressum/", "Impressum", "de"],
    ["/csv-validator/de/haftung/", "Haftung und Einordnung", "de"],
    ["/csv-validator/en/privacy/", "Privacy Policy", "en"],
    ["/csv-validator/en/imprint/", "Imprint", "en"],
    ["/csv-validator/en/disclaimer/", "Disclaimer", "en"],
  ] as const;

  for (const [route, heading, locale] of legalRoutes) {
    await page.goto(route);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.locator("main")).not.toContainText(/PLACEHOLDER/i);
  }
});

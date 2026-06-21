export const locales = ["de", "en"] as const;

export type Locale = (typeof locales)[number];
export type PageKey = "home" | "formats" | "privacy" | "imprint" | "disclaimer";

export const defaultLocale: Locale = "de";

export const pagePaths: Record<Locale, Record<PageKey, string>> = {
  de: {
    home: "/de/",
    formats: "/de/formate/",
    privacy: "/de/datenschutz/",
    imprint: "/de/impressum/",
    disclaimer: "/de/haftung/",
  },
  en: {
    home: "/en/",
    formats: "/en/formats/",
    privacy: "/en/privacy/",
    imprint: "/en/imprint/",
    disclaimer: "/en/disclaimer/",
  },
};

export const otherLocale = (locale: Locale): Locale =>
  locale === "de" ? "en" : "de";

export const routeFor = (locale: Locale, page: PageKey): string =>
  pagePaths[locale][page];

export const basePath = (baseUrl: string, route: string): string => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return `${normalizedBase}${route}`;
};

export const siteCopy = {
  de: {
    brand: "DATEV CSV Validator",
    skipToContent: "Zum Inhalt springen",
    languageSwitch: "Sprache auf Englisch wechseln",
    languageSwitchLabel: "EN",
    github: "GitHub-Repository öffnen",
    theme: "Hell-/Dunkelmodus umschalten",
    nav: {
      home: "Validator",
      formats: "Formate",
      privacy: "Datenschutz",
      disclaimer: "Haftung",
      imprint: "Impressum",
    },
    footer: {
      owner: "© Schoenfeld Solutions",
      independent:
        "Unabhängiges Open-Source-Tool. Nicht mit DATEV eG verbunden.",
      warranty: "Ohne Gewährleistung.",
    },
  },
  en: {
    brand: "DATEV CSV Validator",
    skipToContent: "Skip to content",
    languageSwitch: "Switch language to German",
    languageSwitchLabel: "DE",
    github: "Open GitHub repository",
    theme: "Toggle light and dark mode",
    nav: {
      home: "Validator",
      formats: "Formats",
      privacy: "Privacy",
      disclaimer: "Disclaimer",
      imprint: "Imprint",
    },
    footer: {
      owner: "© Schoenfeld Solutions",
      independent:
        "Independent open-source tool. Not affiliated with DATEV eG.",
      warranty: "No warranty.",
    },
  },
} as const;

export const appCopy = {
  de: {
    title: "DATEV CSV-Dateien lokal prüfen",
    description:
      "Unabhängig, clientseitig, kein Upload, keine Gewährleistung. Gültige Ergebnisse bedeuten nur, dass die Datei dem implementierten lokalen DATEV-CSV-Strukturvertrag entspricht.",
    dropTitle: ".csv oder .txt hier ablegen",
    dropCopy: "Maximale Größe: 10 MiB. UTF-8 mit BOM oder Windows-1252.",
    chooseFile: "Datei auswählen",
    waiting: "Warte auf eine lokale Datei.",
    processing: "wird lokal verarbeitet",
    processed: "lokal im Browser verarbeitet",
    resultKicker: "Validierungsergebnis",
    resultTitle: "Lokaler Bericht",
    ready: "Bereit",
    valid:
      "Gültig gegen den implementierten lokalen DATEV-CSV-Strukturvertrag.",
    invalid:
      "Ungültig gegen den implementierten lokalen DATEV-CSV-Strukturvertrag.",
    unsupported:
      "Nicht unterstützt durch den implementierten lokalen DATEV-CSV-Strukturvertrag.",
    metadata: {
      recognition: "Recognition-Code",
      format: "Format",
      marker: "Marker",
      encoding: "Encoding",
      delimiter: "Trennzeichen",
      rows: "Zeilen",
      dataRows: "Datenzeilen",
      fields: "Felder",
    },
    actions: {
      copy: "JSON-Ergebnis kopieren",
      download: "JSON-Bericht herunterladen",
      copied: "JSON kopiert.",
      copyFailed: "Kopieren fehlgeschlagen.",
    },
    diagnostics: {
      title: "Fehler und Warnungen",
      empty: "Keine Diagnostics.",
      summary: (errors: number, warnings: number) =>
        `${errors} Fehler, ${warnings} Warnungen`,
      severity: "Severity",
      code: "Code",
      line: "Zeile",
      column: "Spalte",
      field: "Feld",
      message: "Message",
    },
    trust: {
      intro:
        "Unabhängig, clientseitig, kein Upload, keine Gewährleistung. Gültige Ergebnisse bedeuten nur, dass die Datei dem implementierten lokalen DATEV-CSV-Strukturvertrag entspricht.",
      items: [
        "Verarbeitung nur im Browser",
        "Kein Server empfängt Ihre Datei",
        "Keine Telemetrie oder Analytics",
      ],
    },
  },
  en: {
    title: "Validate DATEV CSV files locally",
    description:
      "Independent, client-side, no upload, no warranty. Valid results mean only that the file matches the implemented local structural DATEV CSV contract.",
    dropTitle: "Drop .csv or .txt here",
    dropCopy: "Maximum size: 10 MiB. UTF-8 with BOM or Windows-1252.",
    chooseFile: "Choose file",
    waiting: "Waiting for a local file.",
    processing: "is processed locally",
    processed: "processed locally in the browser",
    resultKicker: "Validation result",
    resultTitle: "Local report",
    ready: "Ready",
    valid: "Valid against the implemented local structural DATEV CSV contract.",
    invalid:
      "Invalid against the implemented local structural DATEV CSV contract.",
    unsupported:
      "Unsupported by the implemented local structural DATEV CSV contract.",
    metadata: {
      recognition: "Recognition code",
      format: "Format",
      marker: "Marker",
      encoding: "Encoding",
      delimiter: "Delimiter",
      rows: "Rows",
      dataRows: "Data rows",
      fields: "Fields",
    },
    actions: {
      copy: "Copy JSON result",
      download: "Download JSON report",
      copied: "JSON copied.",
      copyFailed: "Clipboard copy failed.",
    },
    diagnostics: {
      title: "Errors and warnings",
      empty: "No diagnostics.",
      summary: (errors: number, warnings: number) =>
        `${errors} errors, ${warnings} warnings`,
      severity: "Severity",
      code: "Code",
      line: "Line",
      column: "Column",
      field: "Field",
      message: "Message",
    },
    trust: {
      intro:
        "Independent, client-side, no upload, no warranty. Valid results mean only that the file matches the implemented local structural DATEV CSV contract.",
      items: [
        "Browser-only processing",
        "No server receives your file",
        "No telemetry or analytics",
      ],
    },
  },
} as const;

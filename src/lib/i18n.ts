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
      downloadHtml: "HTML-Bericht herunterladen",
      copied: "JSON kopiert.",
      copyFailed: "Kopieren fehlgeschlagen.",
    },
    report: {
      kicker: "Generierter Bericht",
      title: "Strukturierter Validierungsbericht",
      sectionsLabel: "Berichtsabschnitte",
      generatedAt: "Erstellt",
      intro:
        "Dieser Bericht wird lokal aus dem strukturierten Validator-Ergebnis erzeugt. Er enthält keine CSV-/TXT-Rohwerte.",
      nextActions: "Empfohlene nächste Schritte",
      downloadName: "datev-validator-bericht",
      htmlTitle: "DATEV CSV Validator Bericht",
      sourceAndPrivacy: "Datei und lokale Verarbeitung",
      status: {
        failed: "Fehlgeschlagen",
        passed: "Bestanden",
        warning: "Warnung",
        "not-run": "Nicht ausgeführt",
      },
      sections: {
        summary: "Zusammenfassung",
        source: "Datei und Verarbeitung",
        privacy: "Datenschutzstatus",
        contract: "Vertragsquelle",
        recognition: "Formaterkennung",
        encodingCsv: "Encoding und CSV-Lexik",
        header: "Header-Prüfungen",
        captions: "Caption-Prüfungen",
        dataRows: "Datenzeilen-Prüfungen",
        fieldSemantics: "Feldsemantik",
        unsupported: "Nicht unterstützte Prüfungen",
        disclaimer: "Haftung und Einordnung",
      },
      sectionDescriptions: {
        summary:
          "Gesamtstatus, Fehler- und Warnungsanzahl aus dem lokalen Ergebnis.",
        source:
          "Dateiname, Dateigröße und Verarbeitung ausschließlich im Browser.",
        privacy:
          "Kein Upload, kein Serverempfang, keine Telemetrie und keine Analytics.",
        contract:
          "Genutzter lokaler Strukturvertrag: eingebauter Vertrag oder keiner.",
        recognition:
          "Erkannte DATEV-Signatur, Formatname, Kategorie und Version.",
        encodingCsv:
          "Encoding-Policy, Semikolon-Trennzeichen, Texttrenner und CSV-Lexik.",
        header:
          "Marker, Header-Version, Kategorie, Formatname und primitive Headerfelder.",
        captions:
          "Caption-Anzahl, erforderliche Caption-Anker und Feldreihenfolge.",
        dataRows:
          "Datenzeilenanzahl, leere Datenzeilen und Feldanzahl je Datenzeile.",
        fieldSemantics:
          "Pflichtfelder, Typen, Längen, Dezimalstellen und unterstützte Datumsformen.",
        unsupported:
          "Nicht unterstützte Formate oder lokale Prüfklassen werden sichtbar ausgewiesen.",
        disclaimer:
          "Unabhängiges Open-Source-Tool, keine DATEV-Affiliation, ohne Gewährleistung.",
      },
      actions: {
        fixErrors:
          "Fehler anhand der Codes und Felder beheben und die Datei erneut lokal prüfen.",
        ready:
          "Keine Fehler gefunden. Das bedeutet nur Gültigkeit gegen den lokalen Strukturvertrag.",
        reviewWarnings:
          "Warnungen prüfen; sie blockieren die lokale Strukturvalidierung nicht.",
        unsupportedFormat:
          "Formatversion prüfen oder einen späteren Custom-Contract-Modus verwenden.",
      },
      remediation: {
        "fix-source": "Datei oder Größe prüfen.",
        "fix-encoding-or-csv": "Encoding und CSV-Struktur prüfen.",
        "fix-header": "Headerfelder prüfen.",
        "fix-captions": "Caption-Zeile gegen den lokalen Vertrag prüfen.",
        "fix-data-rows": "Datenzeilenstruktur prüfen.",
        "fix-field-value": "Feldwert gegen Typ, Länge und Format prüfen.",
        "review-warning": "Warnung fachlich prüfen.",
        "unsupported-format": "Format oder unterstützten Vertrag prüfen.",
      },
      contractSource: {
        "built-in": "Eingebauter lokaler Vertrag",
        none: "Kein unterstützter lokaler Vertrag",
      },
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
      downloadHtml: "Download HTML report",
      copied: "JSON copied.",
      copyFailed: "Clipboard copy failed.",
    },
    report: {
      kicker: "Generated report",
      title: "Structured validation report",
      sectionsLabel: "Report sections",
      generatedAt: "Generated",
      intro:
        "This report is generated locally from the structured validator result. It contains no raw CSV/TXT values.",
      nextActions: "Recommended next actions",
      downloadName: "datev-validator-report",
      htmlTitle: "DATEV CSV Validator Report",
      sourceAndPrivacy: "File and local processing",
      status: {
        failed: "Failed",
        passed: "Passed",
        warning: "Warning",
        "not-run": "Not run",
      },
      sections: {
        summary: "Summary",
        source: "File and processing",
        privacy: "Privacy status",
        contract: "Contract source",
        recognition: "Format recognition",
        encodingCsv: "Encoding and CSV lexing",
        header: "Header checks",
        captions: "Caption checks",
        dataRows: "Data row checks",
        fieldSemantics: "Field semantics",
        unsupported: "Unsupported checks",
        disclaimer: "Disclaimer and independence",
      },
      sectionDescriptions: {
        summary:
          "Overall status, error count and warning count from the local result.",
        source:
          "File name, file size and processing exclusively in the browser.",
        privacy: "No upload, no server receipt, no telemetry and no analytics.",
        contract:
          "Applied local structural contract: built-in contract or none.",
        recognition:
          "Recognized DATEV signature, format name, category and version.",
        encodingCsv:
          "Encoding policy, semicolon delimiter, text qualifier and CSV lexing.",
        header:
          "Marker, header version, category, format name and primitive header fields.",
        captions: "Caption count, required caption anchors and field order.",
        dataRows:
          "Data record count, empty data rows and field count per data row.",
        fieldSemantics:
          "Required fields, types, lengths, decimal places and supported date expressions.",
        unsupported:
          "Unsupported formats or local check classes are made visible.",
        disclaimer:
          "Independent open-source tool, not affiliated with DATEV eG, no warranty.",
      },
      actions: {
        fixErrors:
          "Fix errors using the codes and fields, then validate the file locally again.",
        ready:
          "No errors found. This means only validity against the local structural contract.",
        reviewWarnings:
          "Review warnings; they do not block local structural validation.",
        unsupportedFormat:
          "Check the format version or use a later custom-contract mode.",
      },
      remediation: {
        "fix-source": "Check file or size.",
        "fix-encoding-or-csv": "Check encoding and CSV structure.",
        "fix-header": "Check header fields.",
        "fix-captions": "Check the caption row against the local contract.",
        "fix-data-rows": "Check data row structure.",
        "fix-field-value": "Check field value against type, length and format.",
        "review-warning": "Review warning.",
        "unsupported-format": "Check format or supported contract.",
      },
      contractSource: {
        "built-in": "Built-in local contract",
        none: "No supported local contract",
      },
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

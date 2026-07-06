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
    dropCopy:
      "Maximale Größe: 10 MiB. UTF-8 mit oder ohne BOM oder Windows-1252.",
    chooseFile: "Datei auswählen",
    waiting: "Warte auf eine lokale Datei.",
    processing: "wird lokal verarbeitet",
    processed: "lokal im Browser verarbeitet",
    progress: {
      "read-xml-contracts": "Lokale DATEV-XML-Verträge werden gelesen.",
      "build-xml-contract-source":
        "Lokale DATEV-XML-Vertragsquelle wird aufgebaut.",
      "read-file": "Datei wird im Browser-Worker gelesen.",
      "decode-text": "Text wird deterministisch dekodiert.",
      "validate-structure": "Lokale DATEV-CSV-Struktur wird geprüft.",
    },
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
      dataKind: "Datenart",
      fileSize: "Dateigröße",
      sha256: "SHA-256",
      encoding: "Encoding",
      delimiter: "Trennzeichen",
      quote: "Texttrenner",
      rows: "Zeilen",
      dataRows: "Datenzeilen",
      fields: "Felder",
      contractSource: "Vertragsquelle",
      contractCount: "Vertragsanzahl",
      overrides: "Overrides",
      contractWarnings: "Vertragswarnungen",
    },
    contractSource: {
      kicker: "Erweiterter lokaler Vertrag",
      copy: "Optional: DATEV-Format-XML-Dateien lokal laden und die nächste CSV/TXT-Datei gegen diese Sitzungsversion prüfen. Es findet kein Upload statt.",
      upload: "XML-Vertrag laden",
      selectLabel: "Aktive Quelle",
      builtInOption: "Eingebaute Verträge",
      uploadedUnavailable: "Geladene XML-Verträge nicht verfügbar",
      mixedUnavailable: "Eingebaute plus XML-Verträge nicht verfügbar",
      editedUnavailable: "Bearbeiteter Sitzungsvertrag nicht verfügbar",
      editedOption: "Bearbeiteten Sitzungsvertrag verwenden",
      uploadedOption: (count: number) =>
        `${count} geladene XML-Verträge verwenden`,
      mixedOption: (count: number, overrides: number) =>
        `Eingebaute plus ${count} XML-Verträge${
          overrides > 0
            ? ` (${overrides} Override${overrides === 1 ? "" : "s"})`
            : ""
        }`,
      defaultStatus:
        "Standard: eingebaute lokale Strukturverträge werden verwendet.",
      loading: (count: number) =>
        `${count} XML-Datei${count === 1 ? "" : "en"} wird/werden lokal geladen...`,
      loaded: (count: number, warnings: number) =>
        `${count} XML-Vertrag${count === 1 ? "" : "e"} lokal geladen${
          warnings > 0
            ? `, ${warnings} Warnung${warnings === 1 ? "" : "en"}`
            : ""
        }.`,
      rejected: (codes: string) =>
        `XML-Verträge wurden nicht übernommen: ${codes}.`,
      builtInSummary: "Eingebaute lokale Verträge",
      uploadedSummary: (count: number) => `Geladene XML-Verträge (${count})`,
      mixedSummary: (count: number) =>
        `Eingebaute plus geladene XML-Verträge (${count})`,
      editedSummary: "Bearbeiteter Sitzungsvertrag",
      overrideWarningLabel: "Override-Warnung",
      overrideWarning: (count: number) =>
        `${count} geladene XML-Vertragssignatur${
          count === 1 ? "" : "en"
        } überschreibt eingebaute lokale Vertragsdaten für diese Sitzung.`,
      editedWarningLabel: "Sitzungsbearbeitung",
      editedWarning:
        "Ein lokal bearbeiteter Sitzungsvertrag ist aktiv. Die eingebauten Standardverträge bleiben unverändert.",
      summaryDetails: (overrides: number, warnings: number) =>
        [
          overrides > 0
            ? `${overrides} Override${overrides === 1 ? "" : "s"}`
            : undefined,
          warnings > 0
            ? `${warnings} Warnung${warnings === 1 ? "" : "en"}`
            : undefined,
        ]
          .filter(Boolean)
          .join(", "),
    },
    contractEditor: {
      kicker: "Sitzungsbearbeitung",
      title: "Lokale Vertragskopie bearbeiten",
      create: "Bearbeitbare Kopie erstellen",
      discard: "Bearbeitung verwerfen",
      apply: "Sitzungsbearbeitung anwenden",
      requiredCaptions: "Erforderliche Caption-Anker, durch Komma getrennt",
      fieldNumber: "Nr.",
      caption: "Caption",
      type: "Typ",
      maxLength: "Max. Länge",
      decimalPlaces: "Dezimalstellen",
      required: "Pflicht",
      expression: "Ausdruck",
      emptyExpression: "Kein Ausdruck",
      loading: "Lokale Vertragskopie wird erstellt...",
      loaded:
        "Bearbeitbare lokale Kopie erstellt. Änderungen gelten erst nach dem Anwenden und nur für diese Browser-Sitzung.",
      applying: "Bearbeiteter Sitzungsvertrag wird geprüft...",
      applied: "Bearbeiteter Sitzungsvertrag ist für diese Sitzung aktiv.",
      discarding: "Bearbeiteter Sitzungsvertrag wird verworfen...",
      discarded:
        "Bearbeiteter Sitzungsvertrag wurde verworfen; eingebaute Verträge sind wieder aktiv.",
      rejected: (codes: string) =>
        `Bearbeiteter Sitzungsvertrag wurde nicht übernommen: ${codes}.`,
    },
    actions: {
      copy: "JSON-Ergebnis kopieren",
      download: "JSON-Bericht herunterladen",
      downloadHtml: "HTML-Bericht herunterladen",
      copied: "JSON kopiert.",
      copyFailed: "Kopieren fehlgeschlagen.",
    },
    tabs: {
      label: "Ergebnisansichten",
      analysis: "Analyse",
      data: "Daten",
    },
    dataPreview: {
      kicker: "Datenansicht",
      title: "Lokale CSV-/TXT-Vorschau",
      warning:
        "Rohwerte können sensible Buchhaltungs- oder Personendaten enthalten. Aktivieren Sie die Vorschau nur, wenn die Werte auf diesem Bildschirm sichtbar sein dürfen.",
      warningItems: [
        "Die Werte bleiben lokal im Browser.",
        "Es findet kein Upload statt.",
        "Die Vorschau wird nicht in JSON- oder HTML-Berichte exportiert.",
      ],
      enable: "Datenvorschau anzeigen",
      line: "Zeile",
      fieldCount: "Felder",
      field: (index: number) => `Feld ${index}`,
      summary: (shown: number, total: number, limit: number) =>
        `${shown} von ${total} Datenzeilen können nach Freigabe angezeigt werden. Limit: ${limit} Zeilen.`,
      truncated: (shown: number, total: number) =>
        `Die Vorschau ist auf ${shown} von ${total} Datenzeilen begrenzt.`,
      unsupportedNotice:
        "Kein unterstützter lokaler Vertrag passt zu dieser Datei; diese Ansicht ist nur eine roh geparste CSV-Vorschau.",
      unavailable: {
        generic: "Für diese Datei ist keine Datenvorschau verfügbar.",
        "csv-lexing-failed":
          "Die CSV-Lexik ist fehlgeschlagen; Rohwerte werden nicht angezeigt.",
        "no-caption-row":
          "Keine Caption-Zeile für eine Tabellenansicht gefunden.",
        "no-data-rows": "Keine Datenzeilen für eine Tabellenansicht gefunden.",
      },
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
          "Genutzter lokaler Strukturvertrag: eingebauter Vertrag, geladener XML-Vertrag, bearbeiteter Sitzungsvertrag oder keiner.",
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
        "edited-session": "Bearbeiteter Sitzungsvertrag",
        mixed: "Eingebaute plus geladene XML-Verträge",
        none: "Kein unterstützter lokaler Vertrag",
        uploaded: "Geladener XML-Vertrag",
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
    dropCopy:
      "Maximum size: 10 MiB. UTF-8 with or without BOM or Windows-1252.",
    chooseFile: "Choose file",
    waiting: "Waiting for a local file.",
    processing: "is processed locally",
    processed: "processed locally in the browser",
    progress: {
      "read-xml-contracts": "Reading local DATEV XML contracts.",
      "build-xml-contract-source": "Building local DATEV XML contract source.",
      "read-file": "Reading file in the browser worker.",
      "decode-text": "Decoding text deterministically.",
      "validate-structure": "Validating local DATEV CSV structure.",
    },
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
      dataKind: "Data kind",
      fileSize: "File size",
      sha256: "SHA-256",
      encoding: "Encoding",
      delimiter: "Delimiter",
      quote: "Text qualifier",
      rows: "Rows",
      dataRows: "Data rows",
      fields: "Fields",
      contractSource: "Contract source",
      contractCount: "Contract count",
      overrides: "Overrides",
      contractWarnings: "Contract warnings",
    },
    contractSource: {
      kicker: "Advanced local contract",
      copy: "Optional: load DATEV format XML files locally and validate the next CSV/TXT file against that session source. No upload takes place.",
      upload: "Load XML contract",
      selectLabel: "Active source",
      builtInOption: "Built-in contracts",
      uploadedUnavailable: "Loaded XML contracts unavailable",
      mixedUnavailable: "Built-in plus XML contracts unavailable",
      editedUnavailable: "Edited session contract unavailable",
      editedOption: "Use edited session contract",
      uploadedOption: (count: number) =>
        `Use ${count} loaded XML contract${count === 1 ? "" : "s"}`,
      mixedOption: (count: number, overrides: number) =>
        `Built-in plus ${count} XML contract${count === 1 ? "" : "s"}${
          overrides > 0
            ? ` (${overrides} override${overrides === 1 ? "" : "s"})`
            : ""
        }`,
      defaultStatus: "Default: built-in local structural contracts are used.",
      loading: (count: number) =>
        `Loading ${count} XML file${count === 1 ? "" : "s"} locally...`,
      loaded: (count: number, warnings: number) =>
        `${count} XML contract${count === 1 ? "" : "s"} loaded locally${
          warnings > 0
            ? `, ${warnings} warning${warnings === 1 ? "" : "s"}`
            : ""
        }.`,
      rejected: (codes: string) => `XML contracts were not applied: ${codes}.`,
      builtInSummary: "Built-in local contracts",
      uploadedSummary: (count: number) => `Loaded XML contracts (${count})`,
      mixedSummary: (count: number) =>
        `Built-in plus loaded XML contracts (${count})`,
      editedSummary: "Edited session contract",
      overrideWarningLabel: "Override warning",
      overrideWarning: (count: number) =>
        `${count} loaded XML contract signature${
          count === 1 ? "" : "s"
        } override built-in local contract data for this session.`,
      editedWarningLabel: "Session edit",
      editedWarning:
        "A locally edited session contract is active. Built-in default contracts remain unchanged.",
      summaryDetails: (overrides: number, warnings: number) =>
        [
          overrides > 0
            ? `${overrides} override${overrides === 1 ? "" : "s"}`
            : undefined,
          warnings > 0
            ? `${warnings} warning${warnings === 1 ? "" : "s"}`
            : undefined,
        ]
          .filter(Boolean)
          .join(", "),
    },
    contractEditor: {
      kicker: "Session editing",
      title: "Edit local contract copy",
      create: "Create editable copy",
      discard: "Discard edit",
      apply: "Apply session edit",
      requiredCaptions: "Required caption anchors, comma-separated",
      fieldNumber: "No.",
      caption: "Caption",
      type: "Type",
      maxLength: "Max length",
      decimalPlaces: "Decimals",
      required: "Required",
      expression: "Expression",
      emptyExpression: "No expression",
      loading: "Creating local contract copy...",
      loaded:
        "Editable local copy created. Changes apply only after applying them and only for this browser session.",
      applying: "Checking edited session contract...",
      applied: "Edited session contract is active for this session.",
      discarding: "Discarding edited session contract...",
      discarded:
        "Edited session contract was discarded; built-in contracts are active again.",
      rejected: (codes: string) =>
        `Edited session contract was not applied: ${codes}.`,
    },
    actions: {
      copy: "Copy JSON result",
      download: "Download JSON report",
      downloadHtml: "Download HTML report",
      copied: "JSON copied.",
      copyFailed: "Clipboard copy failed.",
    },
    tabs: {
      label: "Result views",
      analysis: "Analysis",
      data: "Data",
    },
    dataPreview: {
      kicker: "Data view",
      title: "Local CSV/TXT preview",
      warning:
        "Raw values can contain sensitive accounting or personal data. Enable the preview only when these values may be visible on this screen.",
      warningItems: [
        "Values stay local in the browser.",
        "No upload takes place.",
        "The preview is not exported to JSON or HTML reports.",
      ],
      enable: "Show data preview",
      line: "Line",
      fieldCount: "Fields",
      field: (index: number) => `Field ${index}`,
      summary: (shown: number, total: number, limit: number) =>
        `${shown} of ${total} data rows can be shown after approval. Limit: ${limit} rows.`,
      truncated: (shown: number, total: number) =>
        `Preview is limited to ${shown} of ${total} data rows.`,
      unsupportedNotice:
        "No supported local contract matched this file; this is a raw parsed CSV preview only.",
      unavailable: {
        generic: "No data preview is available for this file.",
        "csv-lexing-failed": "CSV lexing failed; raw values are not displayed.",
        "no-caption-row": "No caption row was found for a table view.",
        "no-data-rows": "No data rows were found for a table view.",
      },
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
          "Applied local structural contract: built-in contract, loaded XML contract, edited session contract, or none.",
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
        "edited-session": "Edited session contract",
        mixed: "Built-in plus loaded XML contracts",
        none: "No supported local contract",
        uploaded: "Loaded XML contract",
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

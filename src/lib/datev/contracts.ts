import { DATEV_LITE_CONTRACT } from "./contracts.generated";
import { diagnostic } from "./diagnostics";
import type {
  DatevContractRepository,
  DatevEditableContractDraft,
  DatevEditableFieldContractDraft,
  DatevFormatType,
  DatevLiteFieldContract,
  DatevLiteFieldRuleContract,
  DatevLiteDiagnostic,
  DatevLiteRecognitionContract,
  DatevMarker,
  DatevRecognitionCode,
} from "./types";

const SUPPORTED_FIELD_TYPES = new Set<DatevFormatType>([
  "Text",
  "Konto",
  "Zahl",
  "Betrag",
  "Datum",
]);
const SUPPORTED_FORMAT_EXPRESSIONS = new Set(["", "TTMM", "TTMMJJJJ"]);

export const BUILT_IN_CONTRACT_REPOSITORY: DatevContractRepository = {
  findRecognitionBySignature: (
    category: string,
    name: string,
    version: string
  ): DatevLiteRecognitionContract | undefined =>
    DATEV_LITE_CONTRACT.recognitions.find(
      (recognition) =>
        recognition.formatCategory === category &&
        recognition.formatName === name &&
        recognition.formatVersion === version
    ),
  getFields: (
    recognitionCode: string
  ): readonly DatevLiteFieldContract[] | undefined =>
    DATEV_LITE_CONTRACT.fieldsByCode[recognitionCode as DatevRecognitionCode],
  getRules: (
    recognitionCode: string
  ): readonly DatevLiteFieldRuleContract[] | undefined =>
    DATEV_LITE_CONTRACT.rulesByCode[recognitionCode as DatevRecognitionCode],
  listRecognitions: (): readonly DatevLiteRecognitionContract[] =>
    DATEV_LITE_CONTRACT.recognitions,
  summary: {
    contractCount: DATEV_LITE_CONTRACT.recognitions.length,
    kind: "built-in",
    label: "Built-in DATEV CSV contracts",
    overrideCount: 0,
    warningCount: 0,
  },
};

export const createMixedContractRepository = (
  builtInRepository: DatevContractRepository,
  uploadedRepository: DatevContractRepository
): DatevContractRepository => {
  const uploadedRecognitions = uploadedRepository.listRecognitions();
  const uploadedBySignature = new Map(
    uploadedRecognitions.map((recognition) => [
      recognitionSignature(recognition),
      recognition,
    ])
  );
  const uploadedRecognitionCodes = new Set(
    uploadedRecognitions.map((recognition) => recognition.recognitionCode)
  );
  const builtInRecognitions = builtInRepository.listRecognitions();
  const overriddenSignatures = new Set<string>();
  const collidedBuiltInCodes = new Set<string>();

  for (const builtInRecognition of builtInRecognitions) {
    const signature = recognitionSignature(builtInRecognition);
    if (uploadedBySignature.has(signature)) {
      overriddenSignatures.add(signature);
    } else if (
      uploadedRecognitionCodes.has(builtInRecognition.recognitionCode)
    ) {
      collidedBuiltInCodes.add(builtInRecognition.recognitionCode);
    }
  }

  const retainedBuiltInRecognitions = builtInRecognitions.filter(
    (recognition) =>
      !overriddenSignatures.has(recognitionSignature(recognition)) &&
      !collidedBuiltInCodes.has(recognition.recognitionCode)
  );
  const mixedRecognitions = [
    ...retainedBuiltInRecognitions,
    ...uploadedRecognitions,
  ];
  const overrideCount = overriddenSignatures.size;

  return {
    findRecognitionBySignature: (
      category: string,
      name: string,
      version: string
    ): DatevLiteRecognitionContract | undefined => {
      const signature = signatureFromParts(category, name, version);
      const uploadedRecognition = uploadedBySignature.get(signature);
      if (uploadedRecognition) return uploadedRecognition;

      const builtInRecognition = builtInRepository.findRecognitionBySignature(
        category,
        name,
        version
      );
      return builtInRecognition &&
        !collidedBuiltInCodes.has(builtInRecognition.recognitionCode)
        ? builtInRecognition
        : undefined;
    },
    getFields: (
      recognitionCode: string
    ): readonly DatevLiteFieldContract[] | undefined =>
      uploadedRepository.getFields(recognitionCode) ??
      builtInRepository.getFields(recognitionCode),
    getRules: (
      recognitionCode: string
    ): readonly DatevLiteFieldRuleContract[] | undefined =>
      uploadedRepository.getRules(recognitionCode) ??
      builtInRepository.getRules(recognitionCode),
    listRecognitions: (): readonly DatevLiteRecognitionContract[] =>
      mixedRecognitions,
    summary: {
      contractCount: mixedRecognitions.length,
      kind: "mixed",
      label: "Built-in plus uploaded DATEV XML contracts",
      overrideCount,
      warningCount:
        uploadedRepository.summary.warningCount + (overrideCount > 0 ? 1 : 0),
    },
  };
};

export const createEditableContractDraft = (
  repository: DatevContractRepository,
  recognitionCode: string
): {
  readonly draft?: DatevEditableContractDraft;
  readonly diagnostics: readonly DatevLiteDiagnostic[];
} => {
  const recognition = repository
    .listRecognitions()
    .find((item) => item.recognitionCode === recognitionCode);
  const fields = repository.getFields(recognitionCode);
  const rules = repository.getRules(recognitionCode);

  if (!recognition || !fields || !rules) {
    return {
      diagnostics: [
        diagnostic(
          "error",
          "EDIT_CONTRACT_NOT_FOUND",
          "The selected local contract cannot be cloned for editing."
        ),
      ],
    };
  }
  if (fields.length !== rules.length) {
    return {
      diagnostics: [
        diagnostic(
          "error",
          "EDIT_CONTRACT_INCONSISTENT",
          "The selected local contract has inconsistent field and rule counts."
        ),
      ],
    };
  }
  const ruleByFieldNumber = new Map(
    rules.map((rule) => [rule.fieldNumber, rule])
  );
  if (fields.some((field) => !ruleByFieldNumber.has(field.fieldNumber))) {
    return {
      diagnostics: [
        diagnostic(
          "error",
          "EDIT_CONTRACT_INCONSISTENT",
          "The selected local contract has inconsistent field and rule numbers."
        ),
      ],
    };
  }

  const editableFields: DatevEditableFieldContractDraft[] = [];
  for (const field of fields) {
    const rule = ruleByFieldNumber.get(field.fieldNumber);
    if (!rule) {
      return {
        diagnostics: [
          diagnostic(
            "error",
            "EDIT_CONTRACT_INCONSISTENT",
            "The selected local contract has inconsistent field and rule numbers."
          ),
        ],
      };
    }
    editableFields.push({
      caption: field.caption,
      decimalPlaces: rule.decimalPlaces,
      fieldNumber: field.fieldNumber,
      formatExpression: rule.formatExpression,
      formatType: rule.formatType,
      maxLength: rule.maxLength,
      necessary: rule.necessary,
    });
  }

  return {
    diagnostics: [],
    draft: {
      fields: editableFields,
      recognition: {
        ...recognition,
        allowedDatevMarkers: [...recognition.allowedDatevMarkers],
        requiredCaptions: [...recognition.requiredCaptions],
      },
    },
  };
};

export const createEditedSessionContractRepository = (
  draft: DatevEditableContractDraft
): {
  readonly repository?: DatevContractRepository;
  readonly diagnostics: readonly DatevLiteDiagnostic[];
} => {
  const diagnostics = validateEditableContractDraft(draft);
  if (diagnostics.some((item) => item.severity === "error")) {
    return { diagnostics };
  }

  const recognition = {
    ...draft.recognition,
    allowedDatevMarkers: [...draft.recognition.allowedDatevMarkers],
    requiredCaptions: draft.recognition.requiredCaptions.map((item) =>
      item.trim()
    ),
  };
  const fields = draft.fields.map((field): DatevLiteFieldContract => ({
    caption: field.caption.trim(),
    fieldNumber: field.fieldNumber,
  }));
  const rules = draft.fields.map((field): DatevLiteFieldRuleContract => ({
    decimalPlaces: field.decimalPlaces,
    fieldNumber: field.fieldNumber,
    formatExpression: field.formatExpression,
    formatType: field.formatType,
    maxLength: field.maxLength,
    necessary: field.necessary,
  }));

  return {
    diagnostics,
    repository: {
      findRecognitionBySignature: (
        category: string,
        name: string,
        version: string
      ): DatevLiteRecognitionContract | undefined =>
        recognition.formatCategory === category &&
        recognition.formatName === name &&
        recognition.formatVersion === version
          ? recognition
          : undefined,
      getFields: (recognitionCode: string) =>
        recognitionCode === recognition.recognitionCode ? fields : undefined,
      getRules: (recognitionCode: string) =>
        recognitionCode === recognition.recognitionCode ? rules : undefined,
      listRecognitions: () => [recognition],
      summary: {
        contractCount: 1,
        kind: "edited-session",
        label: `Edited session contract: ${recognition.formatName} v${recognition.formatVersion}`,
        overrideCount: 1,
        warningCount: 1,
      },
    },
  };
};

export const SUPPORTED_FORMATS =
  BUILT_IN_CONTRACT_REPOSITORY.listRecognitions();

export const getFields = (
  recognitionCode: string
): readonly DatevLiteFieldContract[] =>
  BUILT_IN_CONTRACT_REPOSITORY.getFields(recognitionCode) ?? [];

export const getRules = (
  recognitionCode: string
): readonly DatevLiteFieldRuleContract[] =>
  BUILT_IN_CONTRACT_REPOSITORY.getRules(recognitionCode) ?? [];

export const findRecognitionBySignature = (
  category: string,
  name: string,
  version: string
): DatevLiteRecognitionContract | undefined =>
  BUILT_IN_CONTRACT_REPOSITORY.findRecognitionBySignature(
    category,
    name,
    version
  );

export const isAllowedMarker = (
  recognition: DatevLiteRecognitionContract,
  marker: string
): marker is DatevMarker =>
  recognition.allowedDatevMarkers.includes(marker as DatevMarker);

const recognitionSignature = (
  recognition: DatevLiteRecognitionContract
): string =>
  signatureFromParts(
    recognition.formatCategory,
    recognition.formatName,
    recognition.formatVersion
  );

const signatureFromParts = (
  category: string,
  name: string,
  version: string
): string => [category, name, version].join("\u0000");

const validateEditableContractDraft = (
  draft: DatevEditableContractDraft
): readonly DatevLiteDiagnostic[] => {
  const diagnostics: DatevLiteDiagnostic[] = [];
  if (draft.fields.length === 0) {
    diagnostics.push(
      diagnostic(
        "error",
        "EDIT_CONTRACT_FIELDS_MISSING",
        "An edited session contract must contain fields."
      )
    );
  }

  const requiredCaptions = draft.recognition.requiredCaptions.map((item) =>
    item.trim()
  );
  if (
    requiredCaptions.length === 0 ||
    requiredCaptions.some((item) => item.length === 0)
  ) {
    diagnostics.push(
      diagnostic(
        "error",
        "EDIT_CONTRACT_REQUIRED_CAPTION",
        "Edited session contract required caption anchors must not be empty."
      )
    );
  }

  const seenFieldNumbers = new Set<number>();
  for (const [index, field] of draft.fields.entries()) {
    const expectedFieldNumber = index + 1;
    if (field.fieldNumber !== expectedFieldNumber) {
      diagnostics.push(
        diagnostic(
          "error",
          "EDIT_CONTRACT_FIELD_ORDER",
          "Edited session contract fields must be ordered without gaps.",
          { fieldIndex: expectedFieldNumber }
        )
      );
    }
    if (seenFieldNumbers.has(field.fieldNumber)) {
      diagnostics.push(
        diagnostic(
          "error",
          "EDIT_CONTRACT_FIELD_DUPLICATE",
          "Edited session contract fields must not contain duplicate numbers.",
          { fieldIndex: field.fieldNumber }
        )
      );
    }
    seenFieldNumbers.add(field.fieldNumber);
    if (field.caption.trim().length === 0) {
      diagnostics.push(
        diagnostic(
          "error",
          "EDIT_CONTRACT_FIELD_CAPTION",
          "Edited session contract field captions must not be empty.",
          { fieldIndex: field.fieldNumber }
        )
      );
    }
    if (!SUPPORTED_FIELD_TYPES.has(field.formatType)) {
      diagnostics.push(
        diagnostic(
          "error",
          "EDIT_CONTRACT_FIELD_TYPE",
          "Edited session contract field types must be supported.",
          { fieldIndex: field.fieldNumber }
        )
      );
    }
    if (!Number.isInteger(field.maxLength) || field.maxLength < 0) {
      diagnostics.push(
        diagnostic(
          "error",
          "EDIT_CONTRACT_MAX_LENGTH",
          "Edited session contract maxLength values must be non-negative integers.",
          { fieldIndex: field.fieldNumber }
        )
      );
    }
    if (!Number.isInteger(field.decimalPlaces) || field.decimalPlaces < 0) {
      diagnostics.push(
        diagnostic(
          "error",
          "EDIT_CONTRACT_DECIMAL_PLACES",
          "Edited session contract decimalPlaces values must be non-negative integers.",
          { fieldIndex: field.fieldNumber }
        )
      );
    }
    if (!SUPPORTED_FORMAT_EXPRESSIONS.has(field.formatExpression)) {
      diagnostics.push(
        diagnostic(
          "error",
          "EDIT_CONTRACT_FORMAT_EXPRESSION",
          "Edited session contract date expressions must be supported.",
          { fieldIndex: field.fieldNumber }
        )
      );
    }
  }

  return diagnostics;
};

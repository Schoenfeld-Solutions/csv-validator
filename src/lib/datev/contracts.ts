import { DATEV_LITE_CONTRACT } from "./contracts.generated";
import type {
  DatevContractRepository,
  DatevLiteFieldContract,
  DatevLiteFieldRuleContract,
  DatevLiteRecognitionContract,
  DatevMarker,
  DatevRecognitionCode,
} from "./types";

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

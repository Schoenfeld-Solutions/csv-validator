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
    recognitionCode: DatevRecognitionCode
  ): readonly DatevLiteFieldContract[] | undefined =>
    DATEV_LITE_CONTRACT.fieldsByCode[recognitionCode],
  getRules: (
    recognitionCode: DatevRecognitionCode
  ): readonly DatevLiteFieldRuleContract[] | undefined =>
    DATEV_LITE_CONTRACT.rulesByCode[recognitionCode],
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

export const SUPPORTED_FORMATS =
  BUILT_IN_CONTRACT_REPOSITORY.listRecognitions();

export const getFields = (
  recognitionCode: DatevRecognitionCode
): readonly DatevLiteFieldContract[] =>
  BUILT_IN_CONTRACT_REPOSITORY.getFields(recognitionCode) ?? [];

export const getRules = (
  recognitionCode: DatevRecognitionCode
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

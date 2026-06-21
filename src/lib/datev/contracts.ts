import { DATEV_LITE_CONTRACT } from "./contracts.generated";
import type {
  DatevLiteFieldContract,
  DatevLiteFieldRuleContract,
  DatevLiteRecognitionContract,
  DatevMarker,
  DatevRecognitionCode,
} from "./types";

export const SUPPORTED_FORMATS = DATEV_LITE_CONTRACT.recognitions;

export const getFields = (
  recognitionCode: DatevRecognitionCode
): readonly DatevLiteFieldContract[] =>
  DATEV_LITE_CONTRACT.fieldsByCode[recognitionCode];

export const getRules = (
  recognitionCode: DatevRecognitionCode
): readonly DatevLiteFieldRuleContract[] =>
  DATEV_LITE_CONTRACT.rulesByCode[recognitionCode];

export const findRecognitionBySignature = (
  category: string,
  name: string,
  version: string
): DatevLiteRecognitionContract | undefined =>
  DATEV_LITE_CONTRACT.recognitions.find(
    (recognition) =>
      recognition.formatCategory === category &&
      recognition.formatName === name &&
      recognition.formatVersion === version
  );

export const isAllowedMarker = (
  recognition: DatevLiteRecognitionContract,
  marker: string
): marker is DatevMarker =>
  recognition.allowedDatevMarkers.includes(marker as DatevMarker);

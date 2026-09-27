import React from "react";
import { LanguageSelector } from "../LanguageSelector";
import { TranslateToEnglish } from "../TranslateToEnglish";
import { useModelStore } from "../../../stores/modelStore";
import type { ModelInfo } from "@/bindings";
import {
  CHINESE_LANGUAGE_CODE,
  getUniqueCapabilityLanguages,
} from "@/lib/constants/languages";

// Language and translate rows for the current model. Each row only renders
// when the model supports it.
export const ModelLanguageSettings: React.FC = () => {
  const { currentModel, models } = useModelStore();

  const currentModelInfo = models.find((m: ModelInfo) => m.id === currentModel);
  if (!currentModelInfo) {
    return null;
  }

  const capabilityLanguages = getUniqueCapabilityLanguages(
    currentModelInfo.supported_languages,
  );
  const supportsChineseOnlyScriptSelection =
    capabilityLanguages.length === 1 &&
    capabilityLanguages[0] === CHINESE_LANGUAGE_CODE;
  const showLanguageSelector =
    currentModelInfo.supports_language_selection ||
    supportsChineseOnlyScriptSelection;

  return (
    <>
      {showLanguageSelector && (
        <LanguageSelector
          descriptionMode="inline"
          grouped={true}
          supportedLanguages={currentModelInfo.supported_languages}
          supportsLanguageDetection={
            currentModelInfo.supports_language_detection
          }
        />
      )}
      {currentModelInfo.supports_translation && (
        <TranslateToEnglish descriptionMode="inline" grouped={true} />
      )}
    </>
  );
};

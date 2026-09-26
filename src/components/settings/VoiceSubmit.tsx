import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dropdown } from "../ui/Dropdown";
import { Input } from "../ui/Input";
import { SettingContainer } from "../ui/SettingContainer";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import { useSettings } from "../../hooks/useSettings";
import { useOsType } from "../../hooks/useOsType";
import type { AutoSubmitKey } from "@/bindings";

interface VoiceSubmitProps {
  grouped?: boolean;
}

/** Mirrors the backend rule: every word needs a letter or digit. */
const isValidKeyword = (keyword: string) => {
  const words = keyword.trim().split(/\s+/);
  return (
    keyword.trim().length > 0 &&
    words.every((word) => /[\p{L}\p{N}]/u.test(word))
  );
};

export const VoiceSubmit: React.FC<VoiceSubmitProps> = React.memo(
  ({ grouped = false }) => {
    const { t } = useTranslation();
    const osType = useOsType();
    const { getSetting, updateSetting, isUpdating } = useSettings();

    const enabled = getSetting("voice_submit_enabled") ?? false;
    const savedKeyword = getSetting("voice_submit_keyword") ?? "submit";
    const submitKey = (getSetting("auto_submit_key") ||
      "enter") as AutoSubmitKey;

    // Edits stay local until blur or Enter so a half-typed phrase is never saved.
    const [keyword, setKeyword] = useState(savedKeyword);
    const [invalid, setInvalid] = useState(false);
    useEffect(() => setKeyword(savedKeyword), [savedKeyword]);

    const commitKeyword = () => {
      const normalized = keyword.trim().split(/\s+/).join(" ");
      if (!isValidKeyword(normalized)) {
        setInvalid(true);
        return;
      }
      setInvalid(false);
      setKeyword(normalized);
      if (normalized !== savedKeyword) {
        updateSetting("voice_submit_keyword", normalized);
      }
    };

    const keyOptions = [
      {
        value: "enter",
        label: t("settings.advanced.autoSubmit.options.enter"),
      },
      {
        value: "ctrl_enter",
        label: t("settings.advanced.autoSubmit.options.ctrlEnter"),
      },
      {
        value: "cmd_enter",
        label:
          osType === "macos"
            ? t("settings.advanced.autoSubmit.options.cmdEnter")
            : t("settings.advanced.autoSubmit.options.superEnter"),
      },
    ];

    return (
      <>
        <ToggleSwitch
          checked={enabled}
          onChange={(value) => updateSetting("voice_submit_enabled", value)}
          isUpdating={isUpdating("voice_submit_enabled")}
          label={t("settings.advanced.voiceSubmit.title")}
          description={t("settings.advanced.voiceSubmit.description")}
          descriptionMode="inline"
          grouped={grouped}
        />
        {enabled && (
          <>
            <SettingContainer
              title={t("settings.advanced.voiceSubmit.keyword.title")}
              description={
                invalid
                  ? t("settings.advanced.voiceSubmit.keyword.invalid")
                  : t("settings.advanced.voiceSubmit.keyword.description")
              }
              descriptionMode="inline"
              grouped={grouped}
            >
              <Input
                type="text"
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value);
                  setInvalid(false);
                }}
                onBlur={commitKeyword}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
                aria-invalid={invalid}
                variant="compact"
                className={`w-48 ${invalid ? "border-error" : ""}`}
                disabled={isUpdating("voice_submit_keyword")}
              />
            </SettingContainer>
            <SettingContainer
              title={t("settings.advanced.voiceSubmit.key.title")}
              description={t("settings.advanced.voiceSubmit.key.description")}
              descriptionMode="inline"
              grouped={grouped}
            >
              <Dropdown
                options={keyOptions}
                selectedValue={submitKey}
                onSelect={(value) =>
                  updateSetting("auto_submit_key", value as AutoSubmitKey)
                }
                disabled={isUpdating("auto_submit_key")}
              />
            </SettingContainer>
          </>
        )}
      </>
    );
  },
);

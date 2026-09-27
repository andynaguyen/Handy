import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "../ui/Input";
import { SettingContainer } from "../ui/SettingContainer";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import { useSettings } from "../../hooks/useSettings";

interface VoiceScrubProps {
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

export const VoiceScrub: React.FC<VoiceScrubProps> = React.memo(
  ({ grouped = false }) => {
    const { t } = useTranslation();
    const { getSetting, updateSetting, isUpdating } = useSettings();

    const enabled = getSetting("scrub_enabled") ?? true;
    const savedKeyword = getSetting("scrub_keyword") ?? "scrub that";

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
        updateSetting("scrub_keyword", normalized);
      }
    };

    return (
      <>
        <ToggleSwitch
          checked={enabled}
          onChange={(value) => updateSetting("scrub_enabled", value)}
          isUpdating={isUpdating("scrub_enabled")}
          label={t("settings.advanced.voiceScrub.title")}
          description={t("settings.advanced.voiceScrub.description")}
          descriptionMode="inline"
          grouped={grouped}
        />
        {enabled && (
          <SettingContainer
            title={t("settings.advanced.voiceScrub.keyword.title")}
            description={
              invalid
                ? t("settings.advanced.voiceScrub.keyword.invalid")
                : t("settings.advanced.voiceScrub.keyword.description")
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
              disabled={isUpdating("scrub_keyword")}
            />
          </SettingContainer>
        )}
      </>
    );
  },
);

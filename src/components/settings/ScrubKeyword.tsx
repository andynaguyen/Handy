import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "../ui/Input";
import { SettingContainer } from "../ui/SettingContainer";
import { useSettings } from "../../hooks/useSettings";

interface ScrubKeywordProps {
  grouped?: boolean;
}

/** Mirrors the backend rule: empty, or every word has a letter or digit. */
const isValidKeyword = (keyword: string) =>
  keyword === "" ||
  keyword.split(" ").every((word) => /[\p{L}\p{N}]/u.test(word));

export const ScrubKeyword: React.FC<ScrubKeywordProps> = React.memo(
  ({ grouped = false }) => {
    const { t } = useTranslation();
    const { getSetting, updateSetting, isUpdating } = useSettings();

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
      <SettingContainer
        title={t("settings.advanced.scrubKeyword.title")}
        description={
          invalid
            ? t("settings.advanced.scrubKeyword.invalid")
            : t("settings.advanced.scrubKeyword.description")
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
    );
  },
);

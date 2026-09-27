import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import { commands } from "@/bindings";
import type { AppStyleRule, RunningApp, WritingStyle } from "@/bindings";
import { useSettings } from "../../../hooks/useSettings";
import { useOsType } from "../../../hooks/useOsType";
import { Dropdown } from "../../ui/Dropdown";

const STYLES = [
  { id: "formal", key: "formal" },
  { id: "casual", key: "casual" },
  { id: "very_casual", key: "veryCasual" },
] as const satisfies readonly { id: WritingStyle; key: string }[];

// New rules start as Casual; the row's selector changes it
const NEW_RULE_STYLE: WritingStyle = "casual";

const StyleCards: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="@container">
      <ul className="grid gap-3 @2xl:grid-cols-3">
        {STYLES.map((style) => (
          <li key={style.id} className="bg-card rounded-2xl px-4 py-3.5">
            <p className="text-[15px] font-medium">
              {t(`settings.style.styles.${style.key}.name`)}
              {style.id === "formal" && (
                <span className="font-normal text-text/55">
                  {" "}
                  {t("settings.style.default")}
                </span>
              )}
            </p>
            <p className="text-[13px] text-text/55">
              {t(`settings.style.styles.${style.key}.description`)}
            </p>
            <p className="mt-2 text-[13px] text-text/80">
              {t(`settings.style.styles.${style.key}.example`)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
};

const AppRules: React.FC = () => {
  const { t } = useTranslation();
  const { getSetting, updateSetting, isUpdating } = useSettings();
  const rules = getSetting("app_styles") ?? [];
  const updating = isUpdating("app_styles");
  const [runningApps, setRunningApps] = useState<RunningApp[]>([]);

  const styleOptions = STYLES.map((style) => ({
    value: style.id,
    label: t(`settings.style.styles.${style.key}.name`),
  }));
  const addOptions = runningApps
    .filter((app) => !rules.some((rule) => rule.bundle_id === app.bundle_id))
    .map((app) => ({ value: app.bundle_id, label: app.name }));

  const setRules = (next: AppStyleRule[]) => updateSetting("app_styles", next);

  const addApp = (bundleId: string) => {
    const app = runningApps.find(
      (candidate) => candidate.bundle_id === bundleId,
    );
    if (!app) {
      return;
    }
    setRules([
      ...rules,
      { bundle_id: app.bundle_id, app_name: app.name, style: NEW_RULE_STYLE },
    ]);
  };

  const setStyle = (bundleId: string, style: WritingStyle) => {
    setRules(
      rules.map((rule) =>
        rule.bundle_id === bundleId ? { ...rule, style } : rule,
      ),
    );
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-medium">
          {t("settings.style.apps.title")}
        </h2>
        <Dropdown
          className="w-56"
          options={addOptions}
          selectedValue={null}
          onSelect={addApp}
          onRefresh={() => {
            commands.getRunningApps().then(setRunningApps);
          }}
          placeholder={t("settings.style.apps.add")}
          disabled={updating}
        />
      </div>
      {rules.length === 0 ? (
        <div className="bg-card rounded-2xl px-5 py-10 text-center text-sm text-text/55">
          {t("settings.style.apps.empty")}
        </div>
      ) : (
        <ul className="bg-card rounded-2xl divide-y divide-mid-gray/15">
          {rules.map((rule) => (
            <li
              key={rule.bundle_id}
              className="group flex items-center justify-between gap-3 px-5 py-2.5"
            >
              <span className="text-[15px] truncate" title={rule.bundle_id}>
                {rule.app_name}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <Dropdown
                  options={styleOptions}
                  selectedValue={rule.style}
                  onSelect={(style) =>
                    setStyle(rule.bundle_id, style as WritingStyle)
                  }
                  disabled={updating}
                />
                <button
                  type="button"
                  onClick={() =>
                    setRules(
                      rules.filter(
                        (existing) => existing.bundle_id !== rule.bundle_id,
                      ),
                    )
                  }
                  disabled={updating}
                  aria-label={t("settings.style.apps.remove", {
                    app: rule.app_name,
                  })}
                  className="rounded-lg p-1.5 text-text/55 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 hover:bg-mid-gray/10 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/20 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export const StyleSettings: React.FC = () => {
  const { t } = useTranslation();
  const isMacOS = useOsType() === "macos";

  return (
    <div className="max-w-3xl w-full mx-auto space-y-5">
      <p className="text-sm text-text/65">{t("settings.style.intro")}</p>
      <StyleCards />
      {isMacOS ? (
        <AppRules />
      ) : (
        <div className="bg-card rounded-2xl px-5 py-4 text-sm text-text/55">
          {t("settings.style.macOSOnly")}
        </div>
      )}
    </div>
  );
};

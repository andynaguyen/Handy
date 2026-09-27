import React from "react";
import { createRoot } from "react-dom/client";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { mockIPC } from "@tauri-apps/api/mocks";
import translations from "../../src/i18n/locales/en/translation.json";
import { AdvancedSettings } from "../../src/components/settings/advanced/AdvancedSettings";
import { useSettingsStore } from "../../src/stores/settingsStore";
import "../../src/App.css";

declare global {
  interface Window {
    __TAURI_OS_PLUGIN_INTERNALS__: { os_type: string };
  }
}

// ?experimental=1 turns on experimental features
const params = new URLSearchParams(location.search);
window.__TAURI_OS_PLUGIN_INTERNALS__ = { os_type: "macos" };
let experimental = params.get("experimental") === "1";

mockIPC((command, args) => {
  if (command === "get_app_settings") {
    return { experimental_enabled: experimental };
  }
  if (command === "change_experimental_enabled_setting") {
    experimental = (args as { enabled: boolean }).enabled;
  }
  return null;
});

await i18n.use(initReactI18next).init({
  lng: "en",
  resources: { en: { translation: translations } },
  interpolation: { escapeValue: false },
});
await useSettingsStore.getState().refreshSettings();

createRoot(document.getElementById("root")!).render(
  <div className="flex flex-col items-center px-7 pt-7 pb-8 gap-5 min-h-screen bg-background text-text">
    {/* eslint-disable-next-line i18next/no-literal-string */}
    <h1 className="max-w-3xl w-full font-serif text-[28px]">Advanced</h1>
    <AdvancedSettings />
  </div>,
);

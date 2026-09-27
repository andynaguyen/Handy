import React from "react";
import { createRoot } from "react-dom/client";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { mockIPC } from "@tauri-apps/api/mocks";
import translations from "../../src/i18n/locales/en/translation.json";
import { StyleSettings } from "../../src/components/settings/style/StyleSettings";
import { useSettingsStore } from "../../src/stores/settingsStore";
import "../../src/App.css";

import type { AppStyleRule, RunningApp } from "../../src/bindings";

declare global {
  interface Window {
    styleTest: { saved: AppStyleRule[][] };
    __TAURI_OS_PLUGIN_INTERNALS__: { os_type: string };
  }
}

// ?os=windows switches platforms; the rules start as the backend defaults
const params = new URLSearchParams(location.search);
window.__TAURI_OS_PLUGIN_INTERNALS__ = { os_type: params.get("os") ?? "macos" };
let rules: AppStyleRule[] = [
  {
    bundle_id: "com.apple.MobileSMS",
    app_name: "Messages",
    style: "very_casual",
  },
  {
    bundle_id: "com.tinyspeck.slackmacgap",
    app_name: "Slack",
    style: "very_casual",
  },
];
const runningApps: RunningApp[] = [
  { bundle_id: "com.apple.mail", name: "Mail" },
  { bundle_id: "com.apple.MobileSMS", name: "Messages" },
  { bundle_id: "com.linear", name: "Linear" },
];
window.styleTest = { saved: [] };

mockIPC((command, args) => {
  if (command === "get_app_settings") {
    return { app_styles: rules };
  }
  if (command === "get_running_apps") {
    return runningApps;
  }
  if (command === "update_app_styles") {
    rules = (args as { rules: AppStyleRule[] }).rules;
    window.styleTest.saved.push(rules);
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
    <h1 className="max-w-3xl w-full font-serif text-[28px]">Style</h1>
    <StyleSettings />
  </div>,
);

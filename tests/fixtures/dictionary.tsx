import React from "react";
import { createRoot } from "react-dom/client";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { mockIPC } from "@tauri-apps/api/mocks";
import translations from "../../src/i18n/locales/en/translation.json";
import { DictionarySettings } from "../../src/components/settings/dictionary/DictionarySettings";
import { useSettingsStore } from "../../src/stores/settingsStore";
import "../../src/App.css";

import type { Snippet } from "../../src/bindings";

declare global {
  interface Window {
    dictionaryTest: { saved: string[][]; savedSnippets: Snippet[][] };
  }
}

// ?words=a,b and ?snippets=<JSON> seed the stored lists, oldest first like
// the real settings
const params = new URLSearchParams(location.search);
let words = params.get("words")?.split(",") ?? [];
let snippets: Snippet[] = JSON.parse(params.get("snippets") ?? "[]");
window.dictionaryTest = { saved: [], savedSnippets: [] };

mockIPC((command, args) => {
  if (command === "get_app_settings") {
    return { custom_words: words, snippets };
  }
  if (command === "update_custom_words") {
    words = (args as { words: string[] }).words;
    window.dictionaryTest.saved.push(words);
  }
  if (command === "update_snippets") {
    snippets = (args as { snippets: Snippet[] }).snippets;
    window.dictionaryTest.savedSnippets.push(snippets);
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
    <h1 className="max-w-3xl w-full font-serif text-[28px]">Dictionary</h1>
    <DictionarySettings />
  </div>,
);

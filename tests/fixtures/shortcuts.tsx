import React from "react";
import { createRoot } from "react-dom/client";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { emit } from "@tauri-apps/api/event";
import { mockIPC } from "@tauri-apps/api/mocks";
import translations from "../../src/i18n/locales/en/translation.json";
import { ShortcutInput } from "../../src/components/settings/ShortcutInput";
import { GlobalShortcutInput } from "../../src/components/settings/GlobalShortcutInput";
import { HandyKeysShortcutInput } from "../../src/components/settings/HandyKeysShortcutInput";
import { useSettingsStore } from "../../src/stores/settingsStore";
import "../../src/App.css";

interface RecorderEvent {
  modifiers: string[];
  key: string | null;
  is_key_down: boolean;
  hotkey_string: string;
}

declare global {
  interface Window {
    shortcutTest: {
      changes: string[];
      commands: string[];
      emit: (event: RecorderEvent) => Promise<void>;
    };
  }
}

const backend = new URLSearchParams(location.search).get("backend");
Object.assign(window, {
  __TAURI_OS_PLUGIN_INTERNALS__: {
    os_type: backend === "tauri_macos" ? "macos" : "windows",
  },
});
window.shortcutTest = {
  changes: [],
  commands: [],
  emit: (event) => emit("handy-keys-event", event),
};

mockIPC(
  (command, args) => {
    window.shortcutTest.commands.push(command);
    if (command === "get_app_settings") {
      return {
        keyboard_implementation:
          backend === "handy_keys" ? "handy_keys" : "tauri",
        bindings: {
          transcribe: {
            id: "transcribe",
            name: "Dictation shortcut",
            description: "Start dictation",
            current_binding: "ctrl+space",
            default_binding: "ctrl+space",
          },
        },
      };
    }
    if (command === "change_binding") {
      window.shortcutTest.changes.push((args as { binding: string }).binding);
      return { success: true };
    }
    return null;
  },
  { shouldMockEvents: true },
);

await i18n.use(initReactI18next).init({
  lng: "en",
  resources: { en: { translation: translations } },
  interpolation: { escapeValue: false },
});
await useSettingsStore.getState().refreshSettings();

const Component =
  backend === "tauri_macos"
    ? ShortcutInput
    : backend === "handy_keys"
      ? HandyKeysShortcutInput
      : GlobalShortcutInput;

createRoot(document.getElementById("root")!).render(
  <>
    <Component shortcutId="transcribe" descriptionMode="inline" />
    <button type="button">Outside recorder</button>
  </>,
);

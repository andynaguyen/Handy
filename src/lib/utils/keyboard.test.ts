import assert from "node:assert/strict";
import { formatKeyCombination, getKeyName, getMouseShortcut } from "./keyboard";
import i18next from "i18next";
import translation from "../../i18n/locales/en/translation.json";

await i18next.init({ lng: "en", resources: { en: { translation } } });

const keyboardEvent = (value: { code?: string; key?: string }): KeyboardEvent =>
  value as KeyboardEvent;

const compoundKeys = [
  ["ScrollLock", "scrolllock", "Scroll Lock"],
  ["CapsLock", "capslock", "Caps Lock"],
  ["NumLock", "numlock", "Num Lock"],
  ["PageUp", "pageup", "Page Up"],
  ["PageDown", "pagedown", "Page Down"],
  ["PrintScreen", "printscreen", "Print Screen"],
] as const;

for (const [code, stored, displayed] of compoundKeys) {
  assert.equal(getKeyName(keyboardEvent({ code })), stored);
  assert.equal(formatKeyCombination(stored, "linux"), displayed);
}

assert.equal(getKeyName(keyboardEvent({ key: "CapsLock" })), "capslock");
assert.equal(
  getKeyName(keyboardEvent({ code: "AudioVolumeUp" })),
  "audiovolumeup",
);

for (const [button, token, label] of [
  [1, "mousemiddle", "Middle Mouse"],
  [3, "mousex1", "Mouse 4"],
  [4, "mousex2", "Mouse 5"],
  [5, "mouse6", "Mouse 6"],
  [6, "mouse7", "Mouse 7"],
  [7, "mouse8", "Mouse 8"],
] as const) {
  assert.equal(getMouseShortcut({ button } as MouseEvent), token);
  assert.equal(formatKeyCombination(token, "macos"), label);
}
for (const [button, token] of [
  [0, "mouseleft"],
  [2, "mouseright"],
] as const) {
  assert.equal(getMouseShortcut({ button } as MouseEvent), null);
  assert.equal(
    getMouseShortcut({ button, ctrlKey: true } as MouseEvent),
    `ctrl+${token}`,
  );
}
assert.equal(getMouseShortcut({ button: 8 } as MouseEvent), null);
assert.equal(
  getMouseShortcut({
    button: 3,
    altKey: true,
    metaKey: true,
    shiftKey: true,
  } as MouseEvent),
  "alt+shift+super+mousex1",
);
assert.equal(
  formatKeyCombination("ctrl+mouseleft", "windows"),
  "Ctrl + Left Mouse",
);
i18next.addResource(
  "de",
  "translation",
  "settings.general.shortcut.mouseButtons.mousex1",
  "Maustaste 4",
);
await i18next.changeLanguage("de");
assert.equal(formatKeyCombination("mousex1", "linux"), "Maustaste 4");

console.log("keyboard: all assertions passed");

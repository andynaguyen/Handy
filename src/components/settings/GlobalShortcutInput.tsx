import React, { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  getKeyName,
  getMouseShortcut,
  formatKeyCombination,
  normalizeKey,
} from "../../lib/utils/keyboard";
import { ResetButton } from "../ui/ResetButton";
import { SettingContainer } from "../ui/SettingContainer";
import { useSettings } from "../../hooks/useSettings";
import { useOsType } from "../../hooks/useOsType";
import { commands } from "@/bindings";
import { toast } from "sonner";

interface GlobalShortcutInputProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
  shortcutId: string;
  disabled?: boolean;
}

export const GlobalShortcutInput: React.FC<GlobalShortcutInputProps> = ({
  descriptionMode = "inline",
  grouped = false,
  shortcutId,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const { getSetting, updateBinding, resetBinding, isUpdating, isLoading } =
    useSettings();
  const [recordedKeys, setRecordedKeys] = useState<string[]>([]);
  const [editingShortcutId, setEditingShortcutId] = useState<string | null>(
    null,
  );
  const [originalBinding, setOriginalBinding] = useState<string>("");
  const shortcutRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const osType = useOsType();

  const bindings = getSetting("bindings") || {};

  useEffect(() => {
    if (editingShortcutId === null) {
      return;
    }

    let finished = false;
    const pressed = new Set<string>();
    const captured = new Set<string>();
    let mouseCapture: { button: number; shortcut: string } | null = null;

    const finish = async (shortcut?: string) => {
      if (finished) {
        return;
      }
      finished = true;
      try {
        if (shortcut) {
          await updateBinding(editingShortcutId, shortcut);
        }
      } catch (error) {
        console.error("Failed to change binding:", error);
        toast.error(
          t("settings.general.shortcut.errors.set", { error: String(error) }),
        );
        if (originalBinding) {
          try {
            await updateBinding(editingShortcutId, originalBinding);
          } catch (resetError) {
            console.error("Failed to reset binding:", resetError);
            toast.error(t("settings.general.shortcut.errors.reset"));
          }
        }
      } finally {
        await commands.resumeAllBindings().catch(console.error);
        setEditingShortcutId(null);
        setRecordedKeys([]);
        setOriginalBinding("");
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (finished || e.repeat) {
        return;
      }
      e.preventDefault();
      const key = normalizeKey(getKeyName(e, osType));
      pressed.add(key);
      captured.add(key);
      if (!mouseCapture) {
        setRecordedKeys([...captured]);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (finished) {
        return;
      }
      e.preventDefault();
      pressed.delete(normalizeKey(getKeyName(e, osType)));
      if (pressed.size === 0 && captured.size > 0 && !mouseCapture) {
        const modifiers = new Set([
          "ctrl",
          "control",
          "shift",
          "alt",
          "option",
          "meta",
          "command",
          "cmd",
          "super",
          "win",
          "windows",
        ]);
        const sorted = [...captured].sort(
          (a, b) => Number(modifiers.has(b)) - Number(modifiers.has(a)),
        );
        void finish(sorted.join("+"));
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (finished || mouseCapture) {
        return;
      }
      const shortcut = getMouseShortcut(e);
      if (shortcut) {
        e.preventDefault();
        e.stopPropagation();
        mouseCapture = { button: e.button, shortcut };
        setRecordedKeys(shortcut.split("+"));
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (mouseCapture && e.button === mouseCapture.button) {
        e.preventDefault();
        e.stopPropagation();
        void finish(mouseCapture.shortcut);
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (mouseCapture || getMouseShortcut(e)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const activeElement = shortcutRefs.current.get(editingShortcutId);
      if (
        e.button === 0 &&
        activeElement &&
        !activeElement.contains(e.target as Node)
      ) {
        e.preventDefault();
        e.stopPropagation();
        void finish();
      }
    };

    const preventMouseAction = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousedown", handleMouseDown, true);
    window.addEventListener("mouseup", handleMouseUp, true);
    window.addEventListener("click", handleClick, true);
    window.addEventListener("auxclick", preventMouseAction, true);
    window.addEventListener("contextmenu", preventMouseAction, true);

    return () => {
      if (!finished) {
        void commands.resumeAllBindings().catch(console.error);
      }
      finished = true;
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousedown", handleMouseDown, true);
      window.removeEventListener("mouseup", handleMouseUp, true);
      window.removeEventListener("click", handleClick, true);
      window.removeEventListener("auxclick", preventMouseAction, true);
      window.removeEventListener("contextmenu", preventMouseAction, true);
    };
  }, [editingShortcutId, originalBinding, updateBinding, osType, t]);

  // Start recording a new shortcut
  const startRecording = async (id: string) => {
    if (editingShortcutId === id || disabled) {
      return;
    }

    // Suspend all bindings so no shortcut fires (or swallows the
    // keystrokes) while keys are being recorded
    await commands.suspendAllBindings().catch(console.error);

    // Store the original binding to restore if canceled
    setOriginalBinding(bindings[id]?.current_binding || "");
    setEditingShortcutId(id);
    setRecordedKeys([]);
  };

  // Format the current shortcut keys being recorded
  const formatCurrentKeys = (): string => {
    if (recordedKeys.length === 0) {
      return t("settings.general.shortcut.pressKeysOrMouse");
    }

    // Use the same formatting as the display to ensure consistency
    return formatKeyCombination(recordedKeys.join("+"), osType);
  };

  // Store references to shortcut elements
  const setShortcutRef = (id: string, ref: HTMLDivElement | null) => {
    shortcutRefs.current.set(id, ref);
  };

  // If still loading, show loading state
  if (isLoading) {
    return (
      <SettingContainer
        title={t("settings.general.shortcut.title")}
        description={t("settings.general.shortcut.description")}
        descriptionMode={descriptionMode}
        grouped={grouped}
      >
        <div className="text-sm text-mid-gray">
          {t("settings.general.shortcut.loading")}
        </div>
      </SettingContainer>
    );
  }

  // If no bindings are loaded, show empty state
  if (Object.keys(bindings).length === 0) {
    return (
      <SettingContainer
        title={t("settings.general.shortcut.title")}
        description={t("settings.general.shortcut.description")}
        descriptionMode={descriptionMode}
        grouped={grouped}
      >
        <div className="text-sm text-mid-gray">
          {t("settings.general.shortcut.none")}
        </div>
      </SettingContainer>
    );
  }

  const binding = bindings[shortcutId];
  if (!binding) {
    return (
      <SettingContainer
        title={t("settings.general.shortcut.title")}
        description={t("settings.general.shortcut.notFound")}
        descriptionMode={descriptionMode}
        grouped={grouped}
      >
        <div className="text-sm text-mid-gray">
          {t("settings.general.shortcut.none")}
        </div>
      </SettingContainer>
    );
  }

  // Get translated name and description for the binding
  const translatedName = t(
    `settings.general.shortcut.bindings.${shortcutId}.name`,
    binding.name,
  );
  const translatedDescription = t(
    `settings.general.shortcut.bindings.${shortcutId}.description`,
    binding.description,
  );

  return (
    <SettingContainer
      title={translatedName}
      description={translatedDescription}
      descriptionMode={descriptionMode}
      grouped={grouped}
      disabled={disabled}
      layout="horizontal"
    >
      <div className="flex items-center space-x-1">
        {editingShortcutId === shortcutId ? (
          <div
            ref={(ref) => setShortcutRef(shortcutId, ref)}
            className="px-2.5 py-1 text-sm font-medium whitespace-nowrap border border-accent bg-background ring-2 ring-accent/15 rounded-lg"
          >
            {formatCurrentKeys()}
          </div>
        ) : (
          <div
            className="px-2.5 py-1 text-sm font-medium whitespace-nowrap bg-background border border-mid-gray/25 shadow-[0_1px_1px_rgba(0,0,0,0.03)] hover:border-mid-gray/50 rounded-lg cursor-pointer"
            onClick={() => startRecording(shortcutId)}
          >
            {formatKeyCombination(binding.current_binding, osType)}
          </div>
        )}
        <ResetButton
          onClick={() => resetBinding(shortcutId)}
          disabled={isUpdating(`binding_${shortcutId}`)}
        />
      </div>
    </SettingContainer>
  );
};

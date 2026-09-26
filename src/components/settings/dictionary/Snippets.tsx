import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import type { Snippet } from "@/bindings";
import { useSettings } from "../../../hooks/useSettings";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { Input } from "../../ui/Input";
import { Textarea } from "../../ui/Textarea";

const MAX_TRIGGER_LENGTH = 50;
const MAX_TEXT_LENGTH = 4000;

// Mirrors the backend's matching: whole words, case-insensitive, letters and
// digits only. Two triggers with the same key would fire on the same speech.
const triggerKey = (trigger: string) =>
  trigger
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase())
    .filter(Boolean)
    .join(" ");

interface SnippetDialogProps {
  // null while adding, otherwise the index of the snippet being edited
  editing: number | null;
  initial: Snippet;
  snippets: Snippet[];
  onClose: () => void;
  onSave: (snippet: Snippet) => void;
}

const SnippetDialog: React.FC<SnippetDialogProps> = ({
  editing,
  initial,
  snippets,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation();
  const triggerRef = useRef<HTMLInputElement>(null);
  const [trigger, setTrigger] = useState(initial.trigger);
  const [text, setText] = useState(initial.text);
  const key = triggerKey(trigger);
  const duplicate = snippets.some(
    (snippet, index) =>
      index !== editing && triggerKey(snippet.trigger) === key,
  );
  const canSave = key.length > 0 && text.trim().length > 0 && !duplicate;
  const counter = `${text.length}/${MAX_TEXT_LENGTH}`;

  const save = () => {
    if (!canSave) {
      return;
    }
    onSave({ trigger: trigger.trim().replace(/\s+/g, " "), text });
  };

  return (
    <Dialog
      open
      title={t(
        editing === null
          ? "settings.dictionary.snippets.addTitle"
          : "settings.dictionary.snippets.editTitle",
      )}
      closeLabel={t("common.close")}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      initialFocusRef={triggerRef}
      contentFades={false}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("settings.dictionary.cancel")}
          </Button>
          <Button onClick={save} disabled={!canSave}>
            {t(
              editing === null
                ? "settings.dictionary.snippets.add"
                : "settings.dictionary.snippets.save",
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <Input
            ref={triggerRef}
            type="text"
            className="w-full"
            value={trigger}
            maxLength={MAX_TRIGGER_LENGTH}
            onChange={(e) => setTrigger(e.target.value)}
            placeholder={t("settings.dictionary.snippets.triggerPlaceholder")}
            aria-label={t("settings.dictionary.snippets.triggerPlaceholder")}
          />
          {duplicate && (
            <p className="mt-2 text-[13px] text-red-500">
              {t("settings.dictionary.snippets.duplicate", {
                trigger: trigger.trim(),
              })}
            </p>
          )}
        </div>
        <div>
          <Textarea
            className="w-full min-h-40"
            value={text}
            maxLength={MAX_TEXT_LENGTH}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("settings.dictionary.snippets.textPlaceholder")}
            aria-label={t("settings.dictionary.snippets.textPlaceholder")}
          />
          <p className="mt-1 text-end text-xs text-text/45 tabular-nums">
            {counter}
          </p>
        </div>
      </div>
    </Dialog>
  );
};

interface SnippetsProps {
  query: string;
  adding: boolean;
  onAddingChange: (adding: boolean) => void;
}

export const Snippets: React.FC<SnippetsProps> = ({
  query,
  adding,
  onAddingChange,
}) => {
  const { t } = useTranslation();
  const { getSetting, updateSetting, isUpdating } = useSettings();
  const [editing, setEditing] = useState<number | null>(null);
  const snippets = getSetting("snippets") || [];
  const updating = isUpdating("snippets");

  // Newest first, keeping each snippet's stored index for edits and removal
  const needle = query.trim().toLowerCase();
  const visible = snippets
    .map((snippet, index) => ({ snippet, index }))
    .reverse()
    .filter(
      ({ snippet }) =>
        snippet.trigger.toLowerCase().includes(needle) ||
        snippet.text.toLowerCase().includes(needle),
    );

  const closeDialog = () => {
    setEditing(null);
    onAddingChange(false);
  };

  const save = (snippet: Snippet) => {
    updateSetting(
      "snippets",
      editing === null
        ? [...snippets, snippet]
        : snippets.map((existing, index) =>
            index === editing ? snippet : existing,
          ),
    );
    closeDialog();
  };

  const remove = (index: number) => {
    updateSetting(
      "snippets",
      snippets.filter((_, existing) => existing !== index),
    );
  };

  let list: React.ReactNode;
  if (snippets.length === 0) {
    list = (
      <div className="bg-card rounded-2xl px-5 py-10 text-center text-sm text-text/55">
        {t("settings.dictionary.snippets.empty")}
      </div>
    );
  } else if (visible.length === 0) {
    list = (
      <div className="bg-card rounded-2xl px-5 py-10 text-center text-sm text-text/55">
        {t("settings.dictionary.snippets.noMatches", { query: query.trim() })}
      </div>
    );
  } else {
    list = (
      <ul className="bg-card rounded-2xl divide-y divide-mid-gray/15">
        {visible.map(({ snippet, index }) => (
          <li key={index} className="group flex items-center gap-3 pe-5">
            <button
              type="button"
              onClick={() => setEditing(index)}
              className="flex-1 min-w-0 flex items-center gap-2 ps-5 py-3.5 text-start text-[15px] cursor-pointer focus:outline-none focus-visible:underline"
            >
              <span className="shrink-0">{snippet.trigger}</span>
              <span className="shrink-0 text-text/40" aria-hidden="true">
                →
              </span>
              <span className="truncate text-text/70">{snippet.text}</span>
            </button>
            <button
              type="button"
              onClick={() => remove(index)}
              disabled={updating}
              aria-label={t("settings.dictionary.snippets.remove", {
                trigger: snippet.trigger,
              })}
              className="shrink-0 rounded-lg p-1.5 text-text/55 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 hover:bg-mid-gray/10 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/20 cursor-pointer disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    );
  }

  const dialogOpen = adding || editing !== null;

  return (
    <>
      {list}
      {dialogOpen && (
        <SnippetDialog
          editing={editing}
          initial={
            editing === null ? { trigger: "", text: "" } : snippets[editing]
          }
          snippets={snippets}
          onClose={closeDialog}
          onSave={save}
        />
      )}
    </>
  );
};

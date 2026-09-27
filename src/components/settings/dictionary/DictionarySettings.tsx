import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Search, Trash2 } from "lucide-react";
import { useSettings } from "../../../hooks/useSettings";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { Input } from "../../ui/Input";
import { Tabs } from "../../ui/Tabs";
import { Snippets } from "./Snippets";

const MAX_WORD_LENGTH = 50;

const normalizeWord = (word: string) =>
  word
    .replace(/[<>"']/g, "")
    .replace(/\s+/g, " ")
    .trim();

interface AddWordDialogProps {
  open: boolean;
  words: string[];
  onOpenChange: (open: boolean) => void;
  onAdd: (word: string) => void;
}

const AddWordDialog: React.FC<AddWordDialogProps> = ({
  open,
  words,
  onOpenChange,
  onAdd,
}) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const word = normalizeWord(value);
  const duplicate = words.includes(word);
  const canAdd =
    word.length > 0 && word.length <= MAX_WORD_LENGTH && !duplicate;

  const close = () => {
    setValue("");
    onOpenChange(false);
  };

  const add = () => {
    if (!canAdd) {
      return;
    }
    onAdd(word);
    close();
  };

  return (
    <Dialog
      open={open}
      title={t("settings.dictionary.dialogTitle")}
      closeLabel={t("common.close")}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          close();
        }
      }}
      initialFocusRef={inputRef}
      contentFades={false}
      className="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            {t("settings.dictionary.cancel")}
          </Button>
          <Button onClick={add} disabled={!canAdd}>
            {t("settings.dictionary.add")}
          </Button>
        </>
      }
    >
      <Input
        ref={inputRef}
        type="text"
        className="w-full"
        value={value}
        maxLength={MAX_WORD_LENGTH}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        placeholder={t("settings.dictionary.placeholder")}
      />
      {duplicate && (
        <p className="mt-2 text-[13px] text-red-500">
          {t("settings.dictionary.duplicate", { word })}
        </p>
      )}
    </Dialog>
  );
};

interface WordsProps {
  query: string;
  adding: boolean;
  onAddingChange: (adding: boolean) => void;
}

const Words: React.FC<WordsProps> = ({ query, adding, onAddingChange }) => {
  const { t } = useTranslation();
  const { getSetting, updateSetting, isUpdating } = useSettings();
  const words = getSetting("custom_words") || [];
  const updating = isUpdating("custom_words");

  // Newest first; the setting stores words in the order they were added
  const needle = query.trim().toLowerCase();
  const visibleWords = [...words]
    .reverse()
    .filter((word) => word.toLowerCase().includes(needle));

  const removeWord = (word: string) => {
    updateSetting(
      "custom_words",
      words.filter((existing) => existing !== word),
    );
  };

  let list: React.ReactNode;
  if (words.length === 0) {
    list = (
      <div className="bg-card rounded-2xl px-5 py-10 text-center text-sm text-text/55">
        {t("settings.dictionary.empty")}
      </div>
    );
  } else if (visibleWords.length === 0) {
    list = (
      <div className="bg-card rounded-2xl px-5 py-10 text-center text-sm text-text/55">
        {t("settings.dictionary.noMatches", { query: query.trim() })}
      </div>
    );
  } else {
    list = (
      <ul className="bg-card rounded-2xl divide-y divide-mid-gray/15">
        {visibleWords.map((word) => (
          <li
            key={word}
            className="group flex items-center justify-between gap-3 px-5 py-3.5"
          >
            <span className="text-[15px] truncate">{word}</span>
            <button
              type="button"
              onClick={() => removeWord(word)}
              disabled={updating}
              aria-label={t("settings.dictionary.remove", { word })}
              className="shrink-0 rounded-lg p-1.5 text-text/55 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 hover:bg-mid-gray/10 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/20 cursor-pointer disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      {list}
      <AddWordDialog
        open={adding}
        words={words}
        onOpenChange={onAddingChange}
        onAdd={(word) => updateSetting("custom_words", [...words, word])}
      />
    </>
  );
};

const TABS = [
  { id: "words", labelKey: "settings.dictionary.tabs.dictionary" },
  { id: "snippets", labelKey: "settings.dictionary.tabs.snippets" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export const DictionarySettings: React.FC = () => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabId>("words");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const Tab = tab === "words" ? Words : Snippets;

  return (
    <div className="max-w-3xl w-full mx-auto space-y-5">
      <Tabs
        tabs={TABS}
        selected={tab}
        onSelect={(id) => {
          setTab(id);
          setQuery("");
        }}
      />
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40"
            aria-hidden="true"
          />
          <Input
            type="search"
            className="w-full ps-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("settings.dictionary.searchPlaceholder")}
            aria-label={t("settings.dictionary.searchPlaceholder")}
          />
        </div>
        <Button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 py-2"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          {t("settings.dictionary.addNew")}
        </Button>
      </div>
      <Tab query={query} adding={adding} onAddingChange={setAdding} />
    </div>
  );
};

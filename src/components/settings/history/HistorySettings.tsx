import React, { useCallback, useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { readFile } from "@tauri-apps/plugin-fs";
import {
  Check,
  Copy,
  FolderOpen,
  RotateCcw,
  SlidersHorizontal,
  Star,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  commands,
  events,
  type HistoryEntry,
  type HistoryUpdatePayload,
} from "@/bindings";
import { useOsType } from "@/hooks/useOsType";
import { AudioPlayer, AudioPlayerGroup } from "../../ui/AudioPlayer";
import { Button } from "../../ui/Button";
import { SettingsGroup } from "../../ui/SettingsGroup";
import { HistoryLimit } from "../HistoryLimit";
import { RecordingRetentionPeriodSelector } from "../RecordingRetentionPeriod";
import { copyToClipboard } from "./clipboard";
import { toDateKey } from "../stats/usageStats";

const IconButton: React.FC<{
  onClick: () => void;
  title: string;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}> = ({ onClick, title, disabled, active, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`p-1.5 rounded-lg flex items-center justify-center transition-colors cursor-pointer hover:bg-mid-gray/15 disabled:cursor-not-allowed disabled:text-text/20 disabled:hover:bg-transparent ${
      active ? "text-accent" : "text-text/45 hover:text-text"
    }`}
    title={title}
  >
    {children}
  </button>
);

const PAGE_SIZE = 30;

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** "Today", "Yesterday", or a date, in the UI language. */
const formatDayLabel = (date: Date, locale: string): string => {
  const today = new Date();
  // Rounded so DST days (23 or 25 hours) still count as one day apart.
  const daysAgo = Math.round(
    (startOfDay(today).getTime() - startOfDay(date).getTime()) / 86_400_000,
  );
  if (daysAgo === 0 || daysAgo === 1) {
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
      -daysAgo,
      "day",
    );
  }
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  }).format(date);
};

/** Entries arrive newest first, so each day's entries are contiguous. */
const groupByDay = (entries: HistoryEntry[]) => {
  const groups: { key: string; date: Date; entries: HistoryEntry[] }[] = [];
  for (const entry of entries) {
    const date = new Date(entry.timestamp * 1000);
    const key = toDateKey(date);
    const last = groups[groups.length - 1];
    if (last?.key === key) {
      last.entries.push(entry);
    } else {
      groups.push({ key, date, entries: [entry] });
    }
  }
  return groups;
};

const headerButtonClass =
  "flex items-center gap-1.5 text-text/60 hover:text-text";

export const HistorySettings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const osType = useOsType();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const entriesRef = useRef<HistoryEntry[]>([]);
  const loadingRef = useRef(false);
  const [showSettings, setShowSettings] = useState(false);

  // Keep ref in sync for use in IntersectionObserver callback
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  const loadPage = useCallback(async (cursor?: number) => {
    const isFirstPage = cursor === undefined;
    if (!isFirstPage && loadingRef.current) return;
    loadingRef.current = true;

    if (isFirstPage) setLoading(true);

    try {
      const result = await commands.getHistoryEntries(
        cursor ?? null,
        PAGE_SIZE,
      );
      if (result.status === "ok") {
        const { entries: newEntries, has_more } = result.data;
        setEntries((prev) =>
          isFirstPage ? newEntries : [...prev, ...newEntries],
        );
        setHasMore(has_more);
      }
    } catch (error) {
      console.error("Failed to load history entries:", error);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadPage();
  }, [loadPage]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (loading) return;

    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (observerEntries) => {
        const first = observerEntries[0];
        if (first.isIntersecting) {
          const lastEntry = entriesRef.current[entriesRef.current.length - 1];
          if (lastEntry) {
            loadPage(lastEntry.id);
          }
        }
      },
      { threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loading, hasMore, loadPage]);

  // Listen for new entries added from the transcription pipeline
  useEffect(() => {
    const unlisten = events.historyUpdatePayload.listen((event) => {
      const payload: HistoryUpdatePayload = event.payload;
      if (payload.action === "added") {
        setEntries((prev) => [payload.entry, ...prev]);
      } else if (payload.action === "updated") {
        setEntries((prev) =>
          prev.map((e) => (e.id === payload.entry.id ? payload.entry : e)),
        );
      }
      // "deleted" and "toggled" are handled by optimistic updates only,
      // so we intentionally ignore them here to avoid double-mutation.
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const toggleSaved = async (id: number) => {
    // Optimistic update
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, saved: !e.saved } : e)),
    );
    try {
      const result = await commands.toggleHistoryEntrySaved(id);
      if (result.status !== "ok") {
        // Revert on failure
        setEntries((prev) =>
          prev.map((e) => (e.id === id ? { ...e, saved: !e.saved } : e)),
        );
      }
    } catch (error) {
      console.error("Failed to toggle saved status:", error);
      // Revert on failure
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, saved: !e.saved } : e)),
      );
    }
  };

  const getAudioUrl = useCallback(
    async (fileName: string) => {
      try {
        const result = await commands.getAudioFilePath(fileName);
        if (result.status === "ok") {
          if (osType === "linux") {
            const fileData = await readFile(result.data);
            const blob = new Blob([fileData], { type: "audio/wav" });
            return URL.createObjectURL(blob);
          }
          return convertFileSrc(result.data, "asset");
        }
        return null;
      } catch (error) {
        console.error("Failed to get audio file path:", error);
        return null;
      }
    },
    [osType],
  );

  const deleteAudioEntry = async (id: number) => {
    // Optimistically remove
    setEntries((prev) => prev.filter((e) => e.id !== id));
    try {
      const result = await commands.deleteHistoryEntry(id);
      if (result.status !== "ok") {
        // Reload on failure
        loadPage();
      }
    } catch (error) {
      console.error("Failed to delete entry:", error);
      loadPage();
    }
  };

  const retryHistoryEntry = async (id: number) => {
    const result = await commands.retryHistoryEntryTranscription(id);
    if (result.status !== "ok") {
      throw new Error(String(result.error));
    }
  };

  const openRecordingsFolder = async () => {
    try {
      const result = await commands.openRecordingsFolder();
      if (result.status !== "ok") {
        throw new Error(String(result.error));
      }
    } catch (error) {
      console.error("Failed to open recordings folder:", error);
    }
  };

  // History settings sit behind a header toggle so they stay one click away
  // however long the list gets.
  const header = (
    <>
      <div className="flex justify-end gap-1">
        <Button
          onClick={() => setShowSettings((shown) => !shown)}
          variant="ghost"
          size="sm"
          className={headerButtonClass}
          aria-expanded={showSettings}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>{t("sidebar.settings")}</span>
        </Button>
        <Button
          onClick={openRecordingsFolder}
          variant="ghost"
          size="sm"
          className={headerButtonClass}
          title={t("settings.history.openFolder")}
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>{t("settings.history.openFolder")}</span>
        </Button>
      </div>
      {showSettings && (
        <SettingsGroup>
          <HistoryLimit descriptionMode="inline" grouped={true} />
          <RecordingRetentionPeriodSelector
            descriptionMode="inline"
            grouped={true}
          />
        </SettingsGroup>
      )}
    </>
  );

  if (loading || entries.length === 0) {
    return (
      <div className="max-w-3xl w-full mx-auto space-y-2">
        {header}
        <div className="px-4 py-10 text-center text-sm text-text/55 border border-mid-gray/15 rounded-2xl">
          {loading
            ? t("settings.history.loading")
            : t("settings.history.empty")}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl w-full mx-auto space-y-2">
      {header}
      <AudioPlayerGroup>
        <div className="space-y-6">
          {groupByDay(entries).map((group) => (
            <section key={group.key} className="space-y-2">
              <h2 className="px-1 text-xs font-medium uppercase tracking-[0.08em] text-text/55">
                {formatDayLabel(group.date, i18n.language)}
              </h2>
              <div className="border border-mid-gray/15 rounded-2xl divide-y divide-mid-gray/15 overflow-hidden">
                {group.entries.map((entry) => (
                  <HistoryEntryComponent
                    key={entry.id}
                    entry={entry}
                    onToggleSaved={() => toggleSaved(entry.id)}
                    onCopyText={() => copyToClipboard(entry.transcription_text)}
                    getAudioUrl={getAudioUrl}
                    deleteAudio={deleteAudioEntry}
                    retryTranscription={retryHistoryEntry}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </AudioPlayerGroup>
      {/* Sentinel for infinite scroll */}
      <div ref={sentinelRef} className="h-1" />
    </div>
  );
};

interface HistoryEntryProps {
  entry: HistoryEntry;
  onToggleSaved: () => void;
  onCopyText: () => Promise<boolean>;
  getAudioUrl: (fileName: string) => Promise<string | null>;
  deleteAudio: (id: number) => Promise<void>;
  retryTranscription: (id: number) => Promise<void>;
}

const HistoryEntryComponent: React.FC<HistoryEntryProps> = ({
  entry,
  onToggleSaved,
  onCopyText,
  getAudioUrl,
  deleteAudio,
  retryTranscription,
}) => {
  const { t, i18n } = useTranslation();
  const [showCopied, setShowCopied] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const hasTranscription = entry.transcription_text.trim().length > 0;

  const handleLoadAudio = useCallback(
    () => getAudioUrl(entry.file_name),
    [getAudioUrl, entry.file_name],
  );

  const handleCopyText = async () => {
    if (!hasTranscription) {
      return;
    }

    const copied = await onCopyText();
    if (!copied) {
      toast.error(t("settings.history.copyError"));
      return;
    }

    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  const handleDeleteEntry = async () => {
    try {
      await deleteAudio(entry.id);
    } catch (error) {
      console.error("Failed to delete entry:", error);
      toast.error(t("settings.history.deleteError"));
    }
  };

  const handleRetranscribe = async () => {
    try {
      setRetrying(true);
      await retryTranscription(entry.id);
    } catch (error) {
      console.error("Failed to re-transcribe:", error);
      toast.error(t("settings.history.retranscribeError"));
    } finally {
      setRetrying(false);
    }
  };

  const time = new Intl.DateTimeFormat(i18n.language, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(entry.timestamp * 1000));

  return (
    <div className="flex gap-4 px-5 py-4 transition-colors hover:bg-card/60">
      <time className="w-16 shrink-0 text-[13px] leading-6 text-text/50 tabular-nums">
        {time}
      </time>
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <p
          className={`text-sm leading-6 ${
            retrying
              ? ""
              : hasTranscription
                ? "select-text cursor-text whitespace-pre-wrap break-words"
                : "text-text/40"
          }`}
          style={
            retrying
              ? { animation: "transcribe-pulse 3s ease-in-out infinite" }
              : undefined
          }
        >
          {retrying && (
            <style>{`
                @keyframes transcribe-pulse {
                  0%, 100% { color: color-mix(in srgb, var(--color-text) 40%, transparent); }
                  50% { color: color-mix(in srgb, var(--color-text) 90%, transparent); }
                }
              `}</style>
          )}
          {retrying
            ? t("settings.history.transcribing")
            : hasTranscription
              ? entry.transcription_text
              : t("settings.history.transcriptionFailed")}
        </p>
        <div className="flex items-center gap-3">
          <AudioPlayer
            onLoadRequest={handleLoadAudio}
            className="flex-1 min-w-0"
          />
          <div className="flex items-center shrink-0 -me-1.5">
            <IconButton
              onClick={handleCopyText}
              disabled={!hasTranscription || retrying}
              title={t("settings.history.copyToClipboard")}
            >
              {showCopied ? (
                <Check width={16} height={16} />
              ) : (
                <Copy width={16} height={16} />
              )}
            </IconButton>
            <IconButton
              onClick={onToggleSaved}
              disabled={retrying}
              active={entry.saved}
              title={
                entry.saved
                  ? t("settings.history.unsave")
                  : t("settings.history.save")
              }
            >
              <Star
                width={16}
                height={16}
                fill={entry.saved ? "currentColor" : "none"}
              />
            </IconButton>
            <IconButton
              onClick={handleRetranscribe}
              disabled={retrying}
              title={t("settings.history.retranscribe")}
            >
              <RotateCcw
                width={16}
                height={16}
                style={
                  retrying
                    ? { animation: "spin 1s linear infinite reverse" }
                    : undefined
                }
              />
            </IconButton>
            <IconButton
              onClick={handleDeleteEntry}
              disabled={retrying}
              title={t("settings.history.delete")}
            >
              <Trash2 width={16} height={16} />
            </IconButton>
          </div>
        </div>
      </div>
    </div>
  );
};

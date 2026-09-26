import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { commands, type DailyUsage } from "@/bindings";
import {
  buildHeatmap,
  computeStreaks,
  intensityLevel,
  parseDateKey,
  rangeStart,
  summarizeUsage,
} from "./usageStats";

const HEATMAP_WEEKS = 20;

// `days: null` means all time.
const RANGES = [
  { id: "today", days: 1, labelKey: "settings.stats.ranges.today" },
  { id: "week", days: 7, labelKey: "settings.stats.ranges.week" },
  { id: "month", days: 30, labelKey: "settings.stats.ranges.month" },
  { id: "all", days: null, labelKey: "settings.stats.ranges.all" },
] as const;

type RangeId = (typeof RANGES)[number]["id"];

const LEVEL_CLASSES = [
  "bg-mid-gray/15",
  "bg-data/25",
  "bg-data/50",
  "bg-data/75",
  "bg-data",
];

const StatCard: React.FC<{ value: string; label: string }> = ({
  value,
  label,
}) => (
  <div className="bg-card rounded-2xl px-5 py-4">
    <p className="text-[28px] leading-tight font-semibold tracking-tight tabular-nums">
      {value}
    </p>
    <p className="text-[11px] leading-4 font-medium text-text/55 uppercase tracking-[0.08em] mt-1.5">
      {label}
    </p>
  </div>
);

export const StatsSettings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [days, setDays] = useState<DailyUsage[] | null>(null);
  const [error, setError] = useState(false);
  const [rangeId, setRangeId] = useState<RangeId>("week");

  useEffect(() => {
    commands.getDailyUsage().then((result) => {
      if (result.status === "ok") {
        setDays(result.data);
      } else {
        console.error("Failed to load usage stats:", result.error);
        setError(true);
      }
    });
  }, []);

  const view = useMemo(() => {
    if (!days) {
      return null;
    }
    const today = new Date();
    const wordsByDate = new Map(days.map((day) => [day.date, day.words]));
    const weeks = buildHeatmap(wordsByDate, today, HEATMAP_WEEKS);
    const maxWords = Math.max(
      0,
      ...weeks.flat().map((cell) => cell?.words ?? 0),
    );
    return {
      today,
      weeks,
      maxWords,
      streaks: computeStreaks(
        days.map((day) => day.date),
        today,
      ),
    };
  }, [days]);

  if (error) {
    return (
      <div className="px-4 py-3 text-center text-text/60">
        {t("settings.stats.loadError")}
      </div>
    );
  }

  if (!days || !view) {
    return (
      <div className="px-4 py-3 text-center text-text/60">
        {t("settings.stats.loading")}
      </div>
    );
  }

  const range = RANGES.find((candidate) => candidate.id === rangeId)!;
  const summary = summarizeUsage(
    days,
    range.days === null ? null : rangeStart(view.today, range.days),
  );

  const locale = i18n.language;
  const number = new Intl.NumberFormat(locale);
  const monthFormat = new Intl.DateTimeFormat(locale, { month: "short" });
  const weekdayFormat = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const longDateFormat = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
  });
  // First column is always a full week, so its days give Sunday..Saturday labels.
  const weekdayLabels = view.weeks[0].map((cell) =>
    cell ? weekdayFormat.format(parseDateKey(cell.date)) : "",
  );

  // Label a week column when its Sunday starts a new month. The first column
  // is skipped so a partial month doesn't crowd the next label.
  const monthLabels = view.weeks.map((week, weekIndex) => {
    const sunday = parseDateKey(week[0]!.date);
    if (weekIndex === 0) {
      return "";
    }
    const previousSunday = parseDateKey(view.weeks[weekIndex - 1][0]!.date);
    return sunday.getMonth() === previousSunday.getMonth()
      ? ""
      : monthFormat.format(sunday);
  });

  return (
    <div className="max-w-3xl w-full mx-auto space-y-6">
      <div className="space-y-5">
        <div className="flex gap-6 border-b border-mid-gray/20" role="group">
          {RANGES.map((candidate) => {
            const selected = candidate.id === rangeId;
            return (
              <button
                key={candidate.id}
                type="button"
                onClick={() => setRangeId(candidate.id)}
                aria-pressed={selected}
                className={`-mb-px pb-2 text-[15px] font-medium border-b-2 transition-colors cursor-pointer ${
                  selected
                    ? "border-accent text-text"
                    : "border-transparent text-text/50 hover:text-text"
                }`}
              >
                {t(candidate.labelKey)}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            value={
              summary.wordsPerMinute === null
                ? "-"
                : number.format(Math.round(summary.wordsPerMinute))
            }
            label={t("settings.stats.wordsPerMinute")}
          />
          <StatCard
            value={number.format(summary.words)}
            label={t("settings.stats.totalWords")}
          />
          <StatCard
            value={number.format(summary.transcriptions)}
            label={t("settings.stats.transcriptions")}
          />
        </div>
      </div>

      <div className="bg-card rounded-2xl px-5 py-5 space-y-5">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("settings.stats.streak", { count: view.streaks.current })}
          </h2>
          <p className="text-[11px] font-medium text-text/70 uppercase tracking-[0.08em]">
            {t("settings.stats.longestStreak", {
              count: view.streaks.longest,
            })}
          </p>
        </div>

        <div
          className="grid gap-1 text-[10px] text-text/50 leading-none"
          style={{
            gridTemplateColumns: `auto repeat(${HEATMAP_WEEKS}, minmax(0, 1fr))`,
          }}
        >
          <span />
          {monthLabels.map((label, weekIndex) => (
            <span key={weekIndex} className="whitespace-nowrap h-3">
              {label}
            </span>
          ))}
          {weekdayLabels.map((weekdayLabel, dayIndex) => (
            <React.Fragment key={dayIndex}>
              <span className="flex items-center pe-1">
                {dayIndex % 2 === 1 ? weekdayLabel : ""}
              </span>
              {view.weeks.map((week, weekIndex) => {
                const cell = week[dayIndex];
                if (!cell) {
                  return <div key={weekIndex} className="aspect-square" />;
                }
                return (
                  <div
                    key={weekIndex}
                    className={`aspect-square rounded-[3px] ${
                      LEVEL_CLASSES[intensityLevel(cell.words, view.maxWords)]
                    }`}
                    title={t("settings.stats.dayTooltip", {
                      count: cell.words,
                      formattedCount: number.format(cell.words),
                      date: longDateFormat.format(parseDateKey(cell.date)),
                    })}
                  />
                );
              })}
            </React.Fragment>
          ))}
        </div>

        <div className="flex items-center justify-end gap-1 text-xs text-text/50">
          <span className="me-1">{t("settings.stats.less")}</span>
          {LEVEL_CLASSES.map((className) => (
            <div
              key={className}
              className={`w-3 h-3 rounded-[3px] ${className}`}
            />
          ))}
          <span className="ms-1">{t("settings.stats.more")}</span>
        </div>
      </div>
    </div>
  );
};

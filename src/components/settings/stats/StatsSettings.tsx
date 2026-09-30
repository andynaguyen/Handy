import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { commands, type DailyUsage } from "@/bindings";
import { Tabs, Tooltip } from "@/components/ui";
import { isRTLLanguage } from "@/lib/utils/rtl";
import {
  buildHeatmap,
  computeStreaks,
  intensityLevel,
  parseDateKey,
  rangeStart,
  summarizeUsage,
  toDateKey,
} from "./usageStats";

const HEATMAP_WEEKS = 20;
const DAY_POPOVER_ID = "stats-day-popover";

// [week, weekday] offsets for moving between heatmap cells, in LTR layout.
const ARROW_STEPS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

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

const PopoverRow: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div className="flex justify-between gap-3">
    <dt className="text-text/60 whitespace-nowrap">{label}</dt>
    <dd className="font-medium tabular-nums truncate">{value}</dd>
  </div>
);

export const StatsSettings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [days, setDays] = useState<DailyUsage[] | null>(null);
  const [error, setError] = useState(false);
  const [rangeId, setRangeId] = useState<RangeId>("today");
  // The cell that takes Tab focus; arrow keys move it. Null means today.
  const [focusDate, setFocusDate] = useState<string | null>(null);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const activeCellRef = useRef<HTMLElement | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

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
      usageByDate: new Map(days.map((day) => [day.date, day])),
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
    dateStyle: "long",
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

  const tabStopDate = focusDate ?? toDateKey(view.today);
  const activeUsage = activeDate ? view.usageByDate.get(activeDate) : undefined;

  // Empty days get no popover; their aria-label already says 0 words.
  const showDay = (
    element: HTMLElement,
    cell: { date: string; words: number },
  ) => {
    if (cell.words === 0) {
      return;
    }
    activeCellRef.current = element;
    setActiveDate(cell.date);
  };

  const moveFocus = (
    event: React.KeyboardEvent,
    weekIndex: number,
    dayIndex: number,
  ) => {
    const step = ARROW_STEPS[event.key];
    if (!step) {
      return;
    }
    event.preventDefault();
    const weekStep = isRTLLanguage(locale) ? -step[0] : step[0];
    const target = view.weeks[weekIndex + weekStep]?.[dayIndex + step[1]];
    if (target) {
      gridRef.current
        ?.querySelector<HTMLElement>(`[data-date="${target.date}"]`)
        ?.focus();
    }
  };

  return (
    <div className="max-w-3xl w-full mx-auto space-y-6">
      <div className="space-y-5">
        <Tabs tabs={RANGES} selected={rangeId} onSelect={setRangeId} />
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
          ref={gridRef}
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
                    role="img"
                    data-date={cell.date}
                    tabIndex={cell.date === tabStopDate ? 0 : -1}
                    aria-label={`${longDateFormat.format(parseDateKey(cell.date))}, ${t("settings.stats.dayPopover.words")}: ${number.format(cell.words)}`}
                    aria-describedby={
                      cell.date === activeDate ? DAY_POPOVER_ID : undefined
                    }
                    onMouseEnter={(event) => showDay(event.currentTarget, cell)}
                    onMouseLeave={() => setActiveDate(null)}
                    onFocus={(event) => {
                      setFocusDate(cell.date);
                      showDay(event.currentTarget, cell);
                    }}
                    onBlur={() => setActiveDate(null)}
                    onKeyDown={(event) => moveFocus(event, weekIndex, dayIndex)}
                    className={`aspect-square rounded-[3px] outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      LEVEL_CLASSES[intensityLevel(cell.words, view.maxWords)]
                    }`}
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

      {activeDate && (
        // Keyed so the tooltip remounts and repositions for each cell.
        <Tooltip key={activeDate} targetRef={activeCellRef} position="top">
          <div id={DAY_POPOVER_ID} role="tooltip" className="text-xs space-y-2">
            <p className="text-sm font-semibold">
              {longDateFormat.format(parseDateKey(activeDate))}
            </p>
            <dl className="space-y-1">
              <PopoverRow
                label={t("settings.stats.dayPopover.words")}
                value={number.format(activeUsage?.words ?? 0)}
              />
              {activeUsage?.top_app && (
                <>
                  <PopoverRow
                    label={t("settings.stats.dayPopover.appsUsed")}
                    value={number.format(activeUsage.apps_used)}
                  />
                  <PopoverRow
                    label={t("settings.stats.dayPopover.topApp")}
                    value={activeUsage.top_app}
                  />
                </>
              )}
            </dl>
          </div>
        </Tooltip>
      )}
    </div>
  );
};

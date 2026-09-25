import type { DailyUsage } from "@/bindings";

// A null cell is a future day in the current week.
export type HeatmapCell = { date: string; words: number } | null;

export const toDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const parseDateKey = (key: string): Date => {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
};

// Calendar arithmetic, so DST shifts never skip or repeat a day.
const addDays = (date: Date, days: number): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/**
 * `dates` are YYYY-MM-DD keys of active days, sorted oldest first. The current
 * streak survives until a full day passes without dictation, so it still
 * counts yesterday's run before the user dictates today.
 */
export const computeStreaks = (
  dates: string[],
  today: Date,
): { current: number; longest: number } => {
  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const date of dates) {
    const continues =
      previous !== null &&
      toDateKey(addDays(parseDateKey(previous), 1)) === date;
    run = continues ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = date;
  }

  const active = new Set(dates);
  let day = active.has(toDateKey(today)) ? today : addDays(today, -1);
  let current = 0;
  while (active.has(toDateKey(day))) {
    current++;
    day = addDays(day, -1);
  }

  return { current, longest };
};

/** Week columns, oldest first, each running Sunday to Saturday. */
export const buildHeatmap = (
  wordsByDate: Map<string, number>,
  today: Date,
  weeks: number,
): HeatmapCell[][] => {
  const start = addDays(today, -today.getDay() - (weeks - 1) * 7);
  const todayKey = toDateKey(today);
  return Array.from({ length: weeks }, (_, week) =>
    Array.from({ length: 7 }, (_, weekday) => {
      const key = toDateKey(addDays(start, week * 7 + weekday));
      if (key > todayKey) {
        return null;
      }
      return { date: key, words: wordsByDate.get(key) ?? 0 };
    }),
  );
};

/** 0 for no activity, otherwise 1-4 relative to the busiest day. */
export const intensityLevel = (words: number, maxWords: number): number => {
  if (words <= 0 || maxWords <= 0) {
    return 0;
  }
  return Math.min(4, Math.ceil((words / maxWords) * 4));
};

/**
 * Totals for the days on or after `since` (a YYYY-MM-DD key), or for all days
 * when `since` is null.
 */
export const summarizeUsage = (
  days: DailyUsage[],
  since: string | null,
): { words: number; transcriptions: number; wordsPerMinute: number | null } => {
  let words = 0;
  let transcriptions = 0;
  let timedWords = 0;
  let durationMs = 0;
  for (const day of days) {
    if (since !== null && day.date < since) {
      continue;
    }
    words += day.words;
    transcriptions += day.transcriptions;
    timedWords += day.timed_words;
    durationMs += day.duration_ms;
  }
  return {
    words,
    transcriptions,
    wordsPerMinute: durationMs > 0 ? timedWords / (durationMs / 60_000) : null,
  };
};

/** First day key of a range covering the last `days` days, today included. */
export const rangeStart = (today: Date, days: number): string =>
  toDateKey(addDays(today, -(days - 1)));

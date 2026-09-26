import assert from "node:assert/strict";
import {
  buildHeatmap,
  computeStreaks,
  intensityLevel,
  parseDateKey,
  rangeStart,
  summarizeUsage,
} from "./usageStats";

const today = parseDateKey("2026-03-10"); // Tuesday

assert.deepEqual(computeStreaks([], today), { current: 0, longest: 0 });

// Today active, streak runs back three days; an older run of 4 is the longest.
assert.deepEqual(
  computeStreaks(
    [
      "2026-02-01",
      "2026-02-02",
      "2026-02-03",
      "2026-02-04",
      "2026-03-08",
      "2026-03-09",
      "2026-03-10",
    ],
    today,
  ),
  { current: 3, longest: 4 },
);

// Nothing yet today, but yesterday's streak is still alive.
assert.deepEqual(computeStreaks(["2026-03-08", "2026-03-09"], today), {
  current: 2,
  longest: 2,
});

// Missing both today and yesterday breaks the streak.
assert.deepEqual(computeStreaks(["2026-03-07", "2026-03-08"], today), {
  current: 0,
  longest: 2,
});

// Streaks cross month boundaries.
assert.deepEqual(
  computeStreaks(["2026-02-28", "2026-03-01"], parseDateKey("2026-03-01")),
  { current: 2, longest: 2 },
);

const heatmap = buildHeatmap(new Map([["2026-03-09", 42]]), today, 2);
assert.equal(heatmap.length, 2);
assert.deepEqual(heatmap[0][0], { date: "2026-03-01", words: 0 });
assert.deepEqual(heatmap[1][1], { date: "2026-03-09", words: 42 });
assert.deepEqual(heatmap[1][2], { date: "2026-03-10", words: 0 });
assert.equal(heatmap[1][3], null);

assert.equal(intensityLevel(0, 100), 0);
assert.equal(intensityLevel(1, 100), 1);
assert.equal(intensityLevel(50, 100), 2);
assert.equal(intensityLevel(100, 100), 4);

assert.equal(rangeStart(today, 1), "2026-03-10");
assert.equal(rangeStart(today, 7), "2026-03-04");
assert.equal(rangeStart(today, 30), "2026-02-09");

const days = [
  // Backfilled day: words but no recorded duration.
  {
    date: "2026-02-01",
    words: 50,
    transcriptions: 2,
    timed_words: 0,
    duration_ms: 0,
    apps_used: 0,
    top_app: null,
  },
  {
    date: "2026-03-05",
    words: 100,
    transcriptions: 3,
    timed_words: 100,
    duration_ms: 60_000,
    apps_used: 0,
    top_app: null,
  },
  {
    date: "2026-03-10",
    words: 30,
    transcriptions: 1,
    timed_words: 30,
    duration_ms: 10_000,
    apps_used: 0,
    top_app: null,
  },
];
assert.deepEqual(summarizeUsage(days, "2026-03-10"), {
  words: 30,
  transcriptions: 1,
  wordsPerMinute: 180,
});
assert.deepEqual(summarizeUsage(days, "2026-03-04"), {
  words: 130,
  transcriptions: 4,
  wordsPerMinute: 130 / (70 / 60),
});
// All time counts the backfilled words, but WPM only uses timed ones.
assert.deepEqual(summarizeUsage(days, null), {
  words: 180,
  transcriptions: 6,
  wordsPerMinute: 130 / (70 / 60),
});
assert.deepEqual(summarizeUsage([], null), {
  words: 0,
  transcriptions: 0,
  wordsPerMinute: null,
});

console.log("usageStats: all assertions passed");

import { DAY_COUNT, WEEK_COUNT, dayInfo } from "./program.js";
import { nextTrainingMax, epleyE1RM, LIFTS } from "./calc.js";

// The four main lifts that gate 5/3/1 week advancement — Pull A/B have no
// main lift and never count toward this, regardless of how many times
// they're completed. Deliberately its own list rather than calc.js's LIFTS
// (which also includes the long-retired trapBarDeadlift).
export const WEEK_ADVANCE_LIFTS = ["bench", "squat", "press", "deadlift"];

/**
 * How many weeks the given cycle runs before wrapping. With
 * deloadOnEvenCyclesOnly on (the default), only even cycle numbers (2, 4, 6,
 * ...) get a 4th deload week — odd cycles end after week 3. Turning that
 * setting off reverts to every cycle being 4 weeks with a deload.
 *
 * deloadOverride (true/false/null) lets the current cycle's deload status be
 * toggled by hand from the main screen, taking priority over the
 * cycleNumber-parity rule above for that one cycle; null defers to the rule.
 */
export function effectiveWeekCount(cycleNumber, settings, deloadOverride = null) {
  if (deloadOverride === true) return WEEK_COUNT;
  if (deloadOverride === false) return WEEK_COUNT - 1;
  if (!settings?.deloadOnEvenCyclesOnly) return WEEK_COUNT;
  return cycleNumber % 2 === 0 ? WEEK_COUNT : WEEK_COUNT - 1;
}

/**
 * Just the week/cycle wrap math: given a week about to advance by one,
 * returns the resulting {weekIndex, cycleNumber} — week 1 of the next cycle
 * if that was the cycle's last week, else the same cycle's next week.
 * Factored out of advanceCycle so a caller that needs "when is this lift
 * next due" (see today.js's Lift Status) can reuse the exact same wrap logic
 * without going through the day-rotation/mainLiftsCompleted machinery.
 */
export function advanceWeek(weekIndex, cycleNumber, settings, deloadOverride = null) {
  const weekCount = effectiveWeekCount(cycleNumber, settings, deloadOverride);
  let nextWeek = weekIndex + 1;
  let nextCycle = cycleNumber;
  if (nextWeek > weekCount) {
    nextWeek = 1;
    nextCycle += 1;
  }
  return { weekIndex: nextWeek, cycleNumber: nextCycle };
}

/**
 * Advance the cycle by one session. The day pointer always rotates to the
 * next session in order (Pull A -> Push A -> Legs A -> Pull B -> Push B ->
 * Legs B -> Pull A, ...) regardless of what kind of session just finished.
 *
 * The 5/3/1 week, however, only advances once all four main lifts — Push
 * A/Legs A/Push B/Legs B's bench/squat/press/deadlift — have been completed
 * at least once since the last week advance, tracked in
 * cycleState.mainLiftsCompleted (deduped by lift, order-independent — doing
 * the same lift twice in a week before finishing the other three doesn't
 * advance anything early). Pass the just-completed session's `lift` (null or
 * omitted for a Pull day, which has none) as `completedLift`; omit it
 * entirely to rotate the day without ever touching week/cycle state (used by
 * the history-resync helper below, which can't reconstruct a partial week).
 */
export function advanceCycle(cycleState, settings, deloadOverride = null, completedLift = null) {
  let { dayIndex, weekIndex, cycleNumber, mainLiftsCompleted = [] } = cycleState;
  let cycleCompleted = false;

  dayIndex += 1;
  if (dayIndex > DAY_COUNT) dayIndex = 1;

  let nextMainLiftsCompleted = mainLiftsCompleted;
  if (completedLift && WEEK_ADVANCE_LIFTS.includes(completedLift)) {
    nextMainLiftsCompleted = mainLiftsCompleted.includes(completedLift) ? mainLiftsCompleted : [...mainLiftsCompleted, completedLift];
    if (nextMainLiftsCompleted.length >= WEEK_ADVANCE_LIFTS.length) {
      nextMainLiftsCompleted = [];
      const before = weekIndex;
      const weekCountBefore = effectiveWeekCount(cycleNumber, settings, deloadOverride);
      ({ weekIndex, cycleNumber } = advanceWeek(weekIndex, cycleNumber, settings, deloadOverride));
      cycleCompleted = before >= weekCountBefore;
    }
  }
  return { cycleState: { dayIndex, weekIndex, cycleNumber, mainLiftsCompleted: nextMainLiftsCompleted }, cycleCompleted };
}

/**
 * Recompute the "recommended next" cycle position purely from logged
 * history: one step past whichever completed session is most recent by
 * date. Ignores skipped sessions entirely (they never move the pointer) and
 * ignores state.cycleState itself, so it can't inherit drift from a stale
 * or manually-edited pointer — a way to resync to ground truth on demand.
 * Falls back to day 1/week 1/cycle 1 if nothing has ever been completed.
 *
 * Deliberately omits `completedLift` when calling advanceCycle — reliably
 * reconstructing which main lifts were already completed earlier in that
 * same week (toward the week-advance threshold) would mean replaying the
 * whole week's history, not just its most recent session, which is more
 * than this quick resync is meant to do. The day pointer still rotates by
 * one as usual; week/cycle carry over from the last session unchanged, and
 * mainLiftsCompleted resets to empty — a reasonable approximation for a
 * manual "this looks off, fix it" tool, not a perfect replay.
 */
export function deriveCycleStateFromHistory(sessionLogs, settings) {
  const completed = sessionLogs.filter((log) => log.completed);
  if (completed.length === 0) return { dayIndex: 1, weekIndex: 1, cycleNumber: 1, mainLiftsCompleted: [] };
  const last = completed.reduce((a, b) => (new Date(b.date) > new Date(a.date) ? b : a));
  const { cycleState } = advanceCycle(
    { dayIndex: last.dayIndex, weekIndex: last.weekIndex, cycleNumber: last.cycleNumber ?? 1, mainLiftsCompleted: [] },
    settings
  );
  return cycleState;
}

/** Apply the standard TM progression (deadlift/squat +10, bench/press +5 by default) to all lifts. */
export function progressTrainingMaxes(trainingMaxes, tmIncrements, now = new Date().toISOString()) {
  const next = {};
  for (const lift of Object.keys(trainingMaxes)) {
    next[lift] = {
      currentValue: nextTrainingMax(trainingMaxes[lift].currentValue, lift, tmIncrements),
      updatedAt: now,
    };
  }
  return next;
}

/**
 * Most recent logged value for a given exercise+set index, for prefill.
 * Falls back to any set of that exercise from the most recent session that logged it,
 * so a changed set count doesn't blank out prefill entirely.
 */
export function lastAccessoryLog(sessionLogs, exerciseName, setIndex) {
  for (let i = sessionLogs.length - 1; i >= 0; i--) {
    const sets = (sessionLogs[i].accessorySets || []).filter((s) => s.exerciseName === exerciseName && s.weight != null);
    if (sets.length === 0) continue;
    const exact = sets.find((s) => s.setIndex === setIndex);
    return exact || sets[sets.length - 1];
  }
  return null;
}

// A Legs session is identified by its lift (squat or deadlift), not by day
// index or name — this works identically for a current Legs A/B session and
// any older squat/deadlift session logged under a since-retired day
// structure, with no dependency on which program shape was active then.
const LEGS_LIFTS = ["squat", "deadlift"];

/**
 * True if `dayIndexToStart` is a Legs day (Legs A/B) and fewer than `minDays`
 * full days have passed since the most recent completed Legs session —
 * powers the non-blocking "less than 3 days since your last leg day" notice
 * on the splash screen. False (never a notice) if there's no prior Legs
 * session to compare against, or the day in question isn't a Legs day.
 */
export function tooSoonForLegsDay(sessionLogs, dayLift, now = new Date(), minDays = 3) {
  if (!LEGS_LIFTS.includes(dayLift)) return false;
  const lastLegs = sessionLogs
    .filter((log) => log.completed && LEGS_LIFTS.includes(log.lift))
    .reduce((latest, log) => (!latest || new Date(log.date) > new Date(latest.date) ? log : latest), null);
  if (!lastLegs) return false;
  const msSince = now.getTime() - new Date(lastLegs.date).getTime();
  return msSince < minDays * 24 * 60 * 60 * 1000;
}

/** AMRAP history for a lift: [{date, weekIndex, weight, reps, e1rm}], oldest first. */
export function amrapHistory(sessionLogs, lift) {
  return sessionLogs
    .filter((log) => log.lift === lift && log.completed)
    .flatMap((log) => {
      const amrapSet = (log.mainSets || []).find((s) => s.isAmrap && s.actualReps != null);
      if (!amrapSet) return [];
      return [{
        date: log.date,
        weekIndex: log.weekIndex,
        weight: amrapSet.weight,
        reps: amrapSet.actualReps,
        e1rm: epleyE1RM(amrapSet.weight, amrapSet.actualReps),
      }];
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

/**
 * Most recent COMPLETED session per lift: { [lift]: {cycleNumber, weekIndex,
 * date} }. Ignores skipped sessions entirely (consistent with how the cycle
 * pointer itself only advances on real completion) — a lift with no
 * completed history at all is simply absent from the result.
 */
export function lastCompletedByLift(sessionLogs) {
  const result = {};
  for (const log of sessionLogs) {
    if (!log.completed || !log.lift) continue;
    const existing = result[log.lift];
    if (!existing || new Date(log.date) > new Date(existing.date)) {
      result[log.lift] = { cycleNumber: log.cycleNumber ?? 1, weekIndex: log.weekIndex, date: log.date };
    }
  }
  return result;
}

/**
 * Parses pasted bodyweight lines for bulk import, one entry per line as
 * "YYYY-MM-DD weight" (e.g. "2026-09-19 230.2"). Blank lines and anything
 * that doesn't match are silently skipped rather than throwing, since this
 * is meant for pasting a batch copied from elsewhere (a health app export,
 * a notes list) that may have stray formatting.
 */
export function parseBulkWeightEntries(text) {
  const entries = [];
  for (const line of text.split("\n")) {
    const match = line.trim().match(/^(\d{4}-\d{2}-\d{2})\s+([\d.]+)$/);
    if (!match) continue;
    const weight = Number(match[2]);
    if (!weight) continue;
    entries.push({ date: new Date(match[1]).toISOString(), weight });
  }
  return entries;
}

/** Weekly rolling average bodyweight: buckets entries into trailing 7-day windows ending on each entry's date. */
export function bodyweightRollingAverage(entries) {
  const sorted = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
  return sorted.map((entry, i) => {
    const end = new Date(entry.date).getTime();
    const start = end - 6 * 24 * 60 * 60 * 1000;
    const windowEntries = sorted.filter((e) => {
      const t = new Date(e.date).getTime();
      return t >= start && t <= end;
    });
    const avg = windowEntries.reduce((sum, e) => sum + e.weight, 0) / windowEntries.length;
    return { date: entry.date, weight: entry.weight, rollingAverage: Math.round(avg * 100) / 100 };
  });
}

/** Total working weight lifted in a session: completed main + supplemental sets (accessories excluded). */
export function sessionVolume(log) {
  const mainVol = (log.mainSets || []).reduce(
    (sum, s) => (s.completed && s.actualReps ? sum + s.weight * s.actualReps : sum),
    0
  );
  const suppVol = (log.supplementalSets || []).reduce(
    (sum, s) => (s.completed && s.reps ? sum + s.weight * s.reps : sum),
    0
  );
  return mainVol + suppVol;
}

/** Volume history for a lift: [{date, weekIndex, volume}], oldest first. */
export function volumeHistory(sessionLogs, lift) {
  return sessionLogs
    .filter((log) => log.lift === lift && log.completed)
    .map((log) => ({ date: log.date, weekIndex: log.weekIndex, volume: Math.round(sessionVolume(log)) }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

/**
 * Combined series for all four main lifts, aligned to a shared x-axis of program
 * weeks (cycle+week), for the overlay chart in History. metric is 'e1rm' or 'volume'.
 * Each series' values array is the same length as xLabels; null where that lift
 * had no session that week — the chart draws straight through those gaps to
 * the next real point rather than breaking the line.
 */
export function combinedLiftMetricSeries(sessionLogs, metric) {
  const weekKey = (log) => `${log.cycleNumber ?? 1}-${log.weekIndex}`;
  const mainLogs = sessionLogs.filter((log) => LIFTS.includes(log.lift) && log.completed);

  const keys = [...new Set(mainLogs.map(weekKey))].sort((a, b) => {
    const [ac, aw] = a.split("-").map(Number);
    const [bc, bw] = b.split("-").map(Number);
    return ac - bc || aw - bw;
  });
  const xLabels = keys.map((k) => {
    const [c, w] = k.split("-");
    return `C${c}W${w}`;
  });

  const series = LIFTS.map((lift) => {
    const byKey = new Map();
    mainLogs
      .filter((log) => log.lift === lift)
      .forEach((log) => {
        let value = null;
        if (metric === "e1rm") {
          const amrapSet = (log.mainSets || []).find((s) => s.isAmrap && s.actualReps != null);
          if (amrapSet) value = epleyE1RM(amrapSet.weight, amrapSet.actualReps);
        } else if (metric === "volume") {
          value = sessionVolume(log);
        }
        if (value != null) byKey.set(weekKey(log), Math.round(value));
      });
    return { lift, values: keys.map((k) => (byKey.has(k) ? byKey.get(k) : null)) };
  });

  return { xLabels, series };
}

/** Total completed reps across a session's sets of one named accessory exercise. */
function accessoryRepsInSession(log, exerciseName) {
  return (log.accessorySets || [])
    .filter((s) => s.exerciseName === exerciseName && s.completed && s.reps)
    .reduce((sum, s) => sum + s.reps, 0);
}

/**
 * Combined series for a set of named accessory exercises (e.g. Pull-ups and
 * Chin-ups), aligned to a shared x-axis of program weeks (cycle+week), for
 * the volume-over-time chart in History. Volume here is total reps logged
 * for that exercise in a session (bodyweight accessories have no per-set
 * weight to multiply by) — all of a session's sets for that exercise added
 * together, not just one set. Each series' values array is the same length
 * as xLabels; null where that exercise wasn't logged that week.
 */
export function accessoryRepVolumeSeries(sessionLogs, exerciseNames) {
  const weekKey = (log) => `${log.cycleNumber ?? 1}-${log.weekIndex}`;
  const relevantLogs = sessionLogs.filter(
    (log) => log.completed && exerciseNames.some((name) => accessoryRepsInSession(log, name) > 0)
  );

  const keys = [...new Set(relevantLogs.map(weekKey))].sort((a, b) => {
    const [ac, aw] = a.split("-").map(Number);
    const [bc, bw] = b.split("-").map(Number);
    return ac - bc || aw - bw;
  });
  const xLabels = keys.map((k) => {
    const [c, w] = k.split("-");
    return `C${c}W${w}`;
  });

  const series = exerciseNames.map((name) => {
    const byKey = new Map();
    relevantLogs.forEach((log) => {
      const reps = accessoryRepsInSession(log, name);
      if (reps > 0) byKey.set(weekKey(log), reps);
    });
    return { name, values: keys.map((k) => (byKey.has(k) ? byKey.get(k) : null)) };
  });

  return { xLabels, series };
}

/** Group session logs by calendar date (YYYY-MM-DD, local time) for the Calendar view. */
export function sessionsByDate(sessionLogs) {
  const map = new Map();
  for (const log of sessionLogs) {
    const d = new Date(log.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(log);
  }
  return map;
}

/** Build a fresh (unlogged) SessionLog skeleton for the given cycle position. */
export function newSessionLog({ dayIndex, weekIndex, cycleNumber }, mainSets, supplementalSets, accessories) {
  const day = dayInfo(dayIndex);
  return {
    id: `${Date.now()}`,
    date: new Date().toISOString(),
    dayIndex,
    weekIndex,
    cycleNumber,
    lift: day.lift,
    completed: false,
    mainSets,
    supplementalSets,
    // Activities with no set count (yoga, Zone 2) still get exactly one
    // entry, so there's a single checkbox to mark them done — just without
    // the weight/reps fields a normal accessory's sets would carry. An
    // accessory offering variants (e.g. standing/seated calf raise) logs
    // under its default (first) variant's real name, never the generic
    // slot name — history/prefill is always keyed by the concrete exercise
    // actually performed, and the day's original choice stays the default.
    accessorySets: accessories.flatMap((a) =>
      Array.from({ length: a.sets || 1 }, (_, setIndex) => ({
        exerciseName: a.variants ? a.variants[0] : a.name,
        setIndex,
        weight: null,
        reps: null,
        completed: false,
      }))
    ),
    notes: "",
  };
}

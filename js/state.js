import { DAY_COUNT, WEEK_COUNT, dayInfo } from "./program.js";
import { nextTrainingMax, epleyE1RM, LIFTS } from "./calc.js";

/** Advance the cycle by one day. Wrapping day 6->1 advances the week; wrapping week 4->1 completes a cycle. */
export function advanceCycle(cycleState) {
  let { dayIndex, weekIndex, cycleNumber } = cycleState;
  let cycleCompleted = false;

  dayIndex += 1;
  if (dayIndex > DAY_COUNT) {
    dayIndex = 1;
    weekIndex += 1;
    if (weekIndex > WEEK_COUNT) {
      weekIndex = 1;
      cycleNumber += 1;
      cycleCompleted = true;
    }
  }
  return { cycleState: { dayIndex, weekIndex, cycleNumber }, cycleCompleted };
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
 * had no session that week (the chart just skips the gap rather than interpolating).
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
    // Activities with no set count (yoga, a walk, Zone 2) get no set entries —
    // they're just checked off via their exercise name, not logged per set.
    accessorySets: accessories.flatMap((a) =>
      Array.from({ length: a.sets || 0 }, (_, setIndex) => ({
        exerciseName: a.name,
        setIndex,
        weight: null,
        reps: null,
        completed: false,
      }))
    ),
    notes: "",
  };
}

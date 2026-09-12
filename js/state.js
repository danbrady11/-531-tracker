import { DAY_COUNT, WEEK_COUNT, dayInfo } from "./program.js";
import { nextTrainingMax, epleyE1RM } from "./calc.js";

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

/** Build a fresh (unlogged) SessionLog skeleton for the given cycle position. */
export function newSessionLog({ dayIndex, weekIndex }, mainSets, supplementalSets, accessories) {
  const day = dayInfo(dayIndex);
  return {
    id: `${Date.now()}`,
    date: new Date().toISOString(),
    dayIndex,
    weekIndex,
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

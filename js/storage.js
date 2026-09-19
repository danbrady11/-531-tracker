import { LIFTS } from "./calc.js";

const STORAGE_KEY = "531-tracker-state-v1";

function defaultState() {
  return {
    settings: {
      barWeight: 45,
      roundingIncrement: 5,
      bbbPercentage: 0.5,
      tmIncrements: { squat: 10, deadlift: 10, bench: 5, press: 5, trapBarDeadlift: 10 },
      // Rest between sets, by exercise category — editable in Settings so a
      // duration change never needs a code change. "superset" is the rest
      // taken only after the "b" exercise of a superset pair, since there's
      // deliberately no rest between "a" and "b" themselves.
      restTimerSec: { main: 180, bbb: 90, compound: 90, isolation: 60, superset: 60 },
      theme: "system", // 'system' | 'light' | 'dark'
      // When true (the default), only even-numbered cycles (2, 4, 6, ...) run
      // a week-4 deload; odd-numbered cycles end after week 3 and roll
      // straight into the next cycle. Turn off to deload every cycle.
      deloadOnEvenCyclesOnly: true,
    },
    trainingMaxes: {
      squat: { currentValue: 135, updatedAt: null },
      bench: { currentValue: 115, updatedAt: null },
      deadlift: { currentValue: 155, updatedAt: null },
      press: { currentValue: 75, updatedAt: null },
      // Deliberately NOT defaulted from the old conventional deadlift TM —
      // trap bar deadlift is a different lift with a different max, and
      // app.js prompts for a real starting number the first time this loads.
      trapBarDeadlift: { currentValue: 0, updatedAt: null },
    },
    cycleState: { dayIndex: 1, weekIndex: 1, cycleNumber: 1 },
    sessionLogs: [],
    bodyweightEntries: [],
    // Exercise names the user has added ad hoc to a workout at least once,
    // remembered so they can be picked from a dropdown next time instead of
    // retyped. Separate from the fixed per-day accessory lists in program.js.
    customExercises: [],
  };
}

// One-time renames for accessory exercises that got relabeled in the program.
// Keeps prefill working off old logged history under the new name instead of
// starting that exercise's history over from nothing. Safe to run repeatedly
// (a no-op once nothing matches the old names anymore).
const ACCESSORY_RENAMES = {
  "Rear delt": "Reverse pec deck / cable reverse fly",
  "Face pulls": "Face pulls (optional)",
  "Nordic curl": "Swiss ball leg curl",
  "Overhead tricep extension": "Cable rope overhead extension",
};

function renameAccessoryEntries(accessorySets) {
  if (!Array.isArray(accessorySets)) return accessorySets;
  return accessorySets.map((s) =>
    ACCESSORY_RENAMES[s.exerciseName] ? { ...s, exerciseName: ACCESSORY_RENAMES[s.exerciseName] } : s
  );
}

// One-time day-order reorder: Deadlift moved from day 1 to day 6 (so
// completing it is what concludes a cycle, instead of it always being the
// first day of a fresh week); Bench/Recovery/Squat/Press/Accessory each
// shifted back one slot to make room. Maps OLD dayIndex -> NEW dayIndex so
// existing history keeps naming the same real exercise after the reorder.
// Guarded by a flag because — unlike the accessory renames above — this
// rotation is NOT idempotent: applying it twice would shift everything by
// two slots instead of one.
const DAY_INDEX_ROTATE_V1 = { 1: 6, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5 };

function rotateDayIndex(dayIndex) {
  return DAY_INDEX_ROTATE_V1[dayIndex] ?? dayIndex;
}

export function migrate(state) {
  const base = defaultState();
  // Shallow-merge one level so new settings/keys added in later versions
  // fill in without wiping existing user data.
  const merged = {
    ...base,
    ...state,
    settings: { ...base.settings, ...(state.settings || {}) },
    trainingMaxes: { ...base.trainingMaxes, ...(state.trainingMaxes || {}) },
    cycleState: { ...base.cycleState, ...(state.cycleState || {}) },
  };
  merged.settings.tmIncrements = { ...base.settings.tmIncrements, ...(state.settings?.tmIncrements || {}) };
  merged.settings.restTimerSec = { ...base.settings.restTimerSec, ...(state.settings?.restTimerSec || {}) };
  // Superseded by deloadOnEvenCyclesOnly (with flipped parity) — drop the
  // stale key so old exports/synced state don't carry dead settings forward.
  delete merged.settings.deloadEveryOtherCycle;
  // Superseded by restTimerSec's per-category durations.
  delete merged.settings.restTimerMainSec;
  delete merged.settings.restTimerIsolationSec;
  for (const lift of LIFTS) {
    merged.trainingMaxes[lift] = { ...base.trainingMaxes[lift], ...(state.trainingMaxes?.[lift] || {}) };
  }
  merged.sessionLogs = (Array.isArray(state.sessionLogs) ? state.sessionLogs : []).map((log) => ({
    ...log,
    accessorySets: renameAccessoryEntries(log.accessorySets),
  }));
  merged.bodyweightEntries = Array.isArray(state.bodyweightEntries) ? state.bodyweightEntries : [];
  merged.customExercises = [
    ...new Set((Array.isArray(state.customExercises) ? state.customExercises : []).map((n) => ACCESSORY_RENAMES[n] || n)),
  ];
  if (merged.currentSession?.accessorySets) {
    merged.currentSession = { ...merged.currentSession, accessorySets: renameAccessoryEntries(merged.currentSession.accessorySets) };
  }

  if (!state._dayOrderRotatedV1) {
    merged.sessionLogs = merged.sessionLogs.map((log) => ({ ...log, dayIndex: rotateDayIndex(log.dayIndex) }));
    merged.cycleState = { ...merged.cycleState, dayIndex: rotateDayIndex(merged.cycleState.dayIndex) };
    if (merged.currentSession) {
      merged.currentSession = { ...merged.currentSession, dayIndex: rotateDayIndex(merged.currentSession.dayIndex) };
    }
    merged._dayOrderRotatedV1 = true;
  }

  return merged;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return migrate(JSON.parse(raw));
  } catch (err) {
    console.error("Failed to load state, resetting.", err);
    return defaultState();
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function exportStateJSON(state) {
  return JSON.stringify(state, null, 2);
}

export function importStateJSON(json) {
  const parsed = JSON.parse(json);
  return migrate(parsed);
}

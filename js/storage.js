import { LIFTS } from "./calc.js";

const STORAGE_KEY = "531-tracker-state-v1";

function defaultState() {
  return {
    settings: {
      barWeight: 45,
      roundingIncrement: 5,
      bbbPercentage: 0.5,
      tmIncrements: { squat: 10, deadlift: 10, bench: 5, press: 5 },
      restTimerMainSec: 210,
      restTimerIsolationSec: 90,
      theme: "system", // 'system' | 'light' | 'dark'
      // When true, only odd-numbered cycles (1, 3, 5, ...) run a week-4 deload;
      // even-numbered cycles end after week 3 and roll straight into the next cycle.
      deloadEveryOtherCycle: false,
    },
    trainingMaxes: {
      squat: { currentValue: 135, updatedAt: null },
      bench: { currentValue: 115, updatedAt: null },
      deadlift: { currentValue: 155, updatedAt: null },
      press: { currentValue: 75, updatedAt: null },
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
};

function renameAccessoryEntries(accessorySets) {
  if (!Array.isArray(accessorySets)) return accessorySets;
  return accessorySets.map((s) =>
    ACCESSORY_RENAMES[s.exerciseName] ? { ...s, exerciseName: ACCESSORY_RENAMES[s.exerciseName] } : s
  );
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

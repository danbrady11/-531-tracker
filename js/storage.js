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
    // deloadOverride lets the current cycle's deload status be toggled by
    // hand from the main screen; null means "use the settings-based rule".
    // Reset to null whenever a new cycle starts (see advanceCycle's caller
    // in app.js's finishDay) so each cycle defaults fresh unless re-toggled.
    cycleState: { dayIndex: 1, weekIndex: 1, cycleNumber: 1, deloadOverride: null },
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
  "Seated cable row (wide/neutral)": "Seated cable row",
  "Seated cable row (close grip)": "Seated cable row",
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

// One-time program restructure: Recovery (old day 2) dropped entirely, and
// Daily Psoas / Psoas Strength removed from every day. Bench/Squat/Press/
// Accessory/Deadlift keep their exercises unchanged, just renumbered into a
// 5-day cycle with Recovery's slot gone. For session HISTORY, Recovery's old
// day 2 remaps to day 6 — a reserved slot (see program.js's LEGACY_DAYS)
// that preserves those old Yoga/Zone 2 logs under a name of their own
// instead of colliding with whatever day 2 (now Squat) means going forward.
const DAY_COUNT_5_REMAP_HISTORY = { 1: 1, 2: 6, 3: 2, 4: 3, 5: 4, 6: 5 };

function remapDayIndexForHistory(dayIndex) {
  return DAY_COUNT_5_REMAP_HISTORY[dayIndex] ?? dayIndex;
}

// For the live cycle pointer (state.cycleState) and an in-progress
// currentSession, old day 2 (Recovery) has nowhere sensible to stay — it no
// longer exists — so it resolves forward to whatever would run next (old
// day 3, Squat, now day 2) rather than to the history-only legacy slot.
// Every other day shifts down by one past the removed slot.
function remapDayIndexForLivePointer(dayIndex) {
  if (dayIndex <= 1) return dayIndex;
  if (dayIndex === 2) return 2;
  return dayIndex - 1;
}

// One-time program restructure: the dedicated Accessory day (old day 4)
// dropped entirely, its exercises redistributed across Bench/Press/Deadlift,
// shrinking the cycle from 5 days to 4. Bench/Squat/Press keep their day
// numbers; old day 5 (Deadlift) becomes day 4. For session HISTORY, the old
// Accessory day (4) remaps to day 7 — a reserved slot (see program.js's
// LEGACY_DAYS) that preserves those logs under their own name instead of
// colliding with whatever day 4 (now Deadlift) means going forward.
const DAY_COUNT_4_REMAP_HISTORY = { 1: 1, 2: 2, 3: 3, 4: 7, 5: 4 };

function remapDayIndexForHistoryV2(dayIndex) {
  return DAY_COUNT_4_REMAP_HISTORY[dayIndex] ?? dayIndex;
}

// For the live cycle pointer, old day 4 (Accessory) has nowhere sensible to
// stay — it no longer exists — so it resolves forward to whatever would run
// next (old day 5, Deadlift, now day 4) rather than to the history-only
// legacy slot. Day 5 maps to the same new day 4 for the same reason.
function remapDayIndexForLivePointerV2(dayIndex) {
  return dayIndex <= 3 ? dayIndex : 4;
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

  if (!state._dayCount5MigrationV1) {
    merged.sessionLogs = merged.sessionLogs.map((log) => ({ ...log, dayIndex: remapDayIndexForHistory(log.dayIndex) }));
    merged.cycleState = { ...merged.cycleState, dayIndex: remapDayIndexForLivePointer(merged.cycleState.dayIndex) };
    // An in-progress Recovery session has nowhere to continue — Recovery no
    // longer exists — so it's dropped rather than relabeled under Squat's
    // new day 2 with mismatched content; a fresh Squat session gets built
    // automatically next time Today renders (see ensureCurrentSession).
    if (merged.currentSession) {
      if (merged.currentSession.dayIndex === 2) {
        merged.currentSession = null;
      } else {
        merged.currentSession = { ...merged.currentSession, dayIndex: remapDayIndexForLivePointer(merged.currentSession.dayIndex) };
      }
    }
    merged._dayCount5MigrationV1 = true;
  }

  if (!state._dayCount4MigrationV1) {
    merged.sessionLogs = merged.sessionLogs.map((log) => ({ ...log, dayIndex: remapDayIndexForHistoryV2(log.dayIndex) }));
    merged.cycleState = { ...merged.cycleState, dayIndex: remapDayIndexForLivePointerV2(merged.cycleState.dayIndex) };
    // Every remaining day's exercise list changed shape in this restructure
    // (set counts, additions, removals), so an in-progress session built
    // under the old 5-day program — whichever day it was on — no longer
    // matches any current day's definition. Rather than try to reconcile
    // mismatched accessorySets, drop it; a fresh, correctly-shaped session
    // gets built automatically next time Today renders (see
    // ensureCurrentSession in app.js). No completed history is affected.
    if (merged.currentSession) {
      merged.currentSession = null;
    }
    merged._dayCount4MigrationV1 = true;
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

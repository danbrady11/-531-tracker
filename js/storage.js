import { LIFTS } from "./calc.js";
import { lastAccessoryLog } from "./state.js";

// The dedicated index the Accessory day used while it was an optional
// "bonus" session (started on demand, outside the rotation) — now that the
// bonus feature itself is removed, program.js no longer exports this: the
// slot is purely historical (see program.js's LEGACY_DAYS[8]). Kept here
// only so a stray in-progress bonus session from before this change can be
// recognized and dropped below.
const OLD_BONUS_ACCESSORY_DAY_INDEX = 8;

const STORAGE_KEY = "531-tracker-state-v1";

function defaultState() {
  return {
    settings: {
      barWeight: 45,
      roundingIncrement: 5,
      bbbPercentage: 0.5,
      // Deadlift's own supplemental percentage — "Back-off", not BBB (no BBB
      // on Deadlift day at all). Editable separately from bbbPercentage.
      deadliftBackoffPercentage: 0.65,
      tmIncrements: { squat: 10, deadlift: 10, bench: 5, press: 5, trapBarDeadlift: 10 },
      // Rest between sets, by exercise category — editable in Settings so a
      // duration change never needs a code change. "superset" is the rest
      // taken only after the "b" exercise of a superset pair, since there's
      // deliberately no rest between "a" and "b" themselves — unused by any
      // live day now that supersets are gone, but still readable if any old
      // synced/exported state carries a customized value.
      restTimerSec: { main: 180, bbb: 90, deadliftBackoff: 120, compound: 90, isolation: 60, superset: 60 },
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
    // mainLiftsCompleted tracks which of the four main lifts (bench/squat/
    // press/deadlift) have been completed so far this week — the 5/3/1 week
    // only advances once all four are in it (see advanceCycle in state.js);
    // reset to empty the moment it does.
    cycleState: { dayIndex: 1, weekIndex: 1, cycleNumber: 1, deloadOverride: null, mainLiftsCompleted: [] },
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
  // The two cable-row variants briefly merged into one unified "Seated
  // cable row" entry on Press day; that merged history now carries
  // forward under Press day's current label. "Seated cable row (close
  // grip)" is NOT renamed here — it's a distinct, live exercise again
  // (now on Deadlift day) and must keep its own name/history going
  // forward.
  "Seated cable row": "Seated cable row (wide/neutral)",
  // Same movement, reworded when the program moved to the Push/Pull/Legs
  // rotation (Pull A's first exercise).
  "Pull-ups (weighted)": "Weighted pull-ups",
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

// One-time program restructure: a new Accessory day (fresh content, not the
// one dropped in the 4-day collapse above) is inserted back in at day 4,
// pushing Deadlift from day 4 to day 5 and growing the cycle back to 5 days.
// Bench/Squat/Press keep their day numbers unchanged — only Deadlift shifts.
// Unlike the removal migrations above, this one only ever shifts day 4 to
// day 5; it never needs a reserved legacy slot since nothing is being
// dropped, just inserted.
const DAY_COUNT_5_REINTRODUCE_REMAP = { 1: 1, 2: 2, 3: 3, 4: 5 };

function remapDayIndexForDayCount5Reintroduce(dayIndex) {
  return DAY_COUNT_5_REINTRODUCE_REMAP[dayIndex] ?? dayIndex;
}

// One-time program restructure: the Accessory day (day 4) is pulled out of
// the rotation and turned into an optional bonus session, started on demand
// rather than in sequence — shrinking the rotation from 5 days back to 4.
// Its exercise list is NOT redistributed anywhere this time (unlike the
// earlier 5-day -> 4-day collapse) — it's preserved whole, just moved to the
// reserved OLD_BONUS_ACCESSORY_DAY_INDEX slot (see program.js's
// LEGACY_DAYS[8]) so it no longer collides with whatever day 4 means in the
// rotation. Bench/Squat/Press keep their day numbers; old day 5 (Deadlift)
// becomes day 4.
const DAY_COUNT_4_BONUS_REMAP_HISTORY = { 1: 1, 2: 2, 3: 3, 4: OLD_BONUS_ACCESSORY_DAY_INDEX, 5: 4 };

function remapDayIndexForAccessoryBonusHistory(dayIndex) {
  return DAY_COUNT_4_BONUS_REMAP_HISTORY[dayIndex] ?? dayIndex;
}

// For the live cycle pointer, old day 4 (Accessory) has nowhere sensible to
// stay in the rotation — it's no longer part of it — so it resolves forward
// to whatever would run next (old day 5, Deadlift, now day 4) rather than to
// the bonus slot (nothing should ever be "recommended next" into a bonus
// day). Day 5 maps to the same new day 4 for the same reason.
function remapDayIndexForAccessoryBonusLivePointer(dayIndex) {
  return dayIndex <= 3 ? dayIndex : 4;
}

// One-time program restructure: the single-lift-per-day rotation (Bench,
// Squat, Press, Deadlift — old days 1-4) is replaced entirely by a 6-session
// Push/Pull/Legs rotation (Pull A, Push A, Legs A, Pull B, Push B, Legs B).
// Old day numbers 1-4 now mean something completely different (Pull A/Push
// A/Legs A/Pull B), so old history can't stay at those numbers — it moves to
// reserved slots 10-13 (see program.js's LEGACY_DAYS), frozen under their
// original Bench/Squat/Press/Deadlift names. Old day 6 (Recovery, already a
// legacy-only slot) collides with the new live Legs B, so it moves from 6 to
// 9. Old days 7 and 8 (both already-legacy Accessory slots) don't collide
// with the new 1-6 range and are untouched.
const PPL_RESTRUCTURE_REMAP_HISTORY = { 1: 10, 2: 11, 3: 12, 4: 13, 6: 9 };

function remapDayIndexForPplRestructure(dayIndex) {
  return PPL_RESTRUCTURE_REMAP_HISTORY[dayIndex] ?? dayIndex;
}

// New-rotation day index of each main lift (2=Bench, 3=Squat, 5=Press,
// 6=Deadlift — see program.js's DAYS), used only to resume the live pointer
// right after the last lift actually completed under the old program,
// instead of blindly restarting at day 1/week 1 and losing real progress.
const PPL_MAIN_LIFT_DAY_INDEX = { bench: 2, squat: 3, press: 5, deadlift: 6 };
const PPL_DAY_COUNT = 6;

// Resumes the live cycle pointer from the most recently completed main-lift
// session under the OLD program, rather than resetting to day 1/week 1 and
// discarding real in-progress position. The old 4-day rotation's dayIndex
// has no sensible 1:1 mapping into the new day order, but every session log
// already carries its own `lift`, which does: whichever lift was done last
// tells us exactly which new-rotation day comes next. weekIndex/cycleNumber
// are carried over from that same log (they're meaningful under both
// programs), and mainLiftsCompleted is rebuilt from every other main lift
// logged under that identical week/cycle — under the old rotation, all four
// lifts were always done once per week, so this reconstructs "how far into
// this week" accurately instead of just the single most recent lift.
function deriveCycleStateForPplRestructure(sessionLogs, cycleState) {
  const lastMain = sessionLogs
    .filter((log) => log.completed && PPL_MAIN_LIFT_DAY_INDEX[log.lift])
    .reduce((latest, log) => (!latest || new Date(log.date) > new Date(latest.date) ? log : latest), null);
  if (!lastMain) {
    return { dayIndex: 1, weekIndex: 1, mainLiftsCompleted: [] };
  }
  const sameWeekLifts = sessionLogs
    .filter(
      (log) =>
        log.completed &&
        PPL_MAIN_LIFT_DAY_INDEX[log.lift] &&
        log.weekIndex === lastMain.weekIndex &&
        (log.cycleNumber ?? 1) === (lastMain.cycleNumber ?? 1)
    )
    .map((log) => log.lift);
  return {
    dayIndex: (PPL_MAIN_LIFT_DAY_INDEX[lastMain.lift] % PPL_DAY_COUNT) + 1,
    weekIndex: lastMain.weekIndex,
    cycleNumber: lastMain.cycleNumber ?? cycleState.cycleNumber,
    mainLiftsCompleted: [...new Set(sameWeekLifts)],
  };
}

// Config additions to an existing day's accessory list (as opposed to a full
// structural restructure) don't need a currentSession reset: nothing else
// about the day changes shape, so an in-progress session can just gain the
// new exercise's sets appended to the end of its accessorySets, leaving
// every other entry (and anything already logged on it) untouched. Not
// flagged/versioned — it's naturally idempotent (skipped once the exercise
// is already present), so it simply runs on every load until the exercise
// is there.
//
// Empty as of the Push/Pull/Legs restructure: the day-number meanings it
// used to target (old day 2 = Squat, old day 4 = Deadlift) have been
// completely repurposed (new day 2 = Push A, new day 4 = Pull B) — reusing
// those old entries here would wrongly backfill e.g. Leg extension onto a
// Push A session. The restructure migration below discards every
// in-progress session outright instead, so there's nothing stale left for
// this list to patch; add new entries here the next time a plain config
// addition (not a full restructure) needs one.
const CURRENT_SESSION_ACCESSORY_BACKFILLS = [];

function backfillCurrentSessionAccessories(currentSession, sessionLogs) {
  if (!currentSession) return currentSession;
  let accessorySets = currentSession.accessorySets || [];
  let changed = false;
  for (const { dayIndex, exerciseName, sets } of CURRENT_SESSION_ACCESSORY_BACKFILLS) {
    if (currentSession.dayIndex !== dayIndex) continue;
    if (accessorySets.some((s) => s.exerciseName === exerciseName)) continue;
    const newSets = Array.from({ length: sets }, (_, setIndex) => {
      const prefill = lastAccessoryLog(sessionLogs, exerciseName, setIndex);
      return { exerciseName, setIndex, weight: prefill?.weight ?? null, reps: prefill?.reps ?? null, completed: false };
    });
    accessorySets = [...accessorySets, ...newSets];
    changed = true;
  }
  return changed ? { ...currentSession, accessorySets } : currentSession;
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

  if (!state._dayCount5ReintroduceV1) {
    merged.sessionLogs = merged.sessionLogs.map((log) => ({ ...log, dayIndex: remapDayIndexForDayCount5Reintroduce(log.dayIndex) }));
    merged.cycleState = { ...merged.cycleState, dayIndex: remapDayIndexForDayCount5Reintroduce(merged.cycleState.dayIndex) };
    // Bench and Press both changed shape in this restructure (set/exercise
    // changes), and Deadlift's dayIndex itself moved from 4 to 5, so an
    // in-progress session built under the old 4-day program no longer
    // matches any current day's position/definition regardless of which
    // day it was on. Drop it; a fresh, correctly-shaped session gets built
    // automatically next time Today renders (see ensureCurrentSession in
    // app.js). No completed history is affected.
    if (merged.currentSession) {
      merged.currentSession = null;
    }
    merged._dayCount5ReintroduceV1 = true;
  }

  if (!state._accessoryBonusMigrationV1) {
    merged.sessionLogs = merged.sessionLogs.map((log) => ({ ...log, dayIndex: remapDayIndexForAccessoryBonusHistory(log.dayIndex) }));
    merged.cycleState = { ...merged.cycleState, dayIndex: remapDayIndexForAccessoryBonusLivePointer(merged.cycleState.dayIndex) };
    // An in-progress Accessory-day session has no clean continuation as a
    // bonus session — bonus completion deliberately skips cycle/TM
    // advancement entirely, which an already-half-logged rotation session
    // was never built expecting — so it's dropped rather than reinterpreted.
    // A non-Accessory session just shifts its dayIndex like history does.
    // No completed history is affected either way.
    if (merged.currentSession) {
      if (merged.currentSession.dayIndex === 4) {
        merged.currentSession = null;
      } else {
        merged.currentSession = { ...merged.currentSession, dayIndex: remapDayIndexForAccessoryBonusLivePointer(merged.currentSession.dayIndex) };
      }
    }
    merged._accessoryBonusMigrationV1 = true;
  }

  if (!state._pplRestructureV1) {
    merged.sessionLogs = merged.sessionLogs.map((log) => ({ ...log, dayIndex: remapDayIndexForPplRestructure(log.dayIndex) }));
    // Resume from wherever the user actually left off (see
    // deriveCycleStateForPplRestructure), rather than restarting at day
    // 1/week 1 and losing real in-progress position. cycleNumber and
    // deloadOverride still come from the live cycleState when history gives
    // no better answer (e.g. a brand-new account with no completed sessions).
    merged.cycleState = {
      ...merged.cycleState,
      ...deriveCycleStateForPplRestructure(merged.sessionLogs, merged.cycleState),
    };
    // Every single day's shape changed completely (the whole program
    // structure is different), so an in-progress session built under the
    // old 4-day program — whichever day it was on — can't be reconciled.
    // Drop it; a fresh, correctly-shaped session gets built automatically
    // next time Today renders (see ensureCurrentSession in app.js). No
    // completed history is affected.
    if (merged.currentSession) {
      merged.currentSession = null;
    }
    merged._pplRestructureV1 = true;
  }

  // One-time correction for the block above: it originally reset the live
  // cycle pointer to day 1/week 1 unconditionally on every account, instead
  // of resuming from the last completed main lift — discarding real
  // in-progress position for anyone who'd already logged part of a week.
  // Anyone who migrated before this fix shipped needs that corrected now;
  // this re-derives it the same way, which is a harmless no-op for anyone
  // whose _pplRestructureV1 ran under the already-fixed logic above (same
  // inputs, same result).
  if (!state._pplRestructureCycleFixV1) {
    merged.cycleState = {
      ...merged.cycleState,
      ...deriveCycleStateForPplRestructure(merged.sessionLogs, merged.cycleState),
    };
    merged._pplRestructureCycleFixV1 = true;
  }

  // The optional "bonus" Accessory session is removed entirely as of this
  // change — nothing builds a session at OLD_BONUS_ACCESSORY_DAY_INDEX
  // anymore, so a stray one left in progress from before this update has
  // nothing to continue as. Naturally idempotent (a no-op once there's no
  // such session left), so no version flag needed. Completed history at
  // that index is untouched — see program.js's LEGACY_DAYS[8].
  if (merged.currentSession?.dayIndex === OLD_BONUS_ACCESSORY_DAY_INDEX) {
    merged.currentSession = null;
  }

  merged.currentSession = backfillCurrentSessionAccessories(merged.currentSession, merged.sessionLogs);

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

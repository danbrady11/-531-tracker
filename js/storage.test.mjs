import { test } from "node:test";
import assert from "node:assert/strict";
import { migrate } from "./storage.js";

// The old bonus-Accessory-day slot (no longer exported from program.js now
// that the feature is removed — it's purely a history-only legacy slot, see
// program.js's LEGACY_DAYS[8]), used by the still-shipped
// _accessoryBonusMigrationV1 migration's own tests below.
const OLD_BONUS_ACCESSORY_DAY_INDEX = 8;

function sessionWith(accessorySets) {
  return { id: "1", date: "2026-01-01T00:00:00.000Z", dayIndex: 2, weekIndex: 1, lift: "bench", completed: true, mainSets: [], supplementalSets: [], accessorySets, notes: "" };
}

// Pre-flags every migration through the Push/Pull/Legs restructure as
// already done, for tests that aren't exercising any of them.
const ALL_MIGRATIONS_DONE = {
  _dayOrderRotatedV1: true,
  _dayCount5MigrationV1: true,
  _dayCount4MigrationV1: true,
  _dayCount5ReintroduceV1: true,
  _accessoryBonusMigrationV1: true,
  _pplRestructureV1: true,
};

test("migrate defaults deloadOnEvenCyclesOnly to true for a brand-new state", () => {
  const migrated = migrate({});
  assert.equal(migrated.settings.deloadOnEvenCyclesOnly, true);
});

test("migrate backfills cycleState.deloadOverride to null for a state saved before it existed", () => {
  const migrated = migrate({ cycleState: { dayIndex: 3, weekIndex: 2, cycleNumber: 1 } });
  assert.equal(migrated.cycleState.deloadOverride, null);
});

test("migrate preserves an explicitly set cycleState.deloadOverride", () => {
  const migrated = migrate({ cycleState: { dayIndex: 3, weekIndex: 2, cycleNumber: 1, deloadOverride: true } });
  assert.equal(migrated.cycleState.deloadOverride, true);
});

test("migrate defaults cycleState.mainLiftsCompleted to an empty array for a state saved before it existed", () => {
  const migrated = migrate({ cycleState: { dayIndex: 3, weekIndex: 2, cycleNumber: 1 } });
  assert.deepEqual(migrated.cycleState.mainLiftsCompleted, []);
});

test("migrate preserves an explicit cycleState.mainLiftsCompleted", () => {
  const migrated = migrate({ ...ALL_MIGRATIONS_DONE, cycleState: { dayIndex: 3, weekIndex: 2, cycleNumber: 1, mainLiftsCompleted: ["bench", "squat"] } });
  assert.deepEqual(migrated.cycleState.mainLiftsCompleted, ["bench", "squat"]);
});

test("migrate drops the superseded deloadEveryOtherCycle key", () => {
  const migrated = migrate({ settings: { deloadEveryOtherCycle: true } });
  assert.equal("deloadEveryOtherCycle" in migrated.settings, false);
  assert.equal(migrated.settings.deloadOnEvenCyclesOnly, true);
});

test("migrate preserves an explicit deloadOnEvenCyclesOnly: false", () => {
  const migrated = migrate({ settings: { deloadOnEvenCyclesOnly: false } });
  assert.equal(migrated.settings.deloadOnEvenCyclesOnly, false);
});

test("migrate defaults restTimerSec per category for a brand-new state, including the new deadliftBackoff category", () => {
  const migrated = migrate({});
  assert.deepEqual(migrated.settings.restTimerSec, { main: 180, bbb: 90, deadliftBackoff: 120, compound: 90, isolation: 60, superset: 60 });
});

test("migrate backfills the new deadliftBackoff rest category for a state saved before it existed", () => {
  const migrated = migrate({ settings: { restTimerSec: { main: 180, bbb: 90, compound: 90, isolation: 60, superset: 60 } } });
  assert.equal(migrated.settings.restTimerSec.deadliftBackoff, 120);
});

test("migrate drops the superseded flat restTimerMainSec/restTimerIsolationSec keys", () => {
  const migrated = migrate({ settings: { restTimerMainSec: 210, restTimerIsolationSec: 90 } });
  assert.equal("restTimerMainSec" in migrated.settings, false);
  assert.equal("restTimerIsolationSec" in migrated.settings, false);
});

test("migrate preserves a customized restTimerSec category, filling in the rest", () => {
  const migrated = migrate({ settings: { restTimerSec: { main: 200 } } });
  assert.equal(migrated.settings.restTimerSec.main, 200);
  assert.equal(migrated.settings.restTimerSec.bbb, 90);
  assert.equal(migrated.settings.restTimerSec.deadliftBackoff, 120);
  assert.equal(migrated.settings.restTimerSec.compound, 90);
  assert.equal(migrated.settings.restTimerSec.isolation, 60);
  assert.equal(migrated.settings.restTimerSec.superset, 60);
});

test("migrate backfills the new bbb category for a state saved before it existed", () => {
  const migrated = migrate({ settings: { restTimerSec: { main: 180, compound: 90, isolation: 60, superset: 60 } } });
  assert.equal(migrated.settings.restTimerSec.bbb, 90);
});

test("migrate defaults deadliftBackoffPercentage to 0.65 for a brand-new state", () => {
  const migrated = migrate({});
  assert.equal(migrated.settings.deadliftBackoffPercentage, 0.65);
});

test("migrate preserves a customized deadliftBackoffPercentage", () => {
  const migrated = migrate({ settings: { deadliftBackoffPercentage: 0.6 } });
  assert.equal(migrated.settings.deadliftBackoffPercentage, 0.6);
});

test("migrate defaults trapBarDeadlift TM to 0 for an existing user, not copied from deadlift", () => {
  const migrated = migrate({ trainingMaxes: { deadlift: { currentValue: 225, updatedAt: "2026-01-01" } } });
  assert.equal(migrated.trainingMaxes.deadlift.currentValue, 225);
  assert.equal(migrated.trainingMaxes.trapBarDeadlift.currentValue, 0);
});

test("migrate preserves an already-set trapBarDeadlift TM (e.g. after the one-time prompt)", () => {
  const migrated = migrate({
    trainingMaxes: {
      deadlift: { currentValue: 225, updatedAt: "2026-01-01" },
      trapBarDeadlift: { currentValue: 185, updatedAt: "2026-02-01" },
    },
  });
  assert.equal(migrated.trainingMaxes.trapBarDeadlift.currentValue, 185);
});

test("migrate renames 'Nordic curl' history to 'Swiss ball leg curl'", () => {
  const state = {
    sessionLogs: [sessionWith([{ exerciseName: "Nordic curl", setIndex: 0, weight: 25, reps: 8, completed: true }])],
  };
  const migrated = migrate(state);
  assert.equal(migrated.sessionLogs[0].accessorySets[0].exerciseName, "Swiss ball leg curl");
});

test("migrate renames 'Overhead tricep extension' history to 'Cable rope overhead extension'", () => {
  const state = {
    sessionLogs: [sessionWith([{ exerciseName: "Overhead tricep extension", setIndex: 0, weight: 30, reps: 12, completed: true }])],
  };
  const migrated = migrate(state);
  assert.equal(migrated.sessionLogs[0].accessorySets[0].exerciseName, "Cable rope overhead extension");
});

test("migrate renames 'Rear delt' history to 'Reverse pec deck / cable reverse fly'", () => {
  const state = {
    sessionLogs: [sessionWith([{ exerciseName: "Rear delt", setIndex: 0, weight: 20, reps: 15, completed: true }])],
  };
  const migrated = migrate(state);
  assert.equal(migrated.sessionLogs[0].accessorySets[0].exerciseName, "Reverse pec deck / cable reverse fly");
  assert.equal(migrated.sessionLogs[0].accessorySets[0].weight, 20);
  assert.equal(migrated.sessionLogs[0].accessorySets[0].reps, 15);
});

test("migrate renames 'Face pulls' history to 'Face pulls (optional)'", () => {
  const state = {
    sessionLogs: [sessionWith([{ exerciseName: "Face pulls", setIndex: 0, weight: 25, reps: 20, completed: true }])],
  };
  const migrated = migrate(state);
  assert.equal(migrated.sessionLogs[0].accessorySets[0].exerciseName, "Face pulls (optional)");
});

test("migrate renames the briefly-unified 'Seated cable row' history to Press day's current label", () => {
  const state = {
    sessionLogs: [sessionWith([{ exerciseName: "Seated cable row", setIndex: 0, weight: 120, reps: 10, completed: true }])],
  };
  const migrated = migrate(state);
  assert.equal(migrated.sessionLogs[0].accessorySets[0].exerciseName, "Seated cable row (wide/neutral)");
  assert.equal(migrated.sessionLogs[0].accessorySets[0].weight, 120);
});

test("migrate leaves 'Seated cable row (close grip)' history alone — it's a distinct, live exercise again", () => {
  const state = {
    sessionLogs: [sessionWith([{ exerciseName: "Seated cable row (close grip)", setIndex: 0, weight: 140, reps: 10, completed: true }])],
  };
  const migrated = migrate(state);
  assert.equal(migrated.sessionLogs[0].accessorySets[0].exerciseName, "Seated cable row (close grip)");
  assert.equal(migrated.sessionLogs[0].accessorySets[0].weight, 140);
});

test("migrate renames 'Pull-ups (weighted)' history to 'Weighted pull-ups' (reworded for the Push/Pull/Legs rotation)", () => {
  const state = {
    sessionLogs: [sessionWith([{ exerciseName: "Pull-ups (weighted)", setIndex: 0, weight: 25, reps: 8, completed: true }])],
  };
  const migrated = migrate(state);
  assert.equal(migrated.sessionLogs[0].accessorySets[0].exerciseName, "Weighted pull-ups");
  assert.equal(migrated.sessionLogs[0].accessorySets[0].weight, 25);
});

test("migrate leaves other exercise names untouched", () => {
  const state = {
    sessionLogs: [sessionWith([{ exerciseName: "Curls", setIndex: 0, weight: 30, reps: 12, completed: true }])],
  };
  const migrated = migrate(state);
  assert.equal(migrated.sessionLogs[0].accessorySets[0].exerciseName, "Curls");
});

test("migrate is idempotent — running it twice doesn't double-rename or error", () => {
  const state = {
    sessionLogs: [sessionWith([{ exerciseName: "Rear delt", setIndex: 0, weight: 20, reps: 15, completed: true }])],
  };
  const once = migrate(state);
  const twice = migrate(once);
  assert.equal(twice.sessionLogs[0].accessorySets[0].exerciseName, "Reverse pec deck / cable reverse fly");
});

test("migrate renames matching entries in customExercises and de-duplicates", () => {
  const state = { customExercises: ["Face pulls", "Curls", "Face pulls (optional)"] };
  const migrated = migrate(state);
  assert.deepEqual([...migrated.customExercises].sort(), ["Curls", "Face pulls (optional)"].sort());
});

test("migrate renames an in-progress currentSession's accessorySets too", () => {
  const state = {
    ...ALL_MIGRATIONS_DONE,
    sessionLogs: [],
    currentSession: { ...sessionWith([{ exerciseName: "Rear delt", setIndex: 0, weight: 20, reps: 15, completed: false }]), dayIndex: 1, completed: false },
  };
  const migrated = migrate(state);
  assert.equal(migrated.currentSession.accessorySets[0].exerciseName, "Reverse pec deck / cable reverse fly");
});

// These three tests exercise the day-order rotation in isolation, so they
// pre-flag every later migration as already done — otherwise a plain
// migrate() call here would run all of them back to back, and the asserted
// dayIndex values would need to reflect the later shifts too.
test("migrate rotates old dayIndex values to match the reordered program (Deadlift day1 -> day6, etc.)", () => {
  const state = {
    _dayCount5MigrationV1: true,
    _dayCount4MigrationV1: true,
    _dayCount5ReintroduceV1: true,
    _accessoryBonusMigrationV1: true,
    _pplRestructureV1: true,
    sessionLogs: [
      { ...sessionWith([]), dayIndex: 1 }, // was Deadlift
      { ...sessionWith([]), dayIndex: 6 }, // was Accessory
      { ...sessionWith([]), dayIndex: 5 }, // was Press
    ],
    cycleState: { dayIndex: 1, weekIndex: 3, cycleNumber: 1 },
  };
  const migrated = migrate(state);
  assert.deepEqual(migrated.sessionLogs.map((l) => l.dayIndex), [6, 5, 4]);
  assert.equal(migrated.cycleState.dayIndex, 6);
});

test("migrate's day-order rotation runs exactly once (flagged), not repeatedly on reload", () => {
  const once = migrate({
    _dayCount5MigrationV1: true,
    _dayCount4MigrationV1: true,
    _dayCount5ReintroduceV1: true,
    _accessoryBonusMigrationV1: true,
    _pplRestructureV1: true,
    sessionLogs: [{ ...sessionWith([]), dayIndex: 1 }],
  });
  assert.equal(once.sessionLogs[0].dayIndex, 6);
  assert.equal(once._dayOrderRotatedV1, true);

  const twice = migrate(once);
  assert.equal(twice.sessionLogs[0].dayIndex, 6, "must not rotate a second time");
});

test("migrate rotates an in-progress currentSession's dayIndex too", () => {
  const state = {
    _dayCount5MigrationV1: true,
    _dayCount4MigrationV1: true,
    _dayCount5ReintroduceV1: true,
    _accessoryBonusMigrationV1: true,
    _pplRestructureV1: true,
    sessionLogs: [],
    currentSession: { ...sessionWith([]), dayIndex: 5 }, // was Press
  };
  const migrated = migrate(state);
  assert.equal(migrated.currentSession.dayIndex, 4);
});

// The day-count-5 migration runs after day-order-rotation (real users
// already have _dayOrderRotatedV1: true) and before day-count-4, so these
// pre-flag every other migration as done and test only this restructure.
test("migrate remaps completed history onto the 5-day cycle, sending old Recovery (day 2) to the reserved legacy day 6", () => {
  const state = {
    _dayOrderRotatedV1: true,
    _dayCount4MigrationV1: true,
    _dayCount5ReintroduceV1: true,
    _accessoryBonusMigrationV1: true,
    _pplRestructureV1: true,
    sessionLogs: [
      { ...sessionWith([]), dayIndex: 1 }, // Bench, unchanged
      { ...sessionWith([]), dayIndex: 2 }, // was Recovery
      { ...sessionWith([]), dayIndex: 3 }, // was Squat
      { ...sessionWith([]), dayIndex: 4 }, // was Press
      { ...sessionWith([]), dayIndex: 5 }, // was Accessory
      { ...sessionWith([]), dayIndex: 6 }, // was Deadlift
    ],
  };
  const migrated = migrate(state);
  assert.deepEqual(migrated.sessionLogs.map((l) => l.dayIndex), [1, 6, 2, 3, 4, 5]);
  assert.equal(migrated._dayCount5MigrationV1, true);
});

test("migrate advances cycleState past the removed Recovery day to Squat's new slot, same week/cycle", () => {
  const state = {
    _dayOrderRotatedV1: true,
    _dayCount4MigrationV1: true,
    _dayCount5ReintroduceV1: true,
    _accessoryBonusMigrationV1: true,
    _pplRestructureV1: true,
    sessionLogs: [],
    cycleState: { dayIndex: 2, weekIndex: 2, cycleNumber: 3 },
  };
  const migrated = migrate(state);
  assert.equal(migrated.cycleState.dayIndex, 2);
});

test("migrate shifts a non-Recovery cycleState dayIndex down past the removed slot", () => {
  const state = {
    _dayOrderRotatedV1: true,
    _dayCount4MigrationV1: true,
    _dayCount5ReintroduceV1: true,
    _accessoryBonusMigrationV1: true,
    _pplRestructureV1: true,
    sessionLogs: [],
    cycleState: { dayIndex: 6, weekIndex: 1, cycleNumber: 1 }, // was Deadlift
  };
  const migrated = migrate(state);
  assert.equal(migrated.cycleState.dayIndex, 5);
});

test("migrate discards an in-progress Recovery currentSession (nothing to continue) instead of mislabeling it as Squat", () => {
  const state = {
    _dayOrderRotatedV1: true,
    _dayCount4MigrationV1: true,
    _dayCount5ReintroduceV1: true,
    _accessoryBonusMigrationV1: true,
    _pplRestructureV1: true,
    sessionLogs: [],
    currentSession: { ...sessionWith([]), dayIndex: 2 },
  };
  const migrated = migrate(state);
  assert.equal(migrated.currentSession, null);
});

test("migrate's day-count-5 restructure runs exactly once, not repeatedly on reload", () => {
  const once = migrate({
    _dayOrderRotatedV1: true,
    _dayCount4MigrationV1: true,
    _dayCount5ReintroduceV1: true,
    _accessoryBonusMigrationV1: true,
    _pplRestructureV1: true,
    sessionLogs: [{ ...sessionWith([]), dayIndex: 3 }],
  });
  assert.equal(once.sessionLogs[0].dayIndex, 2);
  assert.equal(once._dayCount5MigrationV1, true);

  const twice = migrate(once);
  assert.equal(twice.sessionLogs[0].dayIndex, 2, "must not shift a second time");
});

// The day-count-4 migration (Accessory day removed, 5-day -> 4-day cycle)
// runs after the earlier migrations and before the later ones, so these
// pre-flag every other migration as done and test only this restructure.
test("migrate remaps completed history onto the 4-day cycle, sending old Accessory (day 4) to the reserved legacy day 7", () => {
  const state = {
    _dayOrderRotatedV1: true,
    _dayCount5MigrationV1: true,
    _dayCount5ReintroduceV1: true,
    _accessoryBonusMigrationV1: true,
    _pplRestructureV1: true,
    sessionLogs: [
      { ...sessionWith([]), dayIndex: 1 }, // Bench, unchanged
      { ...sessionWith([]), dayIndex: 2 }, // Squat, unchanged
      { ...sessionWith([]), dayIndex: 3 }, // Press, unchanged
      { ...sessionWith([]), dayIndex: 4 }, // was Accessory
      { ...sessionWith([]), dayIndex: 5 }, // was Deadlift
    ],
  };
  const migrated = migrate(state);
  assert.deepEqual(migrated.sessionLogs.map((l) => l.dayIndex), [1, 2, 3, 7, 4]);
  assert.equal(migrated._dayCount4MigrationV1, true);
});

test("migrate's day-count-4 restructure runs exactly once, not repeatedly on reload", () => {
  const once = migrate({
    _dayOrderRotatedV1: true,
    _dayCount5MigrationV1: true,
    _dayCount5ReintroduceV1: true,
    _accessoryBonusMigrationV1: true,
    _pplRestructureV1: true,
    sessionLogs: [{ ...sessionWith([]), dayIndex: 5 }],
  });
  assert.equal(once.sessionLogs[0].dayIndex, 4);
  assert.equal(once._dayCount4MigrationV1, true);

  const twice = migrate(once);
  assert.equal(twice.sessionLogs[0].dayIndex, 4, "must not shift a second time");
});

// The day-count-5-reintroduce migration (new Accessory day inserted back in
// at day 4, Deadlift pushed from day 4 to day 5) runs after the earlier
// migrations, so these pre-flag every other migration as done.
test("migrate remaps completed history onto the reintroduced 5-day cycle, shifting old Deadlift (day 4) to day 5", () => {
  const state = {
    _dayOrderRotatedV1: true,
    _dayCount5MigrationV1: true,
    _dayCount4MigrationV1: true,
    _accessoryBonusMigrationV1: true,
    _pplRestructureV1: true,
    sessionLogs: [
      { ...sessionWith([]), dayIndex: 1 }, // Bench, unchanged
      { ...sessionWith([]), dayIndex: 2 }, // Squat, unchanged
      { ...sessionWith([]), dayIndex: 3 }, // Press, unchanged
      { ...sessionWith([]), dayIndex: 4 }, // was Deadlift
    ],
  };
  const migrated = migrate(state);
  assert.deepEqual(migrated.sessionLogs.map((l) => l.dayIndex), [1, 2, 3, 5]);
  assert.equal(migrated._dayCount5ReintroduceV1, true);
});

test("migrate's day-count-5-reintroduce restructure runs exactly once, not repeatedly on reload", () => {
  const once = migrate({
    _dayOrderRotatedV1: true,
    _dayCount5MigrationV1: true,
    _dayCount4MigrationV1: true,
    _accessoryBonusMigrationV1: true,
    _pplRestructureV1: true,
    sessionLogs: [{ ...sessionWith([]), dayIndex: 4 }],
  });
  assert.equal(once.sessionLogs[0].dayIndex, 5);
  assert.equal(once._dayCount5ReintroduceV1, true);

  const twice = migrate(once);
  assert.equal(twice.sessionLogs[0].dayIndex, 5, "must not shift a second time");
});

// The accessory-bonus migration (Accessory day pulled out of the rotation
// and turned into an optional bonus session) runs after the earlier
// migrations and before the Push/Pull/Legs restructure, so these pre-flag
// everything except itself and the final restructure.
test("migrate remaps completed history onto the bonus-day restructure, sending old Accessory (day 4) to the bonus slot and old Deadlift (day 5) to day 4", () => {
  const state = {
    _dayOrderRotatedV1: true,
    _dayCount5MigrationV1: true,
    _dayCount4MigrationV1: true,
    _dayCount5ReintroduceV1: true,
    _pplRestructureV1: true,
    sessionLogs: [
      { ...sessionWith([]), dayIndex: 1 }, // Bench, unchanged
      { ...sessionWith([]), dayIndex: 2 }, // Squat, unchanged
      { ...sessionWith([]), dayIndex: 3 }, // Press, unchanged
      { ...sessionWith([]), dayIndex: 4 }, // was Accessory (rotation day)
      { ...sessionWith([]), dayIndex: 5 }, // was Deadlift
    ],
  };
  const migrated = migrate(state);
  assert.deepEqual(migrated.sessionLogs.map((l) => l.dayIndex), [1, 2, 3, OLD_BONUS_ACCESSORY_DAY_INDEX, 4]);
  assert.equal(migrated._accessoryBonusMigrationV1, true);
});

test("migrate's bonus-day restructure runs exactly once, not repeatedly on reload", () => {
  const once = migrate({
    _dayOrderRotatedV1: true,
    _dayCount5MigrationV1: true,
    _dayCount4MigrationV1: true,
    _dayCount5ReintroduceV1: true,
    _pplRestructureV1: true,
    sessionLogs: [{ ...sessionWith([]), dayIndex: 4 }],
  });
  assert.equal(once.sessionLogs[0].dayIndex, OLD_BONUS_ACCESSORY_DAY_INDEX);
  assert.equal(once._accessoryBonusMigrationV1, true);

  const twice = migrate(once);
  assert.equal(twice.sessionLogs[0].dayIndex, OLD_BONUS_ACCESSORY_DAY_INDEX, "must not shift a second time");
});

test("migrate discards a stray in-progress session left at the old bonus-Accessory slot", () => {
  const state = {
    _dayOrderRotatedV1: true,
    _dayCount5MigrationV1: true,
    _dayCount4MigrationV1: true,
    _dayCount5ReintroduceV1: true,
    _accessoryBonusMigrationV1: true,
    _pplRestructureV1: true,
    sessionLogs: [],
    currentSession: { ...sessionWith([]), dayIndex: OLD_BONUS_ACCESSORY_DAY_INDEX },
  };
  const migrated = migrate(state);
  assert.equal(migrated.currentSession, null);
});

test("migrate leaves completed history at the old bonus-Accessory slot untouched — only a stray in-progress session there is dropped", () => {
  const state = {
    ...ALL_MIGRATIONS_DONE,
    sessionLogs: [{ ...sessionWith([]), dayIndex: OLD_BONUS_ACCESSORY_DAY_INDEX, completed: true }],
  };
  const migrated = migrate(state);
  assert.equal(migrated.sessionLogs[0].dayIndex, OLD_BONUS_ACCESSORY_DAY_INDEX);
  assert.equal(migrated.sessionLogs[0].completed, true);
});

// The Push/Pull/Legs restructure: the old single-lift-per-day rotation
// (Bench/Squat/Press/Deadlift, days 1-4) is replaced by the 6-session Pull
// A/Push A/Legs A/Pull B/Push B/Legs B rotation. Runs after every earlier
// migration (real users already have those flags set), so these pre-flag
// them as done and test only this restructure.
const BEFORE_PPL_RESTRUCTURE = {
  _dayOrderRotatedV1: true,
  _dayCount5MigrationV1: true,
  _dayCount4MigrationV1: true,
  _dayCount5ReintroduceV1: true,
  _accessoryBonusMigrationV1: true,
};

test("migrate remaps old single-lift-day history (1-4) to the reserved legacy slots 10-13", () => {
  const state = {
    ...BEFORE_PPL_RESTRUCTURE,
    sessionLogs: [
      { ...sessionWith([]), dayIndex: 1 }, // was Bench
      { ...sessionWith([]), dayIndex: 2 }, // was Squat
      { ...sessionWith([]), dayIndex: 3 }, // was Press
      { ...sessionWith([]), dayIndex: 4 }, // was Deadlift
    ],
  };
  const migrated = migrate(state);
  assert.deepEqual(migrated.sessionLogs.map((l) => l.dayIndex), [10, 11, 12, 13]);
  assert.equal(migrated._pplRestructureV1, true);
});

test("migrate moves old Recovery history (day 6) to the new reserved legacy slot 9, now that day 6 is live (Legs B)", () => {
  const state = {
    ...BEFORE_PPL_RESTRUCTURE,
    sessionLogs: [{ ...sessionWith([]), dayIndex: 6 }],
  };
  const migrated = migrate(state);
  assert.equal(migrated.sessionLogs[0].dayIndex, 9);
});

test("migrate leaves already-legacy history at days 7 and 8 untouched — no collision with the new 1-6 range", () => {
  const state = {
    ...BEFORE_PPL_RESTRUCTURE,
    sessionLogs: [
      { ...sessionWith([]), dayIndex: 7 },
      { ...sessionWith([]), dayIndex: 8 },
    ],
  };
  const migrated = migrate(state);
  assert.deepEqual(migrated.sessionLogs.map((l) => l.dayIndex), [7, 8]);
});

test("migrate resets the live cycle pointer to day 1 (Pull A), week 1, clearing mainLiftsCompleted — but keeps cycleNumber and deloadOverride", () => {
  const state = {
    ...BEFORE_PPL_RESTRUCTURE,
    sessionLogs: [],
    cycleState: { dayIndex: 3, weekIndex: 2, cycleNumber: 5, deloadOverride: true },
  };
  const migrated = migrate(state);
  assert.deepEqual(migrated.cycleState, { dayIndex: 1, weekIndex: 1, cycleNumber: 5, deloadOverride: true, mainLiftsCompleted: [] });
});

test("migrate discards ANY in-progress currentSession during the Push/Pull/Legs restructure, regardless of which day it was on", () => {
  for (const dayIndex of [1, 2, 3, 4]) {
    const state = {
      ...BEFORE_PPL_RESTRUCTURE,
      sessionLogs: [],
      currentSession: { ...sessionWith([]), dayIndex },
    };
    const migrated = migrate(state);
    assert.equal(migrated.currentSession, null, `dayIndex ${dayIndex}`);
  }
});

test("migrate's Push/Pull/Legs restructure runs exactly once, not repeatedly on reload", () => {
  const once = migrate({
    ...BEFORE_PPL_RESTRUCTURE,
    sessionLogs: [{ ...sessionWith([]), dayIndex: 1 }],
  });
  assert.equal(once.sessionLogs[0].dayIndex, 10);
  assert.equal(once._pplRestructureV1, true);

  const twice = migrate(once);
  assert.equal(twice.sessionLogs[0].dayIndex, 10, "must not shift a second time");
});

test("migrate leaves a currentSession alone when all migrations (including the PPL restructure) are already done", () => {
  const state = {
    ...ALL_MIGRATIONS_DONE,
    sessionLogs: [],
    currentSession: { ...sessionWith([]), dayIndex: 3 },
  };
  const migrated = migrate(state);
  assert.equal(migrated.currentSession.dayIndex, 3);
});

test("migrate leaves a currentSession's accessorySets alone when there are no backfills configured for its day (empty backfill list post-restructure)", () => {
  const state = {
    ...ALL_MIGRATIONS_DONE,
    sessionLogs: [],
    currentSession: { ...sessionWith([{ exerciseName: "Weighted pull-ups", setIndex: 0, weight: 25, reps: 8, completed: true }]), dayIndex: 1 },
  };
  const migrated = migrate(state);
  assert.deepEqual(migrated.currentSession.accessorySets, [{ exerciseName: "Weighted pull-ups", setIndex: 0, weight: 25, reps: 8, completed: true }]);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { migrate } from "./storage.js";

// The old bonus-Accessory-day slot (no longer exported from program.js now
// that the feature is removed — it's purely a history-only legacy slot,
// see program.js's LEGACY_DAYS[8]), used by the still-shipped
// _accessoryBonusMigrationV1 migration's own tests below.
const OLD_BONUS_ACCESSORY_DAY_INDEX = 8;

function sessionWith(accessorySets) {
  return { id: "1", date: "2026-01-01T00:00:00.000Z", dayIndex: 2, weekIndex: 1, lift: "bench", completed: true, mainSets: [], supplementalSets: [], accessorySets, notes: "" };
}

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

test("migrate drops the superseded deloadEveryOtherCycle key", () => {
  const migrated = migrate({ settings: { deloadEveryOtherCycle: true } });
  assert.equal("deloadEveryOtherCycle" in migrated.settings, false);
  assert.equal(migrated.settings.deloadOnEvenCyclesOnly, true);
});

test("migrate preserves an explicit deloadOnEvenCyclesOnly: false", () => {
  const migrated = migrate({ settings: { deloadOnEvenCyclesOnly: false } });
  assert.equal(migrated.settings.deloadOnEvenCyclesOnly, false);
});

test("migrate defaults restTimerSec per category for a brand-new state", () => {
  const migrated = migrate({});
  assert.deepEqual(migrated.settings.restTimerSec, { main: 180, bbb: 90, compound: 90, isolation: 60, superset: 60 });
});

test("migrate drops the superseded flat restTimerMainSec/restTimerIsolationSec keys", () => {
  const migrated = migrate({ settings: { restTimerMainSec: 210, restTimerIsolationSec: 90 } });
  assert.equal("restTimerMainSec" in migrated.settings, false);
  assert.equal("restTimerIsolationSec" in migrated.settings, false);
  assert.deepEqual(migrated.settings.restTimerSec, { main: 180, bbb: 90, compound: 90, isolation: 60, superset: 60 });
});

test("migrate preserves a customized restTimerSec category, filling in the rest", () => {
  const migrated = migrate({ settings: { restTimerSec: { main: 200 } } });
  assert.equal(migrated.settings.restTimerSec.main, 200);
  assert.equal(migrated.settings.restTimerSec.bbb, 90);
  assert.equal(migrated.settings.restTimerSec.compound, 90);
  assert.equal(migrated.settings.restTimerSec.isolation, 60);
  assert.equal(migrated.settings.restTimerSec.superset, 60);
});

test("migrate backfills the new bbb category for a state saved before it existed", () => {
  const migrated = migrate({ settings: { restTimerSec: { main: 180, compound: 90, isolation: 60, superset: 60 } } });
  assert.equal(migrated.settings.restTimerSec.bbb, 90);
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

test("migrate leaves 'Seated cable row (close grip)' history alone — it's a distinct, live exercise again (on Deadlift day)", () => {
  const state = {
    sessionLogs: [sessionWith([{ exerciseName: "Seated cable row (close grip)", setIndex: 0, weight: 140, reps: 10, completed: true }])],
  };
  const migrated = migrate(state);
  assert.equal(migrated.sessionLogs[0].accessorySets[0].exerciseName, "Seated cable row (close grip)");
  assert.equal(migrated.sessionLogs[0].accessorySets[0].weight, 140);
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
    _dayCount4MigrationV1: true, // isolate from the day-count-4 migration, which drops currentSession entirely
    _dayCount5ReintroduceV1: true, // isolate from the day-count-5 reintroduce migration, which also drops it
    _accessoryBonusMigrationV1: true, // isolate from the new bonus-day migration, which also drops it
    sessionLogs: [],
    currentSession: { ...sessionWith([{ exerciseName: "Rear delt", setIndex: 0, weight: 20, reps: 15, completed: false }]), completed: false },
  };
  const migrated = migrate(state);
  assert.equal(migrated.currentSession.accessorySets[0].exerciseName, "Reverse pec deck / cable reverse fly");
});

// These three tests exercise the day-order rotation in isolation, so they
// pre-flag the later day-count-5, day-count-4, and day-count-5-reintroduce
// migrations as already done — otherwise a plain migrate() call here would
// run all four one-time migrations back to back, and the asserted dayIndex
// values would need to reflect the later shifts too.
test("migrate rotates old dayIndex values to match the reordered program (Deadlift day1 -> day6, etc.)", () => {
  const state = {
    _dayCount5MigrationV1: true,
    _dayCount4MigrationV1: true,
    _dayCount5ReintroduceV1: true,
    _accessoryBonusMigrationV1: true,
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
    sessionLogs: [{ ...sessionWith([]), dayIndex: 1 }],
  });
  assert.equal(once.sessionLogs[0].dayIndex, 6);
  assert.equal(once._dayOrderRotatedV1, true);

  // Simulate a reload: migrate() runs again on the already-migrated state.
  const twice = migrate(once);
  assert.equal(twice.sessionLogs[0].dayIndex, 6, "must not rotate a second time");
});

test("migrate rotates an in-progress currentSession's dayIndex too", () => {
  const state = {
    _dayCount5MigrationV1: true,
    _dayCount4MigrationV1: true,
    _dayCount5ReintroduceV1: true,
    _accessoryBonusMigrationV1: true,
    sessionLogs: [],
    currentSession: { ...sessionWith([]), dayIndex: 5 }, // was Press
  };
  const migrated = migrate(state);
  assert.equal(migrated.currentSession.dayIndex, 4);
});

// The day-count-5 migration runs after day-order-rotation (real users already
// have _dayOrderRotatedV1: true) and before day-count-4, so these pre-flag
// both of those (and the later reintroduce migration) as done and test only
// the restructure: Recovery dropped, everything else renumbered.
test("migrate remaps completed history onto the 5-day cycle, sending old Recovery (day 2) to the reserved legacy day 6", () => {
  const state = {
    _dayOrderRotatedV1: true,
    _dayCount4MigrationV1: true,
    _dayCount5ReintroduceV1: true,
    _accessoryBonusMigrationV1: true,
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
    sessionLogs: [],
    cycleState: { dayIndex: 2, weekIndex: 2, cycleNumber: 3 },
  };
  const migrated = migrate(state);
  assert.deepEqual(migrated.cycleState, { dayIndex: 2, weekIndex: 2, cycleNumber: 3, deloadOverride: null });
});

test("migrate shifts a non-Recovery cycleState dayIndex down past the removed slot", () => {
  const state = {
    _dayOrderRotatedV1: true,
    _dayCount4MigrationV1: true,
    _dayCount5ReintroduceV1: true,
    _accessoryBonusMigrationV1: true,
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
    sessionLogs: [],
    currentSession: { ...sessionWith([]), dayIndex: 2 },
  };
  const migrated = migrate(state);
  assert.equal(migrated.currentSession, null);
});

test("migrate shifts a non-Recovery in-progress currentSession's dayIndex down past the removed slot", () => {
  const state = {
    _dayOrderRotatedV1: true,
    _dayCount4MigrationV1: true,
    _dayCount5ReintroduceV1: true,
    _accessoryBonusMigrationV1: true,
    sessionLogs: [],
    currentSession: { ...sessionWith([]), dayIndex: 4 }, // was Press
  };
  const migrated = migrate(state);
  assert.equal(migrated.currentSession.dayIndex, 3);
});

test("migrate's day-count-5 restructure runs exactly once, not repeatedly on reload", () => {
  const once = migrate({
    _dayOrderRotatedV1: true,
    _dayCount4MigrationV1: true,
    _dayCount5ReintroduceV1: true,
    _accessoryBonusMigrationV1: true,
    sessionLogs: [{ ...sessionWith([]), dayIndex: 3 }],
  });
  assert.equal(once.sessionLogs[0].dayIndex, 2);
  assert.equal(once._dayCount5MigrationV1, true);

  const twice = migrate(once);
  assert.equal(twice.sessionLogs[0].dayIndex, 2, "must not shift a second time");
});

// The day-count-4 migration (Accessory day removed, 5-day -> 4-day cycle)
// runs after both earlier migrations (real users already have both flags
// set) and before the later reintroduce migration, so these pre-flag those
// as done and test only this restructure.
test("migrate remaps completed history onto the 4-day cycle, sending old Accessory (day 4) to the reserved legacy day 7", () => {
  const state = {
    _dayOrderRotatedV1: true,
    _dayCount5MigrationV1: true,
    _dayCount5ReintroduceV1: true,
    _accessoryBonusMigrationV1: true,
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

test("migrate advances cycleState past the removed Accessory day to Deadlift's new slot, same week/cycle", () => {
  const state = {
    _dayOrderRotatedV1: true,
    _dayCount5MigrationV1: true,
    _dayCount5ReintroduceV1: true,
    _accessoryBonusMigrationV1: true,
    sessionLogs: [],
    cycleState: { dayIndex: 4, weekIndex: 2, cycleNumber: 3 },
  };
  const migrated = migrate(state);
  assert.deepEqual(migrated.cycleState, { dayIndex: 4, weekIndex: 2, cycleNumber: 3, deloadOverride: null });
});

test("migrate shifts a non-Accessory cycleState dayIndex (old Deadlift, day 5) down to the new day 4", () => {
  const state = {
    _dayOrderRotatedV1: true,
    _dayCount5MigrationV1: true,
    _dayCount5ReintroduceV1: true,
    _accessoryBonusMigrationV1: true,
    sessionLogs: [],
    cycleState: { dayIndex: 5, weekIndex: 1, cycleNumber: 1 },
  };
  const migrated = migrate(state);
  assert.equal(migrated.cycleState.dayIndex, 4);
});

test("migrate leaves a cycleState dayIndex of 1-3 untouched (Bench/Squat/Press keep their numbers)", () => {
  for (const dayIndex of [1, 2, 3]) {
    const migrated = migrate({
      _dayOrderRotatedV1: true,
      _dayCount5MigrationV1: true,
      _dayCount5ReintroduceV1: true,
      _accessoryBonusMigrationV1: true,
      sessionLogs: [],
      cycleState: { dayIndex, weekIndex: 1, cycleNumber: 1 },
    });
    assert.equal(migrated.cycleState.dayIndex, dayIndex);
  }
});

test("migrate discards ANY in-progress currentSession during the day-count-4 restructure, regardless of which day it was on", () => {
  for (const dayIndex of [1, 2, 3, 4, 5]) {
    const state = {
      _dayOrderRotatedV1: true,
      _dayCount5MigrationV1: true,
      _dayCount5ReintroduceV1: true,
      _accessoryBonusMigrationV1: true,
      sessionLogs: [],
      currentSession: { ...sessionWith([]), dayIndex },
    };
    const migrated = migrate(state);
    assert.equal(migrated.currentSession, null, `dayIndex ${dayIndex}`);
  }
});

test("migrate's day-count-4 restructure runs exactly once, not repeatedly on reload", () => {
  const once = migrate({
    _dayOrderRotatedV1: true,
    _dayCount5MigrationV1: true,
    _dayCount5ReintroduceV1: true,
    _accessoryBonusMigrationV1: true,
    sessionLogs: [{ ...sessionWith([]), dayIndex: 5 }],
  });
  assert.equal(once.sessionLogs[0].dayIndex, 4);
  assert.equal(once._dayCount4MigrationV1, true);

  const twice = migrate(once);
  assert.equal(twice.sessionLogs[0].dayIndex, 4, "must not shift a second time");
});

// The day-count-5-reintroduce migration (new Accessory day inserted back in
// at day 4, Deadlift pushed from day 4 to day 5) runs after all three
// earlier migrations (real users already have those flags set), so these
// pre-flag them as done and test only this restructure.
test("migrate remaps completed history onto the reintroduced 5-day cycle, shifting old Deadlift (day 4) to day 5", () => {
  const state = {
    _dayOrderRotatedV1: true,
    _dayCount5MigrationV1: true,
    _dayCount4MigrationV1: true,
    _accessoryBonusMigrationV1: true,
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

test("migrate advances cycleState from old Deadlift (day 4) to its new slot (day 5), same week/cycle", () => {
  const state = {
    _dayOrderRotatedV1: true,
    _dayCount5MigrationV1: true,
    _dayCount4MigrationV1: true,
    _accessoryBonusMigrationV1: true,
    sessionLogs: [],
    cycleState: { dayIndex: 4, weekIndex: 2, cycleNumber: 3 },
  };
  const migrated = migrate(state);
  assert.deepEqual(migrated.cycleState, { dayIndex: 5, weekIndex: 2, cycleNumber: 3, deloadOverride: null });
});

test("migrate leaves a cycleState dayIndex of 1-3 untouched during the reintroduce migration", () => {
  for (const dayIndex of [1, 2, 3]) {
    const migrated = migrate({
      _dayOrderRotatedV1: true,
      _dayCount5MigrationV1: true,
      _dayCount4MigrationV1: true,
      _accessoryBonusMigrationV1: true,
      sessionLogs: [],
      cycleState: { dayIndex, weekIndex: 1, cycleNumber: 1 },
    });
    assert.equal(migrated.cycleState.dayIndex, dayIndex);
  }
});

test("migrate discards ANY in-progress currentSession during the reintroduce restructure, regardless of which day it was on", () => {
  for (const dayIndex of [1, 2, 3, 4]) {
    const state = {
      _dayOrderRotatedV1: true,
      _dayCount5MigrationV1: true,
      _dayCount4MigrationV1: true,
      _accessoryBonusMigrationV1: true,
      sessionLogs: [],
      currentSession: { ...sessionWith([]), dayIndex },
    };
    const migrated = migrate(state);
    assert.equal(migrated.currentSession, null, `dayIndex ${dayIndex}`);
  }
});

test("migrate's day-count-5-reintroduce restructure runs exactly once, not repeatedly on reload", () => {
  const once = migrate({
    _dayOrderRotatedV1: true,
    _dayCount5MigrationV1: true,
    _dayCount4MigrationV1: true,
    _accessoryBonusMigrationV1: true,
    sessionLogs: [{ ...sessionWith([]), dayIndex: 4 }],
  });
  assert.equal(once.sessionLogs[0].dayIndex, 5);
  assert.equal(once._dayCount5ReintroduceV1, true);

  const twice = migrate(once);
  assert.equal(twice.sessionLogs[0].dayIndex, 5, "must not shift a second time");
});

// Config additions to an existing day's accessory list (Leg extension added
// to Squat day) patch an in-progress session in place instead of discarding
// it like the structural day-count migrations above — nothing else about
// the day changed shape, so there's nothing to reconcile. All four
// structural-migration flags are pre-flagged so only this backfill runs.
const ALL_DAY_MIGRATION_FLAGS = {
  _dayOrderRotatedV1: true,
  _dayCount5MigrationV1: true,
  _dayCount4MigrationV1: true,
  _dayCount5ReintroduceV1: true,
  _accessoryBonusMigrationV1: true,
};

test("migrate backfills Leg extension onto an in-progress Squat-day session, leaving everything else untouched", () => {
  const state = {
    ...ALL_DAY_MIGRATION_FLAGS,
    sessionLogs: [],
    currentSession: {
      ...sessionWith([{ exerciseName: "RDL", setIndex: 0, weight: 135, reps: 10, completed: true }]),
      dayIndex: 2,
      mainSets: [{ percentage: 0.65, weight: 90, targetReps: 5, actualReps: 5, isAmrap: false, completed: true }],
    },
  };
  const migrated = migrate(state);
  const session = migrated.currentSession;

  // Existing entries untouched.
  assert.equal(session.dayIndex, 2);
  assert.deepEqual(session.mainSets, state.currentSession.mainSets);
  const rdl = session.accessorySets.filter((s) => s.exerciseName === "RDL");
  assert.deepEqual(rdl, [{ exerciseName: "RDL", setIndex: 0, weight: 135, reps: 10, completed: true }]);

  // Leg extension appended: 4 fresh, unlogged sets.
  const legExtension = session.accessorySets.filter((s) => s.exerciseName === "Leg extension");
  assert.equal(legExtension.length, 4);
  legExtension.forEach((s, i) => {
    assert.equal(s.setIndex, i);
    assert.equal(s.weight, null);
    assert.equal(s.reps, null);
    assert.equal(s.completed, false);
  });

  // Appended after the existing entries.
  assert.equal(session.accessorySets[0].exerciseName, "RDL");
  assert.equal(session.accessorySets[session.accessorySets.length - 1].exerciseName, "Leg extension");
});

test("migrate's Leg extension backfill prefills from existing history, same as any other accessory", () => {
  const state = {
    ...ALL_DAY_MIGRATION_FLAGS,
    sessionLogs: [{ ...sessionWith([{ exerciseName: "Leg extension", setIndex: 0, weight: 90, reps: 14, completed: true }]), completed: true }],
    currentSession: { ...sessionWith([]), dayIndex: 2 },
  };
  const migrated = migrate(state);
  const firstSet = migrated.currentSession.accessorySets.find((s) => s.exerciseName === "Leg extension" && s.setIndex === 0);
  assert.equal(firstSet.weight, 90);
  assert.equal(firstSet.reps, 14);
});

test("migrate's Leg extension backfill is idempotent — doesn't duplicate on a second migrate() call", () => {
  const state = { ...ALL_DAY_MIGRATION_FLAGS, sessionLogs: [], currentSession: { ...sessionWith([]), dayIndex: 2 } };
  const once = migrate(state);
  const twice = migrate(once);
  assert.equal(twice.currentSession.accessorySets.filter((s) => s.exerciseName === "Leg extension").length, 4);
});

test("migrate's Leg extension backfill does nothing for a non-Squat-day in-progress session", () => {
  const state = { ...ALL_DAY_MIGRATION_FLAGS, sessionLogs: [], currentSession: { ...sessionWith([]), dayIndex: 1 } };
  const migrated = migrate(state);
  assert.equal(migrated.currentSession.accessorySets.some((s) => s.exerciseName === "Leg extension"), false);
});

test("migrate's Leg extension backfill does nothing when there's no in-progress session at all", () => {
  const migrated = migrate({ ...ALL_DAY_MIGRATION_FLAGS, sessionLogs: [] });
  assert.equal(migrated.currentSession, undefined);
});

// The accessory-bonus migration (Accessory day pulled out of the rotation
// and turned into an optional bonus session) runs after all four earlier
// migrations (real users already have those flags set), so these pre-flag
// them as done and test only this restructure.
test("migrate remaps completed history onto the bonus-day restructure, sending old Accessory (day 4) to the bonus slot and old Deadlift (day 5) to day 4", () => {
  const state = {
    _dayOrderRotatedV1: true,
    _dayCount5MigrationV1: true,
    _dayCount4MigrationV1: true,
    _dayCount5ReintroduceV1: true,
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

test("migrate advances cycleState past the removed Accessory rotation slot to Deadlift's new slot, same week/cycle", () => {
  const state = {
    _dayOrderRotatedV1: true,
    _dayCount5MigrationV1: true,
    _dayCount4MigrationV1: true,
    _dayCount5ReintroduceV1: true,
    sessionLogs: [],
    cycleState: { dayIndex: 4, weekIndex: 2, cycleNumber: 3 },
  };
  const migrated = migrate(state);
  assert.deepEqual(migrated.cycleState, { dayIndex: 4, weekIndex: 2, cycleNumber: 3, deloadOverride: null });
});

test("migrate shifts a non-Accessory cycleState dayIndex (old Deadlift, day 5) down to the new day 4", () => {
  const state = {
    _dayOrderRotatedV1: true,
    _dayCount5MigrationV1: true,
    _dayCount4MigrationV1: true,
    _dayCount5ReintroduceV1: true,
    sessionLogs: [],
    cycleState: { dayIndex: 5, weekIndex: 1, cycleNumber: 1 },
  };
  const migrated = migrate(state);
  assert.equal(migrated.cycleState.dayIndex, 4);
});

test("migrate leaves a cycleState dayIndex of 1-3 untouched during the bonus-day restructure", () => {
  for (const dayIndex of [1, 2, 3]) {
    const migrated = migrate({
      _dayOrderRotatedV1: true,
      _dayCount5MigrationV1: true,
      _dayCount4MigrationV1: true,
      _dayCount5ReintroduceV1: true,
      sessionLogs: [],
      cycleState: { dayIndex, weekIndex: 1, cycleNumber: 1 },
    });
    assert.equal(migrated.cycleState.dayIndex, dayIndex);
  }
});

test("migrate discards an in-progress Accessory-day (old day 4) currentSession — no clean bonus-session continuation", () => {
  const state = {
    _dayOrderRotatedV1: true,
    _dayCount5MigrationV1: true,
    _dayCount4MigrationV1: true,
    _dayCount5ReintroduceV1: true,
    sessionLogs: [],
    currentSession: { ...sessionWith([]), dayIndex: 4 },
  };
  const migrated = migrate(state);
  assert.equal(migrated.currentSession, null);
});

test("migrate shifts a non-Accessory in-progress currentSession's dayIndex (old Deadlift, day 5) down to the new day 4", () => {
  const state = {
    _dayOrderRotatedV1: true,
    _dayCount5MigrationV1: true,
    _dayCount4MigrationV1: true,
    _dayCount5ReintroduceV1: true,
    sessionLogs: [],
    currentSession: { ...sessionWith([]), dayIndex: 5 },
  };
  const migrated = migrate(state);
  assert.equal(migrated.currentSession.dayIndex, 4);
});

test("migrate leaves a currentSession on days 1-3 untouched (just flags the migration done)", () => {
  for (const dayIndex of [1, 2, 3]) {
    const state = {
      _dayOrderRotatedV1: true,
      _dayCount5MigrationV1: true,
      _dayCount4MigrationV1: true,
      _dayCount5ReintroduceV1: true,
      sessionLogs: [],
      currentSession: { ...sessionWith([]), dayIndex },
    };
    const migrated = migrate(state);
    assert.equal(migrated.currentSession.dayIndex, dayIndex);
  }
});

test("migrate's bonus-day restructure runs exactly once, not repeatedly on reload", () => {
  const once = migrate({
    _dayOrderRotatedV1: true,
    _dayCount5MigrationV1: true,
    _dayCount4MigrationV1: true,
    _dayCount5ReintroduceV1: true,
    sessionLogs: [{ ...sessionWith([]), dayIndex: 4 }],
  });
  assert.equal(once.sessionLogs[0].dayIndex, OLD_BONUS_ACCESSORY_DAY_INDEX);
  assert.equal(once._accessoryBonusMigrationV1, true);

  const twice = migrate(once);
  assert.equal(twice.sessionLogs[0].dayIndex, OLD_BONUS_ACCESSORY_DAY_INDEX, "must not shift a second time");
});

// The bonus Accessory session itself is removed entirely as of this change.
// A stray in-progress session at the old bonus slot (from right before this
// update shipped) has nothing to continue as, so it's discarded — naturally
// idempotent, no version flag. All five structural-migration flags are
// pre-flagged so only this discard runs.
const ALL_FIVE_DAY_MIGRATION_FLAGS = {
  _dayOrderRotatedV1: true,
  _dayCount5MigrationV1: true,
  _dayCount4MigrationV1: true,
  _dayCount5ReintroduceV1: true,
  _accessoryBonusMigrationV1: true,
};

test("migrate discards a stray in-progress session left at the old bonus-Accessory slot", () => {
  const state = {
    ...ALL_FIVE_DAY_MIGRATION_FLAGS,
    sessionLogs: [],
    currentSession: { ...sessionWith([]), dayIndex: OLD_BONUS_ACCESSORY_DAY_INDEX },
  };
  const migrated = migrate(state);
  assert.equal(migrated.currentSession, null);
});

test("migrate leaves a currentSession on a rotation day (1-4) alone when discarding the stray bonus session", () => {
  for (const dayIndex of [1, 2, 3, 4]) {
    const state = {
      ...ALL_FIVE_DAY_MIGRATION_FLAGS,
      sessionLogs: [],
      currentSession: { ...sessionWith([]), dayIndex },
    };
    const migrated = migrate(state);
    assert.equal(migrated.currentSession.dayIndex, dayIndex);
  }
});

test("migrate leaves completed history at the old bonus-Accessory slot untouched — only the in-progress session is dropped", () => {
  const state = {
    ...ALL_FIVE_DAY_MIGRATION_FLAGS,
    sessionLogs: [{ ...sessionWith([]), dayIndex: OLD_BONUS_ACCESSORY_DAY_INDEX, completed: true }],
    currentSession: { ...sessionWith([]), dayIndex: OLD_BONUS_ACCESSORY_DAY_INDEX },
  };
  const migrated = migrate(state);
  assert.equal(migrated.currentSession, null);
  assert.equal(migrated.sessionLogs[0].dayIndex, OLD_BONUS_ACCESSORY_DAY_INDEX);
  assert.equal(migrated.sessionLogs[0].completed, true);
});

// Taking BBB out of Deadlift day and adding Hip thrust as a plain accessory
// is a config addition like Leg extension's above — patches an in-progress
// Deadlift session in place instead of discarding it.
test("migrate backfills Hip thrust onto an in-progress Deadlift-day session, leaving everything else untouched", () => {
  const state = {
    ...ALL_FIVE_DAY_MIGRATION_FLAGS,
    sessionLogs: [],
    currentSession: {
      ...sessionWith([{ exerciseName: "Bulgarian split squat", setIndex: 0, weight: 50, reps: 10, completed: true }]),
      dayIndex: 4,
      mainSets: [{ percentage: 0.65, weight: 100, targetReps: 5, actualReps: 5, isAmrap: false, completed: true }],
    },
  };
  const migrated = migrate(state);
  const session = migrated.currentSession;

  assert.equal(session.dayIndex, 4);
  assert.deepEqual(session.mainSets, state.currentSession.mainSets);
  const splitSquat = session.accessorySets.filter((s) => s.exerciseName === "Bulgarian split squat");
  assert.deepEqual(splitSquat, [{ exerciseName: "Bulgarian split squat", setIndex: 0, weight: 50, reps: 10, completed: true }]);

  const hipThrust = session.accessorySets.filter((s) => s.exerciseName === "Hip thrust");
  assert.equal(hipThrust.length, 3);
  hipThrust.forEach((s, i) => {
    assert.equal(s.setIndex, i);
    assert.equal(s.weight, null);
    assert.equal(s.reps, null);
    assert.equal(s.completed, false);
  });

  assert.equal(session.accessorySets[0].exerciseName, "Bulgarian split squat");
  assert.equal(session.accessorySets[session.accessorySets.length - 1].exerciseName, "Hip thrust");
});

test("migrate's Hip thrust backfill prefills from existing history, same as any other accessory", () => {
  const state = {
    ...ALL_FIVE_DAY_MIGRATION_FLAGS,
    sessionLogs: [{ ...sessionWith([{ exerciseName: "Hip thrust", setIndex: 0, weight: 185, reps: 10, completed: true }]), dayIndex: 4, completed: true }],
    currentSession: { ...sessionWith([]), dayIndex: 4 },
  };
  const migrated = migrate(state);
  const firstSet = migrated.currentSession.accessorySets.find((s) => s.exerciseName === "Hip thrust" && s.setIndex === 0);
  assert.equal(firstSet.weight, 185);
  assert.equal(firstSet.reps, 10);
});

test("migrate's Hip thrust backfill is idempotent — doesn't duplicate on a second migrate() call", () => {
  const state = { ...ALL_FIVE_DAY_MIGRATION_FLAGS, sessionLogs: [], currentSession: { ...sessionWith([]), dayIndex: 4 } };
  const once = migrate(state);
  const twice = migrate(once);
  assert.equal(twice.currentSession.accessorySets.filter((s) => s.exerciseName === "Hip thrust").length, 3);
});

test("migrate's Hip thrust backfill does nothing for a non-Deadlift-day in-progress session", () => {
  const state = { ...ALL_FIVE_DAY_MIGRATION_FLAGS, sessionLogs: [], currentSession: { ...sessionWith([]), dayIndex: 1 } };
  const migrated = migrate(state);
  assert.equal(migrated.currentSession.accessorySets.some((s) => s.exerciseName === "Hip thrust"), false);
});

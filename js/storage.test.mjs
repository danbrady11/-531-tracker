import { test } from "node:test";
import assert from "node:assert/strict";
import { migrate } from "./storage.js";

function sessionWith(accessorySets) {
  return { id: "1", date: "2026-01-01T00:00:00.000Z", dayIndex: 2, weekIndex: 1, lift: "bench", completed: true, mainSets: [], supplementalSets: [], accessorySets, notes: "" };
}

test("migrate defaults deloadOnEvenCyclesOnly to true for a brand-new state", () => {
  const migrated = migrate({});
  assert.equal(migrated.settings.deloadOnEvenCyclesOnly, true);
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
    sessionLogs: [],
    currentSession: { ...sessionWith([{ exerciseName: "Rear delt", setIndex: 0, weight: 20, reps: 15, completed: false }]), completed: false },
  };
  const migrated = migrate(state);
  assert.equal(migrated.currentSession.accessorySets[0].exerciseName, "Reverse pec deck / cable reverse fly");
});

test("migrate rotates old dayIndex values to match the reordered program (Deadlift day1 -> day6, etc.)", () => {
  const state = {
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
  const once = migrate({ sessionLogs: [{ ...sessionWith([]), dayIndex: 1 }] });
  assert.equal(once.sessionLogs[0].dayIndex, 6);
  assert.equal(once._dayOrderRotatedV1, true);

  // Simulate a reload: migrate() runs again on the already-migrated state.
  const twice = migrate(once);
  assert.equal(twice.sessionLogs[0].dayIndex, 6, "must not rotate a second time");
});

test("migrate rotates an in-progress currentSession's dayIndex too", () => {
  const state = { sessionLogs: [], currentSession: { ...sessionWith([]), dayIndex: 5 } }; // was Press
  const migrated = migrate(state);
  assert.equal(migrated.currentSession.dayIndex, 4);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { migrate } from "./storage.js";

function sessionWith(accessorySets) {
  return { id: "1", date: "2026-01-01T00:00:00.000Z", dayIndex: 2, weekIndex: 1, lift: "bench", completed: true, mainSets: [], supplementalSets: [], accessorySets, notes: "" };
}

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

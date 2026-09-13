import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceCycle, effectiveWeekCount, accessoryHistory, rehabAdherence } from "./state.js";

const deloadEveryCycle = { deloadOnEvenCyclesOnly: false };
const deloadEvenOnly = { deloadOnEvenCyclesOnly: true };

test("effectiveWeekCount: always 4 when the setting is off (deload every cycle)", () => {
  assert.equal(effectiveWeekCount(1, deloadEveryCycle), 4);
  assert.equal(effectiveWeekCount(2, deloadEveryCycle), 4);
  assert.equal(effectiveWeekCount(7, deloadEveryCycle), 4);
});

test("effectiveWeekCount: even cycles get 4 weeks, odd cycles get 3, when deloadOnEvenCyclesOnly is on", () => {
  assert.equal(effectiveWeekCount(1, deloadEvenOnly), 3);
  assert.equal(effectiveWeekCount(2, deloadEvenOnly), 4);
  assert.equal(effectiveWeekCount(3, deloadEvenOnly), 3);
  assert.equal(effectiveWeekCount(4, deloadEvenOnly), 4);
});

test("advanceCycle: with the setting off, week 4 always runs before the cycle completes", () => {
  let { cycleState, cycleCompleted } = advanceCycle({ dayIndex: 6, weekIndex: 3, cycleNumber: 1 }, deloadEveryCycle);
  assert.deepEqual(cycleState, { dayIndex: 1, weekIndex: 4, cycleNumber: 1 });
  assert.equal(cycleCompleted, false);

  ({ cycleState, cycleCompleted } = advanceCycle({ dayIndex: 6, weekIndex: 4, cycleNumber: 1 }, deloadEveryCycle));
  assert.deepEqual(cycleState, { dayIndex: 1, weekIndex: 1, cycleNumber: 2 });
  assert.equal(cycleCompleted, true);
});

test("advanceCycle: even-only — cycle 1 (odd) skips week 4 and completes right after week 3", () => {
  const { cycleState, cycleCompleted } = advanceCycle({ dayIndex: 6, weekIndex: 3, cycleNumber: 1 }, deloadEvenOnly);
  assert.deepEqual(cycleState, { dayIndex: 1, weekIndex: 1, cycleNumber: 2 });
  assert.equal(cycleCompleted, true);
});

test("advanceCycle: even-only — cycle 2 (even) still gets a week 4 deload", () => {
  const { cycleState, cycleCompleted } = advanceCycle({ dayIndex: 6, weekIndex: 3, cycleNumber: 2 }, deloadEvenOnly);
  assert.deepEqual(cycleState, { dayIndex: 1, weekIndex: 4, cycleNumber: 2 });
  assert.equal(cycleCompleted, false);
});

test("advanceCycle: even-only — cycle 3 (odd again) skips week 4 too", () => {
  const { cycleState, cycleCompleted } = advanceCycle({ dayIndex: 6, weekIndex: 3, cycleNumber: 3 }, deloadEvenOnly);
  assert.deepEqual(cycleState, { dayIndex: 1, weekIndex: 1, cycleNumber: 4 });
  assert.equal(cycleCompleted, true);
});

test("advanceCycle: ordinary day-to-day advancement within a week is unaffected", () => {
  const { cycleState, cycleCompleted } = advanceCycle({ dayIndex: 2, weekIndex: 1, cycleNumber: 1 }, deloadEvenOnly);
  assert.deepEqual(cycleState, { dayIndex: 3, weekIndex: 1, cycleNumber: 1 });
  assert.equal(cycleCompleted, false);
});

function sessionWith(overrides) {
  return {
    id: "1", date: "2026-01-01T00:00:00.000Z", dayIndex: 2, weekIndex: 1, cycleNumber: 1,
    lift: "bench", completed: true, mainSets: [], supplementalSets: [], accessorySets: [], notes: "",
    ...overrides,
  };
}

test("accessoryHistory: max weight and average reps per session, only completed sets", () => {
  const logs = [
    sessionWith({
      date: "2026-01-01T00:00:00.000Z",
      accessorySets: [
        { exerciseName: "Standing banded knee raise", setIndex: 0, weight: 15, reps: 10, completed: true },
        { exerciseName: "Standing banded knee raise", setIndex: 1, weight: 20, reps: 8, completed: true },
        { exerciseName: "Standing banded knee raise", setIndex: 2, weight: 20, reps: 5, completed: false },
      ],
    }),
  ];
  const history = accessoryHistory(logs, "Standing banded knee raise");
  assert.equal(history.length, 1);
  assert.equal(history[0].weight, 20); // max of completed sets (15, 20), not the incomplete 20
  assert.equal(history[0].reps, 9); // avg of completed sets (10, 8) = 9
});

test("accessoryHistory: ignores sessions that didn't log the exercise, sorts oldest first", () => {
  const logs = [
    sessionWith({ date: "2026-01-10T00:00:00.000Z", accessorySets: [{ exerciseName: "Curls", setIndex: 0, weight: 30, reps: 12, completed: true }] }),
    sessionWith({ date: "2026-01-05T00:00:00.000Z", accessorySets: [{ exerciseName: "Standing banded knee raise", setIndex: 0, weight: 15, reps: 10, completed: true }] }),
  ];
  const history = accessoryHistory(logs, "Standing banded knee raise");
  assert.equal(history.length, 1);
  assert.equal(history[0].date, "2026-01-05T00:00:00.000Z");
});

test("accessoryHistory: counts a logged set even when the day's session was skipped, not completed", () => {
  const logs = [
    sessionWith({
      completed: false,
      accessorySets: [{ exerciseName: "Standing banded knee raise", setIndex: 0, weight: 15, reps: 10, completed: true }],
    }),
  ];
  const history = accessoryHistory(logs, "Standing banded knee raise");
  assert.equal(history.length, 1);
  assert.equal(history[0].weight, 15);
});

test("rehabAdherence: counts only sessions that actually had each block, independent of session.completed", () => {
  const logs = [
    sessionWith({ completed: true, dailyPsoas: [{ name: "A", completed: true }, { name: "B", completed: true }] }),
    sessionWith({ completed: false, dailyPsoas: [{ name: "A", completed: true }, { name: "B", completed: false }] }), // skipped lift, partial psoas
    sessionWith({ completed: true, shoulderRehabCompleted: true }),
    sessionWith({ completed: true, shoulderRehabCompleted: false }),
    sessionWith({ completed: true }), // no dailyPsoas, no shoulderRehabCompleted — predates the feature
  ];
  const result = rehabAdherence(logs);
  assert.equal(result.psoasTotal, 2);
  assert.equal(result.psoasDone, 1); // only the fully-checked one counts, even though its lift was skipped
  assert.equal(result.shoulderTotal, 2);
  assert.equal(result.shoulderDone, 1);
});

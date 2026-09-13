import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceCycle, effectiveWeekCount } from "./state.js";

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

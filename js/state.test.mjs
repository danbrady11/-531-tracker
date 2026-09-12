import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceCycle, effectiveWeekCount } from "./state.js";

const deloadOff = { deloadEveryOtherCycle: false };
const deloadAlternating = { deloadEveryOtherCycle: true };

test("effectiveWeekCount: always 4 when the setting is off", () => {
  assert.equal(effectiveWeekCount(1, deloadOff), 4);
  assert.equal(effectiveWeekCount(2, deloadOff), 4);
  assert.equal(effectiveWeekCount(7, deloadOff), 4);
});

test("effectiveWeekCount: odd cycles get 4 weeks, even cycles get 3, when alternating", () => {
  assert.equal(effectiveWeekCount(1, deloadAlternating), 4);
  assert.equal(effectiveWeekCount(2, deloadAlternating), 3);
  assert.equal(effectiveWeekCount(3, deloadAlternating), 4);
  assert.equal(effectiveWeekCount(4, deloadAlternating), 3);
});

test("advanceCycle: with deload off, week 4 always runs before the cycle completes", () => {
  let { cycleState, cycleCompleted } = advanceCycle({ dayIndex: 6, weekIndex: 3, cycleNumber: 1 }, deloadOff);
  assert.deepEqual(cycleState, { dayIndex: 1, weekIndex: 4, cycleNumber: 1 });
  assert.equal(cycleCompleted, false);

  ({ cycleState, cycleCompleted } = advanceCycle({ dayIndex: 6, weekIndex: 4, cycleNumber: 1 }, deloadOff));
  assert.deepEqual(cycleState, { dayIndex: 1, weekIndex: 1, cycleNumber: 2 });
  assert.equal(cycleCompleted, true);
});

test("advanceCycle: alternating — cycle 1 (odd) still gets a week 4 deload", () => {
  const { cycleState, cycleCompleted } = advanceCycle({ dayIndex: 6, weekIndex: 3, cycleNumber: 1 }, deloadAlternating);
  assert.deepEqual(cycleState, { dayIndex: 1, weekIndex: 4, cycleNumber: 1 });
  assert.equal(cycleCompleted, false);
});

test("advanceCycle: alternating — cycle 2 (even) skips week 4 and completes right after week 3", () => {
  const { cycleState, cycleCompleted } = advanceCycle({ dayIndex: 6, weekIndex: 3, cycleNumber: 2 }, deloadAlternating);
  assert.deepEqual(cycleState, { dayIndex: 1, weekIndex: 1, cycleNumber: 3 });
  assert.equal(cycleCompleted, true);
});

test("advanceCycle: alternating — cycle 3 (odd again) gets a week 4 deload too", () => {
  const { cycleState, cycleCompleted } = advanceCycle({ dayIndex: 6, weekIndex: 3, cycleNumber: 3 }, deloadAlternating);
  assert.deepEqual(cycleState, { dayIndex: 1, weekIndex: 4, cycleNumber: 3 });
  assert.equal(cycleCompleted, false);
});

test("advanceCycle: ordinary day-to-day advancement within a week is unaffected", () => {
  const { cycleState, cycleCompleted } = advanceCycle({ dayIndex: 2, weekIndex: 1, cycleNumber: 1 }, deloadAlternating);
  assert.deepEqual(cycleState, { dayIndex: 3, weekIndex: 1, cycleNumber: 1 });
  assert.equal(cycleCompleted, false);
});

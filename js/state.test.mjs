import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceCycle, effectiveWeekCount, newSessionLog, deriveCycleStateFromHistory, lastCompletedByLift, parseBulkWeightEntries } from "./state.js";

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

test("newSessionLog: a no-set-count accessory (Yoga, Zone 2) still gets exactly one checkable entry", () => {
  const session = newSessionLog(
    { dayIndex: 3, weekIndex: 1, cycleNumber: 1 },
    [], [],
    [{ name: "Yoga", sets: null, repsLabel: "" }, { name: "Zone 2", sets: null, repsLabel: "30 min" }]
  );
  const yoga = session.accessorySets.filter((s) => s.exerciseName === "Yoga");
  const zone2 = session.accessorySets.filter((s) => s.exerciseName === "Zone 2");
  assert.equal(yoga.length, 1);
  assert.equal(yoga[0].setIndex, 0);
  assert.equal(yoga[0].completed, false);
  assert.equal(zone2.length, 1);
});

test("newSessionLog: a normal accessory still gets one entry per set", () => {
  const session = newSessionLog(
    { dayIndex: 2, weekIndex: 1, cycleNumber: 1 },
    [], [],
    [{ name: "Curls", sets: 3, repsLabel: "12" }]
  );
  assert.equal(session.accessorySets.filter((s) => s.exerciseName === "Curls").length, 3);
});

function logAt(dayIndex, weekIndex, cycleNumber, date, completed) {
  return { id: `${date}-${dayIndex}`, date, dayIndex, weekIndex, cycleNumber, lift: null, completed, mainSets: [], supplementalSets: [], accessorySets: [], notes: "" };
}

test("deriveCycleStateFromHistory: no completed sessions falls back to day 1/week 1/cycle 1", () => {
  assert.deepEqual(deriveCycleStateFromHistory([], deloadEveryCycle), { dayIndex: 1, weekIndex: 1, cycleNumber: 1 });
  assert.deepEqual(deriveCycleStateFromHistory([logAt(3, 1, 1, "2026-01-01", false)], deloadEveryCycle), { dayIndex: 1, weekIndex: 1, cycleNumber: 1 });
});

test("deriveCycleStateFromHistory: one step past the most recent completed session, ignoring skips", () => {
  const logs = [
    logAt(4, 2, 1, "2026-01-01T00:00:00Z", true),
    logAt(5, 2, 1, "2026-01-02T00:00:00Z", false), // skipped — must not count
    logAt(6, 2, 1, "2026-01-03T00:00:00Z", true), // most recent completed
  ];
  assert.deepEqual(deriveCycleStateFromHistory(logs, deloadEveryCycle), { dayIndex: 1, weekIndex: 3, cycleNumber: 1 });
});

test("deriveCycleStateFromHistory: picks the most recent by date, not array order", () => {
  const logs = [
    logAt(2, 1, 1, "2026-01-10T00:00:00Z", true), // later date, earlier in array
    logAt(1, 1, 1, "2026-01-05T00:00:00Z", true),
  ];
  assert.deepEqual(deriveCycleStateFromHistory(logs, deloadEveryCycle), { dayIndex: 3, weekIndex: 1, cycleNumber: 1 });
});

test("deriveCycleStateFromHistory: completing day 6 of the last week of an odd cycle rolls into the next cycle (deload-even-only)", () => {
  const logs = [logAt(6, 3, 1, "2026-01-01T00:00:00Z", true)];
  assert.deepEqual(deriveCycleStateFromHistory(logs, deloadEvenOnly), { dayIndex: 1, weekIndex: 1, cycleNumber: 2 });
});

function logWithLift(lift, weekIndex, cycleNumber, date, completed) {
  return { id: `${lift}-${date}`, date, dayIndex: 1, weekIndex, cycleNumber, lift, completed, mainSets: [], supplementalSets: [], accessorySets: [], notes: "" };
}

test("lastCompletedByLift: reports each lift's most recent completed cycle/week", () => {
  const logs = [
    logWithLift("bench", 1, 1, "2026-01-01T00:00:00Z", true),
    logWithLift("bench", 2, 2, "2026-01-08T00:00:00Z", true), // most recent bench
    logWithLift("squat", 1, 1, "2026-01-02T00:00:00Z", true),
  ];
  const result = lastCompletedByLift(logs);
  assert.deepEqual(result.bench, { cycleNumber: 2, weekIndex: 2, date: "2026-01-08T00:00:00Z" });
  assert.deepEqual(result.squat, { cycleNumber: 1, weekIndex: 1, date: "2026-01-02T00:00:00Z" });
  assert.equal(result.press, undefined);
});

test("lastCompletedByLift: ignores skipped sessions and picks the most recent by date, not array order", () => {
  const logs = [
    logWithLift("press", 3, 1, "2026-01-10T00:00:00Z", true), // later date, earlier in array
    logWithLift("press", 4, 2, "2026-01-15T00:00:00Z", false), // more recent but skipped — must not count
    logWithLift("press", 1, 1, "2026-01-01T00:00:00Z", true),
  ];
  assert.deepEqual(lastCompletedByLift(logs), { press: { cycleNumber: 1, weekIndex: 3, date: "2026-01-10T00:00:00Z" } });
});

test("parseBulkWeightEntries: parses one 'YYYY-MM-DD weight' entry per line", () => {
  const entries = parseBulkWeightEntries("2026-09-01 223.8\n2026-09-19 230.2");
  assert.equal(entries.length, 2);
  assert.equal(entries[0].weight, 223.8);
  assert.equal(new Date(entries[0].date).toISOString().slice(0, 10), "2026-09-01");
  assert.equal(entries[1].weight, 230.2);
});

test("parseBulkWeightEntries: skips blank lines and unparseable garbage without throwing", () => {
  const entries = parseBulkWeightEntries("2026-09-01 223.8\n\n   \nnot a valid line\n2026-09-02 225");
  assert.equal(entries.length, 2);
  assert.equal(entries[1].weight, 225);
});

test("parseBulkWeightEntries: empty input returns an empty array", () => {
  assert.deepEqual(parseBulkWeightEntries(""), []);
});

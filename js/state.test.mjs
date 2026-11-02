import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceCycle, advanceWeek, effectiveWeekCount, newSessionLog, deriveCycleStateFromHistory, lastCompletedByLift, parseBulkWeightEntries, accessoryRepVolumeSeries, tooSoonForLegsDay, WEEK_ADVANCE_LIFTS } from "./state.js";

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

test("advanceWeek: with the setting off, week 4 always runs before the cycle completes", () => {
  assert.deepEqual(advanceWeek(3, 1, deloadEveryCycle), { weekIndex: 4, cycleNumber: 1 });
  assert.deepEqual(advanceWeek(4, 1, deloadEveryCycle), { weekIndex: 1, cycleNumber: 2 });
});

test("advanceWeek: even-only — an odd cycle wraps straight to the next cycle after week 3", () => {
  assert.deepEqual(advanceWeek(3, 1, deloadEvenOnly), { weekIndex: 1, cycleNumber: 2 });
});

test("advanceWeek: even-only — an even cycle still gets a week 4 deload", () => {
  assert.deepEqual(advanceWeek(3, 2, deloadEvenOnly), { weekIndex: 4, cycleNumber: 2 });
});

test("advanceCycle: the day pointer rotates every call regardless of completedLift — Pull days (no lift) never touch week/cycle", () => {
  let { cycleState, cycleCompleted } = advanceCycle({ dayIndex: 1, weekIndex: 1, cycleNumber: 1, mainLiftsCompleted: [] }, deloadEvenOnly);
  assert.deepEqual(cycleState, { dayIndex: 2, weekIndex: 1, cycleNumber: 1, mainLiftsCompleted: [] });
  assert.equal(cycleCompleted, false);

  // Explicitly completing a Pull day (no main lift) behaves identically —
  // the day still rotates, week/cycle/mainLiftsCompleted are untouched.
  ({ cycleState, cycleCompleted } = advanceCycle({ dayIndex: 4, weekIndex: 1, cycleNumber: 1, mainLiftsCompleted: ["bench"] }, deloadEvenOnly, null, null));
  assert.deepEqual(cycleState, { dayIndex: 5, weekIndex: 1, cycleNumber: 1, mainLiftsCompleted: ["bench"] });
  assert.equal(cycleCompleted, false);

  // Wraps day 6 -> day 1 same as any other day, still no week/cycle effect
  // without a completedLift.
  ({ cycleState, cycleCompleted } = advanceCycle({ dayIndex: 6, weekIndex: 1, cycleNumber: 1, mainLiftsCompleted: [] }, deloadEvenOnly));
  assert.deepEqual(cycleState, { dayIndex: 1, weekIndex: 1, cycleNumber: 1, mainLiftsCompleted: [] });
});

test("advanceCycle: completing a main lift accumulates in mainLiftsCompleted, deduped, without advancing the week until all four", () => {
  let state = { dayIndex: 2, weekIndex: 1, cycleNumber: 1, mainLiftsCompleted: [] };
  let result = advanceCycle(state, deloadEvenOnly, null, "bench");
  assert.deepEqual(result.cycleState, { dayIndex: 3, weekIndex: 1, cycleNumber: 1, mainLiftsCompleted: ["bench"] });
  assert.equal(result.cycleCompleted, false);

  result = advanceCycle(result.cycleState, deloadEvenOnly, null, "squat");
  assert.deepEqual(result.cycleState.mainLiftsCompleted, ["bench", "squat"]);
  assert.equal(result.cycleState.weekIndex, 1);

  // Redoing bench before the week is done doesn't double-count or advance early.
  result = advanceCycle(result.cycleState, deloadEvenOnly, null, "bench");
  assert.deepEqual(result.cycleState.mainLiftsCompleted, ["bench", "squat"]);
  assert.equal(result.cycleState.weekIndex, 1);

  result = advanceCycle(result.cycleState, deloadEvenOnly, null, "press");
  assert.deepEqual(result.cycleState.mainLiftsCompleted, ["bench", "squat", "press"]);
  assert.equal(result.cycleState.weekIndex, 1);

  // The fourth distinct lift completes the week: mainLiftsCompleted resets,
  // weekIndex advances (cycle 1 is odd, so this is week 1 -> 2, not complete).
  result = advanceCycle(result.cycleState, deloadEvenOnly, null, "deadlift");
  assert.deepEqual(result.cycleState.mainLiftsCompleted, []);
  assert.equal(result.cycleState.weekIndex, 2);
  assert.equal(result.cycleCompleted, false);
});

test("advanceCycle: the four main lifts can be completed in any order and still advance the week", () => {
  let state = { dayIndex: 1, weekIndex: 1, cycleNumber: 1, mainLiftsCompleted: [] };
  for (const lift of ["deadlift", "bench", "press"]) {
    ({ cycleState: state } = advanceCycle(state, deloadEvenOnly, null, lift));
  }
  assert.equal(state.weekIndex, 1);
  const result = advanceCycle(state, deloadEvenOnly, null, "squat");
  assert.equal(result.cycleState.weekIndex, 2);
  assert.deepEqual(result.cycleState.mainLiftsCompleted, []);
});

test("advanceCycle: the fourth lift completing an odd cycle's week 3 rolls straight into the next cycle", () => {
  let state = { dayIndex: 1, weekIndex: 3, cycleNumber: 1, mainLiftsCompleted: ["bench", "squat", "press"] };
  const result = advanceCycle(state, deloadEvenOnly, null, "deadlift");
  assert.deepEqual(result.cycleState, { dayIndex: 2, weekIndex: 1, cycleNumber: 2, mainLiftsCompleted: [] });
  assert.equal(result.cycleCompleted, true);
});

test("advanceCycle: the fourth lift completing an even cycle's week 3 runs its week 4 deload instead of completing", () => {
  let state = { dayIndex: 1, weekIndex: 3, cycleNumber: 2, mainLiftsCompleted: ["bench", "squat", "press"] };
  const result = advanceCycle(state, deloadEvenOnly, null, "deadlift");
  assert.deepEqual(result.cycleState, { dayIndex: 2, weekIndex: 4, cycleNumber: 2, mainLiftsCompleted: [] });
  assert.equal(result.cycleCompleted, false);
});

test("advanceCycle: a deload override still applies to the main-lift-gated week advance", () => {
  // True override: odd cycle still reaches week 4 instead of completing after week 3.
  let state = { dayIndex: 1, weekIndex: 3, cycleNumber: 1, mainLiftsCompleted: ["bench", "squat", "press"] };
  let result = advanceCycle(state, deloadEvenOnly, true, "deadlift");
  assert.deepEqual(result.cycleState, { dayIndex: 2, weekIndex: 4, cycleNumber: 1, mainLiftsCompleted: [] });
  assert.equal(result.cycleCompleted, false);

  // False override: even cycle completes after week 3 instead of running week 4.
  state = { dayIndex: 1, weekIndex: 3, cycleNumber: 2, mainLiftsCompleted: ["bench", "squat", "press"] };
  result = advanceCycle(state, deloadEvenOnly, false, "deadlift");
  assert.deepEqual(result.cycleState, { dayIndex: 2, weekIndex: 1, cycleNumber: 3, mainLiftsCompleted: [] });
  assert.equal(result.cycleCompleted, true);
});

test("advanceCycle: WEEK_ADVANCE_LIFTS is exactly the four main lifts", () => {
  assert.deepEqual(WEEK_ADVANCE_LIFTS, ["bench", "squat", "press", "deadlift"]);
});

test("effectiveWeekCount: a deloadOverride of true forces 4 weeks even on an odd (rule-says-3) cycle", () => {
  assert.equal(effectiveWeekCount(1, deloadEvenOnly, true), 4);
});

test("effectiveWeekCount: a deloadOverride of false forces 3 weeks even on an even (rule-says-4) cycle", () => {
  assert.equal(effectiveWeekCount(2, deloadEvenOnly, false), 3);
});

test("effectiveWeekCount: deloadOverride of null (or omitted) defers to the settings-based rule", () => {
  assert.equal(effectiveWeekCount(1, deloadEvenOnly, null), 3);
  assert.equal(effectiveWeekCount(2, deloadEvenOnly), 4);
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

test("newSessionLog: an accessory with variants logs under its default (first) variant, never the generic slot name", () => {
  const session = newSessionLog(
    { dayIndex: 3, weekIndex: 1, cycleNumber: 1 },
    [], [],
    [{ name: "Calf raise", sets: 5, repsLabel: "15", variants: ["Standing calf raise", "Seated calf raise"] }]
  );
  assert.equal(session.accessorySets.filter((s) => s.exerciseName === "Standing calf raise").length, 5);
  assert.equal(session.accessorySets.some((s) => s.exerciseName === "Calf raise"), false);
});

function logAt(dayIndex, weekIndex, cycleNumber, date, completed) {
  return { id: `${date}-${dayIndex}`, date, dayIndex, weekIndex, cycleNumber, lift: null, completed, mainSets: [], supplementalSets: [], accessorySets: [], notes: "" };
}

test("deriveCycleStateFromHistory: no completed sessions falls back to day 1/week 1/cycle 1", () => {
  assert.deepEqual(deriveCycleStateFromHistory([], deloadEveryCycle), { dayIndex: 1, weekIndex: 1, cycleNumber: 1, mainLiftsCompleted: [] });
  assert.deepEqual(deriveCycleStateFromHistory([logAt(3, 1, 1, "2026-01-01", false)], deloadEveryCycle), {
    dayIndex: 1,
    weekIndex: 1,
    cycleNumber: 1,
    mainLiftsCompleted: [],
  });
});

test("deriveCycleStateFromHistory: day rotates one step past the most recent completed session, ignoring skips — week/cycle just carry over (no completedLift to reconstruct a partial week from)", () => {
  const logs = [
    logAt(4, 2, 1, "2026-01-01T00:00:00Z", true),
    logAt(5, 2, 1, "2026-01-02T00:00:00Z", false), // skipped — must not count
    logAt(6, 2, 1, "2026-01-03T00:00:00Z", true), // most recent completed
  ];
  assert.deepEqual(deriveCycleStateFromHistory(logs, deloadEveryCycle), { dayIndex: 1, weekIndex: 2, cycleNumber: 1, mainLiftsCompleted: [] });
});

test("deriveCycleStateFromHistory: picks the most recent by date, not array order", () => {
  const logs = [
    logAt(2, 1, 1, "2026-01-10T00:00:00Z", true), // later date, earlier in array
    logAt(1, 1, 1, "2026-01-05T00:00:00Z", true),
  ];
  assert.deepEqual(deriveCycleStateFromHistory(logs, deloadEveryCycle), { dayIndex: 3, weekIndex: 1, cycleNumber: 1, mainLiftsCompleted: [] });
});

test("deriveCycleStateFromHistory: never auto-completes a cycle on its own — week/cycle number are carried over unchanged even from the last day of a cycle's last week", () => {
  const logs = [logAt(6, 3, 1, "2026-01-01T00:00:00Z", true)];
  assert.deepEqual(deriveCycleStateFromHistory(logs, deloadEvenOnly), { dayIndex: 1, weekIndex: 3, cycleNumber: 1, mainLiftsCompleted: [] });
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

function legsSessionAt(date, lift, completed = true) {
  return { id: date, date, dayIndex: 6, weekIndex: 1, cycleNumber: 1, lift, completed, mainSets: [], supplementalSets: [], accessorySets: [], notes: "" };
}

test("tooSoonForLegsDay: false when the day in question isn't squat or deadlift", () => {
  const logs = [legsSessionAt("2026-01-01T00:00:00Z", "squat")];
  const now = new Date("2026-01-01T12:00:00Z");
  assert.equal(tooSoonForLegsDay(logs, "bench", now), false);
  assert.equal(tooSoonForLegsDay(logs, null, now), false);
});

test("tooSoonForLegsDay: false when there's no prior completed Legs session at all", () => {
  assert.equal(tooSoonForLegsDay([], "squat", new Date()), false);
  const skippedOnly = [legsSessionAt("2026-01-01T00:00:00Z", "deadlift", false)];
  assert.equal(tooSoonForLegsDay(skippedOnly, "squat", new Date("2026-01-02T00:00:00Z")), false);
});

test("tooSoonForLegsDay: true when fewer than 3 full days have passed since the last completed squat or deadlift session", () => {
  const logs = [legsSessionAt("2026-01-01T00:00:00Z", "squat")];
  assert.equal(tooSoonForLegsDay(logs, "deadlift", new Date("2026-01-02T00:00:00Z")), true); // 1 day
  assert.equal(tooSoonForLegsDay(logs, "deadlift", new Date("2026-01-03T23:00:00Z")), true); // just under 3 days
});

test("tooSoonForLegsDay: false once 3 full days have passed", () => {
  const logs = [legsSessionAt("2026-01-01T00:00:00Z", "squat")];
  assert.equal(tooSoonForLegsDay(logs, "deadlift", new Date("2026-01-04T00:00:01Z")), false);
});

test("tooSoonForLegsDay: uses whichever of squat/deadlift was most recent, picks the latest by date not array order", () => {
  const logs = [
    legsSessionAt("2026-01-05T00:00:00Z", "deadlift"), // most recent
    legsSessionAt("2026-01-01T00:00:00Z", "squat"),
  ];
  assert.equal(tooSoonForLegsDay(logs, "squat", new Date("2026-01-06T00:00:00Z")), true); // 1 day since the deadlift session
});

test("tooSoonForLegsDay: works the same for an old session logged under a since-retired day structure (lift-based, not day-structure-based)", () => {
  const oldLog = { id: "1", date: "2026-01-01T00:00:00Z", dayIndex: 11, weekIndex: 1, cycleNumber: 1, lift: "squat", completed: true, mainSets: [], supplementalSets: [], accessorySets: [], notes: "" };
  assert.equal(tooSoonForLegsDay([oldLog], "deadlift", new Date("2026-01-02T00:00:00Z")), true);
});


function pullupChinupSession({ weekIndex, cycleNumber, exerciseName, reps }) {
  return sessionWith({
    weekIndex,
    cycleNumber,
    accessorySets: reps.map((r, i) => ({ exerciseName, setIndex: i, weight: null, reps: r, completed: true })),
  });
}

test("accessoryRepVolumeSeries: sums all of a session's sets for the named exercise, not just one", () => {
  const logs = [pullupChinupSession({ weekIndex: 1, cycleNumber: 1, exerciseName: "Pull-ups (weighted)", reps: [8, 7, 6, 5] })];
  const { xLabels, series } = accessoryRepVolumeSeries(logs, ["Pull-ups (weighted)", "Chin-ups"]);
  assert.deepEqual(xLabels, ["C1W1"]);
  const pullups = series.find((s) => s.name === "Pull-ups (weighted)");
  assert.deepEqual(pullups.values, [26]);
});

test("accessoryRepVolumeSeries: tracks Pull-ups and Chin-ups as separate series aligned on a shared week axis", () => {
  const logs = [
    pullupChinupSession({ weekIndex: 1, cycleNumber: 1, exerciseName: "Pull-ups (weighted)", reps: [8, 7] }),
    pullupChinupSession({ weekIndex: 3, cycleNumber: 1, exerciseName: "Chin-ups", reps: [10, 9, 8] }),
  ];
  const { xLabels, series } = accessoryRepVolumeSeries(logs, ["Pull-ups (weighted)", "Chin-ups"]);
  assert.deepEqual(xLabels, ["C1W1", "C1W3"]);
  const pullups = series.find((s) => s.name === "Pull-ups (weighted)");
  const chinups = series.find((s) => s.name === "Chin-ups");
  assert.deepEqual(pullups.values, [15, null]);
  assert.deepEqual(chinups.values, [null, 27]);
});

test("accessoryRepVolumeSeries: ignores incomplete sets and skipped sessions", () => {
  const logs = [
    sessionWith({
      weekIndex: 1,
      cycleNumber: 1,
      accessorySets: [
        { exerciseName: "Chin-ups", setIndex: 0, weight: null, reps: 10, completed: true },
        { exerciseName: "Chin-ups", setIndex: 1, weight: null, reps: 8, completed: false },
      ],
    }),
    sessionWith({ weekIndex: 2, cycleNumber: 1, completed: false, accessorySets: [{ exerciseName: "Chin-ups", setIndex: 0, weight: null, reps: 12, completed: true }] }),
  ];
  const { xLabels, series } = accessoryRepVolumeSeries(logs, ["Chin-ups"]);
  assert.deepEqual(xLabels, ["C1W1"]);
  assert.deepEqual(series.find((s) => s.name === "Chin-ups").values, [10]);
});

test("accessoryRepVolumeSeries: returns empty series when neither exercise has any history", () => {
  const { xLabels, series } = accessoryRepVolumeSeries([], ["Pull-ups (weighted)", "Chin-ups"]);
  assert.deepEqual(xLabels, []);
  assert.deepEqual(series.map((s) => s.values), [[], []]);
});

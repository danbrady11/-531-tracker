import { test } from "node:test";
import assert from "node:assert/strict";
import { accessoryDefFor, restCategoryFor, dayInfo, DAY_COUNT } from "./program.js";

test("the program is a 6-session Push/Pull/Legs rotation", () => {
  assert.equal(DAY_COUNT, 6);
});

test("the six days are Pull A, Push A, Legs A, Pull B, Push B, Legs B in order", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((i) => dayInfo(i).name), ["Pull A", "Push A", "Legs A", "Pull B", "Push B", "Legs B"]);
});

test("Pull A and Pull B have no main lift or supplemental (kind accessory)", () => {
  for (const dayIndex of [1, 4]) {
    const day = dayInfo(dayIndex);
    assert.equal(day.kind, "accessory", `day ${dayIndex}`);
    assert.equal(day.lift, null, `day ${dayIndex}`);
    assert.equal(day.supplemental, null, `day ${dayIndex}`);
  }
});

test("Push A (2): main bench, BBB 3x10, DB flat press alt 3x10", () => {
  const day = dayInfo(2);
  assert.equal(day.kind, "main");
  assert.equal(day.lift, "bench");
  assert.equal(day.supplemental, "bbb");
  assert.deepEqual(day.supplementalConfig, { sets: 3, targetReps: 10 });
  assert.deepEqual(day.supplementalAlt, { type: "dbFlatPress", label: "DB flat press", sets: 3, targetReps: 10 });
});

test("Legs A (3): main squat, BBB 3x10, Belt squat alt 3x10", () => {
  const day = dayInfo(3);
  assert.equal(day.kind, "main");
  assert.equal(day.lift, "squat");
  assert.equal(day.supplemental, "bbb");
  assert.deepEqual(day.supplementalConfig, { sets: 3, targetReps: 10 });
  assert.deepEqual(day.supplementalAlt, { type: "beltSquat", label: "Belt squat", sets: 3, targetReps: 10 });
});

test("Push B (5): main press, BBB 3x10, Seated DB press alt 3x10", () => {
  const day = dayInfo(5);
  assert.equal(day.kind, "main");
  assert.equal(day.lift, "press");
  assert.equal(day.supplemental, "bbb");
  assert.deepEqual(day.supplementalConfig, { sets: 3, targetReps: 10 });
  assert.deepEqual(day.supplementalAlt, { type: "seatedDbPress", label: "Seated DB press", sets: 3, targetReps: 10 });
});

test("Legs B (6): main deadlift, Back-off 2x5 (no BBB, no alt)", () => {
  const day = dayInfo(6);
  assert.equal(day.kind, "main");
  assert.equal(day.lift, "deadlift");
  assert.equal(day.supplemental, "backoff");
  assert.deepEqual(day.supplementalConfig, { sets: 2, targetReps: 5 });
  assert.equal(day.supplementalAlt, undefined);
});

test("no accessory anywhere in the live program has a supersetRole", () => {
  for (const dayIndex of [1, 2, 3, 4, 5, 6]) {
    for (const accessory of dayInfo(dayIndex).accessories) {
      assert.equal(accessory.supersetRole, undefined, `day ${dayIndex} ${accessory.name}`);
    }
  }
});

test("restCategoryFor: the global compound list applies by exercise name, no per-entry tagging needed", () => {
  const compoundExamples = [
    [1, "Weighted pull-ups"],
    [4, "Chin-ups"],
    [1, "Seated cable row (wide/neutral)"],
    [4, "Seated cable row (close grip)"],
    [1, "Lat pulldown (wide grip)"],
    [4, "Lat pulldown (close/neutral grip)"],
    [1, "Straight-arm pulldown"],
    [2, "Incline barbell press"],
    [2, "Dips (bodyweight)"],
    [5, "Close-grip bench press"],
    [5, "Machine chest press"],
    [3, "RDL"],
    [6, "Hip thrust"],
    [6, "Bulgarian split squat"],
  ];
  for (const [dayIndex, name] of compoundExamples) {
    const def = accessoryDefFor(dayIndex, name);
    assert.ok(def, `${name} should be defined on day ${dayIndex}`);
    assert.equal(restCategoryFor(def), "compound", `${name} on day ${dayIndex}`);
  }

  const isolationExamples = [
    [3, "Leg extension"],
    [3, "Machine leg curl"],
    [3, "Standing calf raise"],
    [6, "Seated calf raise"],
    [1, "Lateral raise"],
    [1, "Reverse pec deck / cable reverse fly"],
    [1, "Curls"],
    [4, "Shrugs (straps)"],
    [4, "Hammer curls"],
    [4, "Incline DB curl"],
    [2, "Cable fly (mid-height)"],
    [2, "Cable rope overhead extension"],
    [3, "Cable crunch"],
    [5, "Rope pushdown"],
  ];
  for (const [dayIndex, name] of isolationExamples) {
    const def = accessoryDefFor(dayIndex, name);
    assert.ok(def, `${name} should be defined on day ${dayIndex}`);
    assert.equal(restCategoryFor(def), "isolation", `${name} on day ${dayIndex}`);
  }
});

test("Pull A (1): full exercise list in order", () => {
  const names = dayInfo(1).accessories.map((a) => a.name);
  assert.deepEqual(names, [
    "Weighted pull-ups",
    "Seated cable row (wide/neutral)",
    "Lat pulldown (wide grip)",
    "Straight-arm pulldown",
    "Reverse pec deck / cable reverse fly",
    "Lateral raise",
    "Curls",
  ]);
  assert.equal(accessoryDefFor(1, "Weighted pull-ups").sets, 4);
  assert.equal(accessoryDefFor(1, "Weighted pull-ups").repsLabel, "6–10");
  assert.equal(accessoryDefFor(1, "Seated cable row (wide/neutral)").sets, 4);
  assert.equal(accessoryDefFor(1, "Seated cable row (wide/neutral)").repsLabel, "8–12");
  assert.equal(accessoryDefFor(1, "Lat pulldown (wide grip)").sets, 3);
  assert.equal(accessoryDefFor(1, "Lat pulldown (wide grip)").repsLabel, "10–12");
  assert.equal(accessoryDefFor(1, "Straight-arm pulldown").sets, 3);
  assert.equal(accessoryDefFor(1, "Straight-arm pulldown").repsLabel, "12–15");
  assert.equal(accessoryDefFor(1, "Reverse pec deck / cable reverse fly").sets, 4);
  assert.equal(accessoryDefFor(1, "Reverse pec deck / cable reverse fly").repsLabel, "15–20");
  assert.equal(accessoryDefFor(1, "Lateral raise").sets, 4);
  assert.equal(accessoryDefFor(1, "Lateral raise").repsLabel, "12–20");
  assert.equal(accessoryDefFor(1, "Curls").sets, 4);
  assert.equal(accessoryDefFor(1, "Curls").repsLabel, "10–15");
});

test("Push A (2): full exercise list in order", () => {
  const names = dayInfo(2).accessories.map((a) => a.name);
  assert.deepEqual(names, ["Incline barbell press", "Dips (bodyweight)", "Cable fly (mid-height)", "Cable rope overhead extension"]);
  assert.equal(accessoryDefFor(2, "Incline barbell press").sets, 3);
  assert.equal(accessoryDefFor(2, "Incline barbell press").repsLabel, "8–10");
  const dips = accessoryDefFor(2, "Dips (bodyweight)");
  assert.equal(dips.sets, 3);
  assert.equal(dips.repsLabel, "", "no rep target — logged freely, like Chin-ups' old AMRAP style");
  assert.equal(accessoryDefFor(2, "Cable fly (mid-height)").sets, 3);
  assert.equal(accessoryDefFor(2, "Cable fly (mid-height)").repsLabel, "12–15");
  const ropeExt = accessoryDefFor(2, "Cable rope overhead extension");
  assert.equal(ropeExt.sets, 3);
  assert.equal(ropeExt.repsLabel, "10–15");
  assert.equal(ropeExt.cue, "facing away from the stack, slight forward lean, rope split at the top");
});

test("Legs A (3): full exercise list in order", () => {
  const names = dayInfo(3).accessories.map((a) => a.name);
  assert.deepEqual(names, ["RDL", "Leg extension", "Machine leg curl", "Standing calf raise", "Lateral raise", "Cable crunch"]);
  assert.equal(accessoryDefFor(3, "RDL").sets, 3);
  assert.equal(accessoryDefFor(3, "RDL").repsLabel, "8–10");
  const legExt = accessoryDefFor(3, "Leg extension");
  assert.equal(legExt.sets, 4);
  assert.equal(legExt.repsLabel, "12–15");
  assert.equal(legExt.cue, "Pause at the top, lower slowly.");
  assert.equal(accessoryDefFor(3, "Machine leg curl").sets, 3);
  assert.equal(accessoryDefFor(3, "Machine leg curl").repsLabel, "10–12");
  assert.equal(accessoryDefFor(3, "Standing calf raise").sets, 4);
  assert.equal(accessoryDefFor(3, "Standing calf raise").repsLabel, "12–15");
  assert.equal(accessoryDefFor(3, "Lateral raise").sets, 4);
  assert.equal(accessoryDefFor(3, "Lateral raise").repsLabel, "12–20");
  assert.equal(accessoryDefFor(3, "Cable crunch").sets, 3);
  assert.equal(accessoryDefFor(3, "Cable crunch").repsLabel, "10–15");
});

test("Pull B (4): full exercise list in order", () => {
  const names = dayInfo(4).accessories.map((a) => a.name);
  assert.deepEqual(names, [
    "Chin-ups",
    "Seated cable row (close grip)",
    "Lat pulldown (close/neutral grip)",
    "Shrugs (straps)",
    "Reverse pec deck / cable reverse fly",
    "Lateral raise",
    "Hammer curls",
    "Incline DB curl",
  ]);
  const chinUps = accessoryDefFor(4, "Chin-ups");
  assert.equal(chinUps.sets, 4);
  assert.equal(chinUps.repsLabel, "6–12");
  assert.equal(accessoryDefFor(4, "Seated cable row (close grip)").sets, 4);
  assert.equal(accessoryDefFor(4, "Seated cable row (close grip)").repsLabel, "10–12");
  assert.equal(accessoryDefFor(4, "Lat pulldown (close/neutral grip)").sets, 3);
  assert.equal(accessoryDefFor(4, "Lat pulldown (close/neutral grip)").repsLabel, "10–12");
  assert.equal(accessoryDefFor(4, "Shrugs (straps)").sets, 3);
  assert.equal(accessoryDefFor(4, "Shrugs (straps)").repsLabel, "12–15");
  assert.equal(accessoryDefFor(4, "Reverse pec deck / cable reverse fly").sets, 3);
  assert.equal(accessoryDefFor(4, "Reverse pec deck / cable reverse fly").repsLabel, "15–20");
  assert.equal(accessoryDefFor(4, "Lateral raise").sets, 4);
  assert.equal(accessoryDefFor(4, "Lateral raise").repsLabel, "12–20");
  assert.equal(accessoryDefFor(4, "Hammer curls").sets, 3);
  assert.equal(accessoryDefFor(4, "Hammer curls").repsLabel, "10–15");
  assert.equal(accessoryDefFor(4, "Incline DB curl").sets, 3);
  assert.equal(accessoryDefFor(4, "Incline DB curl").repsLabel, "10–12");
});

test("Push B (5): full exercise list in order", () => {
  const names = dayInfo(5).accessories.map((a) => a.name);
  assert.deepEqual(names, ["Close-grip bench press", "Machine chest press", "Dips (bodyweight)", "Rope pushdown"]);
  assert.equal(accessoryDefFor(5, "Close-grip bench press").sets, 3);
  assert.equal(accessoryDefFor(5, "Close-grip bench press").repsLabel, "8–10");
  assert.equal(accessoryDefFor(5, "Machine chest press").sets, 3);
  assert.equal(accessoryDefFor(5, "Machine chest press").repsLabel, "10–15");
  const dips = accessoryDefFor(5, "Dips (bodyweight)");
  assert.equal(dips.sets, 3);
  assert.equal(dips.repsLabel, "");
  assert.equal(accessoryDefFor(5, "Rope pushdown").sets, 3);
  assert.equal(accessoryDefFor(5, "Rope pushdown").repsLabel, "10–15");
});

test("Legs B (6): full exercise list in order", () => {
  const names = dayInfo(6).accessories.map((a) => a.name);
  assert.deepEqual(names, ["Hip thrust", "Bulgarian split squat", "Machine leg curl", "Leg extension", "Seated calf raise", "Lateral raise", "Cable crunch"]);
  assert.equal(accessoryDefFor(6, "Hip thrust").sets, 3);
  assert.equal(accessoryDefFor(6, "Hip thrust").repsLabel, "8–12");
  assert.equal(accessoryDefFor(6, "Bulgarian split squat").sets, 3);
  assert.equal(accessoryDefFor(6, "Bulgarian split squat").repsLabel, "8–12/leg");
  assert.equal(accessoryDefFor(6, "Machine leg curl").sets, 3);
  assert.equal(accessoryDefFor(6, "Machine leg curl").repsLabel, "10–12");
  const legExt = accessoryDefFor(6, "Leg extension");
  assert.equal(legExt.sets, 3);
  assert.equal(legExt.repsLabel, "12–15");
  assert.equal(legExt.cue, "Pause at the top, lower slowly.");
  assert.equal(accessoryDefFor(6, "Seated calf raise").sets, 4);
  assert.equal(accessoryDefFor(6, "Seated calf raise").repsLabel, "12–20");
  assert.equal(accessoryDefFor(6, "Lateral raise").sets, 4);
  assert.equal(accessoryDefFor(6, "Lateral raise").repsLabel, "12–20");
  assert.equal(accessoryDefFor(6, "Cable crunch").sets, 3);
  assert.equal(accessoryDefFor(6, "Cable crunch").repsLabel, "10–15");
});

test("legacy slot 9 holds the frozen Recovery day (moved from the old slot 6, now live as Legs B)", () => {
  const legacy = dayInfo(9);
  assert.equal(legacy.name, "Recovery");
  assert.equal(legacy.kind, "recovery");
});

test("legacy slots 7 and 8 still hold the two frozen Accessory-day definitions, unchanged", () => {
  assert.equal(dayInfo(7).name, "Accessory");
  assert.deepEqual(dayInfo(7).accessories.map((a) => a.name), [
    "Incline barbell press",
    "Hex press",
    "Seated cable row (close grip)",
    "Lat pulldown",
    "Straight-arm pulldown",
    "Lateral raise",
    "Reverse pec deck / cable reverse fly",
  ]);
  assert.equal(dayInfo(8).name, "Accessory");
  assert.deepEqual(dayInfo(8).accessories.map((a) => a.name), [
    "Leg press",
    "Seated leg curl",
    "Standing calf raise",
    "Pec deck",
    "Lateral raise",
    "Reverse pec deck / cable reverse fly",
    "Hammer curls",
    "Cable crunch",
  ]);
});

test("legacy slots 10-13 hold the frozen single-lift-per-day rotation (Bench/Squat/Press/Deadlift)", () => {
  assert.equal(dayInfo(10).name, "Bench");
  assert.equal(dayInfo(10).lift, "bench");
  assert.equal(dayInfo(11).name, "Squat");
  assert.equal(dayInfo(11).lift, "squat");
  assert.equal(dayInfo(12).name, "Press");
  assert.equal(dayInfo(12).lift, "press");
  assert.equal(dayInfo(13).name, "Deadlift");
  assert.equal(dayInfo(13).lift, "deadlift");
  assert.equal(dayInfo(13).supplemental, null);
  // Frozen old restCategory tags and supersetRole still intact on these —
  // they predate the new global compound list and are display-only now.
  assert.equal(accessoryDefFor(10, "Pull-ups (weighted)").restCategory, "compound");
  assert.equal(accessoryDefFor(10, "Lateral raise").supersetRole, "a");
});

test("dayInfo returns undefined past the reserved legacy range", () => {
  assert.equal(dayInfo(14), undefined);
});

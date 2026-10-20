import { test } from "node:test";
import assert from "node:assert/strict";
import { accessoryDefFor, restCategoryFor, dayInfo, DAY_COUNT } from "./program.js";

test("the program is a 4-day cycle", () => {
  assert.equal(DAY_COUNT, 4);
});

test("accessoryDefFor finds a fixed accessory on the given day", () => {
  const def = accessoryDefFor(2, "RDL"); // Squat day
  assert.equal(def?.name, "RDL");
  assert.equal(def?.restCategory, "compound");
});

test("accessoryDefFor returns null for an ad hoc exercise not defined anywhere on that day", () => {
  assert.equal(accessoryDefFor(2, "Face pulls (optional)"), null);
});

test("restCategoryFor returns the tagged category when set", () => {
  assert.equal(restCategoryFor({ restCategory: "compound" }), "compound");
});

test("restCategoryFor defaults to isolation when untagged or missing", () => {
  assert.equal(restCategoryFor({ name: "Curls" }), "isolation");
  assert.equal(restCategoryFor(null), "isolation");
});

test("Lateral raise / Reverse pec deck are a superset pair on Squat and Bench; Deadlift and Press no longer have it", () => {
  for (const dayIndex of [1, 2]) {
    const lateral = accessoryDefFor(dayIndex, "Lateral raise");
    const reverseFly = accessoryDefFor(dayIndex, "Reverse pec deck / cable reverse fly");
    assert.equal(lateral?.supersetRole, "a", `day ${dayIndex} Lateral raise`);
    assert.equal(reverseFly?.supersetRole, "b", `day ${dayIndex} Reverse pec deck / cable reverse fly`);
  }
  for (const dayIndex of [3, 4]) {
    assert.equal(accessoryDefFor(dayIndex, "Lateral raise"), null, `day ${dayIndex} should not have this superset`);
    assert.equal(accessoryDefFor(dayIndex, "Reverse pec deck / cable reverse fly"), null, `day ${dayIndex} should not have this superset`);
  }
});

test("Lateral raise / Reverse pec deck are 4x15 / 4x15 on both Squat and Bench", () => {
  for (const dayIndex of [1, 2]) {
    assert.equal(accessoryDefFor(dayIndex, "Lateral raise").sets, 4, `day ${dayIndex}`);
    assert.equal(accessoryDefFor(dayIndex, "Reverse pec deck / cable reverse fly").sets, 4, `day ${dayIndex}`);
  }
});

test("accessoryDefFor matches either calf raise variant name, on both days that offer it", () => {
  for (const dayIndex of [2, 4]) {
    const standing = accessoryDefFor(dayIndex, "Standing calf raise");
    const seated = accessoryDefFor(dayIndex, "Seated calf raise");
    assert.equal(standing?.name, "Calf raise", `day ${dayIndex} standing`);
    assert.equal(seated?.name, "Calf raise", `day ${dayIndex} seated`);
    assert.equal(standing, seated, `day ${dayIndex} both names resolve to the same slot`);
    assert.deepEqual(new Set(standing.variants), new Set(["Standing calf raise", "Seated calf raise"]));
  }
});

test("calf raise defaults to Standing on Squat day and Seated on Deadlift day", () => {
  assert.equal(accessoryDefFor(2, "Standing calf raise").variants[0], "Standing calf raise");
  assert.equal(accessoryDefFor(4, "Seated calf raise").variants[0], "Seated calf raise");
});

test("Swiss ball leg curl is gone entirely; Machine leg curl is now its own standalone exercise on Squat day", () => {
  const machine = accessoryDefFor(2, "Machine leg curl");
  assert.equal(machine?.name, "Machine leg curl");
  assert.equal(machine.sets, 3);
  assert.equal(machine.repsLabel, "10–12");
  assert.equal(restCategoryFor(machine), "compound");
  assert.equal(machine.variants, undefined, "no longer a variant toggle");
  assert.equal(accessoryDefFor(2, "Swiss ball leg curl"), null);
});

test("dayInfo returns a legacy Recovery definition for the reserved day 6 slot, for old history only", () => {
  const legacy = dayInfo(6);
  assert.equal(legacy?.name, "Recovery");
  assert.equal(legacy?.kind, "recovery");
});

test("dayInfo returns a legacy Accessory definition for the reserved day 7 slot, for old history only", () => {
  const legacy = dayInfo(7);
  assert.equal(legacy?.name, "Accessory");
  assert.equal(legacy?.kind, "accessory");
  const names = legacy.accessories.map((a) => a.name);
  assert.deepEqual(names, [
    "Incline barbell press",
    "Hex press",
    "Seated cable row (close grip)",
    "Lat pulldown",
    "Straight-arm pulldown",
    "Lateral raise",
    "Reverse pec deck / cable reverse fly",
  ]);
});

test("the Accessory day no longer exists as an active day (1-4 only)", () => {
  for (const dayIndex of [1, 2, 3, 4]) {
    assert.notEqual(dayInfo(dayIndex).kind, "accessory", `day ${dayIndex}`);
  }
});

test("Bench day (1): Incline barbell press moved in, Seated cable row (wide/neutral) removed, lateral raise/reverse fly superset present at 4x15/4x15", () => {
  const names = dayInfo(1).accessories.map((a) => a.name);
  assert.deepEqual(names, [
    "Pull-ups (weighted)",
    "Incline barbell press",
    "Cable fly (mid-height)",
    "Cable rope overhead extension",
    "Curls",
    "Lateral raise",
    "Reverse pec deck / cable reverse fly",
  ]);
  assert.equal(accessoryDefFor(1, "Seated cable row (wide/neutral)"), null, "removed from Bench day");
  const incline = accessoryDefFor(1, "Incline barbell press");
  assert.equal(incline.sets, 3);
  assert.equal(incline.repsLabel, "8–10");
  assert.equal(restCategoryFor(incline), "compound");
  const lateral = accessoryDefFor(1, "Lateral raise");
  assert.equal(lateral.sets, 4);
  assert.equal(lateral.repsLabel, "15");
  assert.equal(lateral.supersetRole, "a");
  const reverseFly = accessoryDefFor(1, "Reverse pec deck / cable reverse fly");
  assert.equal(reverseFly.sets, 4);
  assert.equal(reverseFly.repsLabel, "15");
  assert.equal(reverseFly.supersetRole, "b");
});

test("Squat day (2) accessory order and set counts", () => {
  const names = dayInfo(2).accessories.map((a) => a.name);
  assert.deepEqual(names, ["RDL", "Machine leg curl", "Calf raise", "Lateral raise", "Reverse pec deck / cable reverse fly", "Cable crunch"]);
});

test("Press day (3): Seated cable row replaces Lat pulldown; Straight-arm pulldown and Hex press stay moved in from the old Accessory day", () => {
  const names = dayInfo(3).accessories.map((a) => a.name);
  assert.deepEqual(names, [
    "Chin-ups",
    "Seated cable row",
    "Straight-arm pulldown",
    "Hex press",
    "Cable rope overhead extension",
    "Hammer curls",
  ]);
  assert.equal(accessoryDefFor(3, "Lat pulldown"), null, "replaced by Seated cable row");
  const seatedRow = accessoryDefFor(3, "Seated cable row");
  assert.equal(seatedRow.sets, 5);
  assert.equal(seatedRow.repsLabel, "10");
  assert.equal(restCategoryFor(seatedRow), "compound");
  const straightArm = accessoryDefFor(3, "Straight-arm pulldown");
  assert.equal(straightArm.sets, 3);
  assert.equal(straightArm.repsLabel, "12");
  const hexPress = accessoryDefFor(3, "Hex press");
  assert.equal(hexPress.sets, 3);
  assert.equal(hexPress.repsLabel, "12–15");
  assert.equal(restCategoryFor(hexPress), "isolation");
  assert.equal(accessoryDefFor(3, "Incline DB press"), null, "was already removed in an earlier change");
  assert.equal(accessoryDefFor(3, "Lateral raise"), null, "Press never has this superset");
  assert.equal(accessoryDefFor(3, "Reverse pec deck / cable reverse fly"), null, "Press never has this superset");
});

test("Deadlift day (4, was day 5): Seated cable row (close grip) removed entirely; no lateral raise/reverse fly superset", () => {
  const names = dayInfo(4).accessories.map((a) => a.name);
  assert.deepEqual(names, [
    "Bulgarian split squat",
    "Shrugs (straps)",
    "Calf raise",
    "Cable crunch",
  ]);
  assert.equal(accessoryDefFor(4, "Seated cable row (close grip)"), null, "removed from Deadlift day");
  assert.equal(dayInfo(4).lift, "deadlift");
  assert.equal(accessoryDefFor(4, "Lateral raise"), null, "moved to Bench");
  assert.equal(accessoryDefFor(4, "Reverse pec deck / cable reverse fly"), null, "moved to Bench");
});

test("Every main lift day has its own distinct BBB alternate movement", () => {
  assert.deepEqual(dayInfo(1).supplementalAlt, { type: "dbFlatPress", label: "DB flat press", sets: 5, targetReps: 10 });
  assert.deepEqual(dayInfo(2).supplementalAlt, { type: "beltSquat", label: "Belt squat", sets: 5, targetReps: 10 });
  assert.deepEqual(dayInfo(3).supplementalAlt, { type: "seatedDbPress", label: "Seated DB press", sets: 5, targetReps: 10 });
  assert.deepEqual(dayInfo(4).supplementalAlt, { type: "hipThrust", label: "Hip thrust", sets: 5, targetReps: 10, barbell: true });
});

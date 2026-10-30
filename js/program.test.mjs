import { test } from "node:test";
import assert from "node:assert/strict";
import { accessoryDefFor, restCategoryFor, dayInfo, DAY_COUNT } from "./program.js";

test("the program is a 4-day rotation", () => {
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

test("Lateral raise / Reverse pec deck are a superset pair on Squat and Bench; Press and Deadlift don't have it", () => {
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

test("Lateral raise is 5x15 on both Squat and Bench; Reverse pec deck stays 4x15 on Squat and 3x15 on Bench", () => {
  assert.equal(accessoryDefFor(1, "Lateral raise").sets, 5, "Bench");
  assert.equal(accessoryDefFor(1, "Reverse pec deck / cable reverse fly").sets, 3, "Bench");
  assert.equal(accessoryDefFor(2, "Lateral raise").sets, 5, "Squat");
  assert.equal(accessoryDefFor(2, "Reverse pec deck / cable reverse fly").sets, 4, "Squat");
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

test("Swiss ball leg curl is gone entirely; Machine leg curl on Squat day is its own standalone exercise", () => {
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

test("dayInfo returns a legacy Accessory definition for the reserved day 7 slot (from the 5-day -> 4-day collapse), for old history only", () => {
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

test("dayInfo returns a legacy Accessory definition for the reserved day 8 slot (from the removed bonus day), for old history only", () => {
  const legacy = dayInfo(8);
  assert.equal(legacy?.name, "Accessory");
  assert.equal(legacy?.kind, "accessory");
  const names = legacy.accessories.map((a) => a.name);
  assert.deepEqual(names, [
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

test("there is no live, selectable Accessory day anywhere in 1-DAY_COUNT, and dayInfo returns nothing beyond the legacy slots", () => {
  for (const dayIndex of [1, 2, 3, 4]) {
    assert.notEqual(dayInfo(dayIndex).kind, "accessory", `day ${dayIndex}`);
  }
  assert.equal(dayInfo(9), undefined, "no day beyond the reserved legacy slots exists");
});

test("Bench day (1): Lateral raise now 5x15, Curls 4x12, everything else unchanged", () => {
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
  const curls = accessoryDefFor(1, "Curls");
  assert.equal(curls.sets, 4);
  assert.equal(curls.repsLabel, "12");
  const incline = accessoryDefFor(1, "Incline barbell press");
  assert.equal(incline.sets, 3);
  assert.equal(incline.repsLabel, "8–10");
  assert.equal(restCategoryFor(incline), "compound");
  const lateral = accessoryDefFor(1, "Lateral raise");
  assert.equal(lateral.sets, 5, "was 4x15, now 5x15");
  assert.equal(lateral.repsLabel, "15");
  assert.equal(lateral.supersetRole, "a");
  const reverseFly = accessoryDefFor(1, "Reverse pec deck / cable reverse fly");
  assert.equal(reverseFly.sets, 3);
  assert.equal(reverseFly.repsLabel, "15");
  assert.equal(reverseFly.supersetRole, "b");
});

test("Squat day (2): Lateral raise now 5x15; Machine leg curl and Leg extension both present, in order, after RDL", () => {
  const names = dayInfo(2).accessories.map((a) => a.name);
  assert.deepEqual(names, ["RDL", "Machine leg curl", "Leg extension", "Calf raise", "Lateral raise", "Reverse pec deck / cable reverse fly", "Cable crunch"]);

  const legCurl = accessoryDefFor(2, "Machine leg curl");
  assert.equal(legCurl.sets, 3);
  assert.equal(legCurl.repsLabel, "10–12");
  assert.equal(restCategoryFor(legCurl), "compound");

  const legExtension = accessoryDefFor(2, "Leg extension");
  assert.equal(legExtension.sets, 4);
  assert.equal(legExtension.repsLabel, "12–15");
  assert.equal(restCategoryFor(legExtension), "isolation");
  assert.equal(legExtension.cue, "Pause at the top, lower slowly.");

  const lateral = accessoryDefFor(2, "Lateral raise");
  assert.equal(lateral.sets, 5, "was 4x15, now 5x15");
});

test("Press day (3): Hammer curls added at the end, after Rope pushdown", () => {
  const names = dayInfo(3).accessories.map((a) => a.name);
  assert.deepEqual(names, [
    "Chin-ups",
    "Seated cable row (wide/neutral)",
    "Straight-arm pulldown",
    "Hex press",
    "Rope pushdown",
    "Hammer curls",
  ]);
  const ropePushdown = accessoryDefFor(3, "Rope pushdown");
  assert.equal(ropePushdown.sets, 3);
  assert.equal(ropePushdown.repsLabel, "12");
  assert.equal(restCategoryFor(ropePushdown), "isolation");
  const hammerCurls = accessoryDefFor(3, "Hammer curls");
  assert.equal(hammerCurls.sets, 3);
  assert.equal(hammerCurls.repsLabel, "12");
  assert.equal(restCategoryFor(hammerCurls), "isolation");
  const seatedRow = accessoryDefFor(3, "Seated cable row (wide/neutral)");
  assert.equal(seatedRow.sets, 5);
  assert.equal(seatedRow.repsLabel, "10");
  assert.equal(restCategoryFor(seatedRow), "compound");
  assert.equal(accessoryDefFor(3, "Lateral raise"), null, "Press never has this superset");
  assert.equal(accessoryDefFor(3, "Reverse pec deck / cable reverse fly"), null, "Press never has this superset");
});

test("Deadlift day (4): no BBB; Hip thrust is now a plain 3x10 accessory, Machine leg curl and Leg extension still present", () => {
  assert.equal(dayInfo(4).supplemental, null, "BBB removed from Deadlift");
  assert.equal(dayInfo(4).supplementalAlt, undefined, "Hip thrust is no longer a supplemental alt");

  const names = dayInfo(4).accessories.map((a) => a.name);
  assert.deepEqual(names, [
    "Hip thrust",
    "Bulgarian split squat",
    "Machine leg curl",
    "Leg extension",
    "Seated cable row (close grip)",
    "Shrugs (straps)",
    "Calf raise",
    "Cable crunch",
  ]);

  const hipThrust = accessoryDefFor(4, "Hip thrust");
  assert.equal(hipThrust.sets, 3);
  assert.equal(hipThrust.repsLabel, "10");
  assert.equal(restCategoryFor(hipThrust), "compound");

  const legCurl = accessoryDefFor(4, "Machine leg curl");
  assert.equal(legCurl.sets, 3);
  assert.equal(legCurl.repsLabel, "10–12");
  assert.equal(restCategoryFor(legCurl), "isolation");

  const legExtension = accessoryDefFor(4, "Leg extension");
  assert.equal(legExtension.sets, 3);
  assert.equal(legExtension.repsLabel, "12–15");
  assert.equal(restCategoryFor(legExtension), "isolation");
  assert.equal(legExtension.cue, "Pause at the top, lower slowly.");

  const seatedRow = accessoryDefFor(4, "Seated cable row (close grip)");
  assert.equal(seatedRow.sets, 3);
  assert.equal(seatedRow.repsLabel, "10–12");
  assert.equal(restCategoryFor(seatedRow), "compound");
  assert.equal(seatedRow.cue, "Use straps. Keep torso still, no rocking.");
  assert.equal(dayInfo(4).lift, "deadlift");
  assert.equal(accessoryDefFor(4, "Lateral raise"), null);
  assert.equal(accessoryDefFor(4, "Reverse pec deck / cable reverse fly"), null);
});

test("the four rotation days (1-4) are Bench/Squat/Press/Deadlift", () => {
  assert.deepEqual([1, 2, 3, 4].map((i) => dayInfo(i).name), ["Bench", "Squat", "Press", "Deadlift"]);
});

test("Bench, Squat, and Press each have their own distinct BBB alternate movement; Deadlift has none (no BBB at all)", () => {
  assert.deepEqual(dayInfo(1).supplementalAlt, { type: "dbFlatPress", label: "DB flat press", sets: 5, targetReps: 10 });
  assert.deepEqual(dayInfo(2).supplementalAlt, { type: "beltSquat", label: "Belt squat", sets: 5, targetReps: 10 });
  assert.deepEqual(dayInfo(3).supplementalAlt, { type: "seatedDbPress", label: "Seated DB press", sets: 5, targetReps: 10 });
  assert.equal(dayInfo(4).supplementalAlt, undefined);
});

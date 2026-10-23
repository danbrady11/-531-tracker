import { test } from "node:test";
import assert from "node:assert/strict";
import { accessoryDefFor, restCategoryFor, dayInfo, DAY_COUNT } from "./program.js";

test("the program is a 5-day cycle", () => {
  assert.equal(DAY_COUNT, 5);
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

test("Lateral raise / Reverse pec deck are a superset pair on Squat, Bench, and the Accessory day; Press and Deadlift don't have it", () => {
  for (const dayIndex of [1, 2, 4]) {
    const lateral = accessoryDefFor(dayIndex, "Lateral raise");
    const reverseFly = accessoryDefFor(dayIndex, "Reverse pec deck / cable reverse fly");
    assert.equal(lateral?.supersetRole, "a", `day ${dayIndex} Lateral raise`);
    assert.equal(reverseFly?.supersetRole, "b", `day ${dayIndex} Reverse pec deck / cable reverse fly`);
  }
  for (const dayIndex of [3, 5]) {
    assert.equal(accessoryDefFor(dayIndex, "Lateral raise"), null, `day ${dayIndex} should not have this superset`);
    assert.equal(accessoryDefFor(dayIndex, "Reverse pec deck / cable reverse fly"), null, `day ${dayIndex} should not have this superset`);
  }
});

test("Lateral raise / Reverse pec deck set counts: 4x15/4x15 on Squat, 4x15/3x15 on Bench and the Accessory day", () => {
  assert.equal(accessoryDefFor(2, "Lateral raise").sets, 4, "Squat");
  assert.equal(accessoryDefFor(2, "Reverse pec deck / cable reverse fly").sets, 4, "Squat");
  for (const dayIndex of [1, 4]) {
    assert.equal(accessoryDefFor(dayIndex, "Lateral raise").sets, 4, `day ${dayIndex}`);
    assert.equal(accessoryDefFor(dayIndex, "Reverse pec deck / cable reverse fly").sets, 3, `day ${dayIndex}`);
  }
});

test("accessoryDefFor matches either calf raise variant name, on both days that offer it", () => {
  for (const dayIndex of [2, 5]) {
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
  assert.equal(accessoryDefFor(5, "Seated calf raise").variants[0], "Seated calf raise");
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

test("dayInfo returns a legacy Accessory definition for the reserved day 7 slot, for old history only (distinct from the live day-4 Accessory)", () => {
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

test("Bench day (1): Curls now 4x12, Reverse pec deck now 3x15, everything else unchanged", () => {
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
  assert.equal(curls.sets, 4, "was 3x12, now 4x12");
  assert.equal(curls.repsLabel, "12");
  const incline = accessoryDefFor(1, "Incline barbell press");
  assert.equal(incline.sets, 3);
  assert.equal(incline.repsLabel, "8–10");
  assert.equal(restCategoryFor(incline), "compound");
  const lateral = accessoryDefFor(1, "Lateral raise");
  assert.equal(lateral.sets, 4);
  assert.equal(lateral.repsLabel, "15");
  assert.equal(lateral.supersetRole, "a");
  const reverseFly = accessoryDefFor(1, "Reverse pec deck / cable reverse fly");
  assert.equal(reverseFly.sets, 3, "was 4x15, now 3x15");
  assert.equal(reverseFly.repsLabel, "15");
  assert.equal(reverseFly.supersetRole, "b");
});

test("Squat day (2): Leg extension added between Machine leg curl and Calf raise", () => {
  const names = dayInfo(2).accessories.map((a) => a.name);
  assert.deepEqual(names, ["RDL", "Machine leg curl", "Leg extension", "Calf raise", "Lateral raise", "Reverse pec deck / cable reverse fly", "Cable crunch"]);
  const legExtension = accessoryDefFor(2, "Leg extension");
  assert.equal(legExtension.sets, 4);
  assert.equal(legExtension.repsLabel, "12–15");
  assert.equal(restCategoryFor(legExtension), "isolation");
  assert.equal(legExtension.cue, "Pause at the top, lower slowly.");
});

test("Press day (3): Cable rope overhead extension and Hammer curls removed; Rope pushdown added at the end", () => {
  const names = dayInfo(3).accessories.map((a) => a.name);
  assert.deepEqual(names, [
    "Chin-ups",
    "Seated cable row (wide/neutral)",
    "Straight-arm pulldown",
    "Hex press",
    "Rope pushdown",
  ]);
  assert.equal(accessoryDefFor(3, "Cable rope overhead extension"), null, "removed");
  assert.equal(accessoryDefFor(3, "Hammer curls"), null, "removed");
  const ropePushdown = accessoryDefFor(3, "Rope pushdown");
  assert.equal(ropePushdown.sets, 3);
  assert.equal(ropePushdown.repsLabel, "12");
  assert.equal(restCategoryFor(ropePushdown), "isolation");
  const seatedRow = accessoryDefFor(3, "Seated cable row (wide/neutral)");
  assert.equal(seatedRow.sets, 5);
  assert.equal(seatedRow.repsLabel, "10");
  assert.equal(restCategoryFor(seatedRow), "compound");
  assert.equal(accessoryDefFor(3, "Lateral raise"), null, "Press never has this superset");
  assert.equal(accessoryDefFor(3, "Reverse pec deck / cable reverse fly"), null, "Press never has this superset");
});

test("the new Accessory day (4) is its own kind, with no lift or supplemental, and the full exercise list in order", () => {
  const day = dayInfo(4);
  assert.equal(day.name, "Accessory");
  assert.equal(day.kind, "accessory");
  assert.equal(day.lift, null);
  assert.equal(day.supplemental, null);
  const names = day.accessories.map((a) => a.name);
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

  const legPress = accessoryDefFor(4, "Leg press");
  assert.equal(legPress.sets, 4);
  assert.equal(legPress.repsLabel, "10–12");
  assert.equal(restCategoryFor(legPress), "compound");
  assert.equal(legPress.cue, "Belt squat if no leg press.");

  const legCurl = accessoryDefFor(4, "Seated leg curl");
  assert.equal(legCurl.sets, 4);
  assert.equal(legCurl.repsLabel, "10–12");
  assert.equal(restCategoryFor(legCurl), "isolation");

  const calfRaise = accessoryDefFor(4, "Standing calf raise");
  assert.equal(calfRaise.sets, 4);
  assert.equal(calfRaise.repsLabel, "15");
  assert.equal(restCategoryFor(calfRaise), "isolation");

  const pecDeck = accessoryDefFor(4, "Pec deck");
  assert.equal(pecDeck.sets, 3);
  assert.equal(pecDeck.repsLabel, "12–15");
  assert.equal(restCategoryFor(pecDeck), "isolation");

  const hammerCurls = accessoryDefFor(4, "Hammer curls");
  assert.equal(hammerCurls.sets, 4);
  assert.equal(hammerCurls.repsLabel, "10–12");
  assert.equal(restCategoryFor(hammerCurls), "isolation");

  const cableCrunch = accessoryDefFor(4, "Cable crunch");
  assert.equal(cableCrunch.sets, 3);
  assert.equal(cableCrunch.repsLabel, "12");
  assert.equal(restCategoryFor(cableCrunch), "isolation");
});

test("Deadlift (now day 5): unchanged content, just renumbered", () => {
  const names = dayInfo(5).accessories.map((a) => a.name);
  assert.deepEqual(names, [
    "Bulgarian split squat",
    "Seated cable row (close grip)",
    "Shrugs (straps)",
    "Calf raise",
    "Cable crunch",
  ]);
  const seatedRow = accessoryDefFor(5, "Seated cable row (close grip)");
  assert.equal(seatedRow.sets, 3);
  assert.equal(seatedRow.repsLabel, "10–12");
  assert.equal(restCategoryFor(seatedRow), "compound");
  assert.equal(seatedRow.cue, "Use straps. Keep torso still, no rocking.");
  assert.equal(dayInfo(5).lift, "deadlift");
  assert.equal(accessoryDefFor(5, "Lateral raise"), null);
  assert.equal(accessoryDefFor(5, "Reverse pec deck / cable reverse fly"), null);
});

test("day 4 (Accessory) is not a main day, and no main day is kind accessory", () => {
  assert.notEqual(dayInfo(4).kind, "main");
  for (const dayIndex of [1, 2, 3, 5]) {
    assert.notEqual(dayInfo(dayIndex).kind, "accessory", `day ${dayIndex}`);
  }
});

test("Every main lift day has its own distinct BBB alternate movement", () => {
  assert.deepEqual(dayInfo(1).supplementalAlt, { type: "dbFlatPress", label: "DB flat press", sets: 5, targetReps: 10 });
  assert.deepEqual(dayInfo(2).supplementalAlt, { type: "beltSquat", label: "Belt squat", sets: 5, targetReps: 10 });
  assert.deepEqual(dayInfo(3).supplementalAlt, { type: "seatedDbPress", label: "Seated DB press", sets: 5, targetReps: 10 });
  assert.deepEqual(dayInfo(5).supplementalAlt, { type: "hipThrust", label: "Hip thrust", sets: 5, targetReps: 10, barbell: true });
});

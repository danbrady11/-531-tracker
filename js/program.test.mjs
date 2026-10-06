import { test } from "node:test";
import assert from "node:assert/strict";
import { accessoryDefFor, restCategoryFor, dayInfo } from "./program.js";

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

test("Lateral raise / Reverse pec deck are always a superset pair, on every day both appear", () => {
  for (const dayIndex of [1, 2, 4]) {
    const lateral = accessoryDefFor(dayIndex, "Lateral raise");
    const reverseFly = accessoryDefFor(dayIndex, "Reverse pec deck / cable reverse fly");
    assert.equal(lateral?.supersetRole, "a", `day ${dayIndex} Lateral raise`);
    assert.equal(reverseFly?.supersetRole, "b", `day ${dayIndex} Reverse pec deck / cable reverse fly`);
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

test("Swiss ball leg curl offers Machine leg curl as an alternate variant, defaulting to Swiss ball", () => {
  const swissBall = accessoryDefFor(2, "Swiss ball leg curl");
  const machine = accessoryDefFor(2, "Machine leg curl");
  assert.equal(swissBall, machine, "both names resolve to the same slot");
  assert.deepEqual(swissBall.variants, ["Swiss ball leg curl", "Machine leg curl"]);
  assert.equal(swissBall.variants[0], "Swiss ball leg curl");
  assert.equal(restCategoryFor(swissBall), "compound");
});

test("dayInfo returns a legacy Recovery definition for the reserved day 6 slot, for old history only", () => {
  const legacy = dayInfo(6);
  assert.equal(legacy?.name, "Recovery");
  assert.equal(legacy?.kind, "recovery");
});

test("Accessory day (4) opens with Incline barbell press, Hex press, ahead of the rest of the day", () => {
  const names = dayInfo(4).accessories.map((a) => a.name);
  assert.deepEqual(names, [
    "Incline barbell press",
    "Hex press",
    "Seated cable row (close grip)",
    "Lat pulldown",
    "Straight-arm pulldown",
    "Lateral raise",
    "Reverse pec deck / cable reverse fly",
  ]);
  const incline = accessoryDefFor(4, "Incline barbell press");
  assert.equal(incline.repsLabel, "8–10");
  assert.equal(incline.sets, 3);
  assert.equal(restCategoryFor(incline), "compound");
  assert.equal(accessoryDefFor(4, "Flat DB press"), null);
});

test("Hex press sits between Incline barbell press and Seated cable row, 3x12-15 at isolation (default) rest", () => {
  const hexPress = accessoryDefFor(4, "Hex press");
  assert.equal(hexPress.sets, 3);
  assert.equal(hexPress.repsLabel, "12–15");
  assert.equal(restCategoryFor(hexPress), "isolation");
});

test("Press day (3) no longer has Incline DB press — just Chin-ups, Cable rope overhead extension, Hammer curls", () => {
  const names = dayInfo(3).accessories.map((a) => a.name);
  assert.deepEqual(names, ["Chin-ups", "Cable rope overhead extension", "Hammer curls"]);
  assert.equal(accessoryDefFor(3, "Incline DB press"), null);
});

test("Each main lift day with a BBB alternate has its own distinct movement; Press has none", () => {
  assert.deepEqual(dayInfo(1).supplementalAlt, { type: "dbFlatPress", label: "DB flat press", sets: 5, targetReps: 10 });
  assert.deepEqual(dayInfo(2).supplementalAlt, { type: "beltSquat", label: "Belt squat", sets: 5, targetReps: 10 });
  assert.deepEqual(dayInfo(5).supplementalAlt, { type: "hipThrust", label: "Hip thrust", sets: 5, targetReps: 10, barbell: true });
  assert.equal(dayInfo(3).supplementalAlt, undefined, "Press should have no supplementalAlt");
  assert.equal(dayInfo(4).supplementalAlt, undefined, "Accessory day has no main lift, so no supplementalAlt");
});

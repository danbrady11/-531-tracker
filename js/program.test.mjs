import { test } from "node:test";
import assert from "node:assert/strict";
import { accessoryDefFor, restCategoryFor } from "./program.js";

test("accessoryDefFor finds a fixed accessory on the given day", () => {
  const def = accessoryDefFor(3, "RDL"); // Squat day
  assert.equal(def?.name, "RDL");
  assert.equal(def?.restCategory, "compound");
});

test("accessoryDefFor finds a Psoas Strength item on a day with hasPsoasStrength", () => {
  const def = accessoryDefFor(1, "Standing banded knee raise"); // Bench day has Psoas Strength
  assert.equal(def?.name, "Standing banded knee raise");
});

test("accessoryDefFor returns null for an ad hoc exercise not defined anywhere on that day", () => {
  assert.equal(accessoryDefFor(3, "Face pulls (optional)"), null);
});

test("accessoryDefFor returns null for a Psoas Strength item on a day without hasPsoasStrength", () => {
  assert.equal(accessoryDefFor(3, "Standing banded knee raise"), null); // Squat day has hasPsoasStrength: false
});

test("restCategoryFor returns the tagged category when set", () => {
  assert.equal(restCategoryFor({ restCategory: "compound" }), "compound");
});

test("restCategoryFor defaults to isolation when untagged or missing", () => {
  assert.equal(restCategoryFor({ name: "Curls" }), "isolation");
  assert.equal(restCategoryFor(null), "isolation");
});

test("Lateral raise / Reverse pec deck are always a superset pair, on every day both appear", () => {
  for (const dayIndex of [1, 3, 5]) {
    const lateral = accessoryDefFor(dayIndex, "Lateral raise");
    const reverseFly = accessoryDefFor(dayIndex, "Reverse pec deck / cable reverse fly");
    assert.equal(lateral?.supersetRole, "a", `day ${dayIndex} Lateral raise`);
    assert.equal(reverseFly?.supersetRole, "b", `day ${dayIndex} Reverse pec deck / cable reverse fly`);
  }
});

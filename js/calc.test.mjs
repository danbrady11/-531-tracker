// Plain-node test runner (node --test) for the 531 math. No framework dependency.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  roundDownToIncrement,
  computeWeight,
  mainSetsForWeek,
  fslSets,
  bbbSets,
  warmupSets,
  epleyE1RM,
  repsToBeatE1RM,
  plateBreakdown,
  nextTrainingMax,
  fslPercentage,
} from "./calc.js";

test("roundDownToIncrement rounds down to nearest 5", () => {
  assert.equal(roundDownToIncrement(123, 5), 120);
  assert.equal(roundDownToIncrement(125, 5), 125);
  assert.equal(roundDownToIncrement(124.999, 5), 120);
  assert.equal(roundDownToIncrement(0, 5), 0);
});

test("roundDownToIncrement handles other increments", () => {
  assert.equal(roundDownToIncrement(123, 2.5), 122.5);
  assert.equal(roundDownToIncrement(123, 1), 123);
});

test("computeWeight: TM 300 squat, week 1 set 1 (65%) rounds down to nearest 5", () => {
  // 300 * 0.65 = 195 exactly
  assert.equal(computeWeight(300, 0.65, 5), 195);
});

test("computeWeight: TM 205, 85% = 174.25 -> rounds down to 170", () => {
  assert.equal(computeWeight(205, 0.85, 5), 170);
});

test("mainSetsForWeek week 1 (5s): 65/75/85, last set AMRAP", () => {
  const sets = mainSetsForWeek(300, 1, 5);
  assert.equal(sets.length, 3);
  assert.equal(sets[0].weight, 195); // 65%
  assert.equal(sets[0].targetReps, 5);
  assert.equal(sets[0].isAmrap, false);
  assert.equal(sets[1].weight, 225); // 75%
  assert.equal(sets[2].weight, 255); // 85% of 300 = 255 exactly
  assert.equal(sets[2].isAmrap, true);
  assert.equal(sets[2].targetReps, 5);
});

test("mainSetsForWeek week 2 (3s): 70/80/90, reps 3/3/3+", () => {
  const sets = mainSetsForWeek(300, 2, 5);
  assert.equal(sets[0].weight, 210);
  assert.equal(sets[1].weight, 240);
  assert.equal(sets[2].weight, 270);
  assert.deepEqual(sets.map((s) => s.targetReps), [3, 3, 3]);
  assert.equal(sets[2].isAmrap, true);
});

test("mainSetsForWeek week 3 (5/3/1): 75/85/95, reps 5/3/1+", () => {
  const sets = mainSetsForWeek(300, 3, 5);
  assert.equal(sets[0].weight, 225);
  assert.equal(sets[1].weight, 255);
  assert.equal(sets[2].weight, 285);
  assert.deepEqual(sets.map((s) => s.targetReps), [5, 3, 1]);
  assert.equal(sets[2].isAmrap, true);
});

test("mainSetsForWeek week 4 (deload): 40/50/60, no AMRAP", () => {
  const sets = mainSetsForWeek(300, 4, 5);
  assert.equal(sets[0].weight, 120);
  assert.equal(sets[1].weight, 150);
  assert.equal(sets[2].weight, 180);
  assert.ok(sets.every((s) => s.isAmrap === false));
});

test("fslPercentage matches the week's first main-set percentage", () => {
  assert.equal(fslPercentage(1), 0.65);
  assert.equal(fslPercentage(2), 0.70);
  assert.equal(fslPercentage(3), 0.75);
});

test("fslSets: 3x8 at week's first percentage, none on deload", () => {
  const week1 = fslSets(300, 1, 5);
  assert.equal(week1.length, 3);
  assert.ok(week1.every((s) => s.weight === 195 && s.targetReps === 8));

  const deload = fslSets(300, 4, 5);
  assert.equal(deload.length, 0);
});

test("bbbSets: 5x10 at configured % of TM, none on deload", () => {
  const week1 = bbbSets(200, 1, 0.5, 5);
  assert.equal(week1.length, 5);
  assert.ok(week1.every((s) => s.weight === 100 && s.targetReps === 10));

  const customPct = bbbSets(200, 1, 0.6, 5);
  assert.equal(customPct[0].weight, 120);

  const deload = bbbSets(200, 4, 0.5, 5);
  assert.equal(deload.length, 0);
});

test("bbbSets: bench and squat never drop below the 135 lb BBB minimum, even at low TMs", () => {
  const lightBench = bbbSets(150, 1, 0.5, 5, "bench"); // 50% of 150 = 75, below the 135 floor
  assert.ok(lightBench.every((s) => s.weight === 135));

  const lightSquat = bbbSets(150, 1, 0.5, 5, "squat");
  assert.ok(lightSquat.every((s) => s.weight === 135));

  // Above the floor, the computed weight still wins.
  const heavyBench = bbbSets(400, 1, 0.5, 5, "bench");
  assert.ok(heavyBench.every((s) => s.weight === 200));
});

test("bbbSets: deadlift and press have no BBB minimum", () => {
  const lightDeadlift = bbbSets(150, 1, 0.5, 5, "deadlift");
  assert.ok(lightDeadlift.every((s) => s.weight === 75));

  const lightPress = bbbSets(150, 1, 0.5, 5, "press");
  assert.ok(lightPress.every((s) => s.weight === 75));
});

test("warmupSets: 40/50/60% x 5/5/3", () => {
  const sets = warmupSets(300, 5);
  assert.equal(sets[0].weight, 120);
  assert.equal(sets[1].weight, 150);
  assert.equal(sets[2].weight, 180);
  assert.deepEqual(sets.map((s) => s.targetReps), [5, 5, 3]);
});

test("epleyE1RM: standard formula", () => {
  // 200 lb x 5 reps -> 200 * (1 + 5/30) = 233.33...
  assert.ok(Math.abs(epleyE1RM(200, 5) - 233.333) < 0.01);
  assert.equal(epleyE1RM(0, 5), 0);
  assert.equal(epleyE1RM(200, 0), 0);
});

test("repsToBeatE1RM: no prior best means 1 rep already counts", () => {
  assert.equal(repsToBeatE1RM(200, 0), 1);
  assert.equal(repsToBeatE1RM(0, 0), 1);
});

test("repsToBeatE1RM: exact boundary requires one more rep than a tie", () => {
  // epleyE1RM(115, 3) = 126.5 exactly, so 3 reps ties the record, not beats it.
  const currentBest = epleyE1RM(115, 3);
  assert.equal(repsToBeatE1RM(115, currentBest), 4);
  assert.ok(epleyE1RM(115, 3) <= currentBest);
  assert.ok(epleyE1RM(115, 4) > currentBest);
});

test("repsToBeatE1RM: a tie reached at a different weight isn't miscounted as beating it (floating-point regression)", () => {
  // epleyE1RM(115, 8) === epleyE1RM(95, 16) exactly, in real arithmetic —
  // but 30 * (epleyE1RM(115,8) / 95 - 1) computes as 15.999999999999996 in
  // floating point, which would floor to 16 (a tie) instead of the correct 17.
  const currentBest = epleyE1RM(115, 8);
  assert.equal(epleyE1RM(95, 16), currentBest); // confirms this is a genuine tie, not just close
  assert.equal(repsToBeatE1RM(95, currentBest), 17);
  assert.ok(epleyE1RM(95, 17) > currentBest);
});

test("repsToBeatE1RM: matches epleyE1RM's own inverse for a non-boundary case", () => {
  const currentBest = 233; // just under epleyE1RM(200,5) = 233.33
  const needed = repsToBeatE1RM(200, currentBest);
  assert.equal(needed, 5);
  assert.ok(epleyE1RM(200, needed) > currentBest);
  assert.ok(epleyE1RM(200, needed - 1) <= currentBest);
});

test("plateBreakdown: simple case, 225 total, 45 bar -> 90/side -> two 45s", () => {
  const result = plateBreakdown(225, 45);
  assert.equal(result.perSide, 90);
  assert.deepEqual(result.plates, [{ plate: 45, count: 2 }]);
  assert.equal(result.remainder, 0);
  assert.equal(result.barOnly, false);
});

test("plateBreakdown: mixed plates, 205 total, 45 bar -> 80/side -> greedy picks 45+35", () => {
  const result = plateBreakdown(205, 45);
  assert.equal(result.perSide, 80);
  assert.deepEqual(result.plates, [
    { plate: 45, count: 1 },
    { plate: 35, count: 1 },
  ]);
});

test("plateBreakdown: weight at or below bar -> bar only, no negative plates", () => {
  assert.equal(plateBreakdown(45, 45).barOnly, true);
  assert.equal(plateBreakdown(30, 45).barOnly, true);
  assert.equal(plateBreakdown(45, 45).plates.length, 0);
});

test("plateBreakdown: odd per-side amount uses fractional plates without floating point drift", () => {
  // 137.5 total, 45 bar -> 46.25/side -> 45 + 1.25
  const result = plateBreakdown(137.5, 45);
  assert.equal(result.perSide, 46.25);
  assert.deepEqual(result.plates, [
    { plate: 45, count: 1 },
    { plate: 1.25, count: 1 },
  ]);
  assert.equal(result.remainder, 0);
});

test("plateBreakdown: per-side amount with no exact plate combo leaves a remainder, never crashes", () => {
  // 46/side with only standard plates (45,35,25,10,5,2.5,1.25) leaves 1 lb unaccounted, not negative.
  const result = plateBreakdown(137, 45);
  assert.ok(result.remainder >= 0);
  const reconstructed = result.plates.reduce((sum, p) => sum + p.plate * p.count, 0) + result.remainder;
  assert.ok(Math.abs(reconstructed - result.perSide) < 1e-6);
});

test("nextTrainingMax: squat/deadlift +10, bench/press +5 by default increments", () => {
  const inc = { squat: 10, deadlift: 10, bench: 5, press: 5 };
  assert.equal(nextTrainingMax(300, "squat", inc), 310);
  assert.equal(nextTrainingMax(300, "deadlift", inc), 310);
  assert.equal(nextTrainingMax(200, "bench", inc), 205);
  assert.equal(nextTrainingMax(150, "press", inc), 155);
});

test("nextTrainingMax: respects custom (edited) increments", () => {
  const inc = { squat: 15, deadlift: 5, bench: 2.5, press: 10 };
  assert.equal(nextTrainingMax(300, "squat", inc), 315);
  assert.equal(nextTrainingMax(300, "deadlift", inc), 305);
});

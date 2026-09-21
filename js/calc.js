// 5/3/1 math: percentages, plate math, warm-ups, e1RM.
// Pure functions only — no DOM, no state — so this module can be tested in isolation.

export const LIFTS = ["squat", "bench", "deadlift", "press", "trapBarDeadlift"];

export const WEEK_SCHEMES = {
  1: { label: "5s", sets: [{ pct: 0.65, reps: 5, amrap: false }, { pct: 0.75, reps: 5, amrap: false }, { pct: 0.85, reps: 5, amrap: true }], deload: false },
  2: { label: "3s", sets: [{ pct: 0.70, reps: 3, amrap: false }, { pct: 0.80, reps: 3, amrap: false }, { pct: 0.90, reps: 3, amrap: true }], deload: false },
  3: { label: "5/3/1", sets: [{ pct: 0.75, reps: 5, amrap: false }, { pct: 0.85, reps: 3, amrap: false }, { pct: 0.95, reps: 1, amrap: true }], deload: false },
  4: { label: "Deload", sets: [{ pct: 0.40, reps: 5, amrap: false }, { pct: 0.50, reps: 5, amrap: false }, { pct: 0.60, reps: 5, amrap: false }], deload: true },
};

// FSL uses the week's first main-set percentage. Only meaningful for weeks 1-3.
export function fslPercentage(weekIndex) {
  return WEEK_SCHEMES[weekIndex].sets[0].pct;
}

/** Round down to the nearest `increment` (e.g. 5 lb). */
export function roundDownToIncrement(weight, increment) {
  if (increment <= 0) return weight;
  return Math.floor(weight / increment) * increment;
}

/** Compute a working weight from TM and a percentage, rounded per settings. */
export function computeWeight(trainingMax, pct, roundingIncrement) {
  return roundDownToIncrement(trainingMax * pct, roundingIncrement);
}

/** Main sets for a lift/week, with calculated weights. */
export function mainSetsForWeek(trainingMax, weekIndex, roundingIncrement) {
  const scheme = WEEK_SCHEMES[weekIndex];
  return scheme.sets.map((s) => ({
    percentage: s.pct,
    weight: computeWeight(trainingMax, s.pct, roundingIncrement),
    targetReps: s.reps,
    actualReps: null,
    isAmrap: s.amrap,
  }));
}

/** FSL supplemental: 3x8 at the week's first main percentage. Deload = none. */
export function fslSets(trainingMax, weekIndex, roundingIncrement) {
  const scheme = WEEK_SCHEMES[weekIndex];
  if (scheme.deload) return [];
  const pct = fslPercentage(weekIndex);
  const weight = computeWeight(trainingMax, pct, roundingIncrement);
  return Array.from({ length: 3 }, () => ({ type: "fsl", percentage: pct, weight, targetReps: 8, reps: null }));
}

// Bench and squat BBB never drops below the empty-bar-plus-plates weight
// that still makes 5x10 worth doing — low TMs on those two lifts otherwise
// compute a BBB weight too light to be useful.
export const BBB_MIN_WEIGHT = { bench: 135, squat: 135 };

/** BBB supplemental: 5x10 at settings.bbbPercentage of TM (or the lift's BBB minimum, if higher). Deload = none. */
export function bbbSets(trainingMax, weekIndex, bbbPercentage, roundingIncrement, lift) {
  const scheme = WEEK_SCHEMES[weekIndex];
  if (scheme.deload) return [];
  const weight = Math.max(computeWeight(trainingMax, bbbPercentage, roundingIncrement), BBB_MIN_WEIGHT[lift] ?? 0);
  return Array.from({ length: 5 }, () => ({ type: "bbb", percentage: bbbPercentage, weight, targetReps: 10, reps: null }));
}

/** Warm-up: 40/50/60% x 5/5/3 of TM. */
export function warmupSets(trainingMax, roundingIncrement) {
  const scheme = [{ pct: 0.40, reps: 5 }, { pct: 0.50, reps: 5 }, { pct: 0.60, reps: 3 }];
  return scheme.map((s) => ({
    percentage: s.pct,
    weight: computeWeight(trainingMax, s.pct, roundingIncrement),
    targetReps: s.reps,
  }));
}

/** Estimated 1RM from an AMRAP set, via Epley. */
export function epleyE1RM(weight, reps) {
  if (!weight || !reps) return 0;
  return weight * (1 + reps / 30);
}

/**
 * Minimum whole reps at `weight` needed for Epley's e1RM to exceed
 * `currentBestE1RM` — the inverse of epleyE1RM, solved for reps and rounded
 * up to the next whole rep so a tie never counts as "beating" it. Returns 1
 * when there's no prior best (anything logged would be a new one) or no
 * weight to compute against.
 */
export function repsToBeatE1RM(weight, currentBestE1RM) {
  if (!weight || !currentBestE1RM || currentBestE1RM <= 0) return 1;
  const raw = 30 * (currentBestE1RM / weight - 1);
  // A real tie (e.g. 95 lb x 16 reps landing on exactly the same e1RM as a
  // prior 115 lb x 8) can compute as 15.999999999999996 instead of 16 due to
  // floating-point error, which would floor to one rep short of correct.
  // Rounding to 6 decimals first is far finer than a rep count needs, so it
  // only ever cancels that noise, never a genuine fractional difference.
  const rounded = Math.round(raw * 1e6) / 1e6;
  return Math.max(1, Math.floor(rounded) + 1);
}

const STANDARD_PLATES = [45, 35, 25, 10, 5, 2.5, 1.25];

/**
 * Plate breakdown per side, given total weight and bar weight.
 * Returns { perSide, plates: [{plate, count}], remainder, barOnly }.
 * `remainder` is any weight per side that couldn't be made with available plates
 * (only possible with unusual bar/rounding combos).
 */
export function plateBreakdown(totalWeight, barWeight, availablePlates = STANDARD_PLATES) {
  if (totalWeight <= barWeight) {
    return { perSide: 0, plates: [], remainder: 0, barOnly: true };
  }
  let perSide = (totalWeight - barWeight) / 2;
  const plates = [];
  const sorted = [...availablePlates].sort((a, b) => b - a);
  // Guard against floating point drift (e.g. 2.5 repeated subtraction).
  let remaining = Math.round(perSide * 100) / 100;
  for (const plate of sorted) {
    let count = 0;
    while (remaining + 1e-6 >= plate) {
      remaining = Math.round((remaining - plate) * 100) / 100;
      count++;
    }
    if (count > 0) plates.push({ plate, count });
  }
  return { perSide, plates, remainder: Math.max(0, remaining), barOnly: false };
}

/** Training max after a completed cycle, using per-lift increments. */
export function nextTrainingMax(currentValue, lift, tmIncrements) {
  return currentValue + (tmIncrements[lift] ?? 0);
}

// Static description of the 6-day rolling cycle. Day numbers are 1-6.

// Checkbox-only, no weight/rep logging. Defined once and rendered on every
// day (including Recovery) rather than duplicated into each day's list.
export const DAILY_PSOAS = [
  { name: "90/90 breathing", cue: "5 breaths" },
  { name: "Dead bug", cue: "3×8/side — slow; low back flat" },
  { name: "Glute bridge", cue: "3×12 — 2s pause at top" },
  { name: "Half-kneeling hip flexor position", cue: "2×30s/side — pelvis tucked, glute squeezed, breathe (not a hard stretch)" },
];

// Logged like a normal accessory (weight/band level + reps, prefilled from
// history). Only appears on the days whose hasPsoasStrength flag is true.
export const PSOAS_STRENGTH = [
  { name: "Standing banded knee raise", sets: 3, repsLabel: "10/side", cue: "drive knee above 90°, 3s lower" },
  { name: "Supine psoas march", sets: 3, repsLabel: "10/side", cue: "back flat" },
  { name: "Standing hip flexor isometric", sets: 3, repsLabel: "20s/side" },
];

// Single checkbox, no weight/rep logging — a band sequence, not tracked set by set.
export const SHOULDER_REHAB_ITEM = { name: "Shoulder Rehab", cue: "Band sequence (own routine)" };

// Rest-timer bucket for a set-based accessory. Anything not explicitly
// tagged "compound" below defaults to "isolation" — see restCategoryFor().
// Main lift working sets and BBB/FSL supplemental sets use their own fixed
// "main" bucket instead, handled directly in today.js/app.js.
export const DEFAULT_REST_CATEGORY = "isolation";

// Reordered so Deadlift is last (day 6) rather than first — completing it is
// what concludes a cycle. Each day's own content/flags are unchanged from
// before; only which slot number holds which day moved. Existing history's
// dayIndex values are re-mapped once in storage.js's migrate() so past
// sessions keep showing the correct exercise name after this reorder.
export const DAYS = {
  1: {
    name: "Bench",
    kind: "main",
    lift: "bench",
    supplemental: "bbb",
    hasPsoasStrength: true,
    hasShoulderRehab: true,
    accessories: [
      { name: "Pull-ups (weighted)", sets: 4, repsLabel: "6–10", restCategory: "compound" },
      { name: "Seated cable row (wide/neutral)", sets: 5, repsLabel: "10" },
      { name: "Lateral raise", sets: 4, repsLabel: "15" },
      { name: "Reverse pec deck / cable reverse fly", sets: 4, repsLabel: "15" },
      { name: "Overhead tricep extension", sets: 3, repsLabel: "12" },
      { name: "Curls", sets: 3, repsLabel: "12" },
    ],
  },
  2: {
    name: "Recovery",
    kind: "recovery",
    lift: null,
    supplemental: null,
    hasPsoasStrength: true,
    hasShoulderRehab: false,
    accessories: [
      { name: "Yoga", sets: null, repsLabel: "" },
      { name: "Zone 2", sets: null, repsLabel: "30 min" },
    ],
  },
  3: {
    name: "Squat",
    kind: "main",
    lift: "squat",
    supplemental: "bbb",
    hasPsoasStrength: false,
    hasShoulderRehab: false,
    accessories: [
      { name: "RDL", sets: 3, repsLabel: "10", restCategory: "compound" },
      { name: "Swiss ball leg curl", sets: 3, repsLabel: "10–12", restCategory: "compound" },
      { name: "Standing calf raise", sets: 5, repsLabel: "15" },
      { name: "Lateral raise", sets: 4, repsLabel: "15" },
      { name: "Reverse pec deck / cable reverse fly", sets: 4, repsLabel: "15" },
      { name: "Cable crunch", sets: 3, repsLabel: "12" },
    ],
  },
  4: {
    name: "Press",
    kind: "main",
    lift: "press",
    supplemental: "bbb",
    hasPsoasStrength: false,
    hasShoulderRehab: true,
    accessories: [
      { name: "Chin-ups", sets: 4, repsLabel: "", restCategory: "compound" },
      { name: "Incline DB press", sets: 3, repsLabel: "10–12", restCategory: "compound" },
      { name: "Overhead tricep extension", sets: 3, repsLabel: "12" },
      { name: "Hammer curls", sets: 3, repsLabel: "12" },
    ],
  },
  5: {
    name: "Accessory",
    kind: "accessory",
    lift: null,
    supplemental: null,
    hasPsoasStrength: true,
    hasShoulderRehab: false,
    accessories: [
      { name: "Seated cable row (close grip)", sets: 5, repsLabel: "10" },
      { name: "Lat pulldown", sets: 4, repsLabel: "10", restCategory: "compound" },
      { name: "Straight-arm pulldown", sets: 3, repsLabel: "12", restCategory: "compound" },
      { name: "Lateral raise", sets: 4, repsLabel: "15" },
      { name: "Reverse pec deck / cable reverse fly", sets: 3, repsLabel: "15" },
      { name: "Zone 2", sets: null, repsLabel: "30 min" },
    ],
  },
  6: {
    name: "Trap Bar Deadlift",
    kind: "main",
    lift: "trapBarDeadlift",
    supplemental: "bbb",
    hasPsoasStrength: false,
    hasShoulderRehab: false,
    accessories: [
      { name: "Bulgarian split squat", sets: 3, repsLabel: "10/leg", restCategory: "compound" },
      { name: "Shrugs (straps)", sets: 3, repsLabel: "12–15" },
      { name: "Seated calf raise", sets: 5, repsLabel: "15" },
      { name: "Cable crunch", sets: 3, repsLabel: "12" },
    ],
  },
};

export const DAY_COUNT = 6;
export const WEEK_COUNT = 4;

export function dayInfo(dayIndex) {
  return DAYS[dayIndex];
}

/**
 * Full accessory definition (name, sets, repsLabel, cue, restCategory,
 * supersetRole, ...) for a named exercise on a given day, searching both the
 * day's own fixed accessories and Psoas Strength (present whenever
 * hasPsoasStrength is true). Returns null for ad hoc exercises added mid-
 * session, which have no such definition.
 *
 * A pair is expressed with no shared id — each exercise just carries its own
 * `supersetRole: "a" | "b"` — because nothing here ever needs to look up an
 * exercise's *partner*, only whether the exercise itself is the one rest
 * skips before ("a") or the one that starts the superset rest after ("b").
 */
export function accessoryDefFor(dayIndex, exerciseName) {
  const day = dayInfo(dayIndex);
  const pool = [...day.accessories, ...(day.hasPsoasStrength ? PSOAS_STRENGTH : [])];
  return pool.find((a) => a.name === exerciseName) || null;
}

/** Which rest-timer bucket (see settings.restTimerSec) a set-based accessory uses. */
export function restCategoryFor(accessory) {
  return accessory?.restCategory || DEFAULT_REST_CATEGORY;
}

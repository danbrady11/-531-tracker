// Static description of the 5-day rolling cycle. Day numbers are 1-5.

// Rest-timer bucket for a set-based accessory. Anything not explicitly
// tagged "compound" below defaults to "isolation" — see restCategoryFor().
// Main lift working sets and BBB/FSL supplemental sets use their own fixed
// "main" bucket instead, handled directly in today.js/app.js.
export const DEFAULT_REST_CATEGORY = "isolation";

export const DAYS = {
  1: {
    name: "Bench",
    kind: "main",
    lift: "bench",
    supplemental: "bbb",
    accessories: [
      { name: "Pull-ups (weighted)", sets: 4, repsLabel: "6–10", restCategory: "compound" },
      { name: "Seated cable row (wide/neutral)", sets: 5, repsLabel: "10" },
      { name: "Cable fly (mid-height)", sets: 3, repsLabel: "12–15" },
      { name: "Lateral raise", sets: 4, repsLabel: "15", supersetRole: "a" },
      { name: "Reverse pec deck / cable reverse fly", sets: 4, repsLabel: "15", supersetRole: "b" },
      { name: "Cable rope overhead extension", sets: 3, repsLabel: "12", cue: "facing away from the stack, slight forward lean, rope split at the top" },
      { name: "Curls", sets: 3, repsLabel: "12" },
    ],
  },
  2: {
    name: "Squat",
    kind: "main",
    lift: "squat",
    supplemental: "bbb",
    accessories: [
      { name: "RDL", sets: 3, repsLabel: "10", restCategory: "compound" },
      { name: "Swiss ball leg curl", sets: 3, repsLabel: "10–12", restCategory: "compound" },
      { name: "Calf raise", sets: 5, repsLabel: "15", variants: ["Standing calf raise", "Seated calf raise"] },
      { name: "Lateral raise", sets: 4, repsLabel: "15", supersetRole: "a" },
      { name: "Reverse pec deck / cable reverse fly", sets: 4, repsLabel: "15", supersetRole: "b" },
      { name: "Cable crunch", sets: 3, repsLabel: "12" },
    ],
  },
  3: {
    name: "Press",
    kind: "main",
    lift: "press",
    supplemental: "bbb",
    accessories: [
      { name: "Chin-ups", sets: 4, repsLabel: "", restCategory: "compound" },
      { name: "Incline DB press", sets: 3, repsLabel: "10–12", restCategory: "compound" },
      { name: "Cable rope overhead extension", sets: 3, repsLabel: "12", cue: "facing away from the stack, slight forward lean, rope split at the top" },
      { name: "Hammer curls", sets: 3, repsLabel: "12" },
    ],
  },
  4: {
    name: "Accessory",
    kind: "accessory",
    lift: null,
    supplemental: null,
    accessories: [
      { name: "Incline barbell press", sets: 3, repsLabel: "8–10", restCategory: "compound" },
      { name: "Flat DB press", sets: 3, repsLabel: "8–10", restCategory: "compound" },
      { name: "Seated cable row (close grip)", sets: 5, repsLabel: "10" },
      { name: "Lat pulldown", sets: 4, repsLabel: "10", restCategory: "compound" },
      { name: "Straight-arm pulldown", sets: 3, repsLabel: "12", restCategory: "compound" },
      { name: "Lateral raise", sets: 4, repsLabel: "15", supersetRole: "a" },
      { name: "Reverse pec deck / cable reverse fly", sets: 3, repsLabel: "15", supersetRole: "b" },
    ],
  },
  5: {
    name: "Deadlift",
    kind: "main",
    lift: "deadlift",
    supplemental: "bbb",
    accessories: [
      { name: "Bulgarian split squat", sets: 3, repsLabel: "10/leg", restCategory: "compound" },
      { name: "Shrugs (straps)", sets: 3, repsLabel: "12–15" },
      { name: "Calf raise", sets: 5, repsLabel: "15", variants: ["Seated calf raise", "Standing calf raise"] },
      { name: "Cable crunch", sets: 3, repsLabel: "12" },
    ],
  },
};

// Day numbers removed from the active program (Recovery, dropped entirely)
// but kept here so old session logs that still reference them — remapped to
// this reserved slot by storage.js's migrate() rather than left colliding
// with a new day's number — render a correct name/content instead of
// crashing. Never included in DAY_COUNT or any day-cycling logic, so nothing
// new is ever built for one.
const LEGACY_DAYS = {
  6: {
    name: "Recovery",
    kind: "recovery",
    lift: null,
    supplemental: null,
    accessories: [
      { name: "Yoga", sets: null, repsLabel: "" },
      { name: "Zone 2", sets: null, repsLabel: "30 min" },
    ],
  },
};

export const DAY_COUNT = 5;
export const WEEK_COUNT = 4;

export function dayInfo(dayIndex) {
  return DAYS[dayIndex] || LEGACY_DAYS[dayIndex];
}

/**
 * Full accessory definition (name, sets, repsLabel, cue, restCategory,
 * supersetRole, variants, ...) for a named exercise on a given day's fixed
 * accessory list. Matches either an accessory's own name or, for one
 * offering variants (e.g. standing/seated calf raise), any of its variant
 * names — session logs are always keyed by the concrete variant actually
 * performed, never the generic slot name. Returns null for ad hoc exercises
 * added mid-session, which have no such definition.
 *
 * A pair is expressed with no shared id — each exercise just carries its own
 * `supersetRole: "a" | "b"` — because nothing here ever needs to look up an
 * exercise's *partner*, only whether the exercise itself is the one rest
 * skips before ("a") or the one that starts the superset rest after ("b").
 */
export function accessoryDefFor(dayIndex, exerciseName) {
  const day = dayInfo(dayIndex);
  return day.accessories.find((a) => a.name === exerciseName || a.variants?.includes(exerciseName)) || null;
}

/** Which rest-timer bucket (see settings.restTimerSec) a set-based accessory uses. */
export function restCategoryFor(accessory) {
  return accessory?.restCategory || DEFAULT_REST_CATEGORY;
}

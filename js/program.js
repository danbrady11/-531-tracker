// Static description of the 6-session Push/Pull/Legs rotation. Day numbers
// are 1-6: Pull A, Bench (Push A), Squat (Legs A), Pull B, Press (Push B),
// Deadlift (Legs B) — each main-lift day is just named for its lift, since
// each lift only appears once; only Pull A/B need the A/B suffix. The
// intended weekly schedule has a rest day after each Legs session, but rest
// days aren't modeled here at all — they're never logged, and the next
// session is always just "whichever comes next in this order," regardless of
// how many calendar days separate two logged sessions. See state.js's
// advanceCycle for how the 5/3/1 week only advances once all four main lifts
// have been completed — Pull A/B never touch it.

// Rest-timer bucket for a set-based accessory. An exercise named in
// COMPOUND_EXERCISE_NAMES below gets "compound"; everything else defaults to
// "isolation" — see restCategoryFor(). An explicit `restCategory` on an
// accessory (only ever set on frozen LEGACY_DAYS entries below, from before
// this global list existed) always wins over both.
export const DEFAULT_REST_CATEGORY = "isolation";

// The authoritative compound list for the PPL program: pull-ups, chin-ups,
// cable rows, lat pulldowns, straight-arm pulldown, incline barbell press,
// dips, close-grip bench, machine chest press, RDL, hip thrust, Bulgarian
// split squat. Matched by the exact exercise name used in DAYS below (e.g.
// both cable-row grip variants, both lat-pulldown grip variants).
const COMPOUND_EXERCISE_NAMES = new Set([
  "Weighted pull-ups",
  "Chin-ups",
  "Seated cable row (wide/neutral)",
  "Seated cable row (close grip)",
  "Lat pulldown (wide grip)",
  "Lat pulldown (close/neutral grip)",
  "Straight-arm pulldown",
  "Incline barbell press",
  "Dips (bodyweight)",
  "Close-grip bench press",
  "Machine chest press",
  "RDL",
  "Hip thrust",
  "Bulgarian split squat",
]);

export const DAYS = {
  1: {
    name: "Pull A",
    kind: "accessory",
    lift: null,
    supplemental: null,
    accessories: [
      { name: "Weighted pull-ups", sets: 4, repsLabel: "6–10" },
      { name: "Seated cable row (wide/neutral)", sets: 4, repsLabel: "8–12" },
      { name: "Lat pulldown (wide grip)", sets: 3, repsLabel: "10–12" },
      { name: "Straight-arm pulldown", sets: 3, repsLabel: "12–15" },
      { name: "Reverse pec deck / cable reverse fly", sets: 4, repsLabel: "15–20" },
      { name: "Lateral raise", sets: 4, repsLabel: "12–20" },
      { name: "Curls", sets: 4, repsLabel: "10–15" },
    ],
  },
  2: {
    name: "Bench",
    kind: "main",
    lift: "bench",
    supplemental: "bbb",
    // Both the main BBB scheme and its alt share these counts going forward
    // (3x10, down from the old 5x10) — see supplementalSetsForType in app.js.
    supplementalConfig: { sets: 3, targetReps: 10 },
    supplementalAlt: { type: "dbFlatPress", label: "DB flat press", sets: 3, targetReps: 10 },
    accessories: [
      { name: "Incline barbell press", sets: 3, repsLabel: "8–10" },
      { name: "Dips (bodyweight)", sets: 3, repsLabel: "" },
      { name: "Cable fly (mid-height)", sets: 3, repsLabel: "12–15" },
      { name: "Cable rope overhead extension", sets: 3, repsLabel: "10–15", cue: "facing away from the stack, slight forward lean, rope split at the top" },
    ],
  },
  3: {
    name: "Squat",
    kind: "main",
    lift: "squat",
    supplemental: "bbb",
    supplementalConfig: { sets: 3, targetReps: 10 },
    supplementalAlt: { type: "beltSquat", label: "Belt squat", sets: 3, targetReps: 10 },
    accessories: [
      { name: "RDL", sets: 3, repsLabel: "8–10" },
      { name: "Leg extension", sets: 4, repsLabel: "12–15", cue: "Pause at the top, lower slowly." },
      { name: "Machine leg curl", sets: 3, repsLabel: "10–12" },
      { name: "Standing calf raise", sets: 4, repsLabel: "12–15" },
      { name: "Lateral raise", sets: 4, repsLabel: "12–20" },
      { name: "Cable crunch", sets: 3, repsLabel: "10–15" },
    ],
  },
  4: {
    name: "Pull B",
    kind: "accessory",
    lift: null,
    supplemental: null,
    accessories: [
      { name: "Chin-ups", sets: 4, repsLabel: "6–12" },
      { name: "Seated cable row (close grip)", sets: 4, repsLabel: "10–12" },
      { name: "Lat pulldown (close/neutral grip)", sets: 3, repsLabel: "10–12" },
      { name: "Shrugs (straps)", sets: 3, repsLabel: "12–15" },
      { name: "Reverse pec deck / cable reverse fly", sets: 3, repsLabel: "15–20" },
      { name: "Lateral raise", sets: 4, repsLabel: "12–20" },
      { name: "Hammer curls", sets: 3, repsLabel: "10–15" },
      { name: "Incline DB curl", sets: 3, repsLabel: "10–12" },
    ],
  },
  5: {
    name: "Press",
    kind: "main",
    lift: "press",
    supplemental: "bbb",
    supplementalConfig: { sets: 3, targetReps: 10 },
    supplementalAlt: { type: "seatedDbPress", label: "Seated DB press", sets: 3, targetReps: 10 },
    accessories: [
      { name: "Close-grip bench press", sets: 3, repsLabel: "8–10" },
      { name: "Machine chest press", sets: 3, repsLabel: "10–15" },
      { name: "Dips (bodyweight)", sets: 3, repsLabel: "" },
      { name: "Rope pushdown", sets: 3, repsLabel: "10–15" },
    ],
  },
  6: {
    name: "Deadlift",
    kind: "main",
    lift: "deadlift",
    // No BBB on Deadlift — "Back-off" is its own supplemental type: 2x5 at
    // settings.deadliftBackoffPercentage of TM (65% default, editable). No
    // alt movement for this slot.
    supplemental: "backoff",
    supplementalConfig: { sets: 2, targetReps: 5 },
    accessories: [
      { name: "Hip thrust", sets: 3, repsLabel: "8–12" },
      { name: "Bulgarian split squat", sets: 3, repsLabel: "8–12/leg" },
      { name: "Machine leg curl", sets: 3, repsLabel: "10–12" },
      { name: "Leg extension", sets: 3, repsLabel: "12–15", cue: "Pause at the top, lower slowly." },
      { name: "Seated calf raise", sets: 4, repsLabel: "12–20" },
      { name: "Lateral raise", sets: 4, repsLabel: "12–20" },
      { name: "Cable crunch", sets: 3, repsLabel: "10–15" },
    ],
  },
};

// Day numbers removed from the active program over time, kept here so old
// session logs that still reference them — remapped to these reserved slots
// by storage.js's migrate() rather than left colliding with a new day's
// number — render a correct name/content instead of crashing. Never
// included in DAY_COUNT or any day-cycling logic, so nothing new is ever
// built for one. Content below is frozen exactly as each day was at the
// moment it stopped being live, including fields (restCategory, cue,
// supersetRole, variants) that no longer mean anything in the current
// program — they're only ever read for rendering an old log's name/sets.
const LEGACY_DAYS = {
  // The dedicated Accessory day, dropped when the program moved from a
  // 5-day to a 4-day rolling cycle — its exercises were redistributed across
  // Bench/Press/Deadlift (themselves now also retired — see 10-13 below).
  7: {
    name: "Accessory",
    kind: "accessory",
    lift: null,
    supplemental: null,
    accessories: [
      { name: "Incline barbell press", sets: 3, repsLabel: "8–10", restCategory: "compound" },
      { name: "Hex press", sets: 3, repsLabel: "12–15" },
      { name: "Seated cable row (close grip)", sets: 5, repsLabel: "10" },
      { name: "Lat pulldown", sets: 4, repsLabel: "10", restCategory: "compound" },
      { name: "Straight-arm pulldown", sets: 3, repsLabel: "12", restCategory: "compound" },
      { name: "Lateral raise", sets: 4, repsLabel: "15", supersetRole: "a" },
      { name: "Reverse pec deck / cable reverse fly", sets: 3, repsLabel: "15", supersetRole: "b" },
    ],
  },
  // The Accessory day's second life: pulled out of the rotation to become an
  // optional "bonus" session (started on demand from Today), then removed
  // entirely. Its exercises were redistributed onto Bench/Squat/Press/
  // Deadlift (themselves now also retired — see 10-13 below) instead of
  // carried forward as a day.
  8: {
    name: "Accessory",
    kind: "accessory",
    lift: null,
    supplemental: null,
    accessories: [
      { name: "Leg press", sets: 4, repsLabel: "10–12", restCategory: "compound", cue: "Belt squat if no leg press." },
      { name: "Seated leg curl", sets: 4, repsLabel: "10–12" },
      { name: "Standing calf raise", sets: 4, repsLabel: "15" },
      { name: "Pec deck", sets: 3, repsLabel: "12–15" },
      { name: "Lateral raise", sets: 4, repsLabel: "15", supersetRole: "a" },
      { name: "Reverse pec deck / cable reverse fly", sets: 3, repsLabel: "15", supersetRole: "b" },
      { name: "Hammer curls", sets: 4, repsLabel: "10–12" },
      { name: "Cable crunch", sets: 3, repsLabel: "12" },
    ],
  },
  // Recovery (yoga/Zone 2), the last day still in rotation before the
  // program moved to all-lifting days. Was reserved slot 6 until the
  // Push/Pull/Legs restructure needed that number for the new Legs B day —
  // moved here to 9 to free it up.
  9: {
    name: "Recovery",
    kind: "recovery",
    lift: null,
    supplemental: null,
    accessories: [
      { name: "Yoga", sets: null, repsLabel: "" },
      { name: "Zone 2", sets: null, repsLabel: "30 min" },
    ],
  },
  // The four single-lift-per-day rotation (Bench/Squat/Press/Deadlift),
  // retired by the move to the Push/Pull/Legs 6-day rotation. Frozen exactly
  // as each was just before that change — including the old global
  // restCategory tags, which the new program replaced with a single
  // COMPOUND_EXERCISE_NAMES list above.
  10: {
    name: "Bench",
    kind: "main",
    lift: "bench",
    supplemental: "bbb",
    supplementalAlt: { type: "dbFlatPress", label: "DB flat press", sets: 5, targetReps: 10 },
    accessories: [
      { name: "Pull-ups (weighted)", sets: 4, repsLabel: "6–10", restCategory: "compound" },
      { name: "Incline barbell press", sets: 3, repsLabel: "8–10", restCategory: "compound" },
      { name: "Cable fly (mid-height)", sets: 3, repsLabel: "12–15" },
      { name: "Cable rope overhead extension", sets: 3, repsLabel: "12", cue: "facing away from the stack, slight forward lean, rope split at the top" },
      { name: "Curls", sets: 4, repsLabel: "12" },
      { name: "Lateral raise", sets: 5, repsLabel: "15", supersetRole: "a" },
      { name: "Reverse pec deck / cable reverse fly", sets: 3, repsLabel: "15", supersetRole: "b" },
    ],
  },
  11: {
    name: "Squat",
    kind: "main",
    lift: "squat",
    supplemental: "bbb",
    supplementalAlt: { type: "beltSquat", label: "Belt squat", sets: 5, targetReps: 10 },
    accessories: [
      { name: "RDL", sets: 3, repsLabel: "10", restCategory: "compound" },
      { name: "Machine leg curl", sets: 3, repsLabel: "10–12", restCategory: "compound" },
      { name: "Leg extension", sets: 4, repsLabel: "12–15", cue: "Pause at the top, lower slowly." },
      { name: "Calf raise", sets: 5, repsLabel: "15", variants: ["Standing calf raise", "Seated calf raise"] },
      { name: "Lateral raise", sets: 5, repsLabel: "15", supersetRole: "a" },
      { name: "Reverse pec deck / cable reverse fly", sets: 4, repsLabel: "15", supersetRole: "b" },
      { name: "Cable crunch", sets: 3, repsLabel: "12" },
    ],
  },
  12: {
    name: "Press",
    kind: "main",
    lift: "press",
    supplemental: "bbb",
    supplementalAlt: { type: "seatedDbPress", label: "Seated DB press", sets: 5, targetReps: 10 },
    accessories: [
      { name: "Chin-ups", sets: 4, repsLabel: "", restCategory: "compound" },
      { name: "Seated cable row (wide/neutral)", sets: 5, repsLabel: "10", restCategory: "compound" },
      { name: "Straight-arm pulldown", sets: 3, repsLabel: "12", restCategory: "compound" },
      { name: "Hex press", sets: 3, repsLabel: "12–15" },
      { name: "Rope pushdown", sets: 3, repsLabel: "12" },
      { name: "Hammer curls", sets: 3, repsLabel: "12" },
    ],
  },
  13: {
    name: "Deadlift",
    kind: "main",
    lift: "deadlift",
    supplemental: null,
    accessories: [
      { name: "Hip thrust", sets: 3, repsLabel: "10", restCategory: "compound" },
      { name: "Bulgarian split squat", sets: 3, repsLabel: "10/leg", restCategory: "compound" },
      { name: "Machine leg curl", sets: 3, repsLabel: "10–12" },
      { name: "Leg extension", sets: 3, repsLabel: "12–15", cue: "Pause at the top, lower slowly." },
      { name: "Seated cable row (close grip)", sets: 3, repsLabel: "10–12", restCategory: "compound", cue: "Use straps. Keep torso still, no rocking." },
      { name: "Shrugs (straps)", sets: 3, repsLabel: "12–15" },
      { name: "Calf raise", sets: 5, repsLabel: "15", variants: ["Seated calf raise", "Standing calf raise"] },
      { name: "Cable crunch", sets: 3, repsLabel: "12" },
    ],
  },
};

export const DAY_COUNT = 6;
export const WEEK_COUNT = 4;

export function dayInfo(dayIndex) {
  return DAYS[dayIndex] || LEGACY_DAYS[dayIndex];
}

/**
 * Full accessory definition (name, sets, repsLabel, cue, restCategory,
 * supersetRole, variants, ...) for a named exercise on a given day's fixed
 * accessory list. Matches either an accessory's own name or, for one
 * offering variants (e.g. standing/seated calf raise, on frozen legacy days
 * only now), any of its variant names — session logs are always keyed by the
 * concrete variant actually performed, never the generic slot name. Returns
 * null for ad hoc exercises added mid-session, which have no such
 * definition.
 */
export function accessoryDefFor(dayIndex, exerciseName) {
  const day = dayInfo(dayIndex);
  return day.accessories.find((a) => a.name === exerciseName || a.variants?.includes(exerciseName)) || null;
}

/**
 * Which rest-timer bucket (see settings.restTimerSec) a set-based accessory
 * uses: an explicit `restCategory` (only ever set on frozen legacy days)
 * wins; otherwise "compound" for anything in COMPOUND_EXERCISE_NAMES, else
 * "isolation".
 */
export function restCategoryFor(accessory) {
  if (accessory?.restCategory) return accessory.restCategory;
  if (accessory?.name && COMPOUND_EXERCISE_NAMES.has(accessory.name)) return "compound";
  return DEFAULT_REST_CATEGORY;
}

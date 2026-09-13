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

export const DAYS = {
  1: {
    name: "Deadlift",
    kind: "main",
    lift: "deadlift",
    supplemental: "fsl",
    hasPsoasStrength: false,
    hasShoulderRehab: false,
    accessories: [
      { name: "Shrugs (straps)", sets: 3, repsLabel: "12–15" },
      { name: "Seated calf raise", sets: 5, repsLabel: "15" },
      { name: "Cable crunch", sets: 3, repsLabel: "12" },
    ],
  },
  2: {
    name: "Bench",
    kind: "main",
    lift: "bench",
    supplemental: "bbb",
    hasPsoasStrength: true,
    hasShoulderRehab: true,
    accessories: [
      { name: "Pull-ups (weighted)", sets: 4, repsLabel: "6–10" },
      { name: "Seated cable row (wide/neutral)", sets: 5, repsLabel: "10" },
      { name: "Lateral raise", sets: 4, repsLabel: "15" },
      { name: "Reverse pec deck / cable reverse fly", sets: 4, repsLabel: "15" },
      { name: "Overhead tricep extension", sets: 3, repsLabel: "12" },
      { name: "Curls", sets: 3, repsLabel: "12" },
    ],
  },
  3: {
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
  4: {
    name: "Squat",
    kind: "main",
    lift: "squat",
    supplemental: "fsl",
    hasPsoasStrength: false,
    hasShoulderRehab: false,
    accessories: [
      { name: "Bulgarian split squat", sets: 3, repsLabel: "10/leg" },
      { name: "Standing calf raise", sets: 5, repsLabel: "15" },
      { name: "Lateral raise", sets: 4, repsLabel: "15" },
      { name: "Reverse pec deck / cable reverse fly", sets: 4, repsLabel: "15" },
      { name: "Cable crunch", sets: 3, repsLabel: "12" },
    ],
  },
  5: {
    name: "Press",
    kind: "main",
    lift: "press",
    supplemental: "bbb",
    hasPsoasStrength: false,
    hasShoulderRehab: true,
    accessories: [
      { name: "Chin-ups", sets: 4, repsLabel: "" },
      { name: "Hammer curls", sets: 3, repsLabel: "12" },
    ],
  },
  6: {
    name: "Accessory",
    kind: "accessory",
    lift: null,
    supplemental: null,
    hasPsoasStrength: true,
    hasShoulderRehab: false,
    accessories: [
      { name: "Seated cable row (close grip)", sets: 5, repsLabel: "10" },
      { name: "Lateral raise", sets: 4, repsLabel: "15" },
      { name: "Reverse pec deck / cable reverse fly", sets: 3, repsLabel: "15" },
      { name: "Zone 2", sets: null, repsLabel: "30 min" },
    ],
  },
};

export const DAY_COUNT = 6;
export const WEEK_COUNT = 4;

export function dayInfo(dayIndex) {
  return DAYS[dayIndex];
}

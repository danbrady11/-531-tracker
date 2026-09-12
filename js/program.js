// Static description of the 6-day rolling cycle. Day numbers are 1-6.

export const DAYS = {
  1: {
    name: "Deadlift",
    kind: "main",
    lift: "deadlift",
    supplemental: "fsl",
    accessories: [
      { name: "Shrugs (straps)", sets: 3, repsLabel: "12–15" },
      { name: "Seated calf raise", sets: 4, repsLabel: "15" },
      { name: "Cable crunch", sets: 3, repsLabel: "12" },
    ],
  },
  2: {
    name: "Bench",
    kind: "main",
    lift: "bench",
    supplemental: "bbb",
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
    accessories: [
      { name: "Yoga", sets: null, repsLabel: "" },
      { name: "Walk", sets: null, repsLabel: "" },
      { name: "Zone 2", sets: null, repsLabel: "30 min" },
      { name: "Band pull-aparts (optional)", sets: 3, repsLabel: "20" },
      { name: "Face pulls (optional)", sets: 3, repsLabel: "20" },
    ],
  },
  4: {
    name: "Squat",
    kind: "main",
    lift: "squat",
    supplemental: "fsl",
    accessories: [
      { name: "Bulgarian split squat", sets: 3, repsLabel: "10/leg" },
      { name: "Standing calf raise", sets: 4, repsLabel: "15" },
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
    accessories: [
      { name: "Seated cable row (close grip)", sets: 5, repsLabel: "10" },
      { name: "Lateral raise", sets: 4, repsLabel: "15" },
      { name: "Reverse pec deck / cable reverse fly", sets: 3, repsLabel: "15" },
      { name: "Standing calf raise", sets: 3, repsLabel: "15" },
      { name: "Zone 2", sets: null, repsLabel: "30 min" },
    ],
  },
};

export const DAY_COUNT = 6;
export const WEEK_COUNT = 4;

export function dayInfo(dayIndex) {
  return DAYS[dayIndex];
}

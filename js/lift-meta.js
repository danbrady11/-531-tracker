// Shared display metadata for the four main lifts, used by History's chart legend
// and the Calendar's day-color coding.
export const LIFT_META = {
  deadlift: { label: "Deadlift", colorVar: "--danger" },
  squat: { label: "Squat", colorVar: "--accent" },
  bench: { label: "Bench", colorVar: "--success" },
  press: { label: "Press", colorVar: "--amrap" },
};
export const LIFT_ORDER = ["deadlift", "squat", "bench", "press"];

// The two non-lift day kinds (Recovery, Accessory) get their own colors too,
// so they're distinguishable from each other on the Calendar instead of both
// falling back to the same generic gray.
export const NON_LIFT_DAY_META = {
  recovery: { label: "Recovery", colorVar: "--rehab" },
  accessory: { label: "Accessory", colorVar: "--warn" },
};
export const NON_LIFT_COLOR_VAR = "--text-muted";

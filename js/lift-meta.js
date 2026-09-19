// Shared display metadata for the main lifts, used by History's chart legend,
// the cycle-completion TM prompt, and the Calendar's day-color coding.
// "trapBarDeadlift" is kept (even though no day uses it anymore — Day 6 was
// briefly switched to it, then reverted to conventional deadlift) so that
// brief stretch of history still shows correctly in Settings and Calendar
// instead of disappearing, the same reasoning "deadlift" itself was kept for
// during the period trap bar was active.
export const LIFT_META = {
  deadlift: { label: "Deadlift", colorVar: "--danger" },
  squat: { label: "Squat", colorVar: "--accent" },
  bench: { label: "Bench", colorVar: "--success" },
  press: { label: "Press", colorVar: "--amrap" },
  trapBarDeadlift: { label: "Trap Bar Deadlift", colorVar: "--pink" },
};
export const LIFT_ORDER = ["deadlift", "squat", "bench", "press", "trapBarDeadlift"];

// Excludes trapBarDeadlift: its brief, discontinuous run isn't worth its own
// line in the combined 1RM/volume chart, unlike LIFT_ORDER's other uses
// (Lift Status on the splash screen) where surfacing it if it has history is
// still useful.
export const CHART_LIFT_ORDER = LIFT_ORDER.filter((lift) => lift !== "trapBarDeadlift");

// The two non-lift day kinds (Recovery, Accessory) get their own colors too,
// so they're distinguishable from each other on the Calendar instead of both
// falling back to the same generic gray.
export const NON_LIFT_DAY_META = {
  recovery: { label: "Recovery", colorVar: "--rehab" },
  accessory: { label: "Accessory", colorVar: "--warn" },
};
export const NON_LIFT_COLOR_VAR = "--text-muted";

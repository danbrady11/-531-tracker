// Shared display metadata for the four main lifts, used by History's chart legend
// and the Calendar's day-color coding.
export const LIFT_META = {
  deadlift: { label: "Deadlift", colorVar: "--danger" },
  squat: { label: "Squat", colorVar: "--accent" },
  bench: { label: "Bench", colorVar: "--success" },
  press: { label: "Press", colorVar: "--amrap" },
};
export const LIFT_ORDER = ["deadlift", "squat", "bench", "press"];
export const NON_LIFT_COLOR_VAR = "--text-muted";

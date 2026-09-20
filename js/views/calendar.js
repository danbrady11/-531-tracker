import { sessionsByDate } from "../state.js";
import { dayInfo } from "../program.js";
import { LIFT_META, CHART_LIFT_ORDER, NON_LIFT_DAY_META, NON_LIFT_COLOR_VAR } from "../lift-meta.js";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const CARDIO_META = {
  Yoga: { label: "Yoga", colorVar: "--rehab" },
  "Zone 2": { label: "Zone 2 Cardio", colorVar: "--indigo" },
};

// Module-local view state: which month is currently displayed. Resets to the
// real-world current month isn't necessary across renders since we keep it here.
let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth(); // 0-11

function dateKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function colorVarForLog(log) {
  const day = dayInfo(log.dayIndex);
  // Prefer the lift the session itself actually recorded over the day
  // slot's current lift — a day's main lift can change (e.g. Day 6 moving
  // from conventional to trap bar deadlift) without rewriting old logs, so
  // this keeps old sessions colored/labeled for what was really performed.
  const lift = log.lift || day.lift;
  if (lift) return LIFT_META[lift]?.colorVar || NON_LIFT_COLOR_VAR;
  return NON_LIFT_DAY_META[day.kind]?.colorVar || NON_LIFT_COLOR_VAR;
}

// Main lift days and the dedicated Accessory day — excludes Recovery, whose
// own activity (Yoga / Zone 2) gets its own calendar below instead.
function isMainOrAccessoryLog(log) {
  const kind = dayInfo(log.dayIndex).kind;
  return kind === "main" || kind === "accessory";
}

// Distinct cardio exercises completed across a date's logs (a single
// Recovery-day session can have both Yoga and Zone 2 checked off).
function cardioNamesForLogs(logs) {
  const names = new Set();
  for (const log of logs) {
    for (const s of log.accessorySets || []) {
      if (CARDIO_META[s.exerciseName] && s.completed) names.add(s.exerciseName);
    }
  }
  return names;
}

function buildCells(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells = [];
  for (let i = 0; i < startWeekday; i++) {
    cells.push({ day: daysInPrevMonth - startWeekday + 1 + i, muted: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, muted: false, key: dateKey(year, month, d) });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: cells.length - startWeekday - daysInMonth + 1, muted: true });
  }
  return cells;
}

// cellInfoForKey(key) -> { count, colorVar }, where colorVar is only
// meaningful when count === 1 (count > 1 always renders a muted dot,
// since a single dot can't represent more than one distinct color).
function renderGrid(cells, todayKey, cellInfoForKey) {
  return cells
    .map((c) => {
      if (c.muted) return `<div class="cal-cell muted"><span>${c.day}</span></div>`;
      const { count, colorVar } = cellInfoForKey(c.key);
      const isToday = c.key === todayKey;
      let dotHtml = "";
      if (count === 1) {
        dotHtml = `<span class="cal-dot" style="background:var(${colorVar})"></span>`;
      } else if (count > 1) {
        dotHtml = `<span class="cal-dot" style="background:var(--text-muted)"></span>`;
      }
      return `<button class="cal-cell ${count ? "has-session" : ""} ${isToday ? "is-today" : ""}" data-action="cal-day" data-key="${c.key}">
        <span>${c.day}</span>
        ${dotHtml}
      </button>`;
    })
    .join("");
}

export function renderCalendar(root, ctx) {
  const { state } = ctx;
  const byDate = sessionsByDate(state.sessionLogs);
  const today = new Date();
  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());

  const cells = buildCells(viewYear, viewMonth);
  const mainCellInfo = (key) => {
    const logs = (byDate.get(key) || []).filter(isMainOrAccessoryLog);
    return { count: logs.length, colorVar: logs.length === 1 ? colorVarForLog(logs[0]) : null };
  };
  const cardioCellInfo = (key) => {
    const names = [...cardioNamesForLogs(byDate.get(key) || [])];
    return { count: names.length, colorVar: names.length === 1 ? CARDIO_META[names[0]].colorVar : null };
  };

  root.innerHTML = `
    <div class="card">
      <div class="cal-header">
        <button class="btn btn-sm btn-ghost" id="cal-prev" aria-label="Previous month">‹</button>
        <h3 style="margin:0;text-transform:none;letter-spacing:0;">${MONTH_NAMES[viewMonth]} ${viewYear}</h3>
        <button class="btn btn-sm btn-ghost" id="cal-next" aria-label="Next month">›</button>
      </div>
      <div class="cal-weekdays">${WEEKDAY_LABELS.map((w) => `<div>${w}</div>`).join("")}</div>
      <div class="cal-grid">${renderGrid(cells, todayKey, mainCellInfo)}</div>
      <div class="cal-legend">
        ${[...CHART_LIFT_ORDER.map((lift) => LIFT_META[lift]), NON_LIFT_DAY_META.accessory]
          .map((meta) => `<span class="legend-item"><span class="legend-swatch" style="background:var(${meta.colorVar})"></span>${meta.label}</span>`)
          .join("")}
      </div>
    </div>

    <div class="card">
      <h3 style="margin:0 0 10px;">Yoga / Zone 2 Cardio</h3>
      <div class="cal-weekdays">${WEEKDAY_LABELS.map((w) => `<div>${w}</div>`).join("")}</div>
      <div class="cal-grid">${renderGrid(cells, todayKey, cardioCellInfo)}</div>
      <div class="cal-legend">
        ${Object.values(CARDIO_META)
          .map((meta) => `<span class="legend-item"><span class="legend-swatch" style="background:var(${meta.colorVar})"></span>${meta.label}</span>`)
          .join("")}
      </div>
    </div>
  `;

  root.querySelector("#cal-prev").addEventListener("click", () => {
    viewMonth -= 1;
    if (viewMonth < 0) {
      viewMonth = 11;
      viewYear -= 1;
    }
    renderCalendar(root, ctx);
  });
  root.querySelector("#cal-next").addEventListener("click", () => {
    viewMonth += 1;
    if (viewMonth > 11) {
      viewMonth = 0;
      viewYear += 1;
    }
    renderCalendar(root, ctx);
  });
  root.querySelectorAll('[data-action="cal-day"]').forEach((el) =>
    el.addEventListener("click", () => ctx.actions.viewSessionsForDate(el.dataset.key))
  );
}

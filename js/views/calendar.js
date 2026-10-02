import { sessionsByDate } from "../state.js";
import { dayInfo } from "../program.js";
import { LIFT_META, CHART_LIFT_ORDER, NON_LIFT_DAY_META, NON_LIFT_COLOR_VAR } from "../lift-meta.js";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

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

// Main lift days and the dedicated Accessory day — excludes Recovery.
function isMainOrAccessoryLog(log) {
  const kind = dayInfo(log.dayIndex).kind;
  return kind === "main" || kind === "accessory";
}

// Leading/trailing cells from the adjacent months (shown to fill out the
// grid) get real date keys too, not just the current month's days — so a
// visible Oct 1-3 shown at the end of September's grid is clickable and
// shows its own sessions, same as any other day.
function buildCells(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;

  const cells = [];
  for (let i = 0; i < startWeekday; i++) {
    const day = daysInPrevMonth - startWeekday + 1 + i;
    cells.push({ day, muted: true, key: dateKey(prevYear, prevMonth, day) });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, muted: false, key: dateKey(year, month, d) });
  }
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ day: nextDay, muted: true, key: dateKey(nextYear, nextMonth, nextDay) });
    nextDay++;
  }
  return cells;
}

// cellInfoForKey(key) -> { colorVars }, one entry per session that day —
// one dot per session, each in its own lift's color.
function renderGrid(cells, todayKey, cellInfoForKey) {
  return cells
    .map((c) => {
      const { colorVars } = cellInfoForKey(c.key);
      const isToday = c.key === todayKey;
      const dotsHtml = colorVars
        .map((colorVar) => `<span class="cal-dot" style="background:var(${colorVar})"></span>`)
        .join("");
      return `<button class="cal-cell ${c.muted ? "muted" : ""} ${colorVars.length ? "has-session" : ""} ${isToday ? "is-today" : ""}" data-action="cal-day" data-key="${c.key}">
        <span>${c.day}</span>
        <span class="cal-dots">${dotsHtml}</span>
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
    return { colorVars: logs.map(colorVarForLog) };
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

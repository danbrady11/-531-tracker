import { dayInfo, DAY_COUNT } from "../program.js";
import { plateBreakdown, warmupSets, epleyE1RM } from "../calc.js";
import { lastAccessoryLog } from "../state.js";

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function plateStripText(weight, barWeight) {
  const { plates, barOnly, remainder } = plateBreakdown(weight, barWeight);
  if (barOnly) return "Bar only";
  if (plates.length === 0) return "Bar only";
  const parts = plates.map((p) => `${p.plate}${p.count > 1 ? `×${p.count}` : ""}`);
  let text = `Bar + ${parts.join(" + ")} /side`;
  if (remainder > 0) text += ` (+${remainder} unaccounted)`;
  return text;
}

function e1rmText(weight, reps) {
  if (!weight || !reps) return "";
  return `Est. 1RM ${Math.round(epleyE1RM(weight, reps))} lb`;
}

function mainSetRow(set, index, barWeight) {
  const doneClass = set.completed ? "done" : "";
  const amrapClass = set.isAmrap ? "amrap" : "";
  const pct = Math.round(set.percentage * 100);
  return `
    <div class="set-row ${amrapClass}" data-main-index="${index}">
      <button class="set-check ${doneClass}" data-action="toggle-main" data-index="${index}" aria-label="Mark set complete">
        ${set.completed ? "✓" : index + 1}
      </button>
      <div class="set-info">
        <div class="set-weight">
          <input class="set-input" type="number" inputmode="decimal" step="5" value="${set.weight}" data-action="main-weight" data-index="${index}" style="width:72px" /> lb
          ${set.isAmrap ? '<span class="amrap-tag"> AMRAP</span>' : ""}
        </div>
        <div class="set-meta">${pct}% · target ${set.targetReps}${set.isAmrap ? "+" : ""} reps${
          set.actualReps != null ? ` · logged ${set.actualReps}` : ""
        }</div>
        <div class="plate-strip">${plateStripText(set.weight, barWeight)}</div>
        ${
          set.isAmrap
            ? `<div class="e1rm-line" data-e1rm-index="${index}">${e1rmText(set.weight, set.actualReps)}</div>`
            : ""
        }
      </div>
      ${
        set.isAmrap
          ? `<input class="set-input" type="number" inputmode="numeric" placeholder="reps" value="${set.actualReps ?? ""}" data-action="amrap-reps" data-index="${index}" />`
          : `<input class="set-input" type="number" inputmode="numeric" placeholder="${set.targetReps}" value="${set.actualReps ?? ""}" data-action="main-reps" data-index="${index}" />`
      }
    </div>`;
}

function supplementalRow(set, index, kind, barWeight) {
  const doneClass = set.completed ? "done" : "";
  return `
    <div class="set-row" data-supp-index="${index}">
      <button class="set-check ${doneClass}" data-action="toggle-supp" data-kind="${kind}" data-index="${index}" aria-label="Mark set complete">
        ${set.completed ? "✓" : index + 1}
      </button>
      <div class="set-info">
        <div class="set-weight">
          <input class="set-input" type="number" inputmode="decimal" step="5" value="${set.weight}" data-action="supp-weight" data-kind="${kind}" data-index="${index}" style="width:72px" /> lb
        </div>
        <div class="set-meta">${Math.round(set.percentage * 100)}% · target ${set.targetReps} reps</div>
        <div class="plate-strip">${plateStripText(set.weight, barWeight)}</div>
      </div>
      <input class="set-input" type="number" inputmode="numeric" placeholder="${set.targetReps}" value="${set.reps ?? ""}" data-action="supp-reps" data-kind="${kind}" data-index="${index}" />
    </div>`;
}

function accessorySetChip(exerciseName, setIndex, entry, prefill) {
  const weight = entry.weight ?? "";
  const reps = entry.reps ?? "";
  const placeholderWeight = prefill?.weight ?? "";
  const placeholderReps = prefill?.reps ?? "";
  const completed = entry.completed ? "completed" : "";
  return `
    <div class="accessory-set ${completed}">
      <span class="accessory-set-idx">${setIndex + 1}</span>
      <input class="set-input" type="number" inputmode="decimal" step="2.5" placeholder="${placeholderWeight}" value="${weight}"
        data-action="accessory-value" data-field="weight" data-exercise="${escapeHtml(exerciseName)}" data-index="${setIndex}" style="width:56px" />
      <input class="set-input" type="number" inputmode="numeric" placeholder="${placeholderReps}" value="${reps}"
        data-action="accessory-value" data-field="reps" data-exercise="${escapeHtml(exerciseName)}" data-index="${setIndex}" style="width:48px" />
      <button class="set-check ${completed}" data-action="toggle-accessory" data-exercise="${escapeHtml(exerciseName)}" data-index="${setIndex}" aria-label="Mark set complete" style="width:36px;height:36px;min-width:36px;">
        ${entry.completed ? "✓" : ""}
      </button>
    </div>`;
}

function accessoryBlock(accessory, session, sessionLogs) {
  const entries = (session.accessorySets || []).filter((s) => s.exerciseName === accessory.name);
  const chips = entries
    .map((entry, i) => accessorySetChip(accessory.name, entry.setIndex ?? i, entry, lastAccessoryLog(sessionLogs, accessory.name, entry.setIndex ?? i)))
    .join("");
  return `
    <div class="accessory-block">
      <div class="accessory-name">
        <span>${escapeHtml(accessory.name)}</span>
        <span class="accessory-target">${accessory.sets ? `${accessory.sets}×${accessory.repsLabel}` : accessory.repsLabel}</span>
      </div>
      ${entries.length ? `<div class="accessory-sets">${chips}</div>` : `<div class="set-meta">Log when done — no set count tracked.</div>`}
    </div>`;
}

const DAY_KIND_LABEL = { main: "Main lift day", recovery: "Recovery day", accessory: "Accessory day" };

let todayScreen = "splash"; // 'splash' | 'workout'

export function renderToday(root, ctx) {
  if (todayScreen === "workout") {
    renderWorkoutScreen(root, ctx);
  } else {
    renderSplashScreen(root, ctx);
  }
}

function renderSplashScreen(root, ctx) {
  const { state } = ctx;
  const { dayIndex, weekIndex, cycleNumber } = state.cycleState;
  const day = dayInfo(dayIndex);

  const otherDaysHtml = Array.from({ length: DAY_COUNT }, (_, i) => i + 1)
    .filter((i) => i !== dayIndex)
    .map((i) => {
      const d = dayInfo(i);
      return `<button class="splash-day-row" data-action="start-day" data-day="${i}">
        <span class="splash-day-num">${i}</span>
        <span class="splash-day-name">${escapeHtml(d.name)}</span>
        <span class="splash-day-arrow" aria-hidden="true">›</span>
      </button>`;
    })
    .join("");

  root.innerHTML = `
    <div class="card splash-hero">
      <div class="splash-kicker">Up next · Cycle ${cycleNumber} · Week ${weekIndex} of 4</div>
      <h2 class="splash-title">${escapeHtml(day.name)}</h2>
      <div class="set-meta">${DAY_KIND_LABEL[day.kind]}</div>
      <button class="btn btn-primary btn-block" style="margin-top:14px;" data-action="start-day" data-day="${dayIndex}">Start Workout</button>
    </div>
    <div class="section-label">Or pick a different day</div>
    <div class="card splash-other-days">${otherDaysHtml}</div>
  `;

  root.querySelectorAll('[data-action="start-day"]').forEach((el) =>
    el.addEventListener("click", () => {
      const day = Number(el.dataset.day);
      if (day !== state.cycleState.dayIndex) ctx.actions.chooseDay(day);
      todayScreen = "workout";
      renderToday(root, ctx);
    })
  );
}

function renderWorkoutScreen(root, ctx) {
  const { state } = ctx;
  const { dayIndex, weekIndex, cycleNumber } = state.cycleState;
  const day = dayInfo(dayIndex);
  const session = state.currentSession;
  const isMainDay = day.kind === "main";
  const bar = state.settings.barWeight;

  let html = `<button class="btn btn-sm btn-ghost" data-action="back-to-splash" style="margin-bottom:8px;">‹ Overview</button>`;
  html += `<div class="day-kicker">Cycle ${cycleNumber} · Week ${weekIndex} of 4 · Day ${dayIndex} of 6</div>`;
  html += `<h2 style="margin:0 0 12px;font-size:1.6rem;">${escapeHtml(day.name)}</h2>`;

  if (isMainDay) {
    const tm = state.trainingMaxes[day.lift].currentValue;
    html += `<div class="card">
      <h3>Main sets — TM ${tm} lb</h3>
      ${session.mainSets.map((s, i) => mainSetRow(s, i, bar)).join("")}
      <div class="btn-row">
        <button class="btn btn-sm" data-action="start-timer" data-seconds="${state.settings.restTimerMainSec}" data-label="Main set rest">Rest ${Math.round(state.settings.restTimerMainSec / 60)}:${String(state.settings.restTimerMainSec % 60).padStart(2, "0")}</button>
        <button class="btn btn-sm btn-ghost" data-action="toggle-warmup">Warm-ups</button>
      </div>
      <div id="warmup-panel" hidden></div>
    </div>`;

    if (day.supplemental) {
      const label = day.supplemental === "fsl" ? "FSL 3×8" : `BBB 5×10 (${Math.round(state.settings.bbbPercentage * 100)}%)`;
      html += `<div class="card">
        <h3>${label}</h3>
        ${session.supplementalSets.map((s, i) => supplementalRow(s, i, day.supplemental, bar)).join("")}
      </div>`;
    }
  } else {
    html += `<div class="card"><h3>${day.kind === "recovery" ? "Recovery" : "Accessory day"}</h3>
      <div class="set-meta">No main lift today.</div></div>`;
  }

  html += `<div class="card">
    <h3>Accessories</h3>
    ${day.accessories.map((a) => accessoryBlock(a, session, state.sessionLogs)).join("")}
    <div class="btn-row">
      <button class="btn btn-sm" data-action="start-timer" data-seconds="${state.settings.restTimerIsolationSec}" data-label="Isolation rest">Rest ${Math.round(state.settings.restTimerIsolationSec / 60)}:${String(state.settings.restTimerIsolationSec % 60).padStart(2, "0")}</button>
    </div>
  </div>`;

  html += `<div class="card notes-field">
    <h3>Notes</h3>
    <textarea data-action="notes" placeholder="How'd it feel?">${escapeHtml(session.notes || "")}</textarea>
  </div>`;

  html += `<div class="btn-row">
    <button class="btn btn-primary btn-block" data-action="complete-day">Complete Day</button>
  </div>
  <div class="btn-row">
    <button class="btn btn-block" data-action="skip-day">Skip Day</button>
  </div>`;

  root.innerHTML = html;

  const warmupBtn = root.querySelector('[data-action="toggle-warmup"]');
  if (warmupBtn) {
    warmupBtn.addEventListener("click", () => {
      const panel = root.querySelector("#warmup-panel");
      if (panel.hidden) {
        const tm = state.trainingMaxes[day.lift].currentValue;
        const sets = warmupSets(tm, state.settings.roundingIncrement);
        panel.innerHTML = sets
          .map(
            (s) =>
              `<div class="set-row"><div class="set-info"><div class="set-weight">${s.weight} lb</div><div class="set-meta">${Math.round(s.percentage * 100)}% × ${s.targetReps}</div><div class="plate-strip">${plateStripText(s.weight, bar)}</div></div></div>`
          )
          .join("");
        panel.hidden = false;
      } else {
        panel.hidden = true;
      }
    });
  }

  root.querySelector('[data-action="back-to-splash"]')?.addEventListener("click", () => {
    todayScreen = "splash";
    renderToday(root, ctx);
  });

  wireActions(root, ctx);
}

function wireActions(root, ctx) {
  const { actions } = ctx;

  root.querySelectorAll('[data-action="toggle-main"]').forEach((el) =>
    el.addEventListener("click", () => actions.toggleMainSet(Number(el.dataset.index)))
  );
  const updateE1rmPreview = (index) => {
    const line = root.querySelector(`[data-e1rm-index="${index}"]`);
    if (!line) return;
    const weightInput = root.querySelector(`[data-action="main-weight"][data-index="${index}"]`);
    const repsInput = root.querySelector(`[data-action="amrap-reps"][data-index="${index}"]`);
    line.textContent = e1rmText(Number(weightInput?.value), Number(repsInput?.value));
  };

  root.querySelectorAll('[data-action="main-weight"]').forEach((el) => {
    el.addEventListener("change", () => actions.setMainWeight(Number(el.dataset.index), Number(el.value)));
    el.addEventListener("input", () => updateE1rmPreview(Number(el.dataset.index)));
  });
  root.querySelectorAll('[data-action="main-reps"]').forEach((el) =>
    el.addEventListener("change", () => actions.setMainReps(Number(el.dataset.index), el.value === "" ? null : Number(el.value)))
  );
  root.querySelectorAll('[data-action="amrap-reps"]').forEach((el) => {
    el.addEventListener("change", () => actions.setMainReps(Number(el.dataset.index), el.value === "" ? null : Number(el.value)));
    el.addEventListener("input", () => updateE1rmPreview(Number(el.dataset.index)));
  });

  root.querySelectorAll('[data-action="toggle-supp"]').forEach((el) =>
    el.addEventListener("click", () => actions.toggleSupplementalSet(el.dataset.kind, Number(el.dataset.index)))
  );
  root.querySelectorAll('[data-action="supp-weight"]').forEach((el) =>
    el.addEventListener("change", () => actions.setSupplementalWeight(el.dataset.kind, Number(el.dataset.index), Number(el.value)))
  );
  root.querySelectorAll('[data-action="supp-reps"]').forEach((el) =>
    el.addEventListener("change", () => actions.setSupplementalReps(el.dataset.kind, Number(el.dataset.index), el.value === "" ? null : Number(el.value)))
  );

  root.querySelectorAll('[data-action="toggle-accessory"]').forEach((el) =>
    el.addEventListener("click", () => actions.toggleAccessorySet(el.dataset.exercise, Number(el.dataset.index)))
  );
  root.querySelectorAll('[data-action="accessory-value"]').forEach((el) =>
    el.addEventListener("change", () =>
      actions.setAccessoryValue(el.dataset.exercise, Number(el.dataset.index), el.dataset.field, el.value === "" ? null : Number(el.value))
    )
  );

  const notes = root.querySelector('[data-action="notes"]');
  if (notes) notes.addEventListener("change", () => actions.updateNotes(notes.value));

  root.querySelectorAll('[data-action="start-timer"]').forEach((el) =>
    el.addEventListener("click", () => actions.startTimer(Number(el.dataset.seconds), el.dataset.label))
  );

  root.querySelector('[data-action="complete-day"]')?.addEventListener("click", () => {
    todayScreen = "splash";
    actions.completeDay();
  });
  root.querySelector('[data-action="skip-day"]')?.addEventListener("click", () => {
    todayScreen = "splash";
    actions.skipDay();
  });
}

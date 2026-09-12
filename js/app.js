import { loadState, saveState, exportStateJSON, importStateJSON } from "./storage.js";
import { mainSetsForWeek, fslSets, bbbSets, LIFTS } from "./calc.js";
import { advanceCycle, progressTrainingMaxes, newSessionLog, lastAccessoryLog, sessionsByDate } from "./state.js";
import { dayInfo, DAY_COUNT } from "./program.js";
import { renderToday } from "./views/today.js";
import { renderSettings } from "./views/settings.js";
import { renderHistory } from "./views/history.js";
import { renderCalendar } from "./views/calendar.js";
import { startRestTimer, cancelRestTimer, subscribeRestTimer, formatMs } from "./timer.js";

let state = loadState();
let currentView = "today";

const viewRoot = document.getElementById("view-root");
const cycleBadge = document.getElementById("cycle-badge");
const modalRoot = document.getElementById("modal-root");

function persist() {
  saveState(state);
}

function buildSessionForCurrentCycle() {
  const { dayIndex, weekIndex } = state.cycleState;
  const day = dayInfo(dayIndex);
  const roundingIncrement = state.settings.roundingIncrement;

  let mainSets = [];
  let supplementalSets = [];

  if (day.kind === "main") {
    const tm = state.trainingMaxes[day.lift].currentValue;
    mainSets = mainSetsForWeek(tm, weekIndex, roundingIncrement).map((s) => ({ ...s, completed: false }));
    if (day.supplemental === "fsl") {
      supplementalSets = fslSets(tm, weekIndex, roundingIncrement).map((s) => ({ ...s, completed: false }));
    } else if (day.supplemental === "bbb") {
      supplementalSets = bbbSets(tm, weekIndex, state.settings.bbbPercentage, roundingIncrement).map((s) => ({ ...s, completed: false }));
    }
  }

  const session = newSessionLog(state.cycleState, mainSets, supplementalSets, day.accessories);
  session.accessorySets = session.accessorySets.map((entry) => {
    const prefill = lastAccessoryLog(state.sessionLogs, entry.exerciseName, entry.setIndex);
    return { ...entry, weight: prefill?.weight ?? null, reps: prefill?.reps ?? null };
  });
  return session;
}

function ensureCurrentSession() {
  const cs = state.cycleState;
  const session = state.currentSession;
  if (!session || session.dayIndex !== cs.dayIndex || session.weekIndex !== cs.weekIndex) {
    state.currentSession = buildSessionForCurrentCycle();
    persist();
  }
}

function updateCycleBadge() {
  const { dayIndex, weekIndex, cycleNumber } = state.cycleState;
  cycleBadge.textContent = `Day ${dayIndex}/6 · Week ${weekIndex}/4 · Cycle ${cycleNumber}`;
}

function applyTheme() {
  document.documentElement.setAttribute("data-theme", state.settings.theme === "system" ? "" : state.settings.theme);
}

function renderCurrentView() {
  updateCycleBadge();
  document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.view === currentView));

  if (currentView === "today") {
    ensureCurrentSession();
    renderToday(viewRoot, { state, actions });
  } else if (currentView === "history") {
    renderHistory(viewRoot, { state, actions });
  } else if (currentView === "calendar") {
    renderCalendar(viewRoot, { state, actions });
  } else if (currentView === "settings") {
    renderSettings(viewRoot, { state, actions });
  }
}

function showModal(innerHtml, wireFn) {
  modalRoot.innerHTML = `<div class="modal-backdrop" id="modal-backdrop"><div class="modal-sheet">${innerHtml}</div></div>`;
  const backdrop = document.getElementById("modal-backdrop");
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal();
  });
  wireFn?.(modalRoot);
}

function closeModal() {
  modalRoot.innerHTML = "";
}

function showToast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

function promptCycleCompletion() {
  const inc = state.settings.tmIncrements;
  const rows = LIFTS.map((lift) => {
    const cur = state.trainingMaxes[lift].currentValue;
    const next = cur + inc[lift];
    return `<div class="bw-row"><span>${lift[0].toUpperCase()}${lift.slice(1)}</span><span>${cur} → <strong>${next}</strong> lb</span></div>`;
  }).join("");

  showModal(
    `<h2>Cycle complete 🎉</h2>
     <p class="set-meta">Increase training maxes for the new cycle?</p>
     ${rows}
     <div class="btn-row">
       <button class="btn btn-primary btn-block" id="tm-confirm">Apply increases</button>
     </div>
     <div class="btn-row">
       <button class="btn btn-block" id="tm-skip">Keep TMs as-is</button>
     </div>`,
    (root) => {
      root.querySelector("#tm-confirm").addEventListener("click", () => {
        state.trainingMaxes = progressTrainingMaxes(state.trainingMaxes, state.settings.tmIncrements);
        persist();
        closeModal();
        renderCurrentView();
      });
      root.querySelector("#tm-skip").addEventListener("click", () => {
        closeModal();
        renderCurrentView();
      });
    }
  );
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function detailLine(label, weight, reps, completed) {
  const amount = [weight != null ? `${weight} lb` : null, reps != null ? `× ${reps}` : null].filter(Boolean).join(" ");
  const check = completed == null ? "" : `<span class="session-detail-check ${completed ? "yes" : "no"}">${completed ? "✓" : "✕"}</span>`;
  return `<div class="session-detail-line"><span>${escapeHtml(label)}</span><span>${amount} ${check}</span></div>`;
}

function renderSessionDetail(log) {
  const day = dayInfo(log.dayIndex);
  let html = `<h2>${escapeHtml(day.name)}</h2>
    <p class="set-meta">${new Date(log.date).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
    · Cycle ${log.cycleNumber ?? 1} · Week ${log.weekIndex}${log.completed ? "" : " · skipped"}</p>`;

  if (log.warmupSets?.length) {
    html += `<div class="session-detail-group"><h4>Warm-up</h4>${log.warmupSets
      .map((s, i) => detailLine(`Set ${i + 1}`, s.weight, s.actualReps ?? s.reps, s.completed))
      .join("")}</div>`;
  }
  if (log.mainSets?.length) {
    html += `<div class="session-detail-group"><h4>Main sets</h4>${log.mainSets
      .map((s, i) => detailLine(`Set ${i + 1}${s.isAmrap ? " (AMRAP)" : ""}`, s.weight, s.actualReps, s.completed))
      .join("")}</div>`;
  }
  if (log.supplementalSets?.length) {
    const label = log.supplementalSets[0].type === "fsl" ? "FSL" : "Boring But Big";
    html += `<div class="session-detail-group"><h4>${label}</h4>${log.supplementalSets
      .map((s, i) => detailLine(`Set ${i + 1}`, s.weight, s.reps, s.completed))
      .join("")}</div>`;
  }
  if (log.accessorySets?.length) {
    const byExercise = new Map();
    for (const s of log.accessorySets) {
      if (!byExercise.has(s.exerciseName)) byExercise.set(s.exerciseName, []);
      byExercise.get(s.exerciseName).push(s);
    }
    for (const [name, sets] of byExercise) {
      html += `<div class="session-detail-group"><h4>${escapeHtml(name)}</h4>${sets
        .map((s, i) => detailLine(`Set ${i + 1}`, s.weight, s.reps, s.completed))
        .join("")}</div>`;
    }
  }
  if (log.notes) {
    html += `<div class="session-detail-group"><h4>Notes</h4><p>${escapeHtml(log.notes)}</p></div>`;
  }
  html += `<div class="btn-row"><button class="btn btn-block" id="detail-close">Close</button></div>`;
  return html;
}

function finishDay(completed) {
  const session = { ...state.currentSession, completed, date: new Date().toISOString() };
  state.sessionLogs.push(session);
  const { cycleState, cycleCompleted } = advanceCycle(state.cycleState);
  state.cycleState = cycleState;
  state.currentSession = null;
  persist();

  if (cycleCompleted) {
    promptCycleCompletion();
  } else {
    showToast(completed ? "Day logged" : "Day skipped");
  }
  renderCurrentView();
}

const actions = {
  toggleMainSet(index) {
    const set = state.currentSession.mainSets[index];
    set.completed = !set.completed;
    if (set.completed && !set.isAmrap && set.actualReps == null) set.actualReps = set.targetReps;
    persist();
    renderCurrentView();
  },
  setMainWeight(index, value) {
    state.currentSession.mainSets[index].weight = value;
    persist();
  },
  setMainReps(index, value) {
    state.currentSession.mainSets[index].actualReps = value;
    persist();
  },
  toggleSupplementalSet(kind, index) {
    const set = state.currentSession.supplementalSets[index];
    set.completed = !set.completed;
    if (set.completed && set.reps == null) set.reps = set.targetReps;
    persist();
    renderCurrentView();
  },
  setSupplementalWeight(kind, index, value) {
    state.currentSession.supplementalSets[index].weight = value;
    persist();
  },
  setSupplementalReps(kind, index, value) {
    state.currentSession.supplementalSets[index].reps = value;
    persist();
  },
  toggleAccessorySet(exerciseName, setIndex) {
    const entry = state.currentSession.accessorySets.find((s) => s.exerciseName === exerciseName && s.setIndex === setIndex);
    entry.completed = !entry.completed;
    if (entry.completed) {
      const prefill = lastAccessoryLog(state.sessionLogs, exerciseName, setIndex);
      if (entry.weight == null && prefill?.weight != null) entry.weight = prefill.weight;
      if (entry.reps == null && prefill?.reps != null) entry.reps = prefill.reps;
    }
    persist();
    renderCurrentView();
  },
  setAccessoryValue(exerciseName, setIndex, field, value) {
    const entry = state.currentSession.accessorySets.find((s) => s.exerciseName === exerciseName && s.setIndex === setIndex);
    entry[field] = value;
    persist();
  },
  updateNotes(text) {
    state.currentSession.notes = text;
    persist();
  },
  startTimer(seconds, label) {
    startRestTimer(seconds, label);
  },
  completeDay() {
    finishDay(true);
  },
  skipDay() {
    finishDay(false);
  },
  chooseDay(dayIndex) {
    if (dayIndex < 1 || dayIndex > DAY_COUNT || dayIndex === state.cycleState.dayIndex) return;
    state.cycleState = { ...state.cycleState, dayIndex };
    persist();
    renderCurrentView();
  },
  viewSessionsForDate(dateKey) {
    const logs = sessionsByDate(state.sessionLogs).get(dateKey) || [];
    if (logs.length === 0) return;
    if (logs.length === 1) {
      showModal(renderSessionDetail(logs[0]), (root) => {
        root.querySelector("#detail-close")?.addEventListener("click", closeModal);
      });
      return;
    }
    const listHtml = `<h2>${new Date(dateKey).toLocaleDateString()}</h2>
      <div class="btn-row" style="flex-direction:column;">
        ${logs.map((log, i) => `<button class="btn btn-block" data-log-index="${i}">${dayInfo(log.dayIndex).name}</button>`).join("")}
      </div>`;
    showModal(listHtml, (root) => {
      root.querySelectorAll("[data-log-index]").forEach((btn) =>
        btn.addEventListener("click", () => {
          showModal(renderSessionDetail(logs[Number(btn.dataset.logIndex)]), (r) => {
            r.querySelector("#detail-close")?.addEventListener("click", closeModal);
          });
        })
      );
    });
  },
  setTrainingMax(lift, value) {
    state.trainingMaxes[lift] = { currentValue: value, updatedAt: new Date().toISOString() };
    persist();
    renderCurrentView();
  },
  setCyclePosition(partial) {
    state.cycleState = { ...state.cycleState, ...partial };
    state.currentSession = null;
    persist();
    renderCurrentView();
  },
  setSetting(key, value) {
    state.settings[key] = value;
    persist();
    if (key === "theme") applyTheme();
    renderCurrentView();
  },
  setTmIncrement(lift, value) {
    state.settings.tmIncrements[lift] = value;
    persist();
  },
  addBodyweightEntry(date, weight) {
    state.bodyweightEntries.push({ date, weight });
    persist();
    renderCurrentView();
  },
  exportJSON() {
    const blob = new Blob([exportStateJSON(state)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `531-tracker-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
  importJSON(text) {
    try {
      state = importStateJSON(text);
      persist();
      applyTheme();
      renderCurrentView();
      showToast("Data imported");
    } catch (err) {
      console.error(err);
      showToast("Import failed: invalid file");
    }
  },
};

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    currentView = btn.dataset.view;
    renderCurrentView();
  });
});

// Rest timer widget
const restTimerEl = document.getElementById("rest-timer");
const restTimerTime = document.getElementById("rest-timer-time");
const restTimerLabel = document.getElementById("rest-timer-label");
document.getElementById("rest-timer-cancel").addEventListener("click", () => cancelRestTimer());

subscribeRestTimer(({ remainingMs, label }) => {
  if (remainingMs > 0) {
    restTimerEl.hidden = false;
    restTimerTime.textContent = formatMs(remainingMs);
    restTimerLabel.textContent = label || "";
  } else {
    restTimerEl.hidden = true;
  }
});

applyTheme();
renderCurrentView();

import { loadState, saveState, exportStateJSON, importStateJSON } from "./storage.js";
import { mainSetsForWeek, fslSets, bbbSets, LIFTS } from "./calc.js";
import { advanceCycle, progressTrainingMaxes, newSessionLog, lastAccessoryLog } from "./state.js";
import { dayInfo } from "./program.js";
import { renderToday } from "./views/today.js";
import { renderSettings } from "./views/settings.js";
import { renderHistory } from "./views/history.js";
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

  return newSessionLog(state.cycleState, mainSets, supplementalSets, day.accessories);
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

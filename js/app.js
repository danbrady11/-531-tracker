import { loadState, saveState, exportStateJSON, importStateJSON, migrate } from "./storage.js";
import { mainSetsForWeek, fslSets, bbbSets, LIFTS } from "./calc.js";
import { advanceCycle, progressTrainingMaxes, newSessionLog, lastAccessoryLog, sessionsByDate } from "./state.js";
import { dayInfo, DAY_COUNT, DAILY_PSOAS, PSOAS_STRENGTH } from "./program.js";
import { renderToday } from "./views/today.js";
import { renderSettings } from "./views/settings.js";
import { renderHistory } from "./views/history.js";
import { renderCalendar } from "./views/calendar.js";
import { startRestTimer, cancelRestTimer, subscribeRestTimer, formatMs } from "./timer.js";
import {
  getSyncCode,
  setSyncCodeLocally,
  generateSyncCode,
  pushToCloud,
  pullFromCloud,
  watchCloud,
} from "./sync.js";

let state = loadState();
let currentView = "today";

const viewRoot = document.getElementById("view-root");
const cycleBadge = document.getElementById("cycle-badge");
const modalRoot = document.getElementById("modal-root");

// --- Cloud sync bookkeeping ---
// Last-write-wins by timestamp. `localUpdatedAt` is bumped on every local
// change; `lastKnownRemoteUpdatedAt` tracks what we last pushed or adopted,
// so an incoming update that merely echoes our own push is a no-op.
let localUpdatedAt = 0;
let lastKnownRemoteUpdatedAt = 0;
let cloudPushTimer = null;
let unwatchCloud = null;
let syncStatus = { state: "idle", message: "" }; // idle | syncing | synced | error

function setSyncStatus(s, message = "") {
  syncStatus = { state: s, message };
  if (currentView === "settings") renderCurrentView();
}

function scheduleCloudPush() {
  const code = getSyncCode();
  if (!code) return;
  localUpdatedAt = Date.now();
  if (cloudPushTimer) clearTimeout(cloudPushTimer);
  cloudPushTimer = setTimeout(async () => {
    const at = localUpdatedAt;
    lastKnownRemoteUpdatedAt = at;
    setSyncStatus("syncing");
    try {
      await pushToCloud(code, state, at);
      setSyncStatus("synced");
    } catch (err) {
      console.error("Cloud push failed", err);
      setSyncStatus("error", "Couldn't reach the cloud. Will retry on the next change.");
    }
  }, 800);
}

/** True if adopting `incoming` would silently throw away history this device already has. */
function wouldLoseData(current, incoming) {
  const curSessions = current?.sessionLogs?.length ?? 0;
  const curBw = current?.bodyweightEntries?.length ?? 0;
  const incSessions = incoming?.sessionLogs?.length ?? 0;
  const incBw = incoming?.bodyweightEntries?.length ?? 0;
  return (curSessions > 0 && incSessions < curSessions) || (curBw > 0 && incBw < curBw);
}

function adoptRemoteState(payload) {
  lastKnownRemoteUpdatedAt = payload.updatedAt;
  localUpdatedAt = payload.updatedAt;
  state = migrate(payload.state);
  saveState(state);
}

function promptSyncConflict(payload) {
  const curSessions = state.sessionLogs?.length ?? 0;
  const incSessions = payload.state?.sessionLogs?.length ?? 0;
  showModal(
    `<h2>Sync conflict</h2>
     <p class="set-meta">The cloud copy has less history than this device — ${incSessions} logged session${incSessions === 1 ? "" : "s"} there vs ${curSessions} here. This usually means another device generated or linked a sync code before it had your real data. Which copy is right?</p>
     <div class="btn-row"><button class="btn btn-primary btn-block" id="conflict-keep-local">Keep this device's data (push to cloud)</button></div>
     <div class="btn-row"><button class="btn btn-block" id="conflict-use-cloud">Use the cloud's data anyway</button></div>`,
    (root) => {
      root.querySelector("#conflict-keep-local").addEventListener("click", async () => {
        closeModal();
        const code = getSyncCode();
        localUpdatedAt = Date.now();
        lastKnownRemoteUpdatedAt = localUpdatedAt;
        setSyncStatus("syncing");
        try {
          await pushToCloud(code, state, localUpdatedAt);
          setSyncStatus("synced", "Kept this device's data and pushed it to the cloud");
        } catch (err) {
          console.error(err);
          setSyncStatus("error", "Push failed.");
        }
      });
      root.querySelector("#conflict-use-cloud").addEventListener("click", () => {
        closeModal();
        adoptRemoteState(payload);
        setSyncStatus("synced", "Adopted the cloud's data");
        renderCurrentView();
      });
    }
  );
}

function startWatchingCloud(code) {
  unwatchCloud?.();
  setSyncStatus("syncing");
  unwatchCloud = watchCloud(
    code,
    (payload) => {
      if (!payload || typeof payload.updatedAt !== "number") return;
      if (payload.updatedAt <= lastKnownRemoteUpdatedAt) {
        setSyncStatus("synced");
        return;
      }
      if (wouldLoseData(state, payload.state)) {
        lastKnownRemoteUpdatedAt = payload.updatedAt; // don't re-prompt for the same payload
        promptSyncConflict(payload);
        return;
      }
      adoptRemoteState(payload);
      setSyncStatus("synced", "Synced from your other device");
      renderCurrentView();
    },
    (err) => {
      console.error("Cloud watch failed", err);
      setSyncStatus("error", "Sync connection failed.");
    }
  );
}

function initCloudSync() {
  const code = getSyncCode();
  if (code) startWatchingCloud(code);
}

async function doGenerateAndLinkSyncCode() {
  const code = generateSyncCode();
  setSyncCodeLocally(code);
  localUpdatedAt = Date.now();
  lastKnownRemoteUpdatedAt = localUpdatedAt;
  setSyncStatus("syncing");
  try {
    await pushToCloud(code, state, localUpdatedAt);
    startWatchingCloud(code);
    showToast(`Sync code ${code} created`);
  } catch (err) {
    console.error(err);
    setSyncStatus("error", "Couldn't reach the cloud to create a sync code.");
  }
  renderCurrentView();
}

function persist() {
  saveState(state);
  scheduleCloudPush();
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

  const accessoriesForSession = [...day.accessories, ...(day.hasPsoasStrength ? PSOAS_STRENGTH : [])];
  const session = newSessionLog(state.cycleState, mainSets, supplementalSets, accessoriesForSession);
  session.accessorySets = session.accessorySets.map((entry) => {
    const prefill = lastAccessoryLog(state.sessionLogs, entry.exerciseName, entry.setIndex);
    return { ...entry, weight: prefill?.weight ?? null, reps: prefill?.reps ?? null };
  });
  // Rehab tracking, separate from the lift itself: a daily checklist (every
  // day, no weight/reps) and, on days that have it, a single shoulder rehab
  // checkbox. Both persist with the session regardless of whether the day
  // ends up completed or skipped, so adherence can be seen independent of
  // whether the lift happened.
  session.dailyPsoas = DAILY_PSOAS.map((item) => ({ name: item.name, completed: false }));
  if (day.hasShoulderRehab) session.shoulderRehabCompleted = false;
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

  const ctx = { state, actions, sync: { code: getSyncCode(), ...syncStatus } };

  if (currentView === "today") {
    ensureCurrentSession();
    renderToday(viewRoot, ctx);
  } else if (currentView === "history") {
    renderHistory(viewRoot, ctx);
  } else if (currentView === "calendar") {
    renderCalendar(viewRoot, ctx);
  } else if (currentView === "settings") {
    renderSettings(viewRoot, ctx);
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
  const { cycleState, cycleCompleted } = advanceCycle(state.cycleState, state.settings);
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
  // Ad hoc exercise added to just this session, beyond the day's fixed
  // accessory list. Remembers the name in state.customExercises so it shows
  // up in the "add exercise" dropdown on any future day too.
  addAdHocExercise(name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!state.customExercises.includes(trimmed)) {
      state.customExercises = [...state.customExercises, trimmed].sort((a, b) => a.localeCompare(b));
    }
    const alreadyInSession = state.currentSession.accessorySets.some((s) => s.exerciseName === trimmed);
    if (!alreadyInSession) {
      const DEFAULT_SETS = 3;
      const newSets = Array.from({ length: DEFAULT_SETS }, (_, setIndex) => {
        const prefill = lastAccessoryLog(state.sessionLogs, trimmed, setIndex);
        return {
          exerciseName: trimmed,
          setIndex,
          weight: prefill?.weight ?? null,
          reps: prefill?.reps ?? null,
          completed: false,
        };
      });
      state.currentSession.accessorySets = [...state.currentSession.accessorySets, ...newSets];
    }
    persist();
    renderCurrentView();
  },
  removeAdHocExercise(exerciseName) {
    state.currentSession.accessorySets = state.currentSession.accessorySets.filter((s) => s.exerciseName !== exerciseName);
    persist();
    renderCurrentView();
  },
  toggleDailyPsoas(name) {
    const item = state.currentSession.dailyPsoas.find((i) => i.name === name);
    item.completed = !item.completed;
    persist();
    renderCurrentView();
  },
  toggleShoulderRehab() {
    state.currentSession.shoulderRehabCompleted = !state.currentSession.shoulderRehabCompleted;
    persist();
    renderCurrentView();
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
  // This device becomes the source of truth for a brand-new sync code: it
  // seeds the cloud with this device's current data. Warn first if this
  // device looks empty — that's the classic "generated on the wrong device"
  // mistake, and it would make an empty copy the seed that other devices
  // then adopt.
  async generateAndLinkSyncCode() {
    if ((state.sessionLogs?.length ?? 0) === 0) {
      showModal(
        `<h2>No history on this device yet</h2>
         <p class="set-meta">Generating a code here makes THIS device's (currently empty) data the source of truth — linking your other device to it would replace its history with nothing. If your real data is on another device, cancel and use "Enter a code from another device" there instead.</p>
         <div class="btn-row"><button class="btn btn-block" id="gen-cancel">Cancel</button></div>
         <div class="btn-row"><button class="btn btn-danger btn-block" id="gen-anyway">Generate anyway</button></div>`,
        (root) => {
          root.querySelector("#gen-cancel").addEventListener("click", closeModal);
          root.querySelector("#gen-anyway").addEventListener("click", () => {
            closeModal();
            doGenerateAndLinkSyncCode();
          });
        }
      );
      return;
    }
    await doGenerateAndLinkSyncCode();
  },
  // Joining an EXISTING code (a second device): never push first, or this
  // device's un-synced local data would clobber the shared copy. Just start
  // watching — whatever's already in the cloud gets adopted immediately.
  linkSyncCode(code) {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setSyncCodeLocally(trimmed);
    startWatchingCloud(trimmed);
    renderCurrentView();
  },
  unlinkSync() {
    unwatchCloud?.();
    unwatchCloud = null;
    setSyncCodeLocally(null);
    setSyncStatus("idle");
    renderCurrentView();
  },
  async forcePushToCloud() {
    const code = getSyncCode();
    if (!code) return;
    localUpdatedAt = Date.now();
    lastKnownRemoteUpdatedAt = localUpdatedAt;
    setSyncStatus("syncing");
    try {
      await pushToCloud(code, state, localUpdatedAt);
      setSyncStatus("synced", "Pushed this device's data to the cloud");
    } catch (err) {
      console.error(err);
      setSyncStatus("error", "Push failed.");
    }
    renderCurrentView();
  },
  async forcePullFromCloud() {
    const code = getSyncCode();
    if (!code) return;
    setSyncStatus("syncing");
    try {
      const payload = await pullFromCloud(code);
      if (payload && wouldLoseData(state, payload.state)) {
        setSyncStatus("idle");
        promptSyncConflict(payload);
        return;
      }
      if (payload) {
        adoptRemoteState(payload);
        setSyncStatus("synced", "Pulled the cloud's data onto this device");
      } else {
        setSyncStatus("error", "No data found for that sync code.");
      }
    } catch (err) {
      console.error(err);
      setSyncStatus("error", "Pull failed.");
    }
    renderCurrentView();
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
initCloudSync();

import { dayInfo, DAY_COUNT, DAILY_PSOAS, PSOAS_STRENGTH, SHOULDER_REHAB_ITEM, restCategoryFor } from "../program.js";
import { plateBreakdown, warmupSets, epleyE1RM, repsToBeatE1RM } from "../calc.js";
import { lastAccessoryLog, effectiveWeekCount, lastCompletedByLift, advanceCycle, amrapHistory } from "../state.js";
import { LIFT_META, LIFT_ORDER } from "../lift-meta.js";

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function formatSec(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function restButtonHtml(seconds, label) {
  return `<button class="btn btn-sm" data-action="start-timer" data-seconds="${seconds}" data-label="${escapeHtml(label)}">Rest ${formatSec(seconds)}</button>`;
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

/** Text for the AMRAP set's "reps needed for a new e1RM" hint, at a given weight. */
function prHintText(weight, bestE1RM) {
  if (!weight) return "";
  if (!bestE1RM) return "No est. 1RM on record yet for this lift — any logged rep sets one.";
  const repsNeeded = repsToBeatE1RM(weight, bestE1RM);
  return `${repsNeeded}+ reps beats your current est. 1RM (${Math.round(bestE1RM)} lb)`;
}

function mainSetRow(set, index, barWeight, bestE1RM) {
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
            ? `<div class="e1rm-line" data-e1rm-index="${index}">${e1rmText(set.weight, set.actualReps)}</div>
               <div class="pr-hint" data-pr-index="${index}" data-best-e1rm="${bestE1RM}">${prHintText(set.weight, bestE1RM)}</div>`
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

/** No set count to log (Yoga, Zone 2) — a single checkbox, no weight/reps. */
function checkableAccessoryRow(accessory, session) {
  const entry = (session.accessorySets || []).find((s) => s.exerciseName === accessory.name && s.setIndex === 0) || { completed: false };
  return `
    <div class="accessory-block">
      <div class="rehab-row" style="padding:0;border:none;">
        <button class="set-check ${entry.completed ? "done" : ""}" data-action="toggle-accessory" data-exercise="${escapeHtml(accessory.name)}" data-index="0" aria-label="Mark done">
          ${entry.completed ? "✓" : ""}
        </button>
        <div class="set-info">
          <div class="rehab-name">${escapeHtml(accessory.name)}</div>
          ${accessory.repsLabel ? `<div class="accessory-cue">${escapeHtml(accessory.repsLabel)}</div>` : ""}
        </div>
      </div>
    </div>`;
}

/**
 * Rest control under an accessory's sets: a normal per-category Rest button,
 * unless the exercise is part of a superset pair — the "a" exercise gets no
 * rest control at all (advance straight to "b"), and "b" gets no manual
 * button either, since its rest starts automatically the moment a set is
 * logged (see actions.toggleAccessorySet in app.js).
 */
function accessoryRestControl(accessory, activeName, restTimerSec) {
  if (accessory.supersetRole === "a") {
    return `<div class="set-meta">Superset — go straight into the next exercise, no rest.</div>`;
  }
  if (accessory.supersetRole === "b") {
    return `<div class="set-meta">Superset — ${formatSec(restTimerSec.superset)} rest starts automatically once a set is logged.</div>`;
  }
  return restButtonHtml(restTimerSec[restCategoryFor(accessory)], `${activeName} rest`);
}

/** Which of an accessory's variants (e.g. standing/seated calf raise) the current session is actually logging — the day's default until switched. */
function activeVariantName(accessory, session) {
  if (!accessory.variants) return accessory.name;
  const logged = (session.accessorySets || []).find((s) => accessory.variants.includes(s.exerciseName));
  return logged?.exerciseName || accessory.variants[0];
}

function variantToggleHtml(accessory, activeName) {
  if (!accessory.variants) return "";
  const buttons = accessory.variants
    .map(
      (v) =>
        `<button class="pill-tab ${v === activeName ? "active" : ""}" data-action="set-variant" data-old="${escapeHtml(activeName)}" data-new="${escapeHtml(v)}">${escapeHtml(v)}</button>`
    )
    .join("");
  return `<div class="pill-tabs" style="margin-bottom:8px;">${buttons}</div>`;
}

function accessoryBlock(accessory, session, sessionLogs, restTimerSec) {
  if (accessory.sets == null) return checkableAccessoryRow(accessory, session);

  const activeName = activeVariantName(accessory, session);
  const entries = (session.accessorySets || []).filter((s) => s.exerciseName === activeName);
  const chips = entries
    .map((entry, i) => accessorySetChip(activeName, entry.setIndex ?? i, entry, lastAccessoryLog(sessionLogs, activeName, entry.setIndex ?? i)))
    .join("");
  return `
    <div class="accessory-block">
      <div class="accessory-name">
        <span>${escapeHtml(activeName)}</span>
        <span class="accessory-target">${accessory.sets}×${accessory.repsLabel}</span>
      </div>
      ${variantToggleHtml(accessory, activeName)}
      ${accessory.cue ? `<div class="accessory-cue">${escapeHtml(accessory.cue)}</div>` : ""}
      <div class="accessory-sets">${chips}</div>
      <div class="btn-row" style="margin-top:8px;">${accessoryRestControl(accessory, activeName, restTimerSec)}</div>
    </div>`;
}

/** Daily Psoas: checkbox-only, no weight/reps, rendered on every day from one shared definition. */
function dailyPsoasBlock(session) {
  const rows = (session.dailyPsoas || [])
    .map((item) => {
      const def = DAILY_PSOAS.find((d) => d.name === item.name);
      return `
        <div class="rehab-row">
          <button class="set-check ${item.completed ? "done" : ""}" data-action="toggle-daily-psoas" data-name="${escapeHtml(item.name)}" aria-label="Mark done">
            ${item.completed ? "✓" : ""}
          </button>
          <div class="set-info">
            <div class="rehab-name">${escapeHtml(item.name)}</div>
            ${def?.cue ? `<div class="accessory-cue">${escapeHtml(def.cue)}</div>` : ""}
          </div>
        </div>`;
    })
    .join("");
  return `
    <div class="card rehab-card">
      <h3>Daily — Psoas</h3>
      ${rows}
    </div>`;
}

/** Single checkbox, no weight/reps — a band sequence the user already knows. */
function shoulderRehabBlock(session) {
  const done = !!session.shoulderRehabCompleted;
  return `
    <div class="card rehab-card">
      <h3>Shoulder Rehab</h3>
      <div class="rehab-row">
        <button class="set-check ${done ? "done" : ""}" data-action="toggle-shoulder-rehab" aria-label="Mark done">
          ${done ? "✓" : ""}
        </button>
        <div class="set-info">
          <div class="rehab-name">${escapeHtml(SHOULDER_REHAB_ITEM.name)}</div>
          <div class="accessory-cue">${escapeHtml(SHOULDER_REHAB_ITEM.cue)}</div>
        </div>
      </div>
    </div>`;
}

/** Psoas Strength: logged like a normal accessory (weight/band level + reps, prefilled). */
function psoasStrengthBlock(session, sessionLogs, restTimerSec) {
  return `
    <div class="card">
      <h3>Psoas Strength</h3>
      ${PSOAS_STRENGTH.map((a) => accessoryBlock(a, session, sessionLogs, restTimerSec)).join("")}
    </div>`;
}

/** An exercise added ad hoc to just this session — not part of the day's fixed list, so it always gets the isolation-rest default. */
function extraAccessoryBlock(exerciseName, session, sessionLogs, restTimerSec) {
  const entries = (session.accessorySets || []).filter((s) => s.exerciseName === exerciseName);
  const chips = entries
    .map((entry, i) => accessorySetChip(exerciseName, entry.setIndex ?? i, entry, lastAccessoryLog(sessionLogs, exerciseName, entry.setIndex ?? i)))
    .join("");
  return `
    <div class="accessory-block">
      <div class="accessory-name">
        <span>${escapeHtml(exerciseName)} <span class="accessory-target">(added)</span></span>
        <button class="btn btn-sm btn-ghost" data-action="remove-ad-hoc" data-exercise="${escapeHtml(exerciseName)}" aria-label="Remove exercise">Remove</button>
      </div>
      <div class="accessory-sets">${chips}</div>
      <div class="btn-row" style="margin-top:8px;">${restButtonHtml(restTimerSec.isolation, `${exerciseName} rest`)}</div>
    </div>`;
}

function addExerciseControls(customExercises) {
  const options = [...customExercises]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
    .join("");
  return `
    <div class="section-label">Add exercise</div>
    ${
      customExercises.length
        ? `<div class="field">
            <select data-action="add-known-exercise">
              <option value="">Choose from your list…</option>
              ${options}
            </select>
          </div>`
        : ""
    }
    <div style="display:flex;gap:8px;">
      <input class="set-input" style="flex:1;" type="text" id="new-exercise-name" placeholder="New exercise name" />
      <button class="btn" data-action="add-new-exercise">Add</button>
    </div>
  `;
}

const DAY_KIND_LABEL = { main: "Main lift day", recovery: "Recovery day", accessory: "Accessory day" };

/**
 * Per-lift "when you'll next train it" strip for the splash screen: one step
 * past its most recent completed session, reusing advanceCycle's own
 * week/cycle-wrap logic (dayIndex: DAY_COUNT forces it to treat this as the
 * last day of that week, which is all that's needed to land on the correct
 * next week — or next cycle's week 1, if that was the cycle's last week).
 * Skips a lift entirely if it has no completed history yet.
 */
function liftStatusHtml(sessionLogs, settings) {
  const lastByLift = lastCompletedByLift(sessionLogs);
  const rows = LIFT_ORDER.filter((lift) => lastByLift[lift])
    .map((lift) => {
      const info = lastByLift[lift];
      const { cycleState } = advanceCycle({ dayIndex: DAY_COUNT, weekIndex: info.weekIndex, cycleNumber: info.cycleNumber }, settings);
      return `<div class="bw-row"><span>${LIFT_META[lift].label}</span><span>C${cycleState.cycleNumber}:W${cycleState.weekIndex} next</span></div>`;
    })
    .join("");
  return rows ? `<div class="card"><h3>Lift Status</h3>${rows}</div>` : "";
}

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
  const weekCount = effectiveWeekCount(cycleNumber, state.settings);

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
      <div class="splash-kicker">Up next · Cycle ${cycleNumber} · Week ${weekIndex} of ${weekCount}</div>
      <h2 class="splash-title">${escapeHtml(day.name)}</h2>
      <div class="set-meta">${DAY_KIND_LABEL[day.kind]}</div>
      <button class="btn btn-primary btn-block" style="margin-top:14px;" data-action="start-day" data-day="${dayIndex}">Start Workout</button>
    </div>
    ${liftStatusHtml(state.sessionLogs, state.settings)}
    <div class="section-label">Or pick a different day</div>
    <div class="card splash-other-days">${otherDaysHtml}</div>
  `;

  root.querySelectorAll('[data-action="start-day"]').forEach((el) =>
    el.addEventListener("click", () => {
      // Always defer to chooseDay — it already only rebuilds the session
      // when it doesn't match the requested day (comparing against the
      // session itself, not the recommended-next pointer), so this stays
      // correct even when currentSession is left over from an earlier,
      // different day that was never completed or skipped.
      ctx.actions.chooseDay(Number(el.dataset.day));
      todayScreen = "workout";
      renderToday(root, ctx);
    })
  );
}

function renderWorkoutScreen(root, ctx) {
  const { state } = ctx;
  const session = state.currentSession;
  // The screen must reflect whichever day this session was actually built
  // for — which can differ from state.cycleState (the recommended next
  // day) when the day picker was used to start a different one.
  const { dayIndex, weekIndex, cycleNumber } = session;
  const day = dayInfo(dayIndex);
  const isMainDay = day.kind === "main";
  const bar = state.settings.barWeight;
  const weekCount = effectiveWeekCount(cycleNumber, state.settings);
  const restTimerSec = state.settings.restTimerSec;

  let html = `<button class="btn btn-sm btn-ghost" data-action="back-to-splash" style="margin-bottom:8px;">‹ Overview</button>`;
  html += `<div class="day-kicker">Cycle ${cycleNumber} · Week ${weekIndex} of ${weekCount} · Day ${dayIndex} of 6</div>`;
  html += `<h2 style="margin:0 0 12px;font-size:1.6rem;">${escapeHtml(day.name)}</h2>`;

  // Shoulder Rehab goes before the main lift; Daily Psoas is prep work done
  // on every day, so both come before the lift itself.
  if (day.hasShoulderRehab) html += shoulderRehabBlock(session);
  html += dailyPsoasBlock(session);

  if (isMainDay) {
    const tm = state.trainingMaxes[day.lift].currentValue;
    // Best e1RM from prior completed sessions only — today's own AMRAP
    // result isn't in state.sessionLogs yet, so this is exactly "what do I
    // need to beat," not a number that shifts as they log today's reps.
    const bestE1RM = Math.max(0, ...amrapHistory(state.sessionLogs, day.lift).map((h) => h.e1rm));
    html += `<div class="card">
      <h3>Main sets — TM ${tm} lb</h3>
      ${session.mainSets.map((s, i) => mainSetRow(s, i, bar, bestE1RM)).join("")}
      <div class="btn-row">
        ${restButtonHtml(restTimerSec.main, "Main set rest")}
        <button class="btn btn-sm btn-ghost" data-action="toggle-warmup">Warm-ups</button>
      </div>
      <div id="warmup-panel" hidden></div>
    </div>`;

    if (day.supplemental) {
      const label = day.supplemental === "fsl" ? "FSL 3×8" : `BBB 5×10 (${Math.round(state.settings.bbbPercentage * 100)}%)`;
      // Falls back to "main" for FSL, which no day currently uses and has no
      // rest duration of its own in Settings — only BBB was asked for.
      const suppRestSec = restTimerSec[day.supplemental] ?? restTimerSec.main;
      html += `<div class="card">
        <h3>${label}</h3>
        ${session.supplementalSets.map((s, i) => supplementalRow(s, i, day.supplemental, bar)).join("")}
        <div class="btn-row">${restButtonHtml(suppRestSec, `${label} rest`)}</div>
      </div>`;
    }
  } else {
    html += `<div class="card"><h3>${day.kind === "recovery" ? "Recovery" : "Accessory day"}</h3>
      <div class="set-meta">No main lift today.</div></div>`;
  }

  const psoasStrengthNames = day.hasPsoasStrength ? new Set(PSOAS_STRENGTH.map((a) => a.name)) : new Set();
  // Includes every variant name (e.g. both standing and seated calf raise),
  // not just each accessory's generic slot name — session logs are always
  // keyed by whichever concrete variant was actually performed, so matching
  // only the slot name would wrongly treat both variants as ad hoc "extra"
  // exercises added mid-session.
  const fixedNames = new Set([
    ...day.accessories.flatMap((a) => (a.variants ? a.variants : [a.name])),
    ...psoasStrengthNames,
  ]);
  const extraNames = [...new Set((session.accessorySets || []).map((s) => s.exerciseName))].filter((n) => !fixedNames.has(n));

  html += `<div class="card">
    <h3>Accessories</h3>
    ${day.accessories.map((a) => accessoryBlock(a, session, state.sessionLogs, restTimerSec)).join("")}
    ${extraNames.map((name) => extraAccessoryBlock(name, session, state.sessionLogs, restTimerSec)).join("")}
    <hr style="border:none;border-top:1px solid var(--border);margin:14px 0;" />
    ${addExerciseControls(state.customExercises || [])}
  </div>`;

  if (day.hasPsoasStrength) html += psoasStrengthBlock(session, state.sessionLogs, restTimerSec);

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
    const weight = Number(weightInput?.value);
    line.textContent = e1rmText(weight, Number(repsInput?.value));

    const prHint = root.querySelector(`[data-pr-index="${index}"]`);
    if (prHint) prHint.textContent = prHintText(weight, Number(prHint.dataset.bestE1rm));
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
  root.querySelectorAll('[data-action="set-variant"]').forEach((el) =>
    el.addEventListener("click", () => actions.setAccessoryVariant(el.dataset.old, el.dataset.new))
  );
  root.querySelectorAll('[data-action="toggle-daily-psoas"]').forEach((el) =>
    el.addEventListener("click", () => actions.toggleDailyPsoas(el.dataset.name))
  );
  root.querySelector('[data-action="toggle-shoulder-rehab"]')?.addEventListener("click", () => actions.toggleShoulderRehab());
  root.querySelectorAll('[data-action="accessory-value"]').forEach((el) =>
    el.addEventListener("change", () =>
      actions.setAccessoryValue(el.dataset.exercise, Number(el.dataset.index), el.dataset.field, el.value === "" ? null : Number(el.value))
    )
  );
  root.querySelectorAll('[data-action="remove-ad-hoc"]').forEach((el) =>
    el.addEventListener("click", () => actions.removeAdHocExercise(el.dataset.exercise))
  );

  root.querySelector('[data-action="add-known-exercise"]')?.addEventListener("change", (e) => {
    if (e.target.value) actions.addAdHocExercise(e.target.value);
  });
  root.querySelector('[data-action="add-new-exercise"]')?.addEventListener("click", () => {
    const input = root.querySelector("#new-exercise-name");
    if (input?.value.trim()) actions.addAdHocExercise(input.value);
  });

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

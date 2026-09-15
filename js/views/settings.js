import { LIFTS } from "../calc.js";
import { effectiveWeekCount } from "../state.js";

const LIFT_LABELS = { squat: "Squat", bench: "Bench", deadlift: "Deadlift", press: "Press", trapBarDeadlift: "Trap Bar Deadlift" };

function syncStatusLabel(sync) {
  if (sync.state === "syncing") return "Syncing…";
  if (sync.state === "error") return sync.message || "Sync error";
  if (sync.state === "synced") return sync.message || "Synced";
  return "Not yet synced";
}

export function renderSettings(root, ctx) {
  const { state, sync } = ctx;
  const s = state.settings;

  const tmTiles = LIFTS.map((lift) => {
    const tm = state.trainingMaxes[lift];
    return `
      <div class="tm-tile">
        <div class="tm-tile-name">${LIFT_LABELS[lift]}</div>
        <input class="set-input tm-tile-value" style="width:100%;font-size:1.1rem;" type="number" step="5"
          value="${tm.currentValue}" data-action="edit-tm" data-lift="${lift}" />
        <div class="set-meta">+${s.tmIncrements[lift]} lb / cycle</div>
      </div>`;
  }).join("");

  root.innerHTML = `
    <div class="card">
      <h3>Training Maxes</h3>
      <div class="tm-grid">${tmTiles}</div>
    </div>

    <div class="card">
      <h3>Cycle position</h3>
      <div class="field-row">
        <div class="field">
          <label>Day (1–6)</label>
          <input class="set-input" style="width:100%" type="number" min="1" max="6" value="${state.cycleState.dayIndex}" data-action="edit-day" />
        </div>
        <div class="field">
          <label>Week (1–4)</label>
          <input class="set-input" style="width:100%" type="number" min="1" max="4" value="${state.cycleState.weekIndex}" data-action="edit-week" />
        </div>
      </div>
      <div class="set-meta">Cycle number: ${state.cycleState.cycleNumber} · ${
        effectiveWeekCount(state.cycleState.cycleNumber, s) === 4
          ? "this cycle ends with a deload (week 4)"
          : "this cycle skips deload — ends after week 3"
      }</div>
      <div class="btn-row">
        <button class="btn btn-sm" data-action="resync-cycle">Resync from history</button>
      </div>
      <div class="set-meta">Recomputes this from the most recent workout you actually completed — use it if this ever looks off.</div>
    </div>

    <div class="card">
      <h3>Program settings</h3>
      <div class="field">
        <label style="display:flex;align-items:center;gap:10px;flex-direction:row;">
          <input type="checkbox" style="width:20px;height:20px;" ${s.deloadOnEvenCyclesOnly ? "checked" : ""} data-action="setting-checkbox" data-key="deloadOnEvenCyclesOnly" />
          Deload on even cycles only
        </label>
        <div class="set-meta">Even cycles (2, 4, 6…) get the week-4 deload; odd cycles end after week 3. Uncheck to deload every cycle instead.</div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Bar weight (lb)</label>
          <input class="set-input" style="width:100%" type="number" step="5" value="${s.barWeight}" data-action="setting" data-key="barWeight" />
        </div>
        <div class="field">
          <label>Round down to (lb)</label>
          <input class="set-input" style="width:100%" type="number" step="0.5" value="${s.roundingIncrement}" data-action="setting" data-key="roundingIncrement" />
        </div>
      </div>
      <div class="field">
        <label>BBB percentage of TM (%)</label>
        <input class="set-input" style="width:100%" type="number" step="5" value="${Math.round(s.bbbPercentage * 100)}" data-action="setting-pct" data-key="bbbPercentage" />
      </div>
      <div class="field-row">
        <div class="field">
          <label>Main set rest (sec)</label>
          <input class="set-input" style="width:100%" type="number" step="15" value="${s.restTimerMainSec}" data-action="setting" data-key="restTimerMainSec" />
        </div>
        <div class="field">
          <label>Isolation rest (sec)</label>
          <input class="set-input" style="width:100%" type="number" step="15" value="${s.restTimerIsolationSec}" data-action="setting" data-key="restTimerIsolationSec" />
        </div>
      </div>
      <div class="field">
        <label>Theme</label>
        <select data-action="setting" data-key="theme">
          <option value="system" ${s.theme === "system" ? "selected" : ""}>System</option>
          <option value="light" ${s.theme === "light" ? "selected" : ""}>Light</option>
          <option value="dark" ${s.theme === "dark" ? "selected" : ""}>Dark</option>
        </select>
      </div>
    </div>

    <div class="card">
      <h3>TM increments per cycle (lb)</h3>
      <div class="field-row">
        ${LIFTS.map(
          (lift) => `
          <div class="field">
            <label>${LIFT_LABELS[lift]}</label>
            <input class="set-input" style="width:100%" type="number" step="2.5" value="${s.tmIncrements[lift]}" data-action="setting-tm-inc" data-lift="${lift}" />
          </div>`
        ).join("")}
      </div>
    </div>

    <div class="card">
      <h3>Cloud Sync</h3>
      ${
        sync.code
          ? `
        <div class="set-meta" style="margin-bottom:8px;">Sync code</div>
        <div style="font-size:1.3rem;font-weight:700;letter-spacing:0.08em;margin-bottom:10px;">${sync.code}</div>
        <div class="sync-status sync-status-${sync.state}">${syncStatusLabel(sync)}</div>
        <div class="btn-row">
          <button class="btn btn-sm" data-action="sync-force-push">Push to cloud</button>
          <button class="btn btn-sm" data-action="sync-force-pull">Pull from cloud</button>
        </div>
        <div class="btn-row">
          <button class="btn btn-sm btn-danger" data-action="sync-unlink">Unlink this device</button>
        </div>
      `
          : `
        <p class="set-meta">Link this device to keep training data in sync with another device (e.g. phone + desktop) automatically.</p>
        <div class="btn-row">
          <button class="btn btn-primary btn-block" data-action="sync-generate">Generate new code (this is your main device)</button>
        </div>
        <div class="field" style="margin-top:14px;">
          <label>Or enter a code from another device</label>
          <div style="display:flex;gap:8px;">
            <input class="set-input" style="flex:1;text-transform:uppercase;" id="sync-code-input" placeholder="ABC123" maxlength="8" />
            <button class="btn" data-action="sync-link">Link</button>
          </div>
        </div>
      `
      }
    </div>

    <div class="card">
      <h3>Data</h3>
      <div class="btn-row">
        <button class="btn btn-block" data-action="export-json">Export JSON</button>
      </div>
      <div class="btn-row">
        <label class="btn btn-block" style="cursor:pointer;">
          Import JSON
          <input type="file" accept="application/json" data-action="import-json" style="display:none" />
        </label>
      </div>
    </div>
  `;

  root.querySelectorAll('[data-action="edit-tm"]').forEach((el) =>
    el.addEventListener("change", () => ctx.actions.setTrainingMax(el.dataset.lift, Number(el.value)))
  );
  root.querySelector('[data-action="edit-day"]')?.addEventListener("change", (e) =>
    ctx.actions.setCyclePosition({ dayIndex: Number(e.target.value) })
  );
  root.querySelector('[data-action="edit-week"]')?.addEventListener("change", (e) =>
    ctx.actions.setCyclePosition({ weekIndex: Number(e.target.value) })
  );
  root.querySelector('[data-action="resync-cycle"]')?.addEventListener("click", () => ctx.actions.resyncCycleFromHistory());

  root.querySelectorAll('[data-action="setting"]').forEach((el) =>
    el.addEventListener("change", () => ctx.actions.setSetting(el.dataset.key, el.type === "number" ? Number(el.value) : el.value))
  );
  root.querySelectorAll('[data-action="setting-pct"]').forEach((el) =>
    el.addEventListener("change", () => ctx.actions.setSetting(el.dataset.key, Number(el.value) / 100))
  );
  root.querySelectorAll('[data-action="setting-tm-inc"]').forEach((el) =>
    el.addEventListener("change", () => ctx.actions.setTmIncrement(el.dataset.lift, Number(el.value)))
  );
  root.querySelectorAll('[data-action="setting-checkbox"]').forEach((el) =>
    el.addEventListener("change", () => ctx.actions.setSetting(el.dataset.key, el.checked))
  );

  root.querySelector('[data-action="sync-generate"]')?.addEventListener("click", () => ctx.actions.generateAndLinkSyncCode());
  root.querySelector('[data-action="sync-link"]')?.addEventListener("click", () => {
    const val = root.querySelector("#sync-code-input")?.value || "";
    ctx.actions.linkSyncCode(val);
  });
  root.querySelector('[data-action="sync-unlink"]')?.addEventListener("click", () => ctx.actions.unlinkSync());
  root.querySelector('[data-action="sync-force-push"]')?.addEventListener("click", () => ctx.actions.forcePushToCloud());
  root.querySelector('[data-action="sync-force-pull"]')?.addEventListener("click", () => ctx.actions.forcePullFromCloud());

  root.querySelector('[data-action="export-json"]')?.addEventListener("click", () => ctx.actions.exportJSON());
  root.querySelector('[data-action="import-json"]')?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => ctx.actions.importJSON(reader.result);
    reader.readAsText(file);
  });
}

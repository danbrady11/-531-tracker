import { rehabMinutesByModality } from "../state.js";
import { REHAB_MODALITIES } from "../rehab-meta.js";

function modalityLabel(key) {
  return REHAB_MODALITIES.find((m) => m.key === key)?.label || key;
}

function modalityColorVar(key) {
  return REHAB_MODALITIES.find((m) => m.key === key)?.colorVar || "--text-muted";
}

export function renderRehab(root, ctx) {
  const { state } = ctx;

  root.innerHTML = `
    <div class="card">
      <h3>Log a session</h3>
      <div class="field-row">
        <div class="field">
          <label>Modality</label>
          <select class="set-input" style="width:100%" id="rehab-modality">
            ${REHAB_MODALITIES.map((m) => `<option value="${m.key}">${m.label}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Minutes</label>
          <input class="set-input" style="width:100%" type="number" step="1" min="0" id="rehab-minutes" />
        </div>
      </div>
      <div class="field">
        <label>Date</label>
        <input class="set-input" style="width:100%" type="date" id="rehab-date" value="${new Date().toISOString().slice(0, 10)}" />
      </div>
      <button class="btn btn-primary btn-block" id="rehab-add">Log session</button>
    </div>

    <div class="card">
      <h3>Last 7 days</h3>
      <div id="rehab-weekly"></div>
    </div>

    <div class="card">
      <h3>Recent sessions</h3>
      <div id="rehab-list"></div>
    </div>
  `;

  renderWeeklyTotals(root, state);
  renderRecentList(root, state, ctx);

  root.querySelector("#rehab-add")?.addEventListener("click", () => {
    const modality = root.querySelector("#rehab-modality").value;
    const minutes = Number(root.querySelector("#rehab-minutes").value);
    const date = root.querySelector("#rehab-date").value;
    if (!minutes || !date) return;
    ctx.actions.addRehabEntry(new Date(date).toISOString(), modality, minutes);
  });
}

function renderWeeklyTotals(root, state) {
  const totals = rehabMinutesByModality(state.rehabEntries, 7);
  root.querySelector("#rehab-weekly").innerHTML = REHAB_MODALITIES.map(
    (m) =>
      `<div class="bw-row">
        <span><span class="legend-swatch" style="background:var(${m.colorVar});margin-right:6px"></span> ${m.label}</span>
        <span>${totals[m.key] || 0} min</span>
      </div>`
  ).join("");
}

function renderRecentList(root, state, ctx) {
  const list = root.querySelector("#rehab-list");
  if (state.rehabEntries.length === 0) {
    list.innerHTML = `<div class="empty-state">No rehab sessions logged yet.</div>`;
    return;
  }
  const recent = [...state.rehabEntries].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20);
  list.innerHTML = recent
    .map(
      (e) =>
        `<div class="bw-row">
          <span><span class="legend-swatch" style="background:var(${modalityColorVar(e.modality)});margin-right:6px"></span> ${new Date(e.date).toLocaleDateString()}</span>
          <span>${modalityLabel(e.modality)} · ${e.minutes} min</span>
          <button class="btn btn-sm btn-ghost" data-action="delete-rehab" data-id="${e.id}" aria-label="Delete entry">✕</button>
        </div>`
    )
    .join("");

  list.querySelectorAll('[data-action="delete-rehab"]').forEach((el) =>
    el.addEventListener("click", () => ctx.actions.deleteRehabEntry(el.dataset.id))
  );
}

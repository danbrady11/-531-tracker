import { LIFTS } from "../calc.js";
import { amrapHistory, bodyweightRollingAverage } from "../state.js";
import { drawLineChart } from "../chart.js";

const LIFT_LABELS = { squat: "Squat", bench: "Bench", deadlift: "Deadlift", press: "Press" };

function shortDate(iso) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

let activeLift = "squat";
let amrapMetric = "reps"; // 'reps' | 'e1rm'

export function renderHistory(root, ctx) {
  const { state } = ctx;

  root.innerHTML = `
    <div class="card">
      <h3>AMRAP history</h3>
      <div class="pill-tabs" id="lift-tabs">
        ${LIFTS.map((l) => `<button class="pill-tab ${l === activeLift ? "active" : ""}" data-lift="${l}">${LIFT_LABELS[l]}</button>`).join("")}
      </div>
      <div class="pill-tabs" id="metric-tabs">
        <button class="pill-tab ${amrapMetric === "reps" ? "active" : ""}" data-metric="reps">AMRAP reps</button>
        <button class="pill-tab ${amrapMetric === "e1rm" ? "active" : ""}" data-metric="e1rm">Est. 1RM</button>
      </div>
      <div class="chart-wrap"><canvas class="chart-canvas" id="amrap-chart"></canvas></div>
      <div id="amrap-empty"></div>
    </div>

    <div class="card">
      <h3>Bodyweight</h3>
      <div class="field-row">
        <div class="field">
          <label>Weight (lb)</label>
          <input class="set-input" style="width:100%" type="number" step="0.1" id="bw-weight" />
        </div>
        <div class="field">
          <label>Date</label>
          <input class="set-input" style="width:100%" type="date" id="bw-date" value="${new Date().toISOString().slice(0, 10)}" />
        </div>
      </div>
      <button class="btn btn-primary btn-block" id="bw-add">Log weight</button>
      <div class="chart-wrap" style="margin-top:14px;"><canvas class="chart-canvas" id="bw-chart"></canvas></div>
      <div id="bw-list" style="margin-top:8px;"></div>
    </div>
  `;

  renderAmrapChart(root, state);
  renderBodyweight(root, state, ctx);

  root.querySelectorAll("#lift-tabs .pill-tab").forEach((btn) =>
    btn.addEventListener("click", () => {
      activeLift = btn.dataset.lift;
      renderHistory(root, ctx);
    })
  );
  root.querySelectorAll("#metric-tabs .pill-tab").forEach((btn) =>
    btn.addEventListener("click", () => {
      amrapMetric = btn.dataset.metric;
      renderHistory(root, ctx);
    })
  );

  root.querySelector("#bw-add")?.addEventListener("click", () => {
    const weight = Number(root.querySelector("#bw-weight").value);
    const date = root.querySelector("#bw-date").value;
    if (!weight || !date) return;
    ctx.actions.addBodyweightEntry(new Date(date).toISOString(), weight);
  });
}

function renderAmrapChart(root, state) {
  const history = amrapHistory(state.sessionLogs, activeLift);
  const canvas = root.querySelector("#amrap-chart");
  const points = history.map((h) => ({
    label: shortDate(h.date),
    value: amrapMetric === "reps" ? h.reps : Math.round(h.e1rm),
  }));
  canvas.hidden = points.length === 0;
  if (points.length) drawLineChart(canvas, points, { suffix: amrapMetric === "reps" ? "" : " lb" });
  root.querySelector("#amrap-empty").innerHTML = points.length
    ? ""
    : `<div class="empty-state">No AMRAP sets logged for this lift yet.</div>`;
}

function renderBodyweight(root, state, ctx) {
  const averaged = bodyweightRollingAverage(state.bodyweightEntries);
  const canvas = root.querySelector("#bw-chart");
  const points = averaged.map((e) => ({ label: shortDate(e.date), value: e.rollingAverage }));
  canvas.hidden = points.length === 0;
  if (points.length) drawLineChart(canvas, points, { suffix: " lb" });

  const list = root.querySelector("#bw-list");
  if (averaged.length === 0) {
    list.innerHTML = `<div class="empty-state">No bodyweight entries yet.</div>`;
    return;
  }
  const recent = [...averaged].reverse().slice(0, 10);
  list.innerHTML = recent
    .map(
      (e) =>
        `<div class="bw-row"><span>${new Date(e.date).toLocaleDateString()}</span><span>${e.weight} lb <span class="set-meta">(7d avg ${e.rollingAverage})</span></span></div>`
    )
    .join("");
}

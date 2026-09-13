import { bodyweightRollingAverage, combinedLiftMetricSeries } from "../state.js";
import { drawLineChart, drawMultiLineChart } from "../chart.js";
import { LIFT_META, LIFT_ORDER } from "../lift-meta.js";

function shortDate(iso) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

let liftMetric = "e1rm"; // 'e1rm' | 'volume'

export function renderHistory(root, ctx) {
  const { state } = ctx;

  root.innerHTML = `
    <div class="card">
      <h3>Main lifts over time</h3>
      <div class="pill-tabs" id="metric-tabs">
        <button class="pill-tab ${liftMetric === "e1rm" ? "active" : ""}" data-metric="e1rm">Est. 1RM</button>
        <button class="pill-tab ${liftMetric === "volume" ? "active" : ""}" data-metric="volume">Volume</button>
      </div>
      <div class="chart-wrap"><canvas class="chart-canvas" id="lift-chart"></canvas></div>
      <div id="lift-chart-empty"></div>
      <div class="chart-legend" id="lift-legend"></div>
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

  renderLiftChart(root, state);
  renderBodyweight(root, state, ctx);

  root.querySelectorAll("#metric-tabs .pill-tab").forEach((btn) =>
    btn.addEventListener("click", () => {
      liftMetric = btn.dataset.metric;
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

function renderLiftChart(root, state) {
  const { xLabels, series } = combinedLiftMetricSeries(state.sessionLogs, liftMetric);
  const canvas = root.querySelector("#lift-chart");
  const orderedSeries = LIFT_ORDER.map((lift) => series.find((s) => s.lift === lift)).filter(Boolean);
  const hasData = orderedSeries.some((s) => s.values.some((v) => v != null));

  canvas.hidden = !hasData;
  if (hasData) {
    drawMultiLineChart(canvas, {
      xLabels,
      series: orderedSeries.map((s) => ({ ...s, colorVar: LIFT_META[s.lift].colorVar })),
      suffix: liftMetric === "e1rm" ? " lb" : "",
    });
  }
  root.querySelector("#lift-chart-empty").innerHTML = hasData
    ? ""
    : `<div class="empty-state">No main-lift sessions logged yet.</div>`;

  root.querySelector("#lift-legend").innerHTML = LIFT_ORDER.map(
    (lift) =>
      `<span class="legend-item"><span class="legend-swatch" style="background:var(${LIFT_META[lift].colorVar})"></span>${LIFT_META[lift].label}</span>`
  ).join("");
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

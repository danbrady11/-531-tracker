// Minimal dependency-free line chart on canvas. Draws value points with labels below.

function readCssColor(varName, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v || fallback;
}

/**
 * points: [{ label, value }]
 * Draws a line chart with dots, y-axis auto-scaled to data with padding.
 */
export function drawLineChart(canvas, points, { yLabel = "", suffix = "" } = {}) {
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.parentElement ? Math.max(280, canvas.parentElement.clientWidth) : 320;
  const cssHeight = 200;
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const border = readCssColor("--border", "#e2e8f0");
  const textMuted = readCssColor("--text-muted", "#64748b");
  const accent = readCssColor("--accent", "#0284c7");
  const text = readCssColor("--text", "#0f172a");

  if (!points || points.length === 0) {
    ctx.fillStyle = textMuted;
    ctx.font = "13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("No data yet", cssWidth / 2, cssHeight / 2);
    return;
  }

  const padding = { top: 18, right: 16, bottom: 28, left: 40 };
  const plotW = cssWidth - padding.left - padding.right;
  const plotH = cssHeight - padding.top - padding.bottom;

  const values = points.map((p) => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const rangePad = (max - min) * 0.15;
  min -= rangePad;
  max += rangePad;

  const xFor = (i) => padding.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const yFor = (v) => padding.top + plotH - ((v - min) / (max - min)) * plotH;

  // gridlines
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  const gridLines = 4;
  ctx.font = "11px sans-serif";
  ctx.fillStyle = textMuted;
  ctx.textAlign = "right";
  for (let i = 0; i <= gridLines; i++) {
    const v = min + ((max - min) * i) / gridLines;
    const y = yFor(v);
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(cssWidth - padding.right, y);
    ctx.stroke();
    ctx.fillText(Math.round(v) + suffix, padding.left - 6, y + 3);
  }

  // line
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = xFor(i);
    const y = yFor(p.value);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.stroke();

  // dots
  points.forEach((p, i) => {
    const x = xFor(i);
    const y = yFor(p.value);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.fill();
  });

  // x labels (skip some if crowded)
  ctx.fillStyle = text;
  ctx.textAlign = "center";
  ctx.font = "10px sans-serif";
  const maxLabels = Math.floor(plotW / 55) || 1;
  const step = Math.max(1, Math.ceil(points.length / maxLabels));
  points.forEach((p, i) => {
    if (i % step !== 0 && i !== points.length - 1) return;
    ctx.fillText(p.label, xFor(i), cssHeight - 10);
  });
}

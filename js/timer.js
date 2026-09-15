// Rest timer: timestamp-based so it stays correct across screen sleep / tab
// throttling — we never decrement a counter, we always recompute from the
// stored end time. State persists to localStorage so a reload mid-rest
// still shows the right remaining time.

const KEY = "531-tracker-rest-timer-v1";
let tickHandle = null;
let listeners = [];
let wakeLock = null;

function readTimerState() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeTimerState(state) {
  if (state) localStorage.setItem(KEY, JSON.stringify(state));
  else localStorage.removeItem(KEY);
}

function notify() {
  const remaining = getRemainingMs();
  const state = readTimerState();
  for (const fn of listeners) fn({ remainingMs: remaining, label: state?.label, totalMs: state?.totalMs });
}

function tickLoop() {
  if (tickHandle) return;
  tickHandle = setInterval(() => {
    const remaining = getRemainingMs();
    notify();
    if (remaining <= 0) {
      stopLoop();
      fireExpiryIfNeeded();
    }
  }, 250);
}

function stopLoop() {
  if (tickHandle) {
    clearInterval(tickHandle);
    tickHandle = null;
  }
}

// A backgrounded/screen-locked tab can have its interval throttled or fully
// suspended, so the countdown can reach zero without this ever running at
// the right moment. Guarding on state.notified means whichever path notices
// first — this interval, the visibilitychange catch-up, or the page just
// loading onto an already-expired timer — fires the alert exactly once.
function fireExpiryIfNeeded() {
  const state = readTimerState();
  if (!state || state.notified) return;
  writeTimerState({ ...state, notified: true });
  onExpire(state.label);
}

function onExpire(label) {
  try {
    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
  } catch {}
  beep();
  notifyOS(label);
  releaseWakeLock();
}

// Local (non-push) notification via the service worker, which is the
// supported path for installed/home-screen PWAs (including iOS 16.4+) —
// plain `new Notification()` isn't reliably available in that context.
function notifyOS(label) {
  try {
    if (!("serviceWorker" in navigator) || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    navigator.serviceWorker.ready
      .then((reg) => reg.showNotification("Rest complete", { body: label || "Time for your next set", tag: "531-rest-timer" }))
      .catch(() => {});
  } catch {}
}

let notificationPermissionRequested = false;
// Only meaningful from a user-gesture call stack (a tap that starts a rest
// timer qualifies); requesting from anywhere else is silently ignored by
// most browsers anyway.
function ensureNotificationPermission() {
  try {
    if (typeof Notification === "undefined" || notificationPermissionRequested) return;
    notificationPermissionRequested = true;
    if (Notification.permission === "default") Notification.requestPermission();
  } catch {}
}

function beep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.value = 0.15;
      osc.connect(gain).connect(ctx.destination);
      const start = ctx.currentTime + i * 0.35;
      osc.start(start);
      osc.stop(start + 0.2);
    }
    setTimeout(() => ctx.close(), 1500);
  } catch {}
}

async function acquireWakeLock() {
  try {
    if ("wakeLock" in navigator) {
      wakeLock = await navigator.wakeLock.request("screen");
    }
  } catch {
    wakeLock = null;
  }
}

function releaseWakeLock() {
  try {
    wakeLock?.release?.();
  } catch {}
  wakeLock = null;
}

export function startRestTimer(seconds, label = "") {
  const now = Date.now();
  const state = { endAt: now + seconds * 1000, totalMs: seconds * 1000, label, notified: false };
  writeTimerState(state);
  ensureNotificationPermission();
  acquireWakeLock();
  tickLoop();
  notify();
}

export function cancelRestTimer() {
  writeTimerState(null);
  stopLoop();
  releaseWakeLock();
  notify();
}

export function getRemainingMs() {
  const state = readTimerState();
  if (!state) return 0;
  return Math.max(0, state.endAt - Date.now());
}

export function isRestTimerActive() {
  return getRemainingMs() > 0;
}

export function subscribeRestTimer(fn) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

export function formatMs(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Resume ticking on load if a timer was already running (e.g. page reload
// mid-rest); if it fully elapsed while the page was closed or hidden
// instead, fire the missed alert now rather than silently dropping it.
if (typeof window !== "undefined") {
  if (isRestTimerActive()) {
    tickLoop();
  } else {
    fireExpiryIfNeeded();
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (isRestTimerActive()) {
      acquireWakeLock();
    } else {
      fireExpiryIfNeeded();
    }
    notify();
  });
}

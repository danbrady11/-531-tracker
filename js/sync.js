// Cross-device sync via Firebase Realtime Database. A single JSON blob per
// "sync code" — no accounts, no per-device identity beyond anonymous auth
// (required only so the security rule can require `auth != null`, keeping
// random internet crawlers out of an otherwise-open database).
//
// This is deliberately last-write-wins by timestamp, not a real merge: fine
// for one person using one device at a time, not for simultaneous edits on
// two devices at once.

const FIREBASE_VERSION = "10.13.2";
const CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

const firebaseConfig = {
  apiKey: "AIzaSyBOe8NETvWCw9C4pLskOXAnpesTg3WRlx0",
  authDomain: "tracker-2b4bb.firebaseapp.com",
  databaseURL: "https://tracker-2b4bb-default-rtdb.firebaseio.com",
  projectId: "tracker-2b4bb",
  storageBucket: "tracker-2b4bb.firebasestorage.app",
  messagingSenderId: "100648000434",
  appId: "1:100648000434:web:129180914084017c8ee2ab",
};

const SYNC_CODE_KEY = "531-tracker-sync-code";
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity

let firebaseModulesPromise = null;
let dbInstance = null;
let authReadyPromise = null;

function loadFirebaseModules() {
  if (!firebaseModulesPromise) {
    firebaseModulesPromise = Promise.all([
      import(`${CDN}/firebase-app.js`),
      import(`${CDN}/firebase-auth.js`),
      import(`${CDN}/firebase-database.js`),
    ]);
  }
  return firebaseModulesPromise;
}

async function ensureReady() {
  const [{ initializeApp }, authMod, dbMod] = await loadFirebaseModules();
  if (!dbInstance) {
    const app = initializeApp(firebaseConfig);
    dbInstance = dbMod.getDatabase(app);
    const auth = authMod.getAuth(app);
    authReadyPromise = new Promise((resolve, reject) => {
      const unsub = authMod.onAuthStateChanged(
        auth,
        (user) => {
          if (user) {
            unsub();
            resolve();
          }
        },
        reject
      );
      authMod.signInAnonymously(auth).catch(reject);
    });
  }
  await authReadyPromise;
  return dbMod;
}

export function getSyncCode() {
  return localStorage.getItem(SYNC_CODE_KEY) || "";
}

export function setSyncCodeLocally(code) {
  if (code) localStorage.setItem(SYNC_CODE_KEY, code);
  else localStorage.removeItem(SYNC_CODE_KEY);
}

export function generateSyncCode() {
  let code = "";
  for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

/**
 * Write { state, updatedAt } to syncs/{code}, replacing whatever was there.
 *
 * Older session logs (e.g. from before accessory/rehab tracking existed)
 * can be missing fields entirely, leaving them `undefined` — harmless for
 * localStorage since JSON.stringify silently drops undefined keys, but
 * Firebase's set() throws on any undefined found anywhere in the tree. The
 * JSON round-trip here applies that same silent-drop behavior before the
 * write, so cloud sync tolerates the same legacy data local storage does.
 */
export async function pushToCloud(code, state, updatedAt) {
  const dbMod = await ensureReady();
  const payload = JSON.parse(JSON.stringify({ state, updatedAt }));
  await dbMod.set(dbMod.ref(dbInstance, `syncs/${code}`), payload);
}

/** One-time read of syncs/{code}. Returns { state, updatedAt } or null. */
export async function pullFromCloud(code) {
  const dbMod = await ensureReady();
  const snap = await dbMod.get(dbMod.ref(dbInstance, `syncs/${code}`));
  return snap.exists() ? snap.val() : null;
}

/**
 * Subscribe to syncs/{code}. Fires immediately with the current value (if
 * any), then again on every change from any device. Returns an unsubscribe
 * function; call it before watching a different code.
 */
export function watchCloud(code, onData, onError) {
  let unsubscribed = false;
  let unsubscribeFn = () => {
    unsubscribed = true;
  };
  ensureReady()
    .then((dbMod) => {
      if (unsubscribed) return;
      const off = dbMod.onValue(
        dbMod.ref(dbInstance, `syncs/${code}`),
        (snap) => {
          if (snap.exists()) onData(snap.val());
        },
        onError
      );
      unsubscribeFn = off;
    })
    .catch((err) => onError?.(err));
  return () => unsubscribeFn();
}

/**
 * v23 morning proof: timestamped Wake / Leave taps + workout photo.
 * Times are judged on the phone's local clock.
 * Photos live in IndexedDB (not localStorage) keyed by date.
 */

export const PROOF_RULES = {
  wake: { label: "I'm up", doneLabel: 'Up', by: '5:00', graceH: 5, graceM: 10 },
  leave: { label: 'Leaving', doneLabel: 'Left', by: '5:30', graceH: 5, graceM: 40 },
  exercise: { label: 'Workout photo', doneLabel: 'Workout', by: '6:00' },
};

/** First date the new proof rules apply (stored once; never changes stored history). */
export const PROOF_SINCE_KEY = 'manuel-os-proof-since-v1';

export function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isOnTime(checkId, date) {
  const r = PROOF_RULES[checkId];
  if (!r || r.graceH == null) return true;
  const mins = date.getHours() * 60 + date.getMinutes();
  // "At or before 5:10" → anything up to 5:10:59 counts.
  return mins <= r.graceH * 60 + r.graceM;
}

/** Past the grace deadline today (for a soft "window passed" hint). */
export function windowPassed(checkId, now = new Date()) {
  const r = PROOF_RULES[checkId];
  if (!r || r.graceH == null) return false;
  return now.getHours() * 60 + now.getMinutes() > r.graceH * 60 + r.graceM;
}

/** "4:58 AM" in the phone's local time. */
export function fmtClock(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

/** "4:58" (no meridiem) for compact summary chips. */
export function fmtClockShort(iso) {
  return fmtClock(iso).replace(/\s?[AP]M$/i, '');
}

/** Minutes since local midnight for an ISO timestamp. */
export function minutesOfDay(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.getHours() * 60 + d.getMinutes();
}

export function fmtMinutes(mins) {
  if (mins == null) return '—';
  const m = Math.round(mins);
  let h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h %= 12;
  if (h === 0) h = 12;
  return `${h}:${mm} ${ap}`;
}

/* ---------------- IndexedDB photo store ---------------- */

const DB_NAME = 'manuel-os-proof';
const DB_VERSION = 1;
const STORE = 'photos';

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'dateKey' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).catch((err) => {
    dbPromise = null;
    throw err;
  });
  return dbPromise;
}

function tx(mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const store = t.objectStore(STORE);
        let result;
        const req = fn(store);
        if (req) req.onsuccess = () => {
          result = req.result;
        };
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      }),
  );
}

/** Record: { dateKey, bytes: ArrayBuffer, type, width, height, takenAt, loggedAt } */
export function putPhoto(record) {
  return tx('readwrite', (s) => s.put(record));
}

export function getPhoto(dateKey) {
  return tx('readonly', (s) => s.get(dateKey));
}

export function deletePhoto(dateKey) {
  return tx('readwrite', (s) => s.delete(dateKey));
}

/** Ask the browser not to evict our data (best effort; no prompt on iOS). */
export function requestPersistence() {
  try {
    navigator.storage?.persist?.().catch(() => {});
  } catch {
    /* ignore */
  }
}

/* ---------------- Image downscale ---------------- */

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image'));
    };
    img.src = url;
  });
}

/** Downscale to maxSide px (longest edge) and re-encode as JPEG. EXIF orientation is applied by the browser. */
export async function downscaleImage(file, maxSide = 1080, quality = 0.75) {
  const { img, url } = await loadImage(file);
  try {
    const w0 = img.naturalWidth || img.width;
    const h0 = img.naturalHeight || img.height;
    const scale = Math.min(1, maxSide / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * scale));
    const h = Math.max(1, Math.round(h0 * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Encode failed'))), 'image/jpeg', quality);
    });
    // Free canvas memory early (iOS has tight canvas limits).
    canvas.width = 0;
    canvas.height = 0;
    return { blob, width: w, height: h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

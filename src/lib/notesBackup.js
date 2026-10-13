/**
 * v26 Notes safety net: rolling notebook snapshots in IndexedDB
 * (separate from localStorage so a bad write can never take the backups with it).
 */
const DB = 'manuel-os-notes-backup';
const STORE = 'snaps';
export const MAX_BACKUPS = 20;

let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no idb'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  dbp.catch(() => {
    dbp = null;
  });
  return dbp;
}

function tx(mode, fn) {
  return db().then(
    (d) =>
      new Promise((resolve, reject) => {
        const t = d.transaction(STORE, mode);
        const s = t.objectStore(STORE);
        let out;
        Promise.resolve(fn(s)).then((v) => {
          out = v;
        });
        t.oncomplete = () => resolve(out);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      }),
  );
}

function all(store) {
  return new Promise((resolve, reject) => {
    const r = store.getAll();
    r.onsuccess = () => resolve(r.result || []);
    r.onerror = () => reject(r.error);
  });
}

export function noteCount(nb) {
  return Array.isArray(nb?.pages) ? nb.pages.filter((p) => String(p.title || '').trim() || String(p.body || '').trim()).length : 0;
}

/** Newest first. */
export async function listBackups() {
  try {
    const rows = await tx('readonly', (s) => all(s));
    return rows.sort((a, b) => b.ts - a.ts);
  } catch {
    return [];
  }
}

/**
 * Save a snapshot unless it's identical to the newest one. Keeps the newest MAX_BACKUPS,
 * but never prunes snapshots marked keep (e.g. "found on this device").
 */
export async function addBackup(nb, reason = 'Auto') {
  if (!nb || !Array.isArray(nb.pages) || !Array.isArray(nb.sections)) return null;
  try {
    const json = JSON.stringify({ sections: nb.sections, pages: nb.pages });
    const rows = await listBackups();
    if (rows[0] && rows[0].json === json) return rows[0];
    const ts = Date.now();
    const row = {
      id: `${ts}-${Math.random().toString(36).slice(2, 6)}`,
      ts,
      reason,
      count: noteCount(nb),
      folders: nb.sections.length,
      json,
      keep: reason.startsWith('Found'),
    };
    const prune = rows.filter((r) => !r.keep).slice(MAX_BACKUPS - 1);
    await tx('readwrite', (s) => {
      s.put(row);
      for (const r of prune) s.delete(r.id);
    });
    return row;
  } catch {
    return null;
  }
}

export async function lastBackupTs() {
  const rows = await listBackups();
  return rows[0]?.ts || 0;
}

export function parseBackup(row) {
  try {
    const p = JSON.parse(row.json);
    if (p && Array.isArray(p.sections) && Array.isArray(p.pages)) return p;
  } catch {
    /* ignore */
  }
  return null;
}

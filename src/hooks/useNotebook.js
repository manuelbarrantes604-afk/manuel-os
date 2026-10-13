import { useCallback, useEffect, useRef, useState } from 'react';
import { addBackup, lastBackupTs, noteCount } from '../lib/notesBackup';

/**
 * Notes notebook (folders → notes). Key and shape unchanged since v24.
 *
 * v26 data-safety rules:
 *  - Nothing is written just because the app opened.
 *  - Every change is applied to a FRESH read of storage and written immediately, so a stale
 *    copy in memory (old tab, old app instance, old bundle) can never replace newer notes.
 *  - Edits only touch the one note being edited; older content never replaces newer.
 *  - Deleted notes go to "Recently Deleted" (separate key) for 30 days.
 *  - Rolling snapshots in IndexedDB before destructive changes and periodically.
 */
export const NOTEBOOK_KEY = 'manuel-os-notebook-v1';
export const TRASH_KEY = 'manuel-os-notes-trash-v1';
const TRASH_DAYS = 30;
const AUTO_BACKUP_MS = 10 * 60 * 1000;

export const SECTION_COLORS = [
  { id: 'sky', bg: 'var(--pastel-sky)', ink: '#2c6db0' },
  { id: 'mint', bg: 'var(--pastel-mint)', ink: '#2f7a4d' },
  { id: 'peach', bg: 'var(--pastel-peach)', ink: '#b4572a' },
  { id: 'lilac', bg: 'var(--pastel-lilac)', ink: '#6a52c9' },
  { id: 'butter', bg: 'var(--pastel-butter)', ink: '#8a6d0b' },
  { id: 'rose', bg: 'var(--pastel-rose)', ink: '#b23a63' },
  { id: 'sage', bg: 'var(--pastel-sage)', ink: '#4f6b55' },
];

export function colorOf(id) {
  return SECTION_COLORS.find((c) => c.id === id) || SECTION_COLORS[0];
}

function uid(p) {
  return `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

const nowIso = () => new Date().toISOString();

function seed() {
  return {
    sections: [{ id: 'sec-general', name: 'General', color: 'sky', createdAt: nowIso() }],
    pages: [],
  };
}

function valid(p) {
  return p && Array.isArray(p.sections) && Array.isArray(p.pages);
}

/** Exactly what's stored, or null when missing/unreadable (never invents data). */
function readStored() {
  try {
    const raw = localStorage.getItem(NOTEBOOK_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return valid(p) ? p : null;
  } catch {
    return null;
  }
}

function forView(p) {
  if (!valid(p)) return seed();
  if (p.sections.length === 0) return { ...p, sections: seed().sections };
  return p;
}

function readTrash() {
  try {
    const t = JSON.parse(localStorage.getItem(TRASH_KEY) || '[]');
    if (!Array.isArray(t)) return [];
    const cutoff = Date.now() - TRASH_DAYS * 86400000;
    return t.filter((x) => x && x.page && new Date(x.deletedAt).getTime() > cutoff);
  } catch {
    return [];
  }
}

function writeTrash(t) {
  try {
    localStorage.setItem(TRASH_KEY, JSON.stringify(t));
  } catch {
    /* keep going: backups still have it */
  }
}

const later = (iso, than) => (iso || '') > (than || '');

export function useNotebook() {
  const [nb, setNb] = useState(() => forView(readStored()));
  const [trash, setTrash] = useState(readTrash);
  const [saveError, setSaveError] = useState(false);
  const latest = useRef(nb);
  const lastAuto = useRef(0);

  const sync = useCallback(() => {
    const s = forView(readStored());
    latest.current = s;
    setNb(s);
    setTrash(readTrash());
  }, []);

  // Pick up changes from other tabs / app instances, and whenever the app comes back.
  useEffect(() => {
    const onStorage = (e) => {
      if (!e.key || e.key === NOTEBOOK_KEY || e.key === TRASH_KEY) sync();
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') sync();
      else backup('Auto (app hidden)', true);
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('pageshow', sync);
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', onVis);
    // Launch snapshot (read-only for notes; IndexedDB only).
    const stored = readStored();
    if (stored && noteCount(stored)) addBackup(stored, 'Opened app').then(() => (lastAuto.current = Date.now()));
    lastBackupTs().then((t) => (lastAuto.current = Math.max(lastAuto.current, t)));
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('pageshow', sync);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sync]);

  /** Snapshot what's in storage right now. */
  const backup = useCallback((reason, onlyIfDue = false) => {
    if (onlyIfDue && Date.now() - lastAuto.current < AUTO_BACKUP_MS) return Promise.resolve(null);
    const cur = readStored() || latest.current;
    if (!noteCount(cur) && cur.sections.length <= 1) return Promise.resolve(null);
    lastAuto.current = Date.now();
    return addBackup(cur, reason);
  }, []);

  /** Apply fn to a FRESH read of storage, write, then show. Returns fn's extra result. */
  const commit = useCallback((fn) => {
    const base = forView(readStored() || latest.current);
    const res = fn(base);
    const next = res && res.nb ? res.nb : res;
    if (!next || next === base) {
      latest.current = base;
      setNb(base);
      return res?.out;
    }
    try {
      localStorage.setItem(NOTEBOOK_KEY, JSON.stringify(next));
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
    latest.current = next;
    setNb(next);
    if (Date.now() - lastAuto.current > AUTO_BACKUP_MS) backup('Auto', true);
    return res?.out;
  }, [backup]);

  const addSection = useCallback(
    (name, color) => {
      const id = uid('sec');
      const n = String(name || '').trim() || 'Untitled folder';
      commit((p) => ({ ...p, sections: [...p.sections, { id, name: n, color: color || 'sky', createdAt: nowIso() }] }));
      return id;
    },
    [commit],
  );

  const updateSection = useCallback(
    (id, patch) =>
      commit((p) => {
        if (!p.sections.some((s) => s.id === id)) return p;
        return {
          ...p,
          sections: p.sections.map((s) =>
            s.id === id ? { ...s, ...patch, name: patch.name != null ? String(patch.name).trim() || s.name : s.name } : s,
          ),
        };
      }),
    [commit],
  );

  const moveSection = useCallback(
    (id, dir) =>
      commit((p) => {
        const i = p.sections.findIndex((s) => s.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= p.sections.length) return p;
        const next = p.sections.slice();
        [next[i], next[j]] = [next[j], next[i]];
        return { ...p, sections: next };
      }),
    [commit],
  );

  const toTrash = useCallback((pagesOut, sectionName) => {
    const real = pagesOut.filter((pg) => String(pg.title || '').trim() || String(pg.body || '').trim());
    if (!real.length) return;
    const at = nowIso();
    const t = [...real.map((page) => ({ page, deletedAt: at, sectionName })), ...readTrash().filter((x) => !real.some((r) => r.id === x.page.id))];
    writeTrash(t);
    setTrash(t);
  }, []);

  const removeFromTrash = useCallback((ids) => {
    const t = readTrash().filter((x) => !ids.includes(x.page.id));
    writeTrash(t);
    setTrash(t);
  }, []);

  /** Returns a snapshot for undo. */
  const deleteSection = useCallback(
    (id) => {
      backup('Before deleting a folder');
      const snap = commit((p) => {
        const index = p.sections.findIndex((s) => s.id === id);
        if (index < 0 || p.sections.length <= 1) return p;
        const out = { section: p.sections[index], index, pages: p.pages.filter((pg) => pg.sectionId === id) };
        return {
          nb: { ...p, sections: p.sections.filter((s) => s.id !== id), pages: p.pages.filter((pg) => pg.sectionId !== id) },
          out,
        };
      });
      if (snap) toTrash(snap.pages, snap.section.name);
      return snap || null;
    },
    [commit, backup, toTrash],
  );

  const restoreSection = useCallback(
    (snap) => {
      if (!snap) return;
      commit((p) => {
        const sections = p.sections.slice();
        if (!sections.some((s) => s.id === snap.section.id)) sections.splice(Math.min(snap.index, sections.length), 0, snap.section);
        const have = new Set(p.pages.map((pg) => pg.id));
        return { ...p, sections, pages: [...p.pages, ...snap.pages.filter((pg) => !have.has(pg.id))] };
      });
      removeFromTrash(snap.pages.map((pg) => pg.id));
    },
    [commit, removeFromTrash],
  );

  const addPage = useCallback(
    (sectionId) => {
      const id = uid('pg');
      const now = nowIso();
      commit((p) => ({ ...p, pages: [{ id, sectionId, title: '', body: '', createdAt: now, updatedAt: now }, ...p.pages] }));
      return id;
    },
    [commit],
  );

  /** Edit one note. Only that note is touched; if it was deleted elsewhere, it's not resurrected silently. */
  const updatePage = useCallback(
    (id, patch) =>
      commit((p) => {
        const cur = p.pages.find((pg) => pg.id === id);
        if (!cur) {
          // Edited in a stale view after deletion elsewhere: keep the words, don't lose them.
          const mine = latest.current.pages.find((pg) => pg.id === id);
          if (!mine) return p;
          return { ...p, pages: [{ ...mine, ...patch, updatedAt: nowIso() }, ...p.pages] };
        }
        const seen = latest.current.pages.find((pg) => pg.id === id);
        if (seen && later(cur.updatedAt, seen.updatedAt) && (cur.title !== seen.title || cur.body !== seen.body)) {
          // Someone else saved newer text for this note: snapshot it before we change it.
          addBackup(p, 'Before editing a note changed elsewhere');
        }
        return { ...p, pages: p.pages.map((pg) => (pg.id === id ? { ...pg, ...patch, updatedAt: nowIso() } : pg)) };
      }),
    [commit],
  );

  const movePage = useCallback(
    (id, sectionId) =>
      commit((p) => {
        if (!p.sections.some((s) => s.id === sectionId) || !p.pages.some((pg) => pg.id === id)) return p;
        return { ...p, pages: p.pages.map((pg) => (pg.id === id ? { ...pg, sectionId } : pg)) };
      }),
    [commit],
  );

  /** Moves the note to Recently Deleted. Returns it for undo. */
  const deletePage = useCallback(
    (id) => {
      const page = commit((p) => {
        const pg = p.pages.find((x) => x.id === id);
        if (!pg) return p;
        return { nb: { ...p, pages: p.pages.filter((x) => x.id !== id) }, out: pg };
      });
      if (page) {
        const sec = latest.current.sections.find((s) => s.id === page.sectionId);
        toTrash([page], sec?.name);
      }
      return page || null;
    },
    [commit, toTrash],
  );

  const restorePage = useCallback(
    (page) => {
      if (!page) return;
      commit((p) => {
        if (p.pages.some((pg) => pg.id === page.id)) return p;
        const sectionId = p.sections.some((s) => s.id === page.sectionId) ? page.sectionId : p.sections[0].id;
        return { ...p, pages: [{ ...page, sectionId }, ...p.pages] };
      });
      removeFromTrash([page.id]);
    },
    [commit, removeFromTrash],
  );

  /**
   * Put one note's content back (Undo changes / Revert). Only acts if the note still holds
   * exactly `expect` — if it changed since, nothing is overwritten. Returns true if applied.
   */
  const restoreContent = useCallback(
    (id, snap, expect) => {
      if (!snap) return false;
      backup('Before undoing note changes');
      return Boolean(
        commit((p) => {
          const cur = p.pages.find((pg) => pg.id === id);
          if (!cur) return p;
          if (expect && (cur.title !== expect.title || cur.body !== expect.body)) return p;
          return {
            nb: {
              ...p,
              pages: p.pages.map((pg) =>
                pg.id === id ? { ...pg, title: snap.title, body: snap.body, updatedAt: snap.updatedAt || pg.updatedAt } : pg,
              ),
            },
            out: true,
          };
        }),
      );
    },
    [commit, backup],
  );

  /** Replace the whole notebook with a backup (current one is snapshotted first). */
  const restoreNotebook = useCallback(
    async (data) => {
      if (!valid(data)) return null;
      const before = readStored() || latest.current;
      await addBackup(before, 'Before restoring a backup');
      commit(() => ({ sections: data.sections.length ? data.sections : seed().sections, pages: data.pages }));
      return before;
    },
    [commit],
  );

  return {
    sections: nb.sections,
    pages: nb.pages,
    trash,
    saveError,
    addSection,
    updateSection,
    moveSection,
    deleteSection,
    restoreSection,
    addPage,
    updatePage,
    movePage,
    deletePage,
    restorePage,
    restoreContent,
    restoreNotebook,
    backup,
    getRaw: () => readStored() || latest.current,
  };
}

import { useCallback, useEffect, useRef, useState } from 'react';

/** v24 Notes notebook (OneNote-style sections → pages). New key only. */
export const NOTEBOOK_KEY = 'manuel-os-notebook-v1';

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

function seed() {
  const now = new Date().toISOString();
  return {
    sections: [{ id: 'sec-general', name: 'General', color: 'sky', createdAt: now }],
    pages: [],
  };
}

function load() {
  try {
    const raw = localStorage.getItem(NOTEBOOK_KEY);
    if (!raw) return seed();
    const p = JSON.parse(raw);
    if (!p || !Array.isArray(p.sections) || !Array.isArray(p.pages)) return seed();
    if (p.sections.length === 0) return { ...p, sections: seed().sections };
    return p;
  } catch {
    return seed();
  }
}

export function useNotebook() {
  const [nb, setNb] = useState(load);
  const [saveError, setSaveError] = useState(false);
  const timer = useRef(null);
  const latest = useRef(nb);

  // Debounced persist (long notes) + flush on hide/unload.
  useEffect(() => {
    latest.current = nb;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        localStorage.setItem(NOTEBOOK_KEY, JSON.stringify(nb));
        setSaveError(false);
      } catch {
        setSaveError(true);
      }
    }, 250);
  }, [nb]);

  useEffect(() => {
    const flush = () => {
      try {
        localStorage.setItem(NOTEBOOK_KEY, JSON.stringify(latest.current));
      } catch {
        /* ignore */
      }
    };
    const onVis = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', flush);
    return () => {
      flush();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', flush);
    };
  }, []);

  const addSection = useCallback((name, color) => {
    const id = uid('sec');
    const n = String(name || '').trim() || 'Untitled section';
    setNb((p) => ({
      ...p,
      sections: [...p.sections, { id, name: n, color: color || 'sky', createdAt: new Date().toISOString() }],
    }));
    return id;
  }, []);

  const updateSection = useCallback((id, patch) => {
    setNb((p) => ({
      ...p,
      sections: p.sections.map((s) =>
        s.id === id
          ? { ...s, ...patch, name: patch.name != null ? String(patch.name).trim() || s.name : s.name }
          : s,
      ),
    }));
  }, []);

  const moveSection = useCallback((id, dir) => {
    setNb((p) => {
      const i = p.sections.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= p.sections.length) return p;
      const next = p.sections.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return { ...p, sections: next };
    });
  }, []);

  /** Returns a snapshot for undo. */
  const deleteSection = useCallback(
    (id) => {
      const cur = latest.current;
      const index = cur.sections.findIndex((s) => s.id === id);
      if (index < 0 || cur.sections.length <= 1) return null;
      const snap = {
        section: cur.sections[index],
        index,
        pages: cur.pages.filter((pg) => pg.sectionId === id),
      };
      setNb((p) => ({
        sections: p.sections.filter((s) => s.id !== id),
        pages: p.pages.filter((pg) => pg.sectionId !== id),
      }));
      return snap;
    },
    [],
  );

  const restoreSection = useCallback((snap) => {
    if (!snap) return;
    setNb((p) => {
      if (p.sections.some((s) => s.id === snap.section.id)) return p;
      const sections = p.sections.slice();
      sections.splice(Math.min(snap.index, sections.length), 0, snap.section);
      return { sections, pages: [...p.pages, ...snap.pages] };
    });
  }, []);

  const addPage = useCallback((sectionId) => {
    const id = uid('pg');
    const now = new Date().toISOString();
    setNb((p) => ({
      ...p,
      pages: [{ id, sectionId, title: '', body: '', createdAt: now, updatedAt: now }, ...p.pages],
    }));
    return id;
  }, []);

  const updatePage = useCallback((id, patch) => {
    setNb((p) => ({
      ...p,
      pages: p.pages.map((pg) => (pg.id === id ? { ...pg, ...patch, updatedAt: new Date().toISOString() } : pg)),
    }));
  }, []);

  const movePage = useCallback((id, sectionId) => {
    setNb((p) => ({
      ...p,
      pages: p.pages.map((pg) => (pg.id === id ? { ...pg, sectionId } : pg)),
    }));
  }, []);

  const deletePage = useCallback((id) => {
    const page = latest.current.pages.find((pg) => pg.id === id) || null;
    setNb((p) => ({ ...p, pages: p.pages.filter((pg) => pg.id !== id) }));
    return page;
  }, []);

  const restorePage = useCallback((page) => {
    if (!page) return;
    setNb((p) => {
      if (p.pages.some((pg) => pg.id === page.id)) return p;
      const sectionId = p.sections.some((s) => s.id === page.sectionId) ? page.sectionId : p.sections[0].id;
      return { ...p, pages: [{ ...page, sectionId }, ...p.pages] };
    });
  }, []);

  return {
    sections: nb.sections,
    pages: nb.pages,
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
  };
}

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SECTION_COLORS, colorOf } from '../hooks/useNotebook';

const TOAST_MS = 5000;

function useMediaQuery(q) {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q).matches : false);
  const [m, setM] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, [q]);
  return m;
}

function firstLine(text) {
  return (
    String(text || '')
      .split('\n')
      .map((l) => l.trim())
      .find(Boolean) || ''
  );
}

function pageTitle(pg) {
  return pg.title?.trim() || firstLine(pg.body) || 'Untitled';
}

function pagePreview(pg) {
  const body = String(pg.body || '');
  if (pg.title?.trim()) return firstLine(body);
  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines[1] || '';
}

function fmtUpdated(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `Today ${time}`;
  if (d.toDateString() === y.toDateString()) return `Yesterday ${time}`;
  const opts = { month: 'short', day: 'numeric' };
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('en-US', opts);
}

function SectionChip({ section, size = 36 }) {
  const c = colorOf(section?.color);
  const letter = (section?.name || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <span className="nb-chip" style={{ background: c.bg, color: c.ink, width: size, height: size }} aria-hidden="true">
      {letter}
    </span>
  );
}

function Sheet({ label, onClose, children }) {
  return createPortal(
    <div className="note-sheet-root nb-sheet-root" role="presentation">
      <button type="button" className="note-sheet-backdrop" aria-label="Close" onClick={onClose} />
      <div className="note-sheet nb-sheet" role="dialog" aria-modal="true" aria-label={label}>
        <div className="note-sheet-handle" aria-hidden="true" />
        {children}
      </div>
    </div>,
    document.body,
  );
}

function SectionSheet({ mode, section, index, total, onSave, onMove, onDelete, onClose }) {
  const [name, setName] = useState(section?.name || '');
  const [color, setColor] = useState(section?.color || SECTION_COLORS[(total || 0) % SECTION_COLORS.length].id);
  const [confirm, setConfirm] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const t = requestAnimationFrame(() => ref.current?.focus());
    return () => cancelAnimationFrame(t);
  }, []);
  const isNew = mode === 'new';
  return (
    <Sheet label={isNew ? 'New section' : 'Edit section'} onClose={onClose}>
      <h3 className="nb-sheet-title">{isNew ? 'New section' : 'Edit section'}</h3>
      <form
        className="nb-sheet-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(name, color);
        }}
      >
        <input
          ref={ref}
          className="nb-field"
          placeholder="Section name (e.g. Faith, Business)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Section name"
          maxLength={40}
        />
        <div className="nb-swatches" role="radiogroup" aria-label="Color">
          {SECTION_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={color === c.id}
              aria-label={c.id}
              className={`nb-swatch ${color === c.id ? 'on' : ''}`}
              style={{ background: c.bg, color: c.ink }}
              onClick={() => setColor(c.id)}
            >
              {color === c.id ? '✓' : ''}
            </button>
          ))}
        </div>
        {!isNew ? (
          <div className="nb-sheet-row">
            <button type="button" className="note-sheet-btn" disabled={index <= 0} onClick={() => onMove(-1)}>
              ▲ Move up
            </button>
            <button type="button" className="note-sheet-btn" disabled={index >= total - 1} onClick={() => onMove(1)}>
              ▼ Move down
            </button>
          </div>
        ) : null}
        {confirm ? (
          <div className="nb-confirm">
            <span>Delete this section and its notes?</span>
            <div className="nb-sheet-row">
              <button type="button" className="note-sheet-btn" onClick={() => setConfirm(false)}>
                Keep
              </button>
              <button type="button" className="note-sheet-btn danger" onClick={onDelete}>
                Delete
              </button>
            </div>
          </div>
        ) : (
          <div className={`nb-sheet-row ${isNew ? '' : 'three'}`}>
            {!isNew ? (
              <button
                type="button"
                className="note-sheet-btn danger"
                disabled={total <= 1}
                onClick={() => setConfirm(true)}
                title={total <= 1 ? 'Keep at least one section' : 'Delete section'}
              >
                Delete
              </button>
            ) : null}
            <button type="button" className="note-sheet-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="note-sheet-btn done">
              {isNew ? 'Add' : 'Save'}
            </button>
          </div>
        )}
      </form>
    </Sheet>
  );
}

function PageMenuSheet({ page, sections, onMove, onDelete, onClose }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <Sheet label="Note options" onClose={onClose}>
      <h3 className="nb-sheet-title">{pageTitle(page)}</h3>
      <p className="nb-sheet-hint">Move to section</p>
      <div className="nb-move-list">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`nb-move-item ${s.id === page.sectionId ? 'current' : ''}`}
            disabled={s.id === page.sectionId}
            onClick={() => onMove(s.id)}
          >
            <SectionChip section={s} size={28} />
            <span>{s.name}</span>
            {s.id === page.sectionId ? <em>Current</em> : <span className="nb-chev">›</span>}
          </button>
        ))}
      </div>
      {confirm ? (
        <div className="nb-confirm">
          <span>Delete this note?</span>
          <div className="nb-sheet-row">
            <button type="button" className="note-sheet-btn" onClick={() => setConfirm(false)}>
              Keep
            </button>
            <button type="button" className="note-sheet-btn danger" onClick={onDelete}>
              Delete
            </button>
          </div>
        </div>
      ) : (
        <div className="nb-sheet-row">
          <button type="button" className="note-sheet-btn danger" onClick={() => setConfirm(true)}>
            Delete note
          </button>
          <button type="button" className="note-sheet-btn done" onClick={onClose}>
            Done
          </button>
        </div>
      )}
    </Sheet>
  );
}

function PageRow({ page, section, active, onOpen, showSection }) {
  const preview = pagePreview(page);
  return (
    <li>
      <button type="button" className={`nb-page ${active ? 'active' : ''}`} onClick={() => onOpen(page.id)}>
        {showSection ? <SectionChip section={section} size={28} /> : null}
        <span className="nb-page-copy">
          <strong className="nb-page-title">{pageTitle(page)}</strong>
          <span className="nb-page-preview">{preview || 'No additional text'}</span>
          <span className="nb-page-date">
            {showSection && section ? `${section.name} · ` : ''}
            {fmtUpdated(page.updatedAt)}
          </span>
        </span>
      </button>
    </li>
  );
}

function SectionsPane({ sections, pages, activeId, onOpen, onEdit, onAdd, query, setQuery, results, onOpenPage, recent, wide }) {
  const counts = useMemo(() => {
    const m = {};
    for (const p of pages) m[p.sectionId] = (m[p.sectionId] || 0) + 1;
    return m;
  }, [pages]);
  const byId = Object.fromEntries(sections.map((s) => [s.id, s]));

  return (
    <div className="nb-pane nb-sections-pane">
      {!wide ? (
        <div className="tiimo-day-head nb-head">
          <h1 className="tiimo-day-title">Notes</h1>
          <button type="button" className="nb-text-btn" onClick={onAdd}>
            + Section
          </button>
        </div>
      ) : (
        <div className="nb-pane-head">
          <h2>Sections</h2>
          <button type="button" className="nb-icon-btn" onClick={onAdd} aria-label="Add section">
            +
          </button>
        </div>
      )}
      <label className="nb-search">
        <span aria-hidden="true">⌕</span>
        <input
          type="search"
          placeholder="Search notes"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search notes"
        />
        {query ? (
          <button type="button" className="nb-search-clear" onClick={() => setQuery('')} aria-label="Clear search">
            ×
          </button>
        ) : null}
      </label>

      {query.trim() ? (
        <div className="nb-results">
          <p className="nb-label">
            {results.length} result{results.length === 1 ? '' : 's'}
          </p>
          {results.length ? (
            <ul className="nb-page-list">
              {results.map((pg) => (
                <PageRow key={pg.id} page={pg} section={byId[pg.sectionId]} onOpen={onOpenPage} showSection />
              ))}
            </ul>
          ) : (
            <p className="nb-empty">No notes match “{query.trim()}”.</p>
          )}
        </div>
      ) : (
        <>
          <ul className="nb-section-list">
            {sections.map((s) => {
              const c = colorOf(s.color);
              return (
                <li key={s.id} className={`nb-section ${activeId === s.id ? 'active' : ''}`} style={{ '--sec-ink': c.ink, '--sec-bg': c.bg }}>
                  <button type="button" className="nb-section-main" onClick={() => onOpen(s.id)}>
                    <SectionChip section={s} />
                    <span className="nb-section-name">{s.name}</span>
                    <span className="nb-count">{counts[s.id] || 0}</span>
                  </button>
                  <button type="button" className="nb-more" onClick={() => onEdit(s.id)} aria-label={`Edit section ${s.name}`}>
                    ⋯
                  </button>
                </li>
              );
            })}
          </ul>
          {!wide && recent.length ? (
            <div className="nb-recent">
              <p className="nb-label">Recent</p>
              <ul className="nb-page-list">
                {recent.map((pg) => (
                  <PageRow key={pg.id} page={pg} section={byId[pg.sectionId]} onOpen={onOpenPage} showSection />
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function PagesPane({ section, pages, activePageId, onOpen, onAdd, onBack, onEdit, wide }) {
  if (!section) return <div className="nb-pane nb-pages-pane" />;
  const c = colorOf(section.color);
  return (
    <div className="nb-pane nb-pages-pane" style={{ '--sec-ink': c.ink, '--sec-bg': c.bg }}>
      {!wide ? (
        <div className="nb-bar">
          <button type="button" className="nb-back" onClick={onBack}>
            ‹ Notes
          </button>
          <button type="button" className="nb-more" onClick={onEdit} aria-label="Edit section">
            ⋯
          </button>
        </div>
      ) : null}
      <div className="nb-pages-head">
        <SectionChip section={section} size={wide ? 30 : 40} />
        <div className="nb-pages-title">
          {wide ? <h2>{section.name}</h2> : <h1 className="tiimo-day-title nb-section-title">{section.name}</h1>}
          <span className="nb-pages-count">
            {pages.length} note{pages.length === 1 ? '' : 's'}
          </span>
        </div>
        {wide ? (
          <button type="button" className="nb-more" onClick={onEdit} aria-label="Edit section">
            ⋯
          </button>
        ) : null}
      </div>
      <button type="button" className="nb-new-note" onClick={onAdd}>
        <span aria-hidden="true">＋</span> New note
      </button>
      {pages.length ? (
        <ul className="nb-page-list">
          {pages.map((pg) => (
            <PageRow key={pg.id} page={pg} active={pg.id === activePageId} onOpen={onOpen} />
          ))}
        </ul>
      ) : (
        <p className="nb-empty">No notes yet. Start one — it saves as you type.</p>
      )}
    </div>
  );
}

function Editor({ page, section, onChange, onBack, onMenu, wide, saveError }) {
  const titleRef = useRef(null);
  const bodyRef = useRef(null);
  const [saved, setSaved] = useState(true);
  // Auto-grow the title so long titles wrap instead of being cut off.
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [page?.title, page?.id, wide]);
  useEffect(() => {
    if (page && !page.title && !page.body) {
      const t = requestAnimationFrame(() => titleRef.current?.focus());
      return () => cancelAnimationFrame(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page?.id]);
  useEffect(() => {
    if (saved) return undefined;
    const t = setTimeout(() => setSaved(true), 600);
    return () => clearTimeout(t);
  }, [saved, page?.updatedAt]);

  if (!page) {
    return (
      <div className="nb-pane nb-editor-pane empty">
        <p className="nb-empty">Pick a note, or start a new one.</p>
      </div>
    );
  }
  const c = colorOf(section?.color);
  const edit = (patch) => {
    setSaved(false);
    onChange(page.id, patch);
  };
  const body = (
    <div className={`nb-editor ${wide ? 'inline' : 'full'}`} style={{ '--sec-ink': c.ink, '--sec-bg': c.bg }} role={wide ? undefined : 'dialog'} aria-label="Note editor">
      <div className="nb-editor-bar">
        {!wide ? (
          <button type="button" className="nb-back" onClick={onBack}>
            ‹ {section?.name || 'Back'}
          </button>
        ) : (
          <span className="nb-editor-crumb">
            <span className="nb-dot" style={{ background: c.ink }} aria-hidden="true" />
            {section?.name}
          </span>
        )}
        <span className={`nb-saved ${saveError ? 'error' : ''}`} aria-live="polite">
          {saveError ? 'Not saved — storage full' : saved ? 'Saved' : 'Saving…'}
        </span>
        <button type="button" className="nb-more" onClick={onMenu} aria-label="Note options">
          ⋯
        </button>
      </div>
      <div className="nb-editor-scroll">
        <textarea
          ref={titleRef}
          className="nb-title-input"
          placeholder="Title"
          rows={1}
          value={page.title}
          onChange={(e) => edit({ title: e.target.value.replace(/\n/g, ' ') })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              bodyRef.current?.focus();
            }
          }}
          aria-label="Note title"
        />
        <p className="nb-editor-meta">Edited {fmtUpdated(page.updatedAt)}</p>
        <textarea
          ref={bodyRef}
          className="nb-body-input"
          placeholder="Start writing…"
          value={page.body}
          onChange={(e) => edit({ body: e.target.value })}
          aria-label="Note body"
        />
      </div>
    </div>
  );
  return wide ? <div className="nb-pane nb-editor-pane">{body}</div> : createPortal(body, document.body);
}

export default function NotesView({ notebook }) {
  const {
    sections,
    pages,
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
  } = notebook;
  const wide = useMediaQuery('(min-width: 768px)');
  const [sectionId, setSectionId] = useState(null);
  const [pageId, setPageId] = useState(null);
  const [query, setQuery] = useState('');
  const [sheet, setSheet] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const activeSectionId =
    sectionId && sections.some((s) => s.id === sectionId) ? sectionId : wide ? sections[0]?.id : null;
  const activeSection = sections.find((s) => s.id === activeSectionId) || null;
  const page = pages.find((p) => p.id === pageId) || null;
  const pageSection = page ? sections.find((s) => s.id === page.sectionId) : null;

  const sectionPages = useMemo(
    () =>
      pages
        .filter((p) => p.sectionId === activeSectionId)
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
    [pages, activeSectionId],
  );
  const recent = useMemo(
    () => [...pages].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, 3),
    [pages],
  );
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return pages
      .filter((p) => `${p.title}\n${p.body}`.toLowerCase().includes(q))
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [pages, query]);

  useEffect(() => {
    if (wide || !page) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [wide, page]);

  useEffect(() => () => toastTimer.current && clearTimeout(toastTimer.current), []);

  const showToast = (message, undo) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, undo });
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  };

  const closeEditor = () => {
    if (page && !page.title.trim() && !page.body.trim()) deletePage(page.id); // discard empty new note
    setPageId(null);
  };

  const openPage = (id) => {
    if (page && page.id !== id && !page.title.trim() && !page.body.trim()) deletePage(page.id);
    const pg = pages.find((p) => p.id === id);
    if (pg) setSectionId(pg.sectionId);
    setPageId(id);
  };

  const newPage = () => {
    if (!activeSectionId) return;
    const id = addPage(activeSectionId);
    setPageId(id);
  };

  const editingSection = sheet?.type === 'section-edit' ? sections.find((s) => s.id === sheet.id) : null;
  const editingIndex = editingSection ? sections.findIndex((s) => s.id === editingSection.id) : -1;
  const menuPage = sheet?.type === 'page-menu' ? pages.find((p) => p.id === sheet.id) : null;

  const showSections = wide || !activeSectionId;
  const showPages = wide || Boolean(activeSectionId);

  return (
    <div className={`view nb-view ${wide ? 'wide' : 'narrow'}`}>
      {wide ? (
        <div className="tiimo-day-head nb-head">
          <h1 className="tiimo-day-title">Notes</h1>
          <span className="tiimo-month-link static">
            {pages.length} note{pages.length === 1 ? '' : 's'}
          </span>
        </div>
      ) : null}
      <div className="nb-layout">
        {showSections ? (
          <SectionsPane
            sections={sections}
            pages={pages}
            activeId={wide ? activeSectionId : null}
            onOpen={(id) => {
              setSectionId(id);
              if (wide) setPageId(null);
            }}
            onEdit={(id) => setSheet({ type: 'section-edit', id })}
            onAdd={() => setSheet({ type: 'section-new' })}
            query={query}
            setQuery={setQuery}
            results={results}
            onOpenPage={openPage}
            recent={recent}
            wide={wide}
          />
        ) : null}
        {showPages && (wide || !showSections) ? (
          <PagesPane
            section={activeSection}
            pages={sectionPages}
            activePageId={pageId}
            onOpen={openPage}
            onAdd={newPage}
            onBack={() => setSectionId(null)}
            onEdit={() => activeSection && setSheet({ type: 'section-edit', id: activeSection.id })}
            wide={wide}
          />
        ) : null}
        {wide || page ? (
          <Editor
            page={page}
            section={pageSection}
            onChange={updatePage}
            onBack={closeEditor}
            onMenu={() => page && setSheet({ type: 'page-menu', id: page.id })}
            wide={wide}
            saveError={saveError}
          />
        ) : null}
      </div>

      {!wide && showSections ? (
        <footer className="mos-footer">
          <p>Manuel OS · local · v24</p>
        </footer>
      ) : null}

      {sheet?.type === 'section-new' ? (
        <SectionSheet
          mode="new"
          total={sections.length}
          onClose={() => setSheet(null)}
          onSave={(name, color) => {
            const id = addSection(name, color);
            setSheet(null);
            setQuery('');
            setSectionId(id);
            setPageId(null);
          }}
        />
      ) : null}
      {editingSection ? (
        <SectionSheet
          key={editingSection.id}
          mode="edit"
          section={editingSection}
          index={editingIndex}
          total={sections.length}
          onClose={() => setSheet(null)}
          onSave={(name, color) => {
            updateSection(editingSection.id, { name, color });
            setSheet(null);
          }}
          onMove={(dir) => moveSection(editingSection.id, dir)}
          onDelete={() => {
            const snap = deleteSection(editingSection.id);
            setSheet(null);
            if (sectionId === editingSection.id) setSectionId(null);
            if (page && page.sectionId === editingSection.id) setPageId(null);
            if (snap) showToast(`Deleted “${snap.section.name}”`, () => restoreSection(snap));
          }}
        />
      ) : null}
      {menuPage ? (
        <PageMenuSheet
          page={menuPage}
          sections={sections}
          onClose={() => setSheet(null)}
          onMove={(sid) => {
            movePage(menuPage.id, sid);
            setSectionId(sid);
            setSheet(null);
            const s = sections.find((x) => x.id === sid);
            showToast(`Moved to ${s?.name || 'section'}`, null);
          }}
          onDelete={() => {
            const removed = deletePage(menuPage.id);
            setSheet(null);
            setPageId(null);
            showToast('Note deleted', () => restorePage(removed));
          }}
        />
      ) : null}
      {toast
        ? createPortal(
            <div className="notes-toast nb-toast" role="status" aria-live="polite">
              <span>{toast.message}</span>
              {toast.undo ? (
                <button
                  type="button"
                  className="notes-toast-undo"
                  onClick={() => {
                    toast.undo();
                    setToast(null);
                  }}
                >
                  Undo
                </button>
              ) : null}
              <button type="button" className="notes-toast-dismiss" aria-label="Dismiss" onClick={() => setToast(null)}>
                ×
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

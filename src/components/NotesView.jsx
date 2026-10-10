import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SECTION_COLORS, colorOf } from '../hooks/useNotebook';

/*
 * v25 Notes — Apple Notes–style: Folders → Notes → Note.
 * Edit freely (autosave). Undo/Redo while editing, "Undo changes" after you
 * leave a note, and an Undo toast after delete / move.
 */

const TOAST_MS = 6500;
const HISTORY_PAUSE_MS = 700;

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
  return pg.title?.trim() || firstLine(pg.body) || 'New Note';
}

function pagePreview(pg) {
  const body = String(pg.body || '');
  if (pg.title?.trim()) return firstLine(body);
  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines[1] || '';
}

function isEmpty(pg) {
  return !pg || (!String(pg.title || '').trim() && !String(pg.body || '').trim());
}

/** Apple-style list date: time today, "Yesterday", weekday this week, else M/D/YY. */
function fmtListDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (days <= 0) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
  return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
}

function fmtLong(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function FolderIcon({ color }) {
  const c = colorOf(color);
  return (
    <svg className="nf-folder" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"
        fill={c.bg}
        stroke={c.ink}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
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

function NewFolderSheet({ onSave, onClose }) {
  const [name, setName] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    const t = requestAnimationFrame(() => ref.current?.focus());
    return () => cancelAnimationFrame(t);
  }, []);
  return (
    <Sheet label="New folder" onClose={onClose}>
      <h3 className="nb-sheet-title">New Folder</h3>
      <form
        className="nb-sheet-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSave(name);
        }}
      >
        <input
          ref={ref}
          className="nb-field"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Folder name"
          maxLength={40}
        />
        <div className="nb-sheet-row">
          <button type="button" className="note-sheet-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="note-sheet-btn done" disabled={!name.trim()}>
            Save
          </button>
        </div>
      </form>
    </Sheet>
  );
}

function FolderMenuSheet({ folder, index, total, onRename, onMove, onDelete, onClose }) {
  const [name, setName] = useState(folder.name);
  return (
    <Sheet label="Folder options" onClose={onClose}>
      <h3 className="nb-sheet-title">Folder</h3>
      <form
        className="nb-sheet-form"
        onSubmit={(e) => {
          e.preventDefault();
          onRename(name);
        }}
      >
        <input className="nb-field" value={name} onChange={(e) => setName(e.target.value)} aria-label="Folder name" maxLength={40} />
        <div className="nb-menu">
          <button type="button" className="nb-menu-item" disabled={index <= 0} onClick={() => onMove(-1)}>
            Move up <span aria-hidden="true">↑</span>
          </button>
          <button type="button" className="nb-menu-item" disabled={index >= total - 1} onClick={() => onMove(1)}>
            Move down <span aria-hidden="true">↓</span>
          </button>
          <button type="button" className="nb-menu-item danger" disabled={total <= 1} onClick={onDelete}>
            Delete folder <span aria-hidden="true">🗑</span>
          </button>
        </div>
        <div className="nb-sheet-row">
          <button type="button" className="note-sheet-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="note-sheet-btn done">
            Done
          </button>
        </div>
      </form>
    </Sheet>
  );
}

function NoteMenuSheet({ page, sections, canRevert, onMove, onRevert, onDelete, onClose }) {
  const [moving, setMoving] = useState(false);
  return (
    <Sheet label="Note options" onClose={onClose}>
      <h3 className="nb-sheet-title">{pageTitle(page)}</h3>
      {moving ? (
        <div className="nb-menu">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              className="nb-menu-item"
              disabled={s.id === page.sectionId}
              onClick={() => onMove(s.id)}
            >
              <span className="nb-menu-folder">
                <FolderIcon color={s.color} /> {s.name}
              </span>
              {s.id === page.sectionId ? <em>Current</em> : null}
            </button>
          ))}
        </div>
      ) : (
        <div className="nb-menu">
          <button type="button" className="nb-menu-item" onClick={() => setMoving(true)}>
            Move to folder <span aria-hidden="true">›</span>
          </button>
          <button type="button" className="nb-menu-item" disabled={!canRevert} onClick={onRevert}>
            Revert to when opened <span aria-hidden="true">↺</span>
          </button>
          <button type="button" className="nb-menu-item danger" onClick={onDelete}>
            Delete note <span aria-hidden="true">🗑</span>
          </button>
        </div>
      )}
      <button type="button" className="note-sheet-btn" onClick={moving ? () => setMoving(false) : onClose}>
        {moving ? 'Back' : 'Cancel'}
      </button>
    </Sheet>
  );
}

function NoteRow({ page, folder, active, onOpen, showFolder }) {
  const preview = pagePreview(page);
  return (
    <li className="nf-row-wrap">
      <button type="button" className={`nf-note ${active ? 'active' : ''}`} onClick={() => onOpen(page.id)}>
        <strong className="nf-note-title">{pageTitle(page)}</strong>
        <span className="nf-note-sub">
          <span className="nf-note-date">{fmtListDate(page.updatedAt)}</span>
          <span className="nf-note-preview">{preview || 'No additional text'}</span>
        </span>
        {showFolder && folder ? (
          <span className="nf-note-folder">
            <FolderIcon color={folder.color} /> {folder.name}
          </span>
        ) : null}
      </button>
    </li>
  );
}

function FoldersPane({ sections, pages, activeId, onOpen, onNewFolder, onNewNote, query, setQuery, results, onOpenPage, wide }) {
  const counts = useMemo(() => {
    const m = {};
    for (const p of pages) m[p.sectionId] = (m[p.sectionId] || 0) + 1;
    return m;
  }, [pages]);
  const byId = Object.fromEntries(sections.map((s) => [s.id, s]));

  return (
    <div className="nb-pane nf-folders-pane">
      <div className="nf-head">
        <h1 className={wide ? 'nf-pane-title' : 'tiimo-day-title'}>{wide ? 'Folders' : 'Notes'}</h1>
        <button type="button" className="nf-compose" onClick={onNewNote} aria-label="New note" title="New note">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M4 20h4l10-10-4-4L4 16z M13.5 6.5l4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <label className="nf-search">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M16 16l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input type="search" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search notes" />
        {query ? (
          <button type="button" className="nf-search-clear" onClick={() => setQuery('')} aria-label="Clear search">
            ×
          </button>
        ) : null}
      </label>

      {query.trim() ? (
        <>
          <p className="nf-label">
            {results.length} result{results.length === 1 ? '' : 's'}
          </p>
          {results.length ? (
            <ul className="nf-group">
              {results.map((pg) => (
                <NoteRow key={pg.id} page={pg} folder={byId[pg.sectionId]} onOpen={onOpenPage} showFolder />
              ))}
            </ul>
          ) : (
            <p className="nf-empty">No notes match “{query.trim()}”.</p>
          )}
        </>
      ) : (
        <>
          <ul className="nf-group">
            {sections.map((s) => (
              <li key={s.id} className="nf-row-wrap">
                <button type="button" className={`nf-folder-row ${activeId === s.id ? 'active' : ''}`} onClick={() => onOpen(s.id)}>
                  <FolderIcon color={s.color} />
                  <span className="nf-folder-name">{s.name}</span>
                  <span className="nf-count">{counts[s.id] || 0}</span>
                  <span className="nf-chev" aria-hidden="true">
                    ›
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="nf-new-folder" onClick={onNewFolder}>
            New Folder
          </button>
        </>
      )}
    </div>
  );
}

function NotesPane({ folder, pages, activePageId, onOpen, onNewNote, onBack, onMenu, wide }) {
  if (!folder) return <div className="nb-pane nf-notes-pane" />;
  return (
    <div className="nb-pane nf-notes-pane">
      <div className="nf-bar">
        {!wide ? (
          <button type="button" className="nf-back" onClick={onBack}>
            <span aria-hidden="true">‹</span> Folders
          </button>
        ) : (
          <span />
        )}
        <div className="nf-bar-right">
          <button type="button" className="nf-icon" onClick={onMenu} aria-label="Folder options">
            ⋯
          </button>
          <button type="button" className="nf-compose" onClick={onNewNote} aria-label="New note" title="New note">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M4 20h4l10-10-4-4L4 16z M13.5 6.5l4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
      <div className="nf-folder-head">
        <h1 className={wide ? 'nf-pane-title' : 'tiimo-day-title'}>{folder.name}</h1>
        <span className="nf-folder-count">
          {pages.length} note{pages.length === 1 ? '' : 's'}
        </span>
      </div>
      {pages.length ? (
        <ul className="nf-group">
          {pages.map((pg) => (
            <NoteRow key={pg.id} page={pg} active={pg.id === activePageId} onOpen={onOpen} />
          ))}
        </ul>
      ) : (
        <button type="button" className="nf-empty-cta" onClick={onNewNote}>
          No notes yet — tap to write one
        </button>
      )}
    </div>
  );
}

/** Note editor with its own Undo/Redo history (grouped by typing pauses). */
function Editor({ page, folder, onChange, onBack, onMenu, wide, saveError }) {
  const titleRef = useRef(null);
  const bodyRef = useRef(null);
  const pageRef = useRef(page);
  pageRef.current = page;
  const hist = useRef({ id: null, stack: [], i: 0, dirty: false, timer: null });
  const [, bump] = useReducer((x) => x + 1, 0);

  // Reset history whenever a different note opens.
  if (page && hist.current.id !== page.id) {
    if (hist.current.timer) clearTimeout(hist.current.timer);
    hist.current = { id: page.id, stack: [{ title: page.title, body: page.body }], i: 0, dirty: false, timer: null };
  }

  useEffect(() => () => hist.current.timer && clearTimeout(hist.current.timer), []);

  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [page?.title, page?.id, wide]);

  useEffect(() => {
    if (page && isEmpty(page)) {
      const t = requestAnimationFrame(() => titleRef.current?.focus());
      return () => cancelAnimationFrame(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page?.id]);

  if (!page) {
    return (
      <div className="nb-pane nb-editor-pane empty">
        <p className="nf-empty">Select a note, or tap ✎ to start one.</p>
      </div>
    );
  }

  const commit = () => {
    const h = hist.current;
    if (h.timer) {
      clearTimeout(h.timer);
      h.timer = null;
    }
    const cur = { title: pageRef.current.title, body: pageRef.current.body };
    const top = h.stack[h.i];
    h.dirty = false;
    if (top && top.title === cur.title && top.body === cur.body) return;
    h.stack = h.stack.slice(0, h.i + 1);
    h.stack.push(cur);
    if (h.stack.length > 200) h.stack.shift();
    h.i = h.stack.length - 1;
  };

  const edit = (patch) => {
    onChange(page.id, patch);
    const h = hist.current;
    h.dirty = true;
    if (h.timer) clearTimeout(h.timer);
    h.timer = setTimeout(() => {
      commit();
      bump();
    }, HISTORY_PAUSE_MS);
    bump();
  };

  const h = hist.current;
  const canUndo = h.i > 0 || h.dirty;
  const canRedo = !h.dirty && h.i < h.stack.length - 1;

  const undo = () => {
    if (h.dirty) commit();
    if (hist.current.i <= 0) return;
    hist.current.i -= 1;
    const snap = hist.current.stack[hist.current.i];
    onChange(page.id, { title: snap.title, body: snap.body });
    bump();
  };
  const redo = () => {
    if (!canRedo) return;
    hist.current.i += 1;
    const snap = hist.current.stack[hist.current.i];
    onChange(page.id, { title: snap.title, body: snap.body });
    bump();
  };
  // Keep the keyboard up on iPhone when tapping toolbar buttons.
  const keepFocus = (e) => e.preventDefault();

  const node = (
    <div className={`nb-editor nf-editor ${wide ? 'inline' : 'full'}`} role={wide ? undefined : 'dialog'} aria-label="Note editor">
      <div className="nf-bar nf-editor-bar">
        {!wide ? (
          <button type="button" className="nf-back" onClick={onBack}>
            <span aria-hidden="true">‹</span> {folder?.name || 'Notes'}
          </button>
        ) : (
          <span className="nf-crumb">
            <FolderIcon color={folder?.color} /> {folder?.name}
          </span>
        )}
        <div className="nf-bar-right">
          {saveError ? <span className="nf-save-error">Not saved — storage full</span> : null}
          <button type="button" className="nf-icon" onPointerDown={keepFocus} onClick={undo} disabled={!canUndo} aria-label="Undo" title="Undo">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M9 7L4.5 11.5 9 16 M5 11.5h9a5 5 0 0 1 0 10h-2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" className="nf-icon" onPointerDown={keepFocus} onClick={redo} disabled={!canRedo} aria-label="Redo" title="Redo">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M15 7l4.5 4.5L15 16 M19 11.5h-9a5 5 0 0 0 0 10h2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" className="nf-icon" onClick={onMenu} aria-label="Note options">
            ⋯
          </button>
        </div>
      </div>
      <div className="nb-editor-scroll">
        <p className="nf-editor-date">{fmtLong(page.updatedAt)}</p>
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
  return wide ? <div className="nb-pane nb-editor-pane">{node}</div> : createPortal(node, document.body);
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
    restoreContent,
  } = notebook;
  const wide = useMediaQuery('(min-width: 768px)');
  const [sectionId, setSectionId] = useState(null);
  const [pageId, setPageId] = useState(null);
  const [query, setQuery] = useState('');
  const [sheet, setSheet] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  // Content of the open note at the moment it was opened (for "Undo changes").
  const openedRef = useRef(null);

  const activeSectionId =
    sectionId && sections.some((s) => s.id === sectionId) ? sectionId : wide ? sections[0]?.id : null;
  const activeSection = sections.find((s) => s.id === activeSectionId) || null;
  const page = pages.find((p) => p.id === pageId) || null;
  const pageFolder = page ? sections.find((s) => s.id === page.sectionId) : null;

  const folderPages = useMemo(
    () => pages.filter((p) => p.sectionId === activeSectionId).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
    [pages, activeSectionId],
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

  const showToast = (message, undo, undoLabel = 'Undo') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, undo, undoLabel });
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  };

  /** Leaving the open note: drop it if empty, else offer "Undo changes". */
  const leaveNote = () => {
    const cur = page;
    const snap = openedRef.current;
    openedRef.current = null;
    if (!cur) return;
    if (isEmpty(cur)) {
      deletePage(cur.id);
      return;
    }
    if (!snap || snap.id !== cur.id) return;
    const changed = snap.title !== cur.title || snap.body !== cur.body;
    if (!changed) return;
    if (isEmpty(snap)) {
      showToast('Note saved', null);
      return;
    }
    showToast('Changes saved', () => restoreContent(cur.id, snap), 'Undo changes');
  };

  const openPage = (id) => {
    if (page && page.id !== id) leaveNote();
    const pg = pages.find((p) => p.id === id);
    if (!pg) return;
    openedRef.current = { id: pg.id, title: pg.title, body: pg.body, updatedAt: pg.updatedAt };
    setSectionId(pg.sectionId);
    setPageId(id);
  };

  const closeEditor = () => {
    leaveNote();
    setPageId(null);
  };

  const newNote = (folderId) => {
    const target = folderId || activeSectionId || sections[0]?.id;
    if (!target) return;
    if (page) leaveNote();
    const id = addPage(target);
    openedRef.current = { id, title: '', body: '', updatedAt: null };
    setQuery('');
    setSectionId(target);
    setPageId(id);
  };

  const menuFolder = sheet?.type === 'folder-menu' ? sections.find((s) => s.id === sheet.id) : null;
  const menuFolderIndex = menuFolder ? sections.findIndex((s) => s.id === menuFolder.id) : -1;
  const menuPage = sheet?.type === 'note-menu' ? pages.find((p) => p.id === sheet.id) : null;
  const opened = openedRef.current;
  const canRevert =
    Boolean(menuPage && opened && opened.id === menuPage.id && !isEmpty(opened)) &&
    (opened.title !== menuPage.title || opened.body !== menuPage.body);

  const showFolders = wide || !activeSectionId;

  return (
    <div className={`view nb-view nf-view ${wide ? 'wide' : 'narrow'}`}>
      <div className="nb-layout nf-layout">
        {showFolders ? (
          <FoldersPane
            sections={sections}
            pages={pages}
            activeId={wide ? activeSectionId : null}
            onOpen={(id) => {
              if (wide && page) {
                leaveNote();
                setPageId(null);
              }
              setSectionId(id);
            }}
            onNewFolder={() => setSheet({ type: 'folder-new' })}
            onNewNote={() => newNote()}
            query={query}
            setQuery={setQuery}
            results={results}
            onOpenPage={openPage}
            wide={wide}
          />
        ) : null}
        {wide || !showFolders ? (
          <NotesPane
            folder={activeSection}
            pages={folderPages}
            activePageId={pageId}
            onOpen={openPage}
            onNewNote={() => newNote(activeSectionId)}
            onBack={() => setSectionId(null)}
            onMenu={() => activeSection && setSheet({ type: 'folder-menu', id: activeSection.id })}
            wide={wide}
          />
        ) : null}
        {wide || page ? (
          <Editor
            page={page}
            folder={pageFolder}
            onChange={updatePage}
            onBack={closeEditor}
            onMenu={() => page && setSheet({ type: 'note-menu', id: page.id })}
            wide={wide}
            saveError={saveError}
          />
        ) : null}
      </div>

      {!wide && showFolders ? (
        <footer className="mos-footer">
          <p>Manuel OS · local · v25</p>
        </footer>
      ) : null}

      {sheet?.type === 'folder-new' ? (
        <NewFolderSheet
          onClose={() => setSheet(null)}
          onSave={(name) => {
            const color = SECTION_COLORS[sections.length % SECTION_COLORS.length].id;
            const id = addSection(name, color);
            setSheet(null);
            setQuery('');
            setSectionId(id);
            setPageId(null);
          }}
        />
      ) : null}
      {menuFolder ? (
        <FolderMenuSheet
          key={menuFolder.id}
          folder={menuFolder}
          index={menuFolderIndex}
          total={sections.length}
          onClose={() => setSheet(null)}
          onRename={(name) => {
            const before = menuFolder.name;
            const next = String(name || '').trim();
            setSheet(null);
            if (next && next !== before) {
              updateSection(menuFolder.id, { name: next });
              const id = menuFolder.id;
              showToast(`Renamed to “${next}”`, () => updateSection(id, { name: before }));
            }
          }}
          onMove={(dir) => moveSection(menuFolder.id, dir)}
          onDelete={() => {
            const snap = deleteSection(menuFolder.id);
            setSheet(null);
            if (sectionId === menuFolder.id) setSectionId(null);
            if (page && page.sectionId === menuFolder.id) setPageId(null);
            if (snap) {
              const n = snap.pages.length;
              showToast(`Deleted “${snap.section.name}”${n ? ` and ${n} note${n === 1 ? '' : 's'}` : ''}`, () => restoreSection(snap));
            }
          }}
        />
      ) : null}
      {menuPage ? (
        <NoteMenuSheet
          page={menuPage}
          sections={sections}
          canRevert={canRevert}
          onClose={() => setSheet(null)}
          onMove={(sid) => {
            const from = menuPage.sectionId;
            const id = menuPage.id;
            movePage(id, sid);
            setSectionId(sid);
            setSheet(null);
            const s = sections.find((x) => x.id === sid);
            showToast(`Moved to ${s?.name || 'folder'}`, () => {
              movePage(id, from);
              setSectionId(from);
            });
          }}
          onRevert={() => {
            const snap = openedRef.current;
            const cur = { title: menuPage.title, body: menuPage.body, updatedAt: menuPage.updatedAt };
            const id = menuPage.id;
            restoreContent(id, snap);
            setSheet(null);
            showToast('Reverted', () => restoreContent(id, cur));
          }}
          onDelete={() => {
            const removed = deletePage(menuPage.id);
            openedRef.current = null;
            setSheet(null);
            setPageId(null);
            if (removed && !isEmpty(removed)) showToast('Note deleted', () => restorePage(removed));
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
                  {toast.undoLabel}
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

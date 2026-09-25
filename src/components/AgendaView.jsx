import { useEffect, useMemo, useRef, useState } from 'react';
import { formatAgendaDayParts, weekStripFor } from '../lib/time';
import { weekRangeLabel } from '../hooks/useAgenda';

const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

const UNDO_LIMIT = 20;
const TOAST_MS = 4500;

function NoteRow({ item, onToggle, onOpen, moving, compact }) {
  return (
    <li
      className={`note-row ${item.done ? 'done' : ''} ${moving ? 'moving' : ''} ${compact ? 'compact' : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', item.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
    >
      <button
        type="button"
        className="note-check"
        aria-label={item.done ? 'Mark open' : 'Mark done'}
        aria-pressed={item.done}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(item.id);
        }}
      >
        {item.done ? '✓' : ''}
      </button>
      <button
        type="button"
        className="note-title-btn"
        onClick={() => onOpen(item)}
      >
        {item.title}
      </button>
    </li>
  );
}

function MicButton({ listening, onToggle, supported }) {
  if (!supported) return null;
  return (
    <button
      type="button"
      className={`note-mic ${listening ? 'listening' : ''}`}
      onClick={onToggle}
      aria-label={listening ? 'Stop listening' : 'Dictate'}
      aria-pressed={listening}
      title={listening ? 'Listening…' : 'Dictate'}
    >
      {listening ? '●' : '🎤'}
    </button>
  );
}

function DayStrip({
  week,
  selectedDay,
  todayKey,
  itemsForDate,
  onSelectDay,
  onDropDay,
  emphasize,
}) {
  const [dragOver, setDragOver] = useState(null);

  return (
    <div
      className={`notes-day-strip ${emphasize ? 'move-ready' : ''}`}
      role="tablist"
      aria-label={emphasize ? 'Pick a day to move' : 'Day'}
    >
      {week.map((d) => {
        const active = d.key === selectedDay;
        const n = (itemsForDate(d.key) || []).filter((i) => !i.done).length;
        const dow = formatAgendaDayParts(d.key).weekday.slice(0, 3);
        const dropLit = dragOver === d.key;
        return (
          <button
            key={d.key}
            type="button"
            role="tab"
            aria-selected={active}
            className={`notes-day-chip ${active ? 'active' : ''} ${d.key === todayKey ? 'is-today' : ''} ${dropLit ? 'drop-lit' : ''}`}
            onClick={() => onSelectDay(d.key)}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setDragOver(d.key);
            }}
            onDragLeave={() => setDragOver((cur) => (cur === d.key ? null : cur))}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(null);
              const id = e.dataTransfer.getData('text/plain');
              if (id) onDropDay(id, d.key);
            }}
          >
            <span className="notes-day-dow">{dow}</span>
            <span className="notes-day-num">{Number(d.key.slice(8))}</span>
            {n > 0 ? <span className="notes-day-dot" aria-hidden="true" /> : null}
          </button>
        );
      })}
    </div>
  );
}

function NoteSheet({
  item,
  draft,
  setDraft,
  onClose,
  onSave,
  onMove,
  onRemove,
  todayKey,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (!item) return undefined;
    const t = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select?.();
    });
    return () => cancelAnimationFrame(t);
  }, [item?.id]);

  if (!item) return null;

  const parts = formatAgendaDayParts(item.due || todayKey);
  const label = item.due === todayKey ? 'Today' : parts.weekday;

  const commitAndClose = () => {
    onSave(draft);
    onClose();
  };

  return (
    <div className="note-sheet-root" role="presentation">
      <button
        type="button"
        className="note-sheet-backdrop"
        aria-label="Close note"
        onClick={commitAndClose}
      />
      <div className="note-sheet" role="dialog" aria-modal="true" aria-label="Note">
        <div className="note-sheet-handle" aria-hidden="true" />
        <textarea
          ref={inputRef}
          className="note-sheet-edit"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          aria-label="Note text"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              onClose();
            }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              commitAndClose();
            }
          }}
        />
        <div className="note-sheet-actions">
          <button
            type="button"
            className="note-sheet-btn move"
            onClick={() => {
              onSave(draft);
              onMove();
            }}
          >
            Move
          </button>
          <button
            type="button"
            className="note-sheet-btn danger"
            onClick={onRemove}
          >
            Remove
          </button>
          <button type="button" className="note-sheet-btn done" onClick={commitAndClose}>
            Done
          </button>
        </div>
        <p className="note-sheet-meta">
          {label} · {parts.date}
        </p>
      </div>
    </div>
  );
}

function UndoToast({ toast, onUndo, onDismiss }) {
  if (!toast) return null;
  return (
    <div className="notes-toast" role="status" aria-live="polite">
      <span>{toast.message}</span>
      {toast.canUndo ? (
        <button type="button" className="notes-toast-undo" onClick={onUndo}>
          Undo
        </button>
      ) : null}
      <button
        type="button"
        className="notes-toast-dismiss"
        aria-label="Dismiss"
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  );
}

export default function AgendaView({
  todayKey,
  overdue,
  counts,
  itemsForDate,
  itemsForWeekDay,
  add,
  toggle,
  remove,
  restore,
  getItem,
  rename,
  setDue,
  focusComposer,
}) {
  const [mode, setMode] = useState('day');
  const [selectedDay, setSelectedDay] = useState(todayKey);
  const [title, setTitle] = useState('');
  const [listening, setListening] = useState(false);
  const [movingId, setMovingId] = useState(null);
  const [sheetItem, setSheetItem] = useState(null);
  const [sheetDraft, setSheetDraft] = useState('');
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [toast, setToast] = useState(null);
  const titleRef = useRef(null);
  const recognitionRef = useRef(null);
  const toastTimer = useRef(null);
  const cacheRef = useRef(new Map());
  const speechSupported = Boolean(SpeechRecognitionAPI);

  const week = useMemo(() => weekStripFor(todayKey), [todayKey]);
  const weekKeys = useMemo(() => week.map((d) => d.key), [week]);
  const weekLabel = useMemo(() => weekRangeLabel(week), [week]);

  const remember = (it) => {
    if (it?.id) cacheRef.current.set(it.id, { ...it });
  };

  const lookup = (id) => getItem?.(id) || cacheRef.current.get(id) || null;

  useEffect(() => {
    setSelectedDay(todayKey);
  }, [todayKey]);

  useEffect(() => {
    if (focusComposer) titleRef.current?.focus();
  }, [focusComposer]);

  useEffect(() => {
    const t = requestAnimationFrame(() => titleRef.current?.focus());
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop?.();
      } catch {
        /* ignore */
      }
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const dayItems = useMemo(() => {
    const list = itemsForDate(selectedDay) || [];
    if (selectedDay === todayKey && overdue?.length) {
      const ids = new Set(list.map((i) => i.id));
      const rolled = overdue.filter((i) => !ids.has(i.id));
      return [...rolled, ...list];
    }
    return list;
  }, [itemsForDate, selectedDay, todayKey, overdue]);

  useEffect(() => {
    for (const it of dayItems) remember(it);
  }, [dayItems]);

  const weekSections = useMemo(() => {
    return week.map((d) => {
      const items = itemsForWeekDay
        ? itemsForWeekDay(d.key, weekKeys)
        : itemsForDate(d.key) || [];
      const dayParts = formatAgendaDayParts(d.key);
      return {
        key: d.key,
        parts: dayParts,
        isToday: d.key === todayKey,
        items,
        openCount: items.filter((i) => !i.done).length,
      };
    });
  }, [week, weekKeys, itemsForWeekDay, itemsForDate, todayKey]);

  useEffect(() => {
    for (const sec of weekSections) {
      for (const it of sec.items) remember(it);
    }
  }, [weekSections]);

  const openCount = dayItems.filter((i) => !i.done).length;
  const parts = formatAgendaDayParts(selectedDay);
  const isToday = selectedDay === todayKey;

  const showToast = (message, canUndo = true) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, canUndo });
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  };

  const pushUndo = (entry) => {
    setUndoStack((prev) => [...prev.slice(-(UNDO_LIMIT - 1)), entry]);
    setRedoStack([]);
  };

  const applyMove = (id, dayKey, opts = {}) => {
    if (!id || !dayKey) return;
    const current = lookup(id);
    const fromDue = current?.due ?? null;
    if (fromDue === dayKey) {
      setMovingId(null);
      return;
    }
    if (!opts.silent && current) {
      pushUndo({
        type: 'move',
        id,
        fromDue,
        toDue: dayKey,
        item: { ...current },
      });
      showToast('Moved');
    }
    setDue?.(id, dayKey);
    setSelectedDay(dayKey);
    setMovingId(null);
    if (current) remember({ ...current, due: dayKey });
  };

  const doRemove = (item) => {
    if (!item?.id) return;
    remember(item);
    pushUndo({ type: 'delete', item: { ...item } });
    remove(item.id);
    setSheetItem(null);
    setMovingId((m) => (m === item.id ? null : m));
    showToast('Note deleted');
  };

  const doRename = (item, nextTitle, opts = {}) => {
    const t = String(nextTitle || '').trim();
    if (!item?.id || !t || t === item.title) return false;
    if (!opts.silent) {
      pushUndo({
        type: 'rename',
        id: item.id,
        fromTitle: item.title,
        toTitle: t,
      });
    }
    rename(item.id, t);
    remember({ ...item, title: t });
    return true;
  };

  const applyUndoEntry = (entry) => {
    if (!entry) return;
    if (entry.type === 'delete') {
      restore?.(entry.item);
      remember(entry.item);
      if (entry.item?.due) setSelectedDay(entry.item.due);
      return;
    }
    if (entry.type === 'move') {
      setDue?.(entry.id, entry.fromDue);
      const cur = lookup(entry.id);
      if (cur) remember({ ...cur, due: entry.fromDue });
      if (entry.fromDue) setSelectedDay(entry.fromDue);
      return;
    }
    if (entry.type === 'rename') {
      rename(entry.id, entry.fromTitle);
      const cur = lookup(entry.id);
      if (cur) remember({ ...cur, title: entry.fromTitle });
    }
  };

  const applyRedoEntry = (entry) => {
    if (!entry) return;
    if (entry.type === 'delete') {
      remove(entry.item.id);
      return;
    }
    if (entry.type === 'move') {
      setDue?.(entry.id, entry.toDue);
      const cur = lookup(entry.id);
      if (cur) remember({ ...cur, due: entry.toDue });
      if (entry.toDue) setSelectedDay(entry.toDue);
      return;
    }
    if (entry.type === 'rename') {
      rename(entry.id, entry.toTitle);
      const cur = lookup(entry.id);
      if (cur) remember({ ...cur, title: entry.toTitle });
    }
  };

  const undo = () => {
    const entry = undoStack[undoStack.length - 1];
    if (!entry) return;
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((r) => [...r, entry]);
    applyUndoEntry(entry);
    showToast('Undone', false);
  };

  const redo = () => {
    const entry = redoStack[redoStack.length - 1];
    if (!entry) return;
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((u) => [...u, entry]);
    applyRedoEntry(entry);
    showToast('Redone', false);
  };

  const submit = (e) => {
    e?.preventDefault?.();
    const t = title.trim();
    if (!t) return;
    add(t, selectedDay || todayKey);
    setTitle('');
    titleRef.current?.focus();
  };

  const startMove = (id) => {
    setMovingId(id);
    setSheetItem(null);
  };

  const onSelectDay = (dayKey) => {
    if (movingId) {
      applyMove(movingId, dayKey);
      titleRef.current?.focus();
      return;
    }
    setSelectedDay(dayKey);
    titleRef.current?.focus();
  };

  const openSheet = (item) => {
    remember(item);
    setSheetItem(item);
    setSheetDraft(item.title);
    setMovingId(null);
  };

  const toggleMic = () => {
    if (!SpeechRecognitionAPI) return;

    if (listening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
      setListening(false);
      return;
    }

    let recognition;
    try {
      recognition = new SpeechRecognitionAPI();
    } catch {
      return;
    }
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0]?.transcript || '')
        .join(' ')
        .trim();
      if (!transcript) return;
      setTitle((prev) => {
        const next = prev.trim() ? `${prev.trim()} ${transcript}` : transcript;
        return next;
      });
      titleRef.current?.focus();
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  return (
    <div className="view agenda-view notes-view">
      <header className="notes-header">
        <h1>Agenda</h1>
        <p className="date-line">
          {mode === 'week'
            ? `Week · ${weekLabel}`
            : `${parts.weekday}, ${parts.date}${isToday ? ' · Today' : ''}`}
          {counts?.overdue ? ` · ${counts.overdue} overdue` : ''}
        </p>
      </header>

      <div className="notes-mode-tabs" role="tablist" aria-label="Agenda mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'day'}
          className={`notes-mode-tab ${mode === 'day' ? 'active' : ''}`}
          onClick={() => setMode('day')}
        >
          Day
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'week'}
          className={`notes-mode-tab ${mode === 'week' ? 'active' : ''}`}
          onClick={() => setMode('week')}
        >
          Week
        </button>
      </div>

      <form className="notes-composer" onSubmit={submit}>
        <input
          ref={titleRef}
          className="notes-input"
          type="text"
          placeholder="Write a note…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="New note"
          autoComplete="off"
        />
        <div className="notes-composer-actions">
          <button
            type="button"
            className="notes-undo-btn"
            disabled={!undoStack.length}
            onClick={undo}
            aria-label="Undo"
            title="Undo"
          >
            Undo
          </button>
          <button
            type="button"
            className="notes-undo-btn"
            disabled={!redoStack.length}
            onClick={redo}
            aria-label="Redo"
            title="Redo"
          >
            Redo
          </button>
          <MicButton
            supported={speechSupported}
            listening={listening}
            onToggle={toggleMic}
          />
          <button type="submit" className="notes-add" aria-label="Add note">
            Add
          </button>
        </div>
      </form>

      <DayStrip
        week={week}
        selectedDay={selectedDay}
        todayKey={todayKey}
        itemsForDate={itemsForDate}
        onSelectDay={onSelectDay}
        onDropDay={(id, dayKey) => applyMove(id, dayKey)}
        emphasize={Boolean(movingId)}
      />

      {movingId ? (
        <p className="notes-move-hint soft" role="status">
          Choose a day
        </p>
      ) : null}

      {mode === 'day' ? (
        <section className="card notes-list-card">
          <div className="notes-list-head">
            <strong>{isToday ? 'Today' : parts.weekday}</strong>
            <span className="card-sub">{openCount || '—'}</span>
          </div>
          {dayItems.length === 0 ? (
            <p className="notes-empty">No notes yet</p>
          ) : (
            <ul className="notes-list">
              {dayItems.map((it) => (
                <NoteRow
                  key={it.id}
                  item={it}
                  onToggle={toggle}
                  onOpen={openSheet}
                  moving={movingId === it.id}
                />
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section className="notes-week-list" aria-label="Week notes">
          {weekSections.map((sec) => (
            <div
              key={sec.key}
              className={`notes-week-day ${sec.isToday ? 'is-today' : ''} ${selectedDay === sec.key ? 'is-selected' : ''}`}
            >
              <button
                type="button"
                className="notes-week-day-head"
                onClick={() => onSelectDay(sec.key)}
              >
                <strong>
                  {sec.isToday ? 'Today' : sec.parts.weekday}
                  <span className="notes-week-day-date"> · {sec.parts.date}</span>
                </strong>
                <span className="card-sub">{sec.openCount || '—'}</span>
              </button>
              {sec.items.length === 0 ? (
                <p className="notes-week-empty">—</p>
              ) : (
                <ul className="notes-list">
                  {sec.items.map((it) => (
                    <NoteRow
                      key={it.id}
                      item={it}
                      onToggle={toggle}
                      onOpen={openSheet}
                      moving={movingId === it.id}
                      compact
                    />
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}

      <footer className="mos-footer">
        <p>Manuel OS · local · v18</p>
      </footer>

      <NoteSheet
        item={sheetItem}
        draft={sheetDraft}
        setDraft={setSheetDraft}
        todayKey={todayKey}
        onClose={() => setSheetItem(null)}
        onSave={(draft) => {
          if (sheetItem) doRename(sheetItem, draft);
        }}
        onMove={() => {
          if (sheetItem) startMove(sheetItem.id);
        }}
        onRemove={() => {
          if (sheetItem) doRemove(sheetItem);
        }}
      />

      <UndoToast
        toast={toast}
        onUndo={() => {
          undo();
          setToast(null);
        }}
        onDismiss={() => setToast(null)}
      />
    </div>
  );
}

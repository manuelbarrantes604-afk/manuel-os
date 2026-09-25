import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatAgendaDayParts, weekStripFor } from '../lib/time';
import { addDays, monthLabel, weekRangeLabel } from '../hooks/useAgenda';

const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

const UNDO_LIMIT = 20;
const TOAST_MS = 4500;
const MONTH_NAMES_SHORT = [
  '',
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function weekRangePretty(weekDays) {
  if (!weekDays?.length) return '';
  const first = weekDays[0].key;
  const last = weekDays[6].key;
  const [, m1, d1] = first.split('-').map(Number);
  const [, m2, d2] = last.split('-').map(Number);
  if (m1 === m2) return `${MONTH_NAMES_SHORT[m1]} ${d1}–${d2}`;
  return `${MONTH_NAMES_SHORT[m1]} ${d1}–${MONTH_NAMES_SHORT[m2]} ${d2}`;
}

function daysInMonth(year, month /* 1-12 */) {
  return new Date(Date.UTC(year, month, 0, 12)).getUTCDate();
}

/** Calendar cells for a month (Mon-first), including leading/trailing padding. */
function monthGrid(ym) {
  const [y, m] = ym.split('-').map(Number);
  const dim = daysInMonth(y, m);
  const firstKey = `${ym}-01`;
  const strip = weekStripFor(firstKey);
  const mondayOfFirst = strip[0].key;
  // How many leading days before the 1st?
  const lead = (() => {
    const [fy, fm, fd] = firstKey.split('-').map(Number);
    const noon = new Date(Date.UTC(fy, fm - 1, fd, 12));
    const dow = noon.getUTCDay(); // 0 Sun
    return dow === 0 ? 6 : dow - 1;
  })();
  const cells = [];
  // Leading from previous month
  for (let i = lead; i > 0; i -= 1) {
    const key = addDays(firstKey, -i);
    cells.push({ key, inMonth: false, dayNum: Number(key.slice(8)) });
  }
  for (let d = 1; d <= dim; d += 1) {
    const key = `${ym}-${String(d).padStart(2, '0')}`;
    cells.push({ key, inMonth: true, dayNum: d });
  }
  // Trailing to complete weeks
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].key;
    const key = addDays(last, 1);
    cells.push({ key, inMonth: false, dayNum: Number(key.slice(8)) });
  }
  return { cells, mondayOfFirst, ym };
}

function useFinePointer() {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(pointer: fine)');
    const sync = () => setFine(mq.matches);
    sync();
    mq.addEventListener?.('change', sync);
    return () => mq.removeEventListener?.('change', sync);
  }, []);
  return fine;
}

function NoteRow({ item, onToggle, onOpen, moving, compact, canDrag }) {
  return (
    <li
      className={`note-row ${item.done ? 'done' : ''} ${moving ? 'moving' : ''} ${compact ? 'compact' : ''}`}
      draggable={canDrag}
      onDragStart={
        canDrag
          ? (e) => {
              e.dataTransfer.setData('text/plain', item.id);
              e.dataTransfer.effectAllowed = 'move';
            }
          : undefined
      }
    >
      <button
        type="button"
        className="note-check"
        aria-label={item.done ? 'Mark open' : 'Mark done'}
        aria-pressed={item.done}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onToggle(item.id);
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {item.done ? '✓' : ''}
      </button>
      <button
        type="button"
        className="note-title-btn"
        onClick={(e) => {
          e.stopPropagation();
          onOpen(item);
        }}
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

  useEffect(() => {
    if (!item) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, onClose]);

  if (!item) return null;

  const parts = formatAgendaDayParts(item.due || todayKey);
  const label = item.due === todayKey ? 'Today' : parts.weekday;

  const commitAndClose = () => {
    onSave(draft);
    onClose();
  };

  const node = (
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

  return createPortal(node, document.body);
}

function UndoToast({ toast, onUndo, onDismiss }) {
  if (!toast) return null;
  const node = (
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
  return createPortal(node, document.body);
}

function NavChrome({ label, onPrev, onNext, onToday }) {
  return (
    <div className="notes-nav-chrome" role="group" aria-label="Navigate">
      <button type="button" className="notes-nav-btn" onClick={onPrev} aria-label="Previous">
        ‹
      </button>
      <button
        type="button"
        className="notes-nav-label"
        onClick={onToday}
        title="Jump to today"
      >
        {label}
      </button>
      <button type="button" className="notes-nav-btn" onClick={onNext} aria-label="Next">
        ›
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
  const [anchorKey, setAnchorKey] = useState(todayKey);
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
  const undoRef = useRef([]);
  const redoRef = useRef([]);
  const speechSupported = Boolean(SpeechRecognitionAPI);
  const canDrag = useFinePointer();

  useEffect(() => {
    undoRef.current = undoStack;
  }, [undoStack]);
  useEffect(() => {
    redoRef.current = redoStack;
  }, [redoStack]);

  const week = useMemo(() => weekStripFor(selectedDay), [selectedDay]);
  const weekKeys = useMemo(() => week.map((d) => d.key), [week]);
  const weekLabel = useMemo(() => weekRangePretty(week) || weekRangeLabel(week), [week]);

  const monthYm = useMemo(() => anchorKey.slice(0, 7), [anchorKey]);
  const monthTitle = useMemo(() => monthLabel(monthYm), [monthYm]);
  const grid = useMemo(() => monthGrid(monthYm), [monthYm]);

  const remember = (it) => {
    if (it?.id) cacheRef.current.set(it.id, { ...it });
  };

  const lookup = (id) => getItem?.(id) || cacheRef.current.get(id) || null;

  useEffect(() => {
    setSelectedDay(todayKey);
    setAnchorKey(todayKey);
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

  // Lock body scroll while sheet is open (phone)
  useEffect(() => {
    if (!sheetItem) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sheetItem]);

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
    const strip = weekStripFor(anchorKey);
    const keys = strip.map((d) => d.key);
    return strip.map((d) => {
      const items = itemsForWeekDay
        ? itemsForWeekDay(d.key, keys)
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
  }, [anchorKey, itemsForWeekDay, itemsForDate, todayKey]);

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
    setUndoStack((prev) => {
      const next = [...prev.slice(-(UNDO_LIMIT - 1)), entry];
      undoRef.current = next;
      return next;
    });
    setRedoStack(() => {
      redoRef.current = [];
      return [];
    });
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
    setAnchorKey(dayKey);
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
      if (entry.item?.due) {
        setSelectedDay(entry.item.due);
        setAnchorKey(entry.item.due);
      }
      return;
    }
    if (entry.type === 'move') {
      setDue?.(entry.id, entry.fromDue);
      const cur = lookup(entry.id);
      if (cur) remember({ ...cur, due: entry.fromDue });
      if (entry.fromDue) {
        setSelectedDay(entry.fromDue);
        setAnchorKey(entry.fromDue);
      }
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
      if (entry.toDue) {
        setSelectedDay(entry.toDue);
        setAnchorKey(entry.toDue);
      }
      return;
    }
    if (entry.type === 'rename') {
      rename(entry.id, entry.toTitle);
      const cur = lookup(entry.id);
      if (cur) remember({ ...cur, title: entry.toTitle });
    }
  };

  const undo = () => {
    const stack = undoRef.current;
    const entry = stack[stack.length - 1];
    if (!entry) return;
    const next = stack.slice(0, -1);
    undoRef.current = next;
    setUndoStack(next);
    setRedoStack((r) => {
      const nr = [...r, entry];
      redoRef.current = nr;
      return nr;
    });
    applyUndoEntry(entry);
    showToast('Undone', false);
  };

  const redo = () => {
    const stack = redoRef.current;
    const entry = stack[stack.length - 1];
    if (!entry) return;
    const next = stack.slice(0, -1);
    redoRef.current = next;
    setRedoStack(next);
    setUndoStack((u) => {
      const nu = [...u, entry];
      undoRef.current = nu;
      return nu;
    });
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
    if (mode === 'month') setMode('day');
  };

  const onSelectDay = (dayKey) => {
    if (movingId) {
      applyMove(movingId, dayKey);
      titleRef.current?.focus();
      return;
    }
    setSelectedDay(dayKey);
    setAnchorKey(dayKey);
    titleRef.current?.focus();
  };

  const openSheet = (item) => {
    if (!item) return;
    remember(item);
    setSheetItem(item);
    setSheetDraft(item.title);
    setMovingId(null);
  };

  const jumpWeek = (delta) => {
    const base = mode === 'week' ? anchorKey : selectedDay;
    const next = addDays(base, delta * 7);
    setAnchorKey(next);
    setSelectedDay(next);
  };

  const jumpMonth = (delta) => {
    const [y, m] = monthYm.split('-').map(Number);
    let nm = m + delta;
    let ny = y;
    while (nm < 1) {
      nm += 12;
      ny -= 1;
    }
    while (nm > 12) {
      nm -= 12;
      ny += 1;
    }
    const dim = daysInMonth(ny, nm);
    const dayNum = Math.min(Number(selectedDay.slice(8)) || 1, dim);
    const next = `${ny}-${String(nm).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    setAnchorKey(next);
    setSelectedDay(next);
  };

  const jumpToday = () => {
    setSelectedDay(todayKey);
    setAnchorKey(todayKey);
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

  const headerLine = (() => {
    if (mode === 'week') return `Week · ${weekRangePretty(weekStripFor(anchorKey))}`;
    if (mode === 'month') return monthTitle;
    return `${parts.weekday}, ${parts.date}${isToday ? ' · Today' : ''}`;
  })();

  const weekNavLabel = weekRangePretty(weekStripFor(mode === 'week' ? anchorKey : selectedDay));

  return (
    <div className="view agenda-view notes-view">
      <header className="notes-header">
        <h1>Agenda</h1>
        <p className="date-line">
          {headerLine}
          {counts?.overdue ? ` · ${counts.overdue} overdue` : ''}
        </p>
      </header>

      <div className="notes-mode-tabs tabs-3" role="tablist" aria-label="Agenda mode">
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
          onClick={() => {
            setMode('week');
            setAnchorKey(selectedDay);
          }}
        >
          Week
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'month'}
          className={`notes-mode-tab ${mode === 'month' ? 'active' : ''}`}
          onClick={() => {
            setMode('month');
            setAnchorKey(selectedDay);
          }}
        >
          Month
        </button>
      </div>

      {mode === 'week' || mode === 'month' ? (
        <NavChrome
          label={mode === 'week' ? weekNavLabel : monthTitle}
          onPrev={() => (mode === 'week' ? jumpWeek(-1) : jumpMonth(-1))}
          onNext={() => (mode === 'week' ? jumpWeek(1) : jumpMonth(1))}
          onToday={jumpToday}
        />
      ) : (
        <NavChrome
          label={weekNavLabel}
          onPrev={() => jumpWeek(-1)}
          onNext={() => jumpWeek(1)}
          onToday={jumpToday}
        />
      )}

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

      <div className="notes-undo-bar" role="group" aria-label="Undo and redo">
        <button
          type="button"
          className={`notes-undo-btn ${undoStack.length ? 'ready' : ''}`}
          disabled={!undoStack.length}
          onClick={undo}
          aria-label="Undo"
          title="Undo"
        >
          Undo{undoStack.length ? ` (${undoStack.length})` : ''}
        </button>
        <button
          type="button"
          className={`notes-undo-btn ${redoStack.length ? 'ready' : ''}`}
          disabled={!redoStack.length}
          onClick={redo}
          aria-label="Redo"
          title="Redo"
        >
          Redo{redoStack.length ? ` (${redoStack.length})` : ''}
        </button>
      </div>

      {mode !== 'month' ? (
        <DayStrip
          week={mode === 'week' ? weekStripFor(anchorKey) : week}
          selectedDay={selectedDay}
          todayKey={todayKey}
          itemsForDate={itemsForDate}
          onSelectDay={(dayKey) => {
            onSelectDay(dayKey);
            if (mode === 'week') setMode('day');
          }}
          onDropDay={(id, dayKey) => applyMove(id, dayKey)}
          emphasize={Boolean(movingId)}
        />
      ) : null}

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
                  canDrag={canDrag}
                />
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {mode === 'week' ? (
        <section className="notes-week-list" aria-label="Week notes">
          {weekSections.map((sec) => (
            <div
              key={sec.key}
              className={`notes-week-day ${sec.isToday ? 'is-today' : ''} ${selectedDay === sec.key ? 'is-selected' : ''}`}
            >
              <button
                type="button"
                className="notes-week-day-head"
                onClick={() => {
                  onSelectDay(sec.key);
                  setMode('day');
                }}
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
                      canDrag={canDrag}
                    />
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      ) : null}

      {mode === 'month' ? (
        <section className="card notes-month-card" aria-label="Month calendar">
          <div className="notes-month-dows" aria-hidden="true">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="notes-month-grid">
            {grid.cells.map((cell) => {
              const items = itemsForDate(cell.key) || [];
              const open = items.filter((i) => !i.done).length;
              const active = cell.key === selectedDay;
              const isTod = cell.key === todayKey;
              return (
                <button
                  key={cell.key}
                  type="button"
                  className={`notes-month-cell ${cell.inMonth ? '' : 'out'} ${active ? 'active' : ''} ${isTod ? 'is-today' : ''} ${open ? 'has-notes' : ''}`}
                  onClick={() => {
                    if (movingId) {
                      applyMove(movingId, cell.key);
                      setMode('day');
                      return;
                    }
                    setSelectedDay(cell.key);
                    setAnchorKey(cell.key);
                    setMode('day');
                  }}
                  aria-label={`${cell.key}${open ? `, ${open} notes` : ''}`}
                >
                  <span className="notes-month-num">{cell.dayNum}</span>
                  {open > 0 ? <span className="notes-month-dot" aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
          <p className="notes-month-hint">Tap a day to open its notes</p>
        </section>
      ) : null}

      <footer className="mos-footer">
        <p>Manuel OS · local · v19</p>
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

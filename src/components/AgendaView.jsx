import { useEffect, useMemo, useRef, useState } from 'react';
import { formatAgendaDayParts, weekStripFor } from '../lib/time';
import { weekRangeLabel } from '../hooks/useAgenda';

const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

function NoteRow({
  item,
  onToggle,
  onRemove,
  onRename,
  onStartMove,
  moving,
  compact,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.title);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    setDraft(item.title);
  }, [item.title]);

  const commit = () => {
    const t = draft.trim();
    if (t && t !== item.title) onRename(item.id, t);
    else setDraft(item.title);
    setEditing(false);
  };

  return (
    <li
      className={`note-row ${item.done ? 'done' : ''} ${moving ? 'moving' : ''} ${compact ? 'compact' : ''}`}
      draggable={!editing}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', item.id);
        e.dataTransfer.effectAllowed = 'move';
        onStartMove?.(item.id, { silent: true });
      }}
      onDragEnd={() => onStartMove?.(null)}
    >
      <button
        type="button"
        className="note-check"
        aria-label={item.done ? 'Mark open' : 'Mark done'}
        aria-pressed={item.done}
        onClick={() => onToggle(item.id)}
      >
        {item.done ? '✓' : ''}
      </button>
      <div className="note-main">
        {editing ? (
          <input
            ref={inputRef}
            className="note-edit"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              }
              if (e.key === 'Escape') {
                setDraft(item.title);
                setEditing(false);
              }
            }}
            aria-label="Edit note"
          />
        ) : (
          <button
            type="button"
            className="note-title-btn"
            onClick={() => setEditing(true)}
          >
            {item.title}
          </button>
        )}
      </div>
      <button
        type="button"
        className={`note-move ${moving ? 'active' : ''}`}
        aria-label={`Move ${item.title}`}
        aria-pressed={moving}
        onClick={() => onStartMove?.(moving ? null : item.id)}
      >
        Move
      </button>
      <button
        type="button"
        className="note-del"
        aria-label={`Delete ${item.title}`}
        onClick={() => onRemove(item.id)}
      >
        ×
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
  moveTarget,
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
        const dropLit = dragOver === d.key || (emphasize && moveTarget === d.key);
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

export default function AgendaView({
  todayKey,
  overdue,
  counts,
  itemsForDate,
  itemsForWeekDay,
  add,
  toggle,
  remove,
  rename,
  setDue,
  focusComposer,
}) {
  const [mode, setMode] = useState('day'); // day | week
  const [selectedDay, setSelectedDay] = useState(todayKey);
  const [title, setTitle] = useState('');
  const [listening, setListening] = useState(false);
  const [movingId, setMovingId] = useState(null);
  const titleRef = useRef(null);
  const recognitionRef = useRef(null);
  const speechSupported = Boolean(SpeechRecognitionAPI);

  const week = useMemo(() => weekStripFor(todayKey), [todayKey]);
  const weekKeys = useMemo(() => week.map((d) => d.key), [week]);
  const weekLabel = useMemo(() => weekRangeLabel(week), [week]);

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

  const weekSections = useMemo(() => {
    return week.map((d) => {
      const items = itemsForWeekDay
        ? itemsForWeekDay(d.key, weekKeys)
        : itemsForDate(d.key) || [];
      const parts = formatAgendaDayParts(d.key);
      return {
        key: d.key,
        parts,
        isToday: d.key === todayKey,
        items,
        openCount: items.filter((i) => !i.done).length,
      };
    });
  }, [week, weekKeys, itemsForWeekDay, itemsForDate, todayKey]);

  const openCount = dayItems.filter((i) => !i.done).length;
  const parts = formatAgendaDayParts(selectedDay);
  const isToday = selectedDay === todayKey;

  const submit = (e) => {
    e?.preventDefault?.();
    const t = title.trim();
    if (!t) return;
    add(t, selectedDay || todayKey);
    setTitle('');
    titleRef.current?.focus();
  };

  const applyMove = (id, dayKey) => {
    if (!id || !dayKey) return;
    setDue?.(id, dayKey);
    setSelectedDay(dayKey);
    setMovingId(null);
  };

  const startMove = (id) => {
    setMovingId(id);
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
        moveTarget={null}
        onDropDay={applyMove}
        emphasize={Boolean(movingId)}
      />

      {movingId ? (
        <p className="notes-move-hint" role="status">
          Tap a day above to move · or drag onto a day
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
                  onRemove={remove}
                  onRename={rename}
                  onStartMove={startMove}
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
                      onRemove={remove}
                      onRename={rename}
                      onStartMove={startMove}
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
        <p>Manuel OS · local · v17</p>
      </footer>
    </div>
  );
}

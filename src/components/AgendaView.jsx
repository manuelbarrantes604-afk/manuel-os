import { useEffect, useMemo, useRef, useState } from 'react';
import { formatAgendaDayParts, weekStripFor } from '../lib/time';

const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

function NoteRow({ item, onToggle, onRemove, onRename }) {
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
    <li className={`note-row ${item.done ? 'done' : ''}`}>
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

export default function AgendaView({
  todayKey,
  overdue,
  counts,
  itemsForDate,
  add,
  toggle,
  remove,
  rename,
  focusComposer,
}) {
  const [selectedDay, setSelectedDay] = useState(todayKey);
  const [title, setTitle] = useState('');
  const [listening, setListening] = useState(false);
  const titleRef = useRef(null);
  const recognitionRef = useRef(null);
  const speechSupported = Boolean(SpeechRecognitionAPI);

  const week = useMemo(() => weekStripFor(todayKey), [todayKey]);

  useEffect(() => {
    setSelectedDay(todayKey);
  }, [todayKey]);

  useEffect(() => {
    if (focusComposer) titleRef.current?.focus();
  }, [focusComposer]);

  useEffect(() => {
    // Autofocus composer on mount so open → type is one step
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
    // Overdue only when viewing today — rolled into today's list
    if (selectedDay === todayKey && overdue?.length) {
      const ids = new Set(list.map((i) => i.id));
      const rolled = overdue.filter((i) => !ids.has(i.id));
      return [...rolled, ...list];
    }
    return list;
  }, [itemsForDate, selectedDay, todayKey, overdue]);

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
          {parts.weekday}, {parts.date}
          {isToday ? ' · Today' : ''}
          {counts?.overdue ? ` · ${counts.overdue} overdue` : ''}
        </p>
      </header>

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

      <div className="notes-day-strip" role="tablist" aria-label="Day">
        {week.map((d) => {
          const active = d.key === selectedDay;
          const n = (itemsForDate(d.key) || []).filter((i) => !i.done).length;
          const dow = formatAgendaDayParts(d.key).weekday.slice(0, 3);
          return (
            <button
              key={d.key}
              type="button"
              role="tab"
              aria-selected={active}
              className={`notes-day-chip ${active ? 'active' : ''} ${d.key === todayKey ? 'is-today' : ''}`}
              onClick={() => {
                setSelectedDay(d.key);
                titleRef.current?.focus();
              }}
            >
              <span className="notes-day-dow">{dow}</span>
              <span className="notes-day-num">{Number(d.key.slice(8))}</span>
              {n > 0 ? <span className="notes-day-dot" aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>

      <section className="card notes-list-card">
        <div className="notes-list-head">
          <strong>
            {isToday ? 'Today' : parts.weekday}
          </strong>
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
              />
            ))}
          </ul>
        )}
      </section>

      <footer className="mos-footer">
        <p>Manuel OS · local · v16</p>
      </footer>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  agendaMonthKeys,
  monthLabel,
  weekContaining,
  weekRangeLabel,
  weeksInMonth,
} from '../hooks/useAgenda';
import { formatAgendaDayParts, weekStripFor } from '../lib/time';

const VIEWS = [
  { id: 'bydate', label: 'By date' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
];

const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

function DayHead({ dateKey, today }) {
  const parts = formatAgendaDayParts(dateKey);
  return (
    <p className="ag-day-label">
      <span className="ag-day-weekday">{parts.weekday},</span>{' '}
      <strong className="ag-day-date">{parts.date}</strong>
      {today ? <span className="ag-today-tag">Today</span> : null}
    </p>
  );
}

function AgendaRow({
  item,
  todayKey,
  onToggle,
  onRemove,
  onRename,
  onDragStart,
  onDragEnd,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.title);
  const inputRef = useRef(null);
  const longPressTimer = useRef(null);
  const touchDragging = useRef(false);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    setDraft(item.title);
  }, [item.title]);

  const overdue = item.due && !item.done && item.due < todayKey;

  const commit = () => {
    const t = draft.trim();
    if (t && t !== item.title) onRename(item.id, t);
    else setDraft(item.title);
    setEditing(false);
  };

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <li
      className={`check-row fu-row ag-row ${item.done ? 'done' : ''} ${overdue ? 'overdue' : ''}`}
      draggable={!editing}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', item.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart?.(item.id);
      }}
      onDragEnd={() => onDragEnd?.()}
      onTouchStart={(e) => {
        if (editing) return;
        e.stopPropagation();
        clearLongPress();
        longPressTimer.current = setTimeout(() => {
          touchDragging.current = true;
          onDragStart?.(item.id);
          if (navigator.vibrate) {
            try {
              navigator.vibrate(12);
            } catch {
              /* ignore */
            }
          }
        }, 380);
      }}
      onTouchEnd={(e) => {
        e.stopPropagation();
        clearLongPress();
      }}
      onTouchMove={(e) => {
        e.stopPropagation();
        if (!touchDragging.current) clearLongPress();
      }}
      onTouchCancel={(e) => {
        e.stopPropagation();
        clearLongPress();
      }}
    >
      <button
        type="button"
        className="fu-check"
        aria-label={item.done ? 'Mark open' : 'Mark done'}
        aria-pressed={item.done}
        onClick={() => onToggle(item.id)}
      >
        {item.done ? '✓' : '○'}
      </button>
      <div className="fu-main">
        {editing ? (
          <input
            ref={inputRef}
            className="fu-edit"
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
            aria-label="Edit title"
          />
        ) : (
          <button
            type="button"
            className="fu-title-btn"
            onClick={() => setEditing(true)}
          >
            <strong>{item.title}</strong>
          </button>
        )}
        {overdue ? <span className="fu-date hot">overdue</span> : null}
      </div>
      <button
        type="button"
        className="fu-del"
        aria-label={`Delete ${item.title}`}
        onClick={() => onRemove(item.id)}
      >
        ×
      </button>
    </li>
  );
}

function ItemList({
  items,
  todayKey,
  onToggle,
  onRemove,
  onRename,
  onDragStart,
  onDragEnd,
}) {
  if (!items.length) return null;
  return (
    <ul className="check-list ag-bullets">
      {items.map((it) => (
        <AgendaRow
          key={it.id}
          item={it}
          todayKey={todayKey}
          onToggle={onToggle}
          onRemove={onRemove}
          onRename={onRename}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
      ))}
    </ul>
  );
}

function DayDropZone({
  dateKey,
  todayKey,
  items,
  isToday,
  draggingId,
  onToggle,
  onRemove,
  onRename,
  onDragStart,
  onDragEnd,
  onDropDue,
  emptyLabel = 'Nothing dated',
  showEmpty = true,
}) {
  const [over, setOver] = useState(false);

  const handleDragOver = (e) => {
    if (!draggingId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setOver(true);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setOver(false);
    const id = e.dataTransfer.getData('text/plain') || draggingId;
    if (id) onDropDue(id, dateKey);
    onDragEnd?.();
  };

  const handleActivateDrop = () => {
    if (!draggingId) return;
    onDropDue(draggingId, dateKey);
    onDragEnd?.();
  };

  return (
    <div
      className={`ag-day-block ${isToday ? 'is-today' : ''} ${over ? 'ag-drop-over' : ''} ${draggingId ? 'ag-drop-ready' : ''}`}
      data-due={dateKey}
      onDragOver={handleDragOver}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
      onClick={draggingId ? handleActivateDrop : undefined}
      role={draggingId ? 'button' : undefined}
    >
      <DayHead dateKey={dateKey} today={isToday} />
      {items.length ? (
        <ItemList
          items={items}
          todayKey={todayKey}
          onToggle={onToggle}
          onRemove={onRemove}
          onRename={onRename}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
      ) : showEmpty ? (
        <p className="ag-empty-day">
          {draggingId ? 'Drop here' : emptyLabel}
        </p>
      ) : null}
    </div>
  );
}

function Accordion({ title, subtitle, defaultOpen, children, tone }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`card ag-acc ${tone || ''}`}>
      <button
        type="button"
        className="ag-acc-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div>
          <h2>{title}</h2>
          {subtitle ? <p className="ag-acc-sub">{subtitle}</p> : null}
        </div>
        <span className="ag-chevron" aria-hidden="true">
          {open ? '▴' : '▾'}
        </span>
      </button>
      {open ? <div className="ag-acc-body">{children}</div> : null}
    </section>
  );
}

function ByDateView({
  todayKey,
  overdue,
  itemsForDate,
  monthQueue,
  onToggle,
  onRemove,
  onRename,
  draggingId,
  onDragStart,
  onDragEnd,
  onDropDue,
}) {
  const months = useMemo(() => agendaMonthKeys(todayKey), [todayKey]);
  const todayYm = todayKey.slice(0, 7);

  return (
    <div className="ag-bydate">
      {overdue.length > 0 && (
        <section className="card ag-overdue">
          <div className="card-head">
            <h2>Overdue</h2>
            <span className="card-sub">{overdue.length} — rolls forward</span>
          </div>
          <ItemList
            items={overdue}
            todayKey={todayKey}
            onToggle={onToggle}
            onRemove={onRemove}
            onRename={onRename}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
          {draggingId ? (
            <p className="ag-drag-hint">Hold & drop onto a day to reschedule</p>
          ) : null}
        </section>
      )}

      {months.map((ym) => {
        const weeks = weeksInMonth(ym);
        const mq = monthQueue(ym);
        let openCount = mq.length;
        const weekBlocks = weeks.map((w) => {
          const dayBlocks = w.days
            .filter((d) => d.key.startsWith(ym))
            .map((d) => {
              const list = itemsForDate(d.key);
              const show =
                list.length > 0 || d.key === todayKey || Boolean(draggingId);
              if (list.some((i) => !i.done))
                openCount += list.filter((i) => !i.done).length;
              return show
                ? {
                    key: d.key,
                    today: d.key === todayKey,
                    items: list,
                  }
                : null;
            })
            .filter(Boolean);
          return { ...w, dayBlocks };
        });
        const hasContent =
          mq.length > 0 || weekBlocks.some((w) => w.dayBlocks.length > 0);

        return (
          <Accordion
            key={ym}
            title={monthLabel(ym)}
            subtitle={hasContent ? `${openCount} open` : 'Empty'}
            defaultOpen={
              ym === todayYm || (ym === '2026-09' && !months.includes(todayYm))
            }
          >
            {mq.length > 0 && (
              <div className="ag-month-queue">
                <p className="ag-day-label soft">Month queue</p>
                <ItemList
                  items={mq}
                  todayKey={todayKey}
                  onToggle={onToggle}
                  onRemove={onRemove}
                  onRename={onRename}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                />
              </div>
            )}
            {weekBlocks.map((w) => {
              if (!w.dayBlocks.length) return null;
              return (
                <Accordion
                  key={w.id}
                  title={w.label}
                  subtitle={`${w.dayBlocks.length} day${w.dayBlocks.length === 1 ? '' : 's'}`}
                  defaultOpen={w.days.some((d) => d.key === todayKey)}
                  tone="ag-week"
                >
                  {w.dayBlocks.map((d) => (
                    <DayDropZone
                      key={d.key}
                      dateKey={d.key}
                      todayKey={todayKey}
                      items={d.items}
                      isToday={d.today}
                      draggingId={draggingId}
                      onToggle={onToggle}
                      onRemove={onRemove}
                      onRename={onRename}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                      onDropDue={onDropDue}
                    />
                  ))}
                </Accordion>
              );
            })}
            {!hasContent && (
              <p className="ag-empty-day">No items this month</p>
            )}
          </Accordion>
        );
      })}
    </div>
  );
}

function shiftWeek(dateKey, deltaWeeks) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() + deltaWeeks * 7);
  return dt.toISOString().slice(0, 10);
}

function WeeklyAgendaView({
  todayKey,
  anchorKey,
  setAnchorKey,
  itemsForWeekDay,
  onToggle,
  onRemove,
  onRename,
  draggingId,
  onDragStart,
  onDragEnd,
  onDropDue,
}) {
  const week = useMemo(() => weekContaining(anchorKey), [anchorKey]);
  const weekKeys = week.map((d) => d.key);
  const label = weekRangeLabel(week);
  const inThisWeek = weekKeys.includes(todayKey);

  return (
    <div className="ag-weekly">
      <div className="ag-nav-row">
        <button
          type="button"
          className="ag-nav-btn"
          onClick={() => setAnchorKey(shiftWeek(anchorKey, -1))}
          aria-label="Previous week"
        >
          ‹
        </button>
        <div className="ag-nav-center">
          <strong>{label}</strong>
          <span className="ag-nav-sub">Mon–Sun</span>
        </div>
        <button
          type="button"
          className="ag-nav-btn"
          onClick={() => setAnchorKey(shiftWeek(anchorKey, 1))}
          aria-label="Next week"
        >
          ›
        </button>
      </div>
      {!inThisWeek && (
        <button
          type="button"
          className="ag-jump-today"
          onClick={() => setAnchorKey(todayKey)}
        >
          Jump to this week
        </button>
      )}

      <div className="ag-week-days">
        {week.map((d) => {
          const items = itemsForWeekDay(d.key, weekKeys);
          const isToday = d.key === todayKey;
          return (
            <section
              key={d.key}
              className={`card ag-week-day ${isToday ? 'is-today' : ''} ${draggingId ? 'ag-drop-ready' : ''}`}
              data-due={d.key}
              onDragOver={(e) => {
                if (!draggingId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('text/plain') || draggingId;
                if (id) onDropDue(id, d.key);
                onDragEnd?.();
              }}
              onClick={
                draggingId
                  ? () => {
                      onDropDue(draggingId, d.key);
                      onDragEnd?.();
                    }
                  : undefined
              }
            >
              <div className="ag-week-day-head">
                <DayHead dateKey={d.key} today={isToday} />
                <span className="card-sub">
                  {items.filter((i) => !i.done).length || '—'}
                </span>
              </div>
              {items.length ? (
                <ItemList
                  items={items}
                  todayKey={todayKey}
                  onToggle={onToggle}
                  onRemove={onRemove}
                  onRename={onRename}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                />
              ) : (
                <p className="ag-empty-day">{draggingId ? 'Drop here' : '—'}</p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function MonthDayAddRow({ selected, onQuickAdd }) {
  const [draft, setDraft] = useState('');
  const parts = formatAgendaDayParts(selected);
  const submit = (e) => {
    e?.preventDefault?.();
    const t = draft.trim();
    if (!t) return;
    onQuickAdd?.(t, selected);
    setDraft('');
  };
  return (
    <form className="ag-month-add" onSubmit={submit}>
      <input
        className="ag-month-add-input"
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={`Add to ${parts.weekday}, ${parts.date}…`}
        aria-label={`Add item for ${parts.label}`}
      />
      <button type="submit" className="fu-composer-add ag-plus" aria-label="Add to selected day">
        +
      </button>
    </form>
  );
}

function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1, 12));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
}

function MonthlyAgendaView({
  todayKey,
  monthYm,
  setMonthYm,
  itemsForDate,
  monthQueue,
  onToggle,
  onRemove,
  onRename,
  draggingId,
  onDragStart,
  onDragEnd,
  onDropDue,
  selected,
  setSelected,
  onPickDate,
  onQuickAdd,
}) {
  useEffect(() => {
    if (!selected.startsWith(monthYm)) {
      setSelected(
        todayKey.startsWith(monthYm) ? todayKey : `${monthYm}-01`,
      );
    }
  }, [monthYm, selected, todayKey, setSelected]);

  const firstKey = `${monthYm}-01`;
  const firstStrip = weekStripFor(firstKey);
  const mondayOfFirst = firstStrip[0].key;
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const [yy, mm, dd] = mondayOfFirst.split('-').map(Number);
    const dt = new Date(Date.UTC(yy, mm - 1, dd + i, 12));
    const key = dt.toISOString().slice(0, 10);
    const inMonth = key.startsWith(monthYm);
    const list = inMonth ? itemsForDate(key) : [];
    cells.push({
      key,
      day: dt.getUTCDate(),
      inMonth,
      count: list.filter((it) => !it.done).length,
      today: key === todayKey,
      selected: key === selected,
    });
  }
  while (cells.length > 35) {
    const last7 = cells.slice(-7);
    if (last7.every((c) => !c.inMonth)) cells.splice(-7);
    else break;
  }

  const selectedItems = itemsForDate(selected);
  const mq = monthQueue(monthYm);
  const minYm = '2026-09';
  const maxYm = todayKey > '2026-12' ? todayKey.slice(0, 7) : '2026-12';

  return (
    <div className="ag-monthly">
      <div className="ag-nav-row">
        <button
          type="button"
          className="ag-nav-btn"
          disabled={monthYm <= minYm}
          onClick={() => setMonthYm(shiftMonth(monthYm, -1))}
          aria-label="Previous month"
        >
          ‹
        </button>
        <div className="ag-nav-center">
          <strong>{monthLabel(monthYm)}</strong>
          <span className="ag-nav-sub">Scan</span>
        </div>
        <button
          type="button"
          className="ag-nav-btn"
          disabled={monthYm >= maxYm}
          onClick={() => setMonthYm(shiftMonth(monthYm, 1))}
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div className="ag-cal card">
        <div className="ag-cal-dows">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <span key={`${d}-${i}`}>{d}</span>
          ))}
        </div>
        <div className="ag-cal-grid" role="grid">
          {cells.map((c) => (
            <button
              key={c.key}
              type="button"
              role="gridcell"
              disabled={!c.inMonth}
              className={`ag-cal-cell ${c.inMonth ? '' : 'out'} ${c.today ? 'today' : ''} ${c.selected ? 'selected' : ''} ${draggingId && c.inMonth ? 'ag-drop-ready' : ''}`}
              onClick={() => {
                if (!c.inMonth) return;
                setSelected(c.key);
                onPickDate?.(c.key);
              }}
              onDragOver={(e) => {
                if (!draggingId || !c.inMonth) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }}
              onDrop={(e) => {
                if (!c.inMonth) return;
                e.preventDefault();
                const id = e.dataTransfer.getData('text/plain') || draggingId;
                if (id) {
                  onDropDue(id, c.key);
                  setSelected(c.key);
                  onPickDate?.(c.key);
                }
                onDragEnd?.();
              }}
              aria-label={`${c.key}${c.count ? `, ${c.count} items` : ''}`}
            >
              <span className="ag-cal-num">{c.inMonth ? c.day : ''}</span>
              {c.count > 0 ? (
                <span className="ag-cal-dots">
                  {c.count <= 3 ? '•'.repeat(c.count) : `•${c.count}`}
                </span>
              ) : (
                <span className="ag-cal-dots muted"> </span>
              )}
            </button>
          ))}
        </div>
      </div>
      <p className="ag-cal-hint">Tap a date to add</p>

      <section className="card ag-month-day">
        <DayDropZone
          dateKey={selected}
          todayKey={todayKey}
          items={selectedItems}
          isToday={selected === todayKey}
          draggingId={draggingId}
          onToggle={onToggle}
          onRemove={onRemove}
          onRename={onRename}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDropDue={onDropDue}
          emptyLabel="No items this day"
        />
        <MonthDayAddRow
          selected={selected}
          onQuickAdd={onQuickAdd}
        />
      </section>

      {mq.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>Month queue</h2>
            <span className="card-sub">{mq.length}</span>
          </div>
          <ItemList
            items={mq}
            todayKey={todayKey}
            onToggle={onToggle}
            onRemove={onRemove}
            onRename={onRename}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        </section>
      )}
    </div>
  );
}

function MicButton({ listening, onToggle, supported }) {
  if (!supported) return null;
  return (
    <button
      type="button"
      className={`ag-mic ${listening ? 'listening' : ''}`}
      onClick={onToggle}
      aria-label={listening ? 'Stop listening' : 'Add by voice'}
      aria-pressed={listening}
      title={listening ? 'Listening…' : 'Speak to add'}
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
  itemsForWeekDay,
  monthQueue,
  add,
  toggle,
  remove,
  rename,
  setDue,
  focusComposer,
}) {
  const [view, setView] = useState('bydate');
  const [title, setTitle] = useState('');
  const [due, setDueLocal] = useState(todayKey);
  const [weekAnchor, setWeekAnchor] = useState(todayKey);
  const [monthYm, setMonthYm] = useState(todayKey.slice(0, 7));
  const [monthSelected, setMonthSelected] = useState(todayKey);
  const [draggingId, setDraggingId] = useState(null);
  const [listening, setListening] = useState(false);
  const titleRef = useRef(null);
  const recognitionRef = useRef(null);
  const speechSupported = Boolean(SpeechRecognitionAPI);

  useEffect(() => {
    setDueLocal(todayKey);
  }, [todayKey]);

  useEffect(() => {
    if (focusComposer) titleRef.current?.focus();
  }, [focusComposer]);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop?.();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const submit = (e) => {
    e?.preventDefault?.();
    const t = title.trim();
    if (!t) return;
    add(t, due || todayKey);
    setTitle('');
  };

  const onDropDue = (id, dateKey) => {
    if (!id || !dateKey) return;
    setDue(id, dateKey);
    setDraggingId(null);
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
      // Prefer composer fill so user can edit; if empty composer, add directly
      setTitle((prev) => {
        const next = prev.trim() ? `${prev.trim()} ${transcript}` : transcript;
        return next;
      });
      titleRef.current?.focus();
    };
    recognition.onerror = () => {
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
    };

    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  // Sync selected date into composer when picking in monthly view
  useEffect(() => {
    if (view === 'monthly' && monthSelected) {
      setDueLocal(monthSelected);
    }
  }, [view, monthSelected]);

  const pickMonthDate = (dateKey) => {
    setMonthSelected(dateKey);
    setDueLocal(dateKey);
    // Focus main composer so tap clearly opens add/edit for that day
    requestAnimationFrame(() => {
      titleRef.current?.focus();
    });
  };

  const quickAddForDay = (titleText, dateKey) => {
    const t = String(titleText || '').trim();
    if (!t || !dateKey) return;
    add(t, dateKey);
  };

  return (
    <div className="view agenda-view">
      <header className="progress-header">
        <h1>Agenda</h1>
        <p className="date-line">Execution only. Dates beat intentions.</p>
        <p className="fu-counts">
          <span>{counts.overdue} Overdue</span>
          <span aria-hidden="true"> · </span>
          <span>{counts.today} Today</span>
          <span aria-hidden="true"> · </span>
          <span>{counts.upcoming} Ahead</span>
        </p>
      </header>

      <div className="ag-seg" role="tablist" aria-label="Agenda view">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={view === v.id}
            className={`ag-seg-btn ${view === v.id ? 'active' : ''}`}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>

      <form className="period-card fu-composer ag-composer" onSubmit={submit}>
        <div className="ag-composer-top">
          <input
            ref={titleRef}
            className="fu-composer-input"
            type="text"
            placeholder="Add what must move…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Agenda title"
          />
          <MicButton
            supported={speechSupported}
            listening={listening}
            onToggle={toggleMic}
          />
          <button
            type="submit"
            className="fu-composer-add ag-plus"
            aria-label="Add"
          >
            +
          </button>
        </div>
        <div className="fu-composer-row">
          <input
            className="fu-composer-date"
            type="date"
            value={due}
            onChange={(e) => setDueLocal(e.target.value)}
            aria-label="Date for new item"
          />
          <span className="ag-composer-hint">
            {speechSupported
              ? 'Enter to add · mic for date above'
              : 'Enter to add'}
          </span>
        </div>
        {draggingId ? (
          <p className="ag-drag-hint">Drop onto a day to move</p>
        ) : (
          <p className="ag-drag-hint soft">Hold / drag an item onto a day to move</p>
        )}
      </form>

      {view === 'bydate' && (
        <ByDateView
          todayKey={todayKey}
          overdue={overdue}
          itemsForDate={itemsForDate}
          monthQueue={monthQueue}
          onToggle={toggle}
          onRemove={remove}
          onRename={rename}
          draggingId={draggingId}
          onDragStart={setDraggingId}
          onDragEnd={() => setDraggingId(null)}
          onDropDue={onDropDue}
        />
      )}
      {view === 'weekly' && (
        <WeeklyAgendaView
          todayKey={todayKey}
          anchorKey={weekAnchor}
          setAnchorKey={setWeekAnchor}
          itemsForWeekDay={itemsForWeekDay}
          onToggle={toggle}
          onRemove={remove}
          onRename={rename}
          draggingId={draggingId}
          onDragStart={setDraggingId}
          onDragEnd={() => setDraggingId(null)}
          onDropDue={onDropDue}
        />
      )}
      {view === 'monthly' && (
        <MonthlyAgendaView
          todayKey={todayKey}
          monthYm={monthYm}
          setMonthYm={setMonthYm}
          itemsForDate={itemsForDate}
          monthQueue={monthQueue}
          onToggle={toggle}
          onRemove={remove}
          onRename={rename}
          draggingId={draggingId}
          onDragStart={setDraggingId}
          onDragEnd={() => setDraggingId(null)}
          onDropDue={onDropDue}
          selected={monthSelected}
          setSelected={setMonthSelected}
          onPickDate={pickMonthDate}
          onQuickAdd={quickAddForDay}
        />
      )}

      <footer className="mos-footer">
        <p>Manuel OS · agenda · local · v13</p>
      </footer>
    </div>
  );
}

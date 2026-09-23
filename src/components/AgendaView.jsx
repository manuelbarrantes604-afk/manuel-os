import { useEffect, useMemo, useRef, useState } from 'react';
import {
  agendaMonthKeys,
  monthLabel,
  shortMonth,
  weekContaining,
  weekRangeLabel,
  weeksInMonth,
} from '../hooks/useAgenda';
import { formatDayLabel, weekStripFor } from '../lib/time';

const VIEWS = [
  { id: 'bydate', label: 'By date' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
];

function formatDayHead(dateKey) {
  return formatDayLabel(dateKey);
}

function AgendaRow({ item, todayKey, onToggle, onRemove, onRename }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.title);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const overdue = item.due && !item.done && item.due < todayKey;

  const commit = () => {
    const t = draft.trim();
    if (t && t !== item.title) onRename(item.id, t);
    else setDraft(item.title);
    setEditing(false);
  };

  return (
    <li
      className={`check-row fu-row ag-row ${item.done ? 'done' : ''} ${overdue ? 'overdue' : ''}`}
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

function ItemList({ items, todayKey, onToggle, onRemove, onRename }) {
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
        />
      ))}
    </ul>
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
          />
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
              const show = list.length > 0 || d.key === todayKey;
              if (list.some((i) => !i.done)) openCount += list.filter((i) => !i.done).length;
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
            subtitle={
              hasContent
                ? `${openCount} open`
                : 'Empty'
            }
            defaultOpen={ym === todayYm || (ym === '2026-09' && !months.includes(todayYm))}
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
                    <div
                      key={d.key}
                      className={`ag-day-block ${d.today ? 'is-today' : ''}`}
                    >
                      <p className="ag-day-label">
                        {formatDayHead(d.key)}
                        {d.today ? <span className="ag-today-tag">Today</span> : null}
                      </p>
                      {d.items.length ? (
                        <ItemList
                          items={d.items}
                          todayKey={todayKey}
                          onToggle={onToggle}
                          onRemove={onRemove}
                          onRename={onRename}
                        />
                      ) : (
                        <p className="ag-empty-day">Nothing dated</p>
                      )}
                    </div>
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
              className={`card ag-week-day ${isToday ? 'is-today' : ''}`}
            >
              <div className="ag-week-day-head">
                <strong>
                  {d.dow} {Number(d.key.slice(8))}
                </strong>
                {isToday ? <span className="ag-today-tag">Today</span> : null}
                <span className="card-sub">{items.filter((i) => !i.done).length || '—'}</span>
              </div>
              {items.length ? (
                <ItemList
                  items={items}
                  todayKey={todayKey}
                  onToggle={onToggle}
                  onRemove={onRemove}
                  onRename={onRename}
                />
              ) : (
                <p className="ag-empty-day">—</p>
              )}
            </section>
          );
        })}
      </div>
    </div>
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
}) {
  const [selected, setSelected] = useState(todayKey);

  useEffect(() => {
    if (!selected.startsWith(monthYm)) {
      setSelected(
        todayKey.startsWith(monthYm) ? todayKey : `${monthYm}-01`,
      );
    }
  }, [monthYm, selected, todayKey]);


  // Grid starts Monday
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
  // Trim trailing empty weeks outside month
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
          <span className="ag-nav-sub">Outlook grid</span>
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
              className={`ag-cal-cell ${c.inMonth ? '' : 'out'} ${c.today ? 'today' : ''} ${c.selected ? 'selected' : ''}`}
              onClick={() => c.inMonth && setSelected(c.key)}
              aria-label={`${c.key}${c.count ? `, ${c.count} items` : ''}`}
            >
              <span className="ag-cal-num">{c.inMonth ? c.day : ''}</span>
              {c.count > 0 ? (
                <span className="ag-cal-dots">
                  {c.count <= 3
                    ? '•'.repeat(c.count)
                    : `•${c.count}`}
                </span>
              ) : (
                <span className="ag-cal-dots muted"> </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>{formatDayHead(selected)}</h2>
          <span className="card-sub">
            {selected === todayKey ? 'Today' : shortMonth(selected.slice(0, 7))}
          </span>
        </div>
        {selectedItems.length ? (
          <ItemList
            items={selectedItems}
            todayKey={todayKey}
            onToggle={onToggle}
            onRemove={onRemove}
            onRename={onRename}
          />
        ) : (
          <p className="ag-empty-day">No items this day</p>
        )}
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
          />
        </section>
      )}
    </div>
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
  focusComposer,
}) {
  const [view, setView] = useState('bydate');
  const [title, setTitle] = useState('');
  const [due, setDue] = useState(todayKey);
  const [weekAnchor, setWeekAnchor] = useState(todayKey);
  const [monthYm, setMonthYm] = useState(todayKey.slice(0, 7));
  const titleRef = useRef(null);

  useEffect(() => {
    setDue(todayKey);
  }, [todayKey]);

  useEffect(() => {
    if (focusComposer) titleRef.current?.focus();
  }, [focusComposer]);

  const submit = (e) => {
    e?.preventDefault?.();
    const t = title.trim();
    if (!t) return;
    add(t, due || todayKey);
    setTitle('');
    setDue(todayKey);
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

      <form className="period-card fu-composer" onSubmit={submit}>
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
          <button type="submit" className="fu-composer-add ag-plus" aria-label="Add">
            +
          </button>
        </div>
        <div className="fu-composer-row">
          <input
            className="fu-composer-date"
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            aria-label="Date"
          />
          <span className="ag-composer-hint">Enter to add</span>
        </div>
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
        />
      )}

      <footer className="mos-footer">
        <p>Manuel OS · agenda · local · v11</p>
      </footer>
    </div>
  );
}

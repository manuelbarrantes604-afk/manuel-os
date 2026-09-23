import { useEffect, useRef, useState } from 'react';

function formatDue(due, month) {
  if (due) {
    const [, m, d] = due.split('-');
    return `${m}/${d}`;
  }
  if (month) {
    const [, m] = month.split('-');
    const names = [
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
    return names[Number(m)] || month;
  }
  return '—';
}

function FollowupRow({ item, todayKey, onToggle, onRemove, onRename }) {
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
      className={`check-row fu-row ${item.done ? 'done' : ''} ${overdue ? 'overdue' : ''}`}
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
        <span className={`fu-date ${overdue ? 'hot' : ''}`}>
          {formatDue(item.due, item.month)}
        </span>
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

function Section({ title, items, todayKey, onToggle, onRemove, onRename, collapsedDefault }) {
  const [open, setOpen] = useState(!collapsedDefault);
  if (!items.length) return null;
  return (
    <section className="card fu-section">
      <button
        type="button"
        className="fu-section-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <h2>{title}</h2>
        <span className="card-sub">
          {items.length}
          {collapsedDefault ? (open ? ' · hide' : ' · show') : ''}
        </span>
      </button>
      {open && (
        <ul className="check-list">
          {items.map((it) => (
            <FollowupRow
              key={it.id}
              item={it}
              todayKey={todayKey}
              onToggle={onToggle}
              onRemove={onRemove}
              onRename={onRename}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export default function FollowupsView({
  todayKey,
  groups,
  counts,
  add,
  toggle,
  remove,
  rename,
  focusComposer,
}) {
  const [title, setTitle] = useState('');
  const [due, setDue] = useState(todayKey);
  const titleRef = useRef(null);

  useEffect(() => {
    setDue(todayKey);
  }, [todayKey]);

  useEffect(() => {
    if (focusComposer) {
      titleRef.current?.focus();
    }
  }, [focusComposer]);

  const submit = (e) => {
    e?.preventDefault?.();
    const t = title.trim();
    if (!t) return;
    add(t, due || todayKey);
    setTitle('');
    setDue(todayKey);
  };

  const empty =
    !groups.overdue.length &&
    !groups.today.length &&
    !groups.next7.length &&
    !groups.later.length &&
    !groups.month.length &&
    !groups.doneThisWeek.length;

  return (
    <div className="view followups-view">
      <header className="progress-header">
        <h1>Follow-ups</h1>
        <p className="date-line">What must move. Not intentions.</p>
        <p className="fu-counts">
          <span>{counts.overdue} Overdue</span>
          <span aria-hidden="true"> · </span>
          <span>{counts.today} Today</span>
          <span aria-hidden="true"> · </span>
          <span>{counts.upcoming} Upcoming</span>
        </p>
      </header>

      <form className="period-card fu-composer" onSubmit={submit}>
        <input
          ref={titleRef}
          className="fu-composer-input"
          type="text"
          placeholder="What must move…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Follow-up title"
        />
        <div className="fu-composer-row">
          <input
            className="fu-composer-date"
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            aria-label="Due date"
          />
          <button type="submit" className="fu-composer-add">
            Add
          </button>
        </div>
      </form>

      {empty && (
        <section className="card">
          <p className="fu-empty">
            Nothing queued. Add what must move — dates beat intentions.
          </p>
        </section>
      )}

      <Section
        title="Overdue"
        items={groups.overdue}
        todayKey={todayKey}
        onToggle={toggle}
        onRemove={remove}
        onRename={rename}
      />
      <Section
        title="Today"
        items={groups.today}
        todayKey={todayKey}
        onToggle={toggle}
        onRemove={remove}
        onRename={rename}
      />
      <Section
        title="Tomorrow + 7d"
        items={groups.next7}
        todayKey={todayKey}
        onToggle={toggle}
        onRemove={remove}
        onRename={rename}
      />
      <Section
        title="Later"
        items={groups.later}
        todayKey={todayKey}
        onToggle={toggle}
        onRemove={remove}
        onRename={rename}
      />
      <Section
        title="Month"
        items={groups.month}
        todayKey={todayKey}
        onToggle={toggle}
        onRemove={remove}
        onRename={rename}
      />
      <Section
        title="Done this week"
        items={groups.doneThisWeek}
        todayKey={todayKey}
        onToggle={toggle}
        onRemove={remove}
        onRename={rename}
        collapsedDefault
      />

      <footer className="mos-footer">
        <p>Manuel OS · follow-ups · local</p>
      </footer>
    </div>
  );
}

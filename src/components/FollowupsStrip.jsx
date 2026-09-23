/** Compact Today strip: today's open + overdue. */
export default function FollowupsStrip({
  items,
  todayKey,
  overdueCount,
  onToggle,
  onOpenFollowups,
  onAdd,
}) {
  if (!items?.length && overdueCount === 0) return null;

  return (
    <section className="period-card followups-strip" aria-label="Today follow-ups">
      <div className="period-head">
        <div>
          <h2>Follow-ups</h2>
          <p className="coach-line">
            {overdueCount > 0 ? (
              <button
                type="button"
                className="linkish"
                onClick={onOpenFollowups}
              >
                {overdueCount} overdue — open Follow-ups
              </button>
            ) : (
              'Due today'
            )}
          </p>
        </div>
        <button type="button" className="strip-add" onClick={onAdd}>
          Add
        </button>
      </div>
      <ul className="check-list strip-list">
        {items.map((it) => (
          <li
            key={it.id}
            className={`check-row strip-row ${
              it.due && todayKey && it.due < todayKey ? 'overdue' : ''
            }`}
          >
            <button
              type="button"
              className="fu-check"
              aria-label={it.done ? 'Mark open' : 'Mark done'}
              aria-pressed={Boolean(it.done)}
              onClick={() => onToggle(it.id)}
            >
              {it.done ? '✓' : '○'}
            </button>
            <button
              type="button"
              className="strip-title"
              onClick={onOpenFollowups}
            >
              <strong>{it.title}</strong>
              {it.due ? <span className="target">{it.due.slice(5)}</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

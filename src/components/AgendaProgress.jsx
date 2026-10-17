import { useMemo, useState } from 'react';

/* v27: quiet, collapsible glance at progress inside Agenda (Day / Week). New key only. */
const OPEN_KEY = 'manuel-os-agenda-progress-open-v1';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function dowOf(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

export default function AgendaProgress({ week, selectedDay, todayKey, itemsForDate, dayItems, viewMode }) {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(OPEN_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [scope, setScope] = useState(viewMode === 'week' ? 'week' : 'day');
  const [lastMode, setLastMode] = useState(viewMode);
  if (viewMode !== lastMode) {
    setLastMode(viewMode);
    setScope(viewMode === 'week' ? 'week' : 'day');
  }

  const days = useMemo(
    () =>
      week.map((d) => {
        const items = itemsForDate(d.key) || [];
        const done = items.filter((i) => i.done).length;
        return { key: d.key, done, total: items.length, today: d.key === todayKey };
      }),
    [week, itemsForDate, todayKey],
  );

  // Selected day uses what the list shows (includes rolled-over overdue on today).
  const sel = { done: dayItems.filter((i) => i.done).length, total: dayItems.length };
  const weekDone = days.reduce((n, d) => n + d.done, 0);
  const weekTotal = days.reduce((n, d) => n + d.total, 0);
  const done = scope === 'day' ? sel.done : weekDone;
  const total = scope === 'day' ? sel.total : weekTotal;
  const left = total - done;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const max = Math.max(1, ...days.map((d) => d.total));

  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(OPEN_KEY, next ? '1' : '0');
    } catch {
      /* ignore */
    }
  };

  const H = 70;
  const bw = 26;
  const gap = 14;
  const W = days.length * bw + (days.length - 1) * gap;

  return (
    <section className={`ag-progress ${open ? 'open' : ''}`} aria-label="Progress summary">
      <button type="button" className="ag-progress-head" onClick={toggle} aria-expanded={open}>
        <span className="ag-progress-title">Progress</span>
        <span className="ag-progress-glance">
          {done}/{total} done {scope === 'day' ? 'today' : 'this week'}
        </span>
        <span aria-hidden="true" className="ag-progress-chev">
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open ? (
        <div className="ag-progress-body">
          <div className="ag-progress-toggle" role="tablist" aria-label="Progress range">
            {['day', 'week'].map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={scope === s}
                className={scope === s ? 'active' : ''}
                onClick={() => setScope(s)}
              >
                {s === 'day' ? 'Day' : 'Week'}
              </button>
            ))}
          </div>
          <div className="ag-stats">
            <div className="ag-stat">
              <strong>{done}</strong>
              <span>Done</span>
            </div>
            <div className="ag-stat">
              <strong>{left}</strong>
              <span>To do</span>
            </div>
            <div className="ag-stat">
              <strong>{pct}%</strong>
              <span>Finished</span>
            </div>
          </div>
          <svg className="ag-bars" viewBox={`0 0 ${W} ${H + 22}`} role="img" aria-label="Tasks done per day">
            {days.map((d, i) => {
              const x = i * (bw + gap);
              const th = Math.max(d.total ? 4 : 2, (d.total / max) * H);
              const dh = (d.done / max) * H;
              const hot = scope === 'day' ? d.key === selectedDay : true;
              return (
                <g key={d.key} opacity={hot ? 1 : 0.45}>
                  <rect x={x} y={H - th} width={bw} height={th} rx="7" fill="#efeff3" />
                  {d.done ? <rect x={x} y={H - dh} width={bw} height={dh} rx="7" fill="#9b87e8" /> : null}
                  {d.done ? (
                    <text x={x + bw / 2} y={H - dh - 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="#52525b">
                      {d.done}
                    </text>
                  ) : null}
                  <text
                    x={x + bw / 2}
                    y={H + 16}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight={d.today ? 800 : 600}
                    fill={d.today ? '#18181b' : '#a1a1aa'}
                  >
                    {DOW[dowOf(d.key)]}
                  </text>
                </g>
              );
            })}
          </svg>
          <p className="ag-progress-note">Tasks done per day · grey is everything planned</p>
        </div>
      ) : null}
    </section>
  );
}

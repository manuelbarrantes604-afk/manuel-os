import { useMemo, useState } from 'react';
import {
  CHECK_DEFS,
  DAY_PARTS,
  GOALS,
  STREAKS,
  TODAY_KEY,
  WEEK_STRIP,
} from './data/seed';
import { useCheckins } from './hooks/useCheckins';
import './App.css';

const NAV = [
  { id: 'today', label: 'Today', icon: '☀️' },
  { id: 'progress', label: 'Progress', icon: '📈' },
];

const CHECK_BY_ID = Object.fromEntries(CHECK_DEFS.map((d) => [d.id, d]));

function statusClass(s) {
  if (s === 'PASS') return 'pass';
  if (s === 'FAIL') return 'fail';
  return 'pending';
}

function greetingForHour(h) {
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function ScorePill({ pct }) {
  const tone =
    pct == null ? 'muted' : pct >= 80 ? 'hot' : pct >= 50 ? 'mid' : 'cold';
  return (
    <span className={`score-pill tone-${tone}`}>
      {pct == null ? '—' : `${pct}%`}
    </span>
  );
}

function TodayHeader({ pct, dateLabel }) {
  const hour = new Date().getHours();
  const greeting = greetingForHour(hour);

  return (
    <header className="today-header">
      <div className="greeting-row">
        <div>
          <p className="hello">{greeting}, Manuel</p>
          <h1>Today</h1>
          <p className="date-line">{dateLabel} · Week 39</p>
        </div>
        <ScorePill pct={pct} />
      </div>
      <p className="coach-banner">
        Faith. Health. Discipline. Family. Execution — not intentions.
      </p>
    </header>
  );
}

function CheckRow({ def, row, cycleStatus, markProof }) {
  return (
    <li className={`check-row ${statusClass(row.status)}`}>
      <button
        type="button"
        className="status-chip"
        onClick={() => cycleStatus(def.id)}
        aria-label={`Cycle ${def.label} status`}
      >
        {row.status}
      </button>
      <div className="check-body">
        <div className="check-top">
          <strong>{def.label}</strong>
          <span className="target">{def.target}</span>
        </div>
        <div className="check-meta">
          <span className="mono">{row.time}</span>
          <span className="note">{row.note}</span>
        </div>
      </div>
      {def.proof && row.status !== 'PASS' && (
        <button
          type="button"
          className="proof-btn"
          onClick={() => markProof(def.id)}
        >
          Add proof
        </button>
      )}
    </li>
  );
}

function PeriodCard({ part, today, cycleStatus, markProof }) {
  const rows = part.checkIds.map((id) => ({
    def: CHECK_BY_ID[id],
    row: today.checks[id],
  }));

  const done = rows.filter((r) => r.row?.status !== 'PENDING').length;
  const total = rows.length;

  return (
    <article className="period-card">
      <div className="period-head">
        <div>
          <h2>{part.title}</h2>
          <p className="coach-line">{part.coachLine}</p>
        </div>
        <span className="period-count">
          {done}/{total}
        </span>
      </div>
      <ul className="check-list">
        {rows.map(({ def, row }) => (
          <CheckRow
            key={def.id}
            def={def}
            row={row}
            cycleStatus={cycleStatus}
            markProof={markProof}
          />
        ))}
      </ul>
    </article>
  );
}

function TodayView({ today, todayPct, cycleStatus, markProof }) {
  const dateLabel = today?.label || 'Wed Sep 23';

  return (
    <div className="view today-view">
      <TodayHeader pct={todayPct} dateLabel={dateLabel} />
      <div className="period-stack">
        {DAY_PARTS.map((part) => (
          <PeriodCard
            key={part.id}
            part={part}
            today={today}
            cycleStatus={cycleStatus}
            markProof={markProof}
          />
        ))}
      </div>
    </div>
  );
}

function ProgressView({ days, weekPcts, todayPct, resetToday }) {
  const strip = useMemo(
    () =>
      WEEK_STRIP.map((d) => ({
        ...d,
        pct: d.key === TODAY_KEY ? todayPct : weekPcts[d.key] ?? d.pct,
      })),
    [weekPcts, todayPct],
  );

  const latestReview = useMemo(() => {
    const keys = Object.keys(days).sort().reverse();
    for (const k of keys) {
      const day = days[k];
      if (day?.review?.ran) return day;
    }
    return days[TODAY_KEY] || null;
  }, [days]);

  return (
    <div className="view progress-view">
      <header className="progress-header">
        <h1>Progress</h1>
        <p className="date-line">Week 39 · keep the streak honest</p>
      </header>

      <section className="card">
        <div className="card-head">
          <h2>This week</h2>
          <span className="card-sub">Mon–Sun</span>
        </div>
        <div className="week-strip" role="list">
          {strip.map((d) => (
            <div
              key={d.key}
              className={`day-cell ${d.today ? 'today' : ''} ${d.empty ? 'empty' : ''}`}
              role="listitem"
            >
              <span className="dow">{d.dow}</span>
              <span className="day-pct">
                {d.empty && !d.today ? '·' : d.pct == null ? '—' : `${d.pct}%`}
              </span>
              <span
                className={`day-bar ${
                  d.pct == null
                    ? 'none'
                    : d.pct >= 80
                      ? 'hot'
                      : d.pct >= 50
                        ? 'mid'
                        : 'cold'
                }`}
                style={{
                  height: d.pct == null ? 4 : Math.max(8, (d.pct / 100) * 48),
                }}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Streaks</h2>
          <span className="card-sub">Current runs</span>
        </div>
        <div className="streak-counters">
          {STREAKS.map((s) => (
            <div key={s.id} className="streak-card">
              <span className="streak-count">{s.count}</span>
              <span className="streak-label">{s.label}</span>
              <span className="streak-unit">{s.unit}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Goals</h2>
          <span className="card-sub">North stars</span>
        </div>
        <ul className="goal-list">
          {GOALS.map((g) => (
            <li key={g.id} className="goal-row">
              <div className="goal-copy">
                <strong>{g.title}</strong>
                <span>{g.meta}</span>
              </div>
              <span className="goal-pct mono">{g.progress}%</span>
              <div className="goal-meter" aria-label={`${g.progress}%`}>
                <div className="goal-fill" style={{ width: `${g.progress}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {latestReview?.review && (
        <section className="card review-simple">
          <div className="card-head">
            <h2>Latest review</h2>
            <span className="card-sub">
              {latestReview.label}
              {latestReview.review.ran
                ? ` · ${latestReview.review.score ?? '—'}%`
                : ' · open'}
            </span>
          </div>
          <p className="review-body">{latestReview.review.body}</p>
        </section>
      )}

      <footer className="mos-footer">
        <button type="button" className="ghost-btn" onClick={resetToday}>
          Reset today
        </button>
        <p>Manuel OS · local only · v2</p>
      </footer>
    </div>
  );
}

export default function App() {
  const { days, today, todayPct, weekPcts, cycleStatus, markProof, resetToday } =
    useCheckins();
  const [tab, setTab] = useState('today');

  return (
    <div className="mos-shell">
      <div className="mos-frame">
        <main className="mos-main">
          {tab === 'today' ? (
            <TodayView
              today={today}
              todayPct={todayPct}
              cycleStatus={cycleStatus}
              markProof={markProof}
            />
          ) : (
            <ProgressView
              days={days}
              weekPcts={weekPcts}
              todayPct={todayPct}
              resetToday={resetToday}
            />
          )}
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Main">
        {NAV.map((n) => (
          <button
            key={n.id}
            type="button"
            className={tab === n.id ? 'active' : ''}
            onClick={() => setTab(n.id)}
          >
            <span className="nav-icon" aria-hidden="true">
              {n.icon}
            </span>
            <span className="nav-label">{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

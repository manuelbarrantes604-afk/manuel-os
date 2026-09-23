import { useEffect, useMemo, useState } from 'react';
import {
  CHECK_DEFS,
  GOALS,
  STREAKS,
  TODAY_KEY,
  VALUES,
  WEEK_STRIP,
} from './data/seed';
import { useCheckins } from './hooks/useCheckins';
import './App.css';

const NAV = [
  { id: 'today', label: 'Today' },
  { id: 'streaks', label: 'Streaks' },
  { id: 'goals', label: 'Goals' },
  { id: 'reviews', label: 'Reviews' },
];

function statusClass(s) {
  if (s === 'PASS') return 'pass';
  if (s === 'FAIL') return 'fail';
  return 'pending';
}

function ScoreRing({ pct, size = 88 }) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const value = pct == null ? 0 : pct;
  const offset = c - (value / 100) * c;
  const tone =
    pct == null ? 'muted' : pct >= 80 ? 'hot' : pct >= 50 ? 'mid' : 'cold';

  return (
    <div className={`score-ring tone-${tone}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 88 88" aria-hidden="true">
        <circle className="track" cx="44" cy="44" r={r} />
        <circle
          className="prog"
          cx="44"
          cy="44"
          r={r}
          strokeDasharray={c}
          strokeDashoffset={pct == null ? c : offset}
        />
      </svg>
      <div className="score-ring-inner">
        <span className="score-num">{pct == null ? '—' : `${pct}`}</span>
        <span className="score-unit">{pct == null ? 'open' : '%'}</span>
      </div>
    </div>
  );
}

function Header({ pct, dateLabel }) {
  return (
    <header className="mos-header">
      <div className="brand-row">
        <div className="wordmark">
          <span className="wm-m">Manuel</span>
          <span className="wm-os">OS</span>
        </div>
        <div className="header-meta">
          <span className="chip">{dateLabel}</span>
          <span className="chip muted">W39</span>
        </div>
      </div>
      <p className="tagline">Evaluate execution, not intentions.</p>
      <div className="header-score">
        <ScoreRing pct={pct} size={104} />
        <div className="header-score-copy">
          <h1>Today&apos;s execution</h1>
          <p>
            {pct == null
              ? 'Day in progress — morning stack already graded.'
              : pct < 50
                ? 'Below standard. Reset the next check.'
                : pct < 80
                  ? 'Partial execution. Close the open items.'
                  : 'On standard. Protect the streak.'}
          </p>
        </div>
      </div>
    </header>
  );
}

function TodayPanel({ today, cycleStatus, markProof }) {
  return (
    <section className="panel" id="today">
      <div className="panel-head">
        <h2>Non-negotiables</h2>
        <span className="panel-sub">Tap status to cycle · proof for photo checks</span>
      </div>
      <ul className="check-list">
        {CHECK_DEFS.map((def) => {
          const row = today.checks[def.id];
          return (
            <li key={def.id} className={`check-row ${statusClass(row.status)}`}>
              <button
                type="button"
                className="status-btn"
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
                  Mark proof
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function StreaksPanel({ weekPcts, todayPct }) {
  const strip = useMemo(
    () =>
      WEEK_STRIP.map((d) => ({
        ...d,
        pct: d.key === TODAY_KEY ? todayPct : weekPcts[d.key] ?? d.pct,
      })),
    [weekPcts, todayPct],
  );

  return (
    <section className="panel" id="streaks">
      <div className="panel-head">
        <h2>Streaks</h2>
        <span className="panel-sub">Week 39 · Mon–Sun</span>
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
                d.pct == null ? 'none' : d.pct >= 80 ? 'hot' : d.pct >= 50 ? 'mid' : 'cold'
              }`}
              style={{ height: d.pct == null ? 4 : Math.max(8, (d.pct / 100) * 48) }}
            />
          </div>
        ))}
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
  );
}

function GoalsPanel() {
  return (
    <section className="panel" id="goals">
      <div className="panel-head">
        <h2>Goals &amp; values</h2>
        <span className="panel-sub">North stars · measured weekly</span>
      </div>
      <div className="values-row">
        {VALUES.map((v) => (
          <article key={v.id} className="value-card">
            <h3>{v.title}</h3>
            <p>{v.blurb}</p>
          </article>
        ))}
      </div>
      <ul className="goal-list">
        {GOALS.map((g) => (
          <li key={g.id} className="goal-row">
            <div className="goal-copy">
              <strong>{g.title}</strong>
              <span>{g.meta}</span>
            </div>
            <div className="goal-meter" aria-label={`${g.progress}%`}>
              <div className="goal-fill" style={{ width: `${g.progress}%` }} />
            </div>
            <span className="goal-pct mono">{g.progress}%</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReviewsPanel({ days }) {
  const reviews = ['2026-09-22', '2026-09-23']
    .map((k) => days[k])
    .filter(Boolean);

  return (
    <section className="panel" id="reviews">
      <div className="panel-head">
        <h2>Reviews</h2>
        <span className="panel-sub">Evening accountability cards</span>
      </div>
      <div className="review-stack">
        {reviews.map((day) => {
          const r = day.review;
          const pct = (() => {
            const checks = Object.values(day.checks);
            const done = checks.filter((c) => c.status !== 'PENDING');
            if (!done.length && !r.ran) return null;
            const passes = checks.filter((c) => c.status === 'PASS').length;
            return Math.round((passes / CHECK_DEFS.length) * 100);
          })();
          return (
            <article
              key={day.date}
              className={`review-card ${r.ran ? 'done' : 'open'}`}
            >
              <div className="review-top">
                <div>
                  <h3>{r.title}</h3>
                  <span className="review-date">{day.label} · {day.week}</span>
                </div>
                <div className={`review-score ${statusClass(pct != null && pct >= 50 ? 'PASS' : 'FAIL')}`}>
                  {r.ran ? `${r.score ?? pct}%` : 'OPEN'}
                </div>
              </div>
              <p className="review-body">{r.body}</p>
              {r.wins?.length > 0 && (
                <div className="review-tags">
                  {r.wins.map((w) => (
                    <span key={w} className="tag pass">
                      {w}
                    </span>
                  ))}
                </div>
              )}
              {r.misses?.length > 0 && (
                <div className="review-tags">
                  {r.misses.map((m) => (
                    <span key={m} className="tag fail">
                      {m}
                    </span>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default function App() {
  const { days, today, todayPct, weekPcts, cycleStatus, markProof, resetToday } =
    useCheckins();
  const [section, setSection] = useState('today');

  useEffect(() => {
    const el = document.getElementById(section);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [section]);

  const dateLabel = today?.label || 'Wed Sep 23';

  return (
    <div className="mos-shell">
      <div className="mos-frame">
        <Header pct={todayPct} dateLabel={dateLabel} />

        <nav className="mos-nav" aria-label="Sections">
          {NAV.map((n) => (
            <button
              key={n.id}
              type="button"
              className={section === n.id ? 'active' : ''}
              onClick={() => setSection(n.id)}
            >
              {n.label}
            </button>
          ))}
        </nav>

        <main className="mos-main">
          <TodayPanel
            today={today}
            cycleStatus={cycleStatus}
            markProof={markProof}
          />
          <StreaksPanel weekPcts={weekPcts} todayPct={todayPct} />
          <GoalsPanel />
          <ReviewsPanel days={days} />

          <footer className="mos-footer">
            <button type="button" className="ghost-btn" onClick={resetToday}>
              Reset today to seed
            </button>
            <p>Manuel OS · local only · v1</p>
          </footer>
        </main>
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import {
  CHECK_DEFS,
  DAY_PARTS,
  GOALS,
  IMPROVE_TIPS,
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
const MORNING_IDS = ['wake', 'leave', 'exercise'];

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

function CheckRow({ def, row, setStatus, clearStatus, markProof }) {
  const status = row?.status || 'PENDING';
  const isPending = status === 'PENDING';

  return (
    <li className={`check-row ${statusClass(status)}`}>
      <div className="check-body full">
        <div className="check-top">
          <strong>{def.label}</strong>
          <span className="target">{def.target}</span>
        </div>
        <div className="check-meta">
          <span className="mono">{row?.time || '—'}</span>
          <span className="note">{row?.note}</span>
        </div>
      </div>

      <div className="pf-row">
        <button
          type="button"
          className={`pf-btn pass ${status === 'PASS' ? 'selected' : ''}`}
          onClick={() => setStatus(def.id, 'PASS')}
          aria-pressed={status === 'PASS'}
        >
          Pass
        </button>
        <button
          type="button"
          className={`pf-btn fail ${status === 'FAIL' ? 'selected' : ''}`}
          onClick={() => setStatus(def.id, 'FAIL')}
          aria-pressed={status === 'FAIL'}
        >
          Fail
        </button>
        {!isPending && (
          <button
            type="button"
            className="pf-btn reset"
            onClick={() => clearStatus(def.id)}
          >
            Reset
          </button>
        )}
      </div>

      {def.proof && status !== 'PASS' && (
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

function PeriodCard({ part, today, setStatus, clearStatus, markProof }) {
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
            setStatus={setStatus}
            clearStatus={clearStatus}
            markProof={markProof}
          />
        ))}
      </ul>
    </article>
  );
}

function DayResultCard({ stats }) {
  if (!stats) return null;
  const show = stats.allGraded || stats.pct === 100;
  if (!show) return null;

  const passLabels = stats.passIds.map((id) => CHECK_BY_ID[id].label);
  const failLabels = stats.failIds.map((id) => CHECK_BY_ID[id].label);

  if (stats.pct === 100) {
    return (
      <section className="card day-result win" aria-live="polite">
        <div className="card-head">
          <h2>Day complete</h2>
          <span className="result-score hot">100%</span>
        </div>
        <p className="result-lead">
          All six non-negotiables locked. Protect sleep and tomorrow&apos;s
          morning.
        </p>
        <p className="result-sub">
          Faith. Health. Discipline. Family. Execution — carried.
        </p>
      </section>
    );
  }

  return (
    <section className="card day-result graded" aria-live="polite">
      <div className="card-head">
        <h2>Day result</h2>
        <span
          className={`result-score ${stats.pct >= 50 ? 'mid' : 'cold'}`}
        >
          {stats.pct}%
        </span>
      </div>
      <p className="result-lead">
        {stats.passCount}/{stats.total} passed · {stats.failCount} failed.
        Honesty first — close the gaps tomorrow.
      </p>
      {passLabels.length > 0 && (
        <p className="result-line pass-line">
          <strong>Passed:</strong> {passLabels.join(', ')}
        </p>
      )}
      {failLabels.length > 0 && (
        <p className="result-line fail-line">
          <strong>Failed:</strong> {failLabels.join(', ')}
        </p>
      )}
    </section>
  );
}

function ImprovementCard({ stats }) {
  if (!stats || stats.failCount === 0) return null;

  const morningFails = MORNING_IDS.filter((id) =>
    stats.failIds.includes(id),
  ).length;
  const show =
    stats.failCount >= 1 &&
    (stats.failCount >= 2 || morningFails >= 1 || stats.allGraded);
  if (!show && stats.failCount < 1) return null;
  // Always show when there is at least 1 FAIL (prefer 2+ or morning stack)
  // Spec: show when at least 1 FAIL (preferably 2+ or morning failed) — we show for any FAIL
  const tips = stats.failIds
    .map((id) => IMPROVE_TIPS[id])
    .filter(Boolean);

  if (!tips.length) return null;

  const multi = stats.failCount >= 2 || morningFails >= 2;

  return (
    <section className="card improve-card" aria-live="polite">
      <div className="card-head">
        <h2>{multi ? "Today's gaps" : 'One fix'}</h2>
        <span className="card-sub">Actionable · Faith · Health · Discipline</span>
      </div>
      {multi && (
        <p className="improve-lead">
          Recurring misses need a reset, not a pep talk. Hit the next check on
          time.
        </p>
      )}
      <ul className="improve-list">
        {tips.map((t) => (
          <li key={t.title}>
            <strong>{t.title}</strong>
            <span>{t.tip}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TodayView({
  today,
  todayPct,
  todayStats,
  setStatus,
  clearStatus,
  markProof,
}) {
  const dateLabel = today?.label || 'Wed Sep 23';

  return (
    <div className="view today-view">
      <TodayHeader pct={todayPct} dateLabel={dateLabel} />
      <DayResultCard stats={todayStats} />
      <ImprovementCard stats={todayStats} />
      <div className="period-stack">
        {DAY_PARTS.map((part) => (
          <PeriodCard
            key={part.id}
            part={part}
            today={today}
            setStatus={setStatus}
            clearStatus={clearStatus}
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
        <p>Manuel OS · local only · v3</p>
      </footer>
    </div>
  );
}

export default function App() {
  const {
    days,
    today,
    todayPct,
    todayStats,
    weekPcts,
    setStatus,
    clearStatus,
    markProof,
    resetToday,
  } = useCheckins();
  const [tab, setTab] = useState('today');

  return (
    <div className="mos-shell">
      <div className="mos-frame">
        <main className="mos-main">
          {tab === 'today' ? (
            <TodayView
              today={today}
              todayPct={todayPct}
              todayStats={todayStats}
              setStatus={setStatus}
              clearStatus={clearStatus}
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

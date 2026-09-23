import { useMemo, useState } from 'react';
import {
  CHECK_DEFS,
  DAY_PARTS,
  GOALS,
  IMPROVE_TIPS,
  PRIORITY_PLACEHOLDERS,
  STREAKS,
} from './data/seed';
import { useCheckins } from './hooks/useCheckins';
import { usePriorities } from './hooks/usePriorities';
import {
  activePeriodId,
  getNextUp,
} from './lib/time';
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

function scrollToCheck(checkId) {
  const el = document.getElementById(`check-${checkId}`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('flash-focus');
    window.setTimeout(() => el.classList.remove('flash-focus'), 1200);
  }
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

function NextUpCard({ nextUp }) {
  if (!nextUp) return null;

  if (nextUp.closed) {
    return (
      <button type="button" className="next-up closed" disabled>
        <span className="next-up-kicker">Next up</span>
        <span className="next-up-title">{nextUp.label}</span>
      </button>
    );
  }

  const def = CHECK_BY_ID[nextUp.id];
  return (
    <button
      type="button"
      className="next-up"
      onClick={() => scrollToCheck(nextUp.id)}
    >
      <span className="next-up-kicker">Next up</span>
      <span className="next-up-title">{def?.label || nextUp.id}</span>
      <span className="next-up-meta">{def?.target} · tap to jump</span>
    </button>
  );
}

function TodayHeader({ pct, dateLabel, week, hour, nextUp }) {
  const greeting = greetingForHour(hour);

  return (
    <header className="today-header">
      <div className="greeting-row">
        <div>
          <p className="hello">{greeting}, Manuel</p>
          <h1>Today</h1>
          <p className="date-line">
            {dateLabel} · {week}
          </p>
        </div>
        <ScorePill pct={pct} />
      </div>
      <p className="coach-banner">
        Faith. Health. Discipline. Family. Execution — not intentions.
      </p>
      <NextUpCard nextUp={nextUp} />
    </header>
  );
}

function MiddayPriorities({ priorities, setPriority, showHint }) {
  return (
    <div className="midday-priorities">
      <div className="midday-pri-head">
        <strong>Top 3 today</strong>
        <span>Auto-saves</span>
      </div>
      <ol className="priority-inputs">
        {priorities.map((value, i) => (
          <li key={i}>
            <span className="pri-num">{i + 1}</span>
            <input
              type="text"
              value={value}
              placeholder={PRIORITY_PLACEHOLDERS[i]}
              onChange={(e) => setPriority(i, e.target.value)}
              onBlur={(e) => setPriority(i, e.target.value.trim())}
              maxLength={80}
              aria-label={`Priority ${i + 1}`}
            />
          </li>
        ))}
      </ol>
      {showHint && (
        <p className="priority-hint">Lock at least one priority.</p>
      )}
    </div>
  );
}

function CheckRow({ def, row, setStatus, highlight }) {
  const status = row?.status || 'PENDING';

  return (
    <li
      id={`check-${def.id}`}
      className={`check-row ${statusClass(status)} ${highlight ? 'is-next' : ''}`}
    >
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
      </div>
    </li>
  );
}

function PeriodCard({
  part,
  today,
  setStatus,
  isActive,
  nextCheckId,
  prioritiesSlot,
}) {
  const rows = part.checkIds.map((id) => ({
    def: CHECK_BY_ID[id],
    row: today.checks[id],
  }));

  const done = rows.filter((r) => r.row?.status !== 'PENDING').length;
  const total = rows.length;

  return (
    <article
      className={`period-card ${isActive ? 'period-active' : ''}`}
      id={`period-${part.id}`}
    >
      <div className="period-head">
        <div>
          <h2>
            {part.title}
            {isActive && <span className="now-badge">Now</span>}
          </h2>
          <p className="coach-line">{part.coachLine}</p>
        </div>
        <span className="period-count">
          {done}/{total}
        </span>
      </div>
      {prioritiesSlot}
      <ul className="check-list">
        {rows.map(({ def, row }) => (
          <CheckRow
            key={def.id}
            def={def}
            row={row}
            setStatus={setStatus}
            highlight={nextCheckId === def.id}
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
  if (!stats || !stats.allGraded || stats.failCount === 0) return null;

  const tips = stats.failIds
    .map((id) => IMPROVE_TIPS[id])
    .filter(Boolean);

  if (!tips.length) return null;

  return (
    <section className="card improve-card" aria-live="polite">
      <div className="card-head">
        <h2>Today&apos;s gaps</h2>
        <span className="card-sub">
          What to change · Faith · Health · Discipline
        </span>
      </div>
      <p className="improve-lead">
        Day is graded. Fix these for tomorrow — specific actions, not pep talk.
      </p>
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
  ny,
  todayKey,
}) {
  const { priorities, setPriority, filledCount } = usePriorities(todayKey);
  const nextUp = useMemo(
    () => getNextUp(today?.checks || {}, ny.hour, ny.minute),
    [today, ny.hour, ny.minute],
  );
  const activePart = activePeriodId(ny.hour);
  const middayStatus = today?.checks?.midday?.status;
  const showPriHint =
    middayStatus === 'PASS' && filledCount === 0;

  return (
    <div className="view today-view">
      <TodayHeader
        pct={todayPct}
        dateLabel={today?.label || 'Today'}
        week={today?.week || 'W—'}
        hour={ny.hour}
        nextUp={nextUp}
      />
      <DayResultCard stats={todayStats} />
      <ImprovementCard stats={todayStats} />
      <div className="period-stack">
        {DAY_PARTS.map((part) => (
          <PeriodCard
            key={part.id}
            part={part}
            today={today}
            setStatus={setStatus}
            isActive={activePart === part.id}
            nextCheckId={nextUp.closed ? null : nextUp.id}
            prioritiesSlot={
              part.id === 'midday' ? (
                <MiddayPriorities
                  priorities={priorities}
                  setPriority={setPriority}
                  showHint={showPriHint}
                />
              ) : null
            }
          />
        ))}
      </div>
    </div>
  );
}

function ProgressView({
  days,
  weekPcts,
  todayPct,
  weekStrip,
  weekHonesty,
  todayKey,
}) {
  const strip = useMemo(
    () =>
      weekStrip.map((d) => {
        const pct =
          d.key === todayKey ? todayPct : weekPcts[d.key] ?? d.pct;
        const empty = pct == null && !d.today && !days[d.key];
        return { ...d, pct, empty };
      }),
    [weekStrip, weekPcts, todayPct, todayKey, days],
  );

  const latestReview = useMemo(() => {
    const keys = Object.keys(days).sort().reverse();
    for (const k of keys) {
      const day = days[k];
      if (day?.review?.ran) return day;
    }
    return days[todayKey] || null;
  }, [days, todayKey]);

  const honestyTone =
    weekHonesty.avg == null
      ? 'muted'
      : weekHonesty.avg >= 80
        ? 'hot'
        : weekHonesty.avg >= 50
          ? 'mid'
          : 'cold';

  return (
    <div className="view progress-view">
      <header className="progress-header">
        <h1>Progress</h1>
        <p className="date-line">This week · keep the streak honest</p>
      </header>

      <section className="card honesty-card">
        <div className="card-head">
          <h2>Week honesty</h2>
          <span className="card-sub">
            {weekHonesty.count
              ? `${weekHonesty.count} graded day${weekHonesty.count === 1 ? '' : 's'}`
              : 'No graded days'}
          </span>
        </div>
        <div className={`honesty-score tone-${honestyTone}`}>
          {weekHonesty.avg == null ? '—' : `${weekHonesty.avg}%`}
        </div>
        <p className="honesty-line">{weekHonesty.line}</p>
      </section>

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
        <p>Manuel OS · local only · v5</p>
      </footer>
    </div>
  );
}

export default function App() {
  const {
    days,
    today,
    todayKey,
    todayPct,
    todayStats,
    weekPcts,
    weekStrip,
    weekHonesty,
    ny,
    setStatus,
  } = useCheckins();
  const [tab, setTab] = useState('today');

  if (!today) {
    return (
      <div className="mos-shell">
        <div className="mos-frame">
          <p className="date-line">Loading today…</p>
        </div>
      </div>
    );
  }

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
              ny={ny}
              todayKey={todayKey}
            />
          ) : (
            <ProgressView
              days={days}
              weekPcts={weekPcts}
              todayPct={todayPct}
              weekStrip={weekStrip}
              weekHonesty={weekHonesty}
              todayKey={todayKey}
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

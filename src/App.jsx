import { useEffect, useMemo, useState } from 'react';
import { CHECK_DEFS, DAY_PARTS, GOALS, IMPROVE_TIPS } from './data/seed';
import WeatherCard from './components/WeatherCard';
import AgendaView from './components/AgendaView';
import { useCheckins } from './hooks/useCheckins';
import { useAgenda } from './hooks/useAgenda';
import { useWeather } from './hooks/useWeather';
import { useWeight } from './hooks/useWeight';
import { activePeriodId } from './lib/time';
import './App.css';

const NAV = [
  { id: 'today', label: 'Today', icon: '○' },
  { id: 'progress', label: 'Progress', icon: '◎' },
  { id: 'agenda', label: 'Agenda', icon: '☐' },
];

const CHECK_BY_ID = Object.fromEntries(CHECK_DEFS.map((d) => [d.id, d]));

/*
 * Tab ✓ completion rules (v12):
 * - Today:   day closed OR all morning+night checks graded (no PENDING)
 * - Progress: start weight configured (no daily weigh-in)
 * - Agenda:  tended if zero overdue (does NOT block Close day)
 * Weather is NOT a Pass/Fail check. Agenda never blocks Close day.
 */
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

function NumberField({ id, label, unit, value, onChange, min, max, step, placeholder }) {
  return (
    <div className="number-field">
      <label htmlFor={id}>
        <span className="nf-label">{label}</span>
        <span className="nf-unit">{unit}</span>
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step={step ?? 1}
        min={min}
        max={max}
        placeholder={placeholder ?? '—'}
        value={value === '' || value == null ? '' : value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => {
          const v = e.target.value.trim();
          onChange(v === '' ? '' : v);
        }}
        aria-label={`${label} in ${unit}`}
      />
    </div>
  );
}

/** One horizontal line: label left, Pass | Fail chips right. */
function CheckRow({ def, row, setStatus }) {
  const status = row?.status || 'PENDING';
  return (
    <li id={`check-${def.id}`} className={`check-row ${statusClass(status)}`}>
      <div className="check-label">
        <strong>{def.label}</strong>
      </div>
      <div className="pf-row" role="group" aria-label={`${def.label} grade`}>
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

function PeriodCard({ part, today, setStatus, isActive, footerSlot }) {
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

      <ul className="check-list">
        {rows.map(({ def, row }) => (
          <CheckRow key={def.id} def={def} row={row} setStatus={setStatus} />
        ))}
      </ul>

      {footerSlot}
    </article>
  );
}

function DayResultCard({ stats }) {
  if (!stats?.showResults) return null;
  const passLabels = stats.passIds.map((id) => CHECK_BY_ID[id].label);
  const failLabels = stats.failIds.map((id) => CHECK_BY_ID[id].label);
  const pendingLabels = stats.pendingIds.map((id) => CHECK_BY_ID[id].label);

  if (stats.pct === 100 && stats.allGraded) {
    return (
      <section className="card day-result win" aria-live="polite">
        <div className="card-head">
          <h2>Day complete</h2>
          <span className="result-score hot">100%</span>
        </div>
        <p className="result-lead">All six locked. Protect tomorrow.</p>
      </section>
    );
  }

  return (
    <section className="card day-result graded" aria-live="polite">
      <div className="card-head">
        <h2>Day result</h2>
        <span className={`result-score ${stats.pct >= 50 ? 'mid' : 'cold'}`}>
          {stats.pct}%
        </span>
      </div>
      <p className="result-lead">
        {stats.passCount}/{stats.total} passed
        {stats.failCount ? ` · ${stats.failCount} failed` : ''}
        {stats.pendingIds.length ? ` · ${stats.pendingIds.length} open` : ''}
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
      {pendingLabels.length > 0 && (
        <p className="result-line">
          <strong>Open:</strong> {pendingLabels.join(', ')}
        </p>
      )}
    </section>
  );
}

function ImprovementCard({ stats }) {
  if (!stats?.showResults || stats.failCount === 0) return null;
  const tips = stats.failIds.map((id) => IMPROVE_TIPS[id]).filter(Boolean);
  if (!tips.length) return null;
  return (
    <section className="card improve-card" aria-live="polite">
      <div className="card-head">
        <h2>What to work on</h2>
        <span className="card-sub">Gaps</span>
      </div>
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

function CloseDayButton({ todayStats, closed, onClose }) {
  if (closed || todayStats.allGraded) {
    return <p className="close-day-done">Day closed</p>;
  }
  const pending = todayStats.pendingIds.length;
  return (
    <div className="close-day-wrap">
      <button type="button" className="close-day-btn" onClick={onClose}>
        Close day
      </button>
      <p className="close-day-hint">
        {pending
          ? `${pending} pending — closing unlocks score`
          : 'Unlock day % and gaps'}
      </p>
    </div>
  );
}

function TodayView({
  today,
  todayPct,
  todayStats,
  setStatus,
  closeDay,
  ny,
  weather,
}) {
  const activePart = activePeriodId(ny.hour);

  return (
    <div className="view today-view">
      <header className="today-header">
        <div className="greeting-row">
          <div>
            <p className="hello">{greetingForHour(ny.hour)}, Manuel</p>
            <h1>Today</h1>
            <p className="date-line">
              {today?.label || 'Today'} · {today?.week || 'W—'}
            </p>
            {weather.metaLine ? (
              <p className="weather-meta">{weather.metaLine}</p>
            ) : null}
          </div>
          <ScorePill pct={todayPct} />
        </div>
        <p className="coach-banner">
          Faith · Health · Discipline · Family · Execution
        </p>
      </header>

      <WeatherCard
        locId={weather.locId}
        setLocId={weather.setLocId}
        data={weather.data}
        status={weather.status}
        errorMsg={weather.errorMsg}
        morningBrief={weather.morningBrief}
        refresh={weather.refresh}
      />

      {todayStats.showResults && (
        <>
          <DayResultCard stats={todayStats} />
          <ImprovementCard stats={todayStats} />
        </>
      )}

      <div className="period-stack">
        {DAY_PARTS.map((part) => (
          <PeriodCard
            key={part.id}
            part={part}
            today={today}
            setStatus={setStatus}
            isActive={activePart === part.id}
            footerSlot={
              part.id === 'night' ? (
                <CloseDayButton
                  todayStats={todayStats}
                  closed={Boolean(today?.closed)}
                  onClose={closeDay}
                />
              ) : null
            }
          />
        ))}
      </div>
    </div>
  );
}

function WeightGoalCard({ startWeight, currentWeight, setStart, setCurrent, stats }) {
  if (!stats.configured) {
    return (
      <section className="card weight-goal-card">
        <div className="card-head">
          <h2>Weight goal</h2>
          <span className="card-sub">−30 lbs</span>
        </div>
        <p className="wg-prompt">Enter your start weight to set the cut.</p>
        <NumberField
          id="weight-start"
          label="Start weight"
          unit="lbs"
          value={startWeight ?? ''}
          onChange={setStart}
          min={50}
          max={500}
          step={0.1}
          placeholder="e.g. 210"
        />
        <p className="wg-deadline muted">Deadline: {stats.deadlineLabel}</p>
      </section>
    );
  }

  const markerPct =
    stats.pct == null
      ? 0
      : Math.max(0, Math.min(100, stats.pct));

  return (
    <section className="card weight-goal-card">
      <div className="card-head">
        <h2>Weight goal</h2>
        <span className="card-sub">−{stats.cutLbs} lbs</span>
      </div>

      <p className="wg-deadline">
        Deadline: <strong>{stats.deadlineLabel}</strong>
      </p>

      <div className="wg-fields">
        <NumberField
          id="weight-start"
          label="Start"
          unit="lbs"
          value={startWeight ?? ''}
          onChange={setStart}
          min={50}
          max={500}
          step={0.1}
        />
        <NumberField
          id="weight-current"
          label="Current"
          unit="lbs"
          value={currentWeight ?? ''}
          onChange={setCurrent}
          min={50}
          max={500}
          step={0.1}
          placeholder="optional"
        />
        <div className="number-field wg-target-field">
          <label>
            <span className="nf-label">Target</span>
            <span className="nf-unit">lbs</span>
          </label>
          <div className="wg-target-value mono" aria-label={`Target ${stats.target} lbs`}>
            {stats.target}
          </div>
        </div>
      </div>

      <div className="wg-track" aria-hidden="true">
        <div className="wg-track-bar">
          <div className="wg-track-fill" style={{ width: `${markerPct}%` }} />
          {stats.current != null && (
            <span
              className="wg-track-marker"
              style={{ left: `${markerPct}%` }}
              title={`${stats.current} lbs`}
            />
          )}
        </div>
        <div className="wg-track-labels">
          <span>{stats.start}</span>
          <span className="wg-track-mid">
            {stats.current != null ? stats.current : '—'}
          </span>
          <span>{stats.target}</span>
        </div>
        <div className="wg-track-captions">
          <span>Start</span>
          <span>Current</span>
          <span>Target</span>
        </div>
      </div>

      <div className="wg-stats">
        <p>
          {stats.current == null ? (
            <>Update current when you want — no daily ritual.</>
          ) : stats.left <= 0 ? (
            <>
              <strong>Cut done</strong> · at or under target
            </>
          ) : (
            <>
              <strong>{stats.left}</strong> lbs left ·{' '}
              <strong>{stats.pct}%</strong> of {stats.cutLbs}-lb cut
            </>
          )}
        </p>
      </div>
    </section>
  );
}

function ProgressView({ weekHonesty, days, todayKey, weight }) {
  const { startWeight, currentWeight, setStart, setCurrent, stats } = weight;

  const latestReview = useMemo(() => {
    const keys = Object.keys(days).sort().reverse();
    for (const k of keys) {
      if (days[k]?.review?.ran) return days[k];
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
        <p className="date-line">Cut · honesty · north stars</p>
      </header>

      <WeightGoalCard
        startWeight={startWeight}
        currentWeight={currentWeight}
        setStart={setStart}
        setCurrent={setCurrent}
        stats={stats}
      />

      <section className="card honesty-card honesty-lite">
        <div className="card-head">
          <h2>Week honesty</h2>
          <span className={`honesty-score tone-${honestyTone}`}>
            {weekHonesty.avg == null ? '—' : `${weekHonesty.avg}%`}
          </span>
        </div>
        <p className="honesty-line">{weekHonesty.line}</p>
      </section>

      <section className="card goals-lite">
        <div className="card-head">
          <h2>Goals</h2>
          <span className="card-sub">North stars</span>
        </div>
        <ul className="goal-list goal-list-lite">
          {GOALS.map((g) => (
            <li key={g.id} className="goal-row-lite">
              <strong>{g.title}</strong>
              <span>{g.meta}</span>
            </li>
          ))}
        </ul>
        {stats.configured ? (
          <p className="goal-weight-note">
            Weight cut: {stats.start} → {stats.target} lbs · {stats.deadlineLabel}
          </p>
        ) : null}
      </section>

      {latestReview?.review?.ran && (
        <section className="card review-simple">
          <div className="card-head">
            <h2>Latest review</h2>
            <span className="card-sub">
              {latestReview.label}
              {latestReview.review.score != null
                ? ` · ${latestReview.review.score}%`
                : ''}
            </span>
          </div>
          <p className="review-body">{latestReview.review.body}</p>
        </section>
      )}

      <footer className="mos-footer">
        <p>Manuel OS · local only · v12</p>
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
    weekHonesty,
    ny,
    setStatus,
    closeDay,
  } = useCheckins();
  const weight = useWeight();
  const weather = useWeather(ny.hour);
  const agenda = useAgenda(todayKey);
  const [tab, setTab] = useState('today');
  const [focusComposer, setFocusComposer] = useState(false);

  useEffect(() => {
    if (tab !== 'agenda') setFocusComposer(false);
  }, [tab]);

  const tabDone = {
    today: Boolean(today?.closed) || Boolean(todayStats?.allGraded),
    progress: Boolean(weight.stats.configured),
    agenda: agenda.tended,
  };

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
          {tab === 'today' && (
            <TodayView
              today={today}
              todayPct={todayPct}
              todayStats={todayStats}
              setStatus={setStatus}
              closeDay={closeDay}
              ny={ny}
              weather={weather}
            />
          )}
          {tab === 'progress' && (
            <ProgressView
              weekHonesty={weekHonesty}
              days={days}
              todayKey={todayKey}
              weight={weight}
            />
          )}
          {tab === 'agenda' && (
            <AgendaView
              todayKey={todayKey}
              overdue={agenda.overdue}
              counts={agenda.counts}
              itemsForDate={agenda.itemsForDate}
              itemsForWeekDay={agenda.itemsForWeekDay}
              monthQueue={agenda.monthQueue}
              add={agenda.add}
              toggle={agenda.toggle}
              remove={agenda.remove}
              rename={agenda.rename}
              setDue={agenda.setDue}
              focusComposer={focusComposer}
            />
          )}
        </main>
      </div>

      <nav className="bottom-nav tabs-3" aria-label="Main">
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
            <span className="nav-label">
              {n.label}
              {tabDone[n.id] ? (
                <span className="nav-check" aria-label="completed">
                  {' '}
                  ✓
                </span>
              ) : null}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}

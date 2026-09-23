import { useEffect, useMemo, useState } from 'react';
import {
  CHECK_DEFS,
  DAY_PARTS,
  GOALS,
  IMPROVE_TIPS,
  STREAKS,
} from './data/seed';
import WeatherCard from './components/WeatherCard';
import AgendaView from './components/AgendaView';
import { useCheckins } from './hooks/useCheckins';
import { useAgenda } from './hooks/useAgenda';
import { useWeather } from './hooks/useWeather';
import { useWeight } from './hooks/useWeight';
import { activePeriodId, formatDayLabel } from './lib/time';
import './App.css';

const NAV = [
  { id: 'today', label: 'Today', icon: '○' },
  { id: 'progress', label: 'Progress', icon: '◎' },
  { id: 'agenda', label: 'Agenda', icon: '☐' },
];

const CHECK_BY_ID = Object.fromEntries(CHECK_DEFS.map((d) => [d.id, d]));

/*
 * Tab ✓ completion rules (v11):
 * - Today:   day closed OR all morning+night checks graded (no PENDING)
 * - Progress: today’s weight logged (morning weigh-in done)
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

/** Compact weight row: label left, input right (same pattern as checks). */
function WeightRow({ id, value, onChange }) {
  return (
    <div className="check-row weight-row">
      <div className="check-label">
        <strong>Weight</strong>
        <span className="target">lbs</span>
      </div>
      <input
        id={id}
        className="weight-inline"
        type="number"
        inputMode="decimal"
        step={0.1}
        min={50}
        max={500}
        placeholder="—"
        value={value === '' || value == null ? '' : value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => {
          const v = e.target.value.trim();
          onChange(v === '' ? '' : v);
        }}
        aria-label="Weight in lbs"
      />
    </div>
  );
}

function NumberField({ id, label, unit, value, onChange, min, max, step }) {
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
        placeholder="—"
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

function PeriodCard({
  part,
  today,
  setStatus,
  isActive,
  weightSlot,
  footerSlot,
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

      <ul className="check-list">
        {rows.map(({ def, row }) => (
          <CheckRow key={def.id} def={def} row={row} setStatus={setStatus} />
        ))}
      </ul>

      {weightSlot}

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
  todayKey,
  weather,
}) {
  const { todayWeight, setTodayWeight } = useWeight(todayKey);
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
            weightSlot={
              part.id === 'morning' ? (
                <WeightRow
                  id="weight-morning"
                  value={todayWeight}
                  onChange={setTodayWeight}
                />
              ) : null
            }
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

function WeightTrend({ recent, trend }) {
  if (!recent.length) {
    return (
      <p className="weight-empty">
        No weight logged yet. Add it on Today → Morning.
      </p>
    );
  }
  const max = Math.max(...recent.map((r) => r.lbs));
  const min = Math.min(...recent.map((r) => r.lbs));
  const span = Math.max(max - min, 1);
  return (
    <div className="weight-trend">
      {trend && (
        <p className="weight-delta">
          {trend.delta === 0
            ? 'Flat across recent entries'
            : trend.delta < 0
              ? `Down ${Math.abs(trend.delta)} lbs across ${trend.days} entries`
              : `Up ${trend.delta} lbs across ${trend.days} entries`}
        </p>
      )}
      <ul className="weight-history">
        {recent.map((r) => {
          const bar = 20 + ((r.lbs - min) / span) * 48;
          return (
            <li key={r.key}>
              <span className="wh-date">{formatDayLabel(r.key)}</span>
              <span
                className="wh-bar"
                style={{ height: `${bar}px` }}
                title={`${r.lbs} lbs`}
              />
              <span className="wh-lbs mono">{r.lbs}</span>
            </li>
          );
        })}
      </ul>
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
  const { todayWeight, setTodayWeight, recent, trend } = useWeight(todayKey);

  const strip = useMemo(
    () =>
      weekStrip.map((d) => {
        const pct = d.key === todayKey ? todayPct : weekPcts[d.key] ?? d.pct;
        const empty = pct == null && !d.today && !days[d.key];
        return { ...d, pct, empty };
      }),
    [weekStrip, weekPcts, todayPct, todayKey, days],
  );

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
          <h2>Weight</h2>
          <span className="card-sub">Morning · lbs</span>
        </div>
        <NumberField
          id="weight-progress"
          label="Today"
          unit="lbs"
          value={todayWeight}
          onChange={setTodayWeight}
          min={50}
          max={500}
          step={0.1}
        />
        <WeightTrend recent={recent} trend={trend} />
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
        <p>Manuel OS · local only · v11</p>
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
    closeDay,
  } = useCheckins();
  const { todayWeight } = useWeight(todayKey);
  const weather = useWeather(ny.hour);
  const agenda = useAgenda(todayKey);
  const [tab, setTab] = useState('today');
  const [focusComposer, setFocusComposer] = useState(false);

  useEffect(() => {
    if (tab !== 'agenda') setFocusComposer(false);
  }, [tab]);

  /*
   * Tab ✓ rules (see top-of-file comment):
   * Today    → closed OR all checks graded
   * Progress → weight logged today
   * Agenda   → zero overdue (never blocks Close day)
   */
  const tabDone = {
    today: Boolean(today?.closed) || Boolean(todayStats?.allGraded),
    progress:
      todayWeight !== '' &&
      todayWeight != null &&
      Number.isFinite(Number(todayWeight)),
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
              todayKey={todayKey}
              weather={weather}
            />
          )}
          {tab === 'progress' && (
            <ProgressView
              days={days}
              weekPcts={weekPcts}
              todayPct={todayPct}
              weekStrip={weekStrip}
              weekHonesty={weekHonesty}
              todayKey={todayKey}
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

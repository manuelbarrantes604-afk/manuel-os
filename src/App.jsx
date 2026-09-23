import { useMemo, useState } from 'react';
import {
  CHECK_DEFS,
  DAY_PARTS,
  GOALS,
  IMPROVE_TIPS,
  STREAKS,
} from './data/seed';
import { useCalories } from './hooks/useCalories';
import { useCheckins } from './hooks/useCheckins';
import { useWeight } from './hooks/useWeight';
import {
  activePeriodId,
  formatDayLabel,
  getNextUp,
} from './lib/time';
import { buildWeeklyReport } from './lib/weeklyCoach';
import './App.css';

const NAV = [
  { id: 'today', label: 'Today', icon: '☀️' },
  { id: 'progress', label: 'Progress', icon: '📈' },
  { id: 'weekly', label: 'Weekly', icon: '🪞' },
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

function NumberField({ id, label, unit, value, onChange, min, max, step, hint }) {
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
      {hint ? <p className="nf-hint">{hint}</p> : null}
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
  weightSlot,
  caloriesSlot,
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

      {weightSlot}
      {caloriesSlot}

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
        <p className="result-lead">
          All five non-negotiables locked. Protect tomorrow&apos;s morning.
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
        <span className={`result-score ${stats.pct >= 50 ? 'mid' : 'cold'}`}>
          {stats.pct}%
        </span>
      </div>
      <p className="result-lead">
        {stats.passCount}/{stats.total} passed
        {stats.failCount ? ` · ${stats.failCount} failed` : ''}
        {stats.pendingIds.length ? ` · ${stats.pendingIds.length} still open` : ''}
        . Honesty first.
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
        <span className="card-sub">Gaps · Faith · Health · Family</span>
      </div>
      <p className="improve-lead">
        Day is closed. Fix these for tomorrow — actions, not pep talk.
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

function CloseDayButton({ todayStats, closed, onClose }) {
  if (closed || todayStats.allGraded) {
    return <p className="close-day-done">Day closed · results above</p>;
  }
  const pending = todayStats.pendingIds.length;
  return (
    <div className="close-day-wrap">
      <button type="button" className="close-day-btn" onClick={onClose}>
        Close day
      </button>
      <p className="close-day-hint">
        {pending
          ? `${pending} still pending — closing unlocks score & gaps`
          : 'Unlock day % and what to work on'}
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
}) {
  const { todayWeight, setTodayWeight } = useWeight(todayKey);
  const { todayCalories, setTodayCalories } = useCalories(todayKey);

  const nextUp = useMemo(
    () => getNextUp(today?.checks || {}, ny.hour, ny.minute),
    [today, ny.hour, ny.minute],
  );
  const activePart = activePeriodId(ny.hour);
  const dayClosed = Boolean(today?.closed) || todayStats.allGraded;

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
          </div>
          <ScorePill pct={todayPct} />
        </div>
        <p className="coach-banner">
          Faith. Health. Discipline. Family. Execution — not intentions.
        </p>
        <NextUpCard
          nextUp={
            dayClosed
              ? { id: null, closed: true, label: 'Day closed — see result below' }
              : nextUp
          }
        />
      </header>

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
            nextCheckId={dayClosed || nextUp.closed ? null : nextUp.id}
            weightSlot={
              part.id === 'morning' ? (
                <NumberField
                  id="weight-morning"
                  label="Weight"
                  unit="lbs · morning"
                  value={todayWeight}
                  onChange={setTodayWeight}
                  min={50}
                  max={500}
                  step={0.1}
                  hint="Step on the scale. Log it."
                />
              ) : null
            }
            caloriesSlot={
              part.id === 'night' ? (
                <NumberField
                  id="calories-night"
                  label="Total calories eaten"
                  unit="kcal · from Cal AI"
                  value={todayCalories}
                  onChange={setTodayCalories}
                  min={0}
                  max={20000}
                  step={1}
                  hint="Type the Cal AI total. No Pass/Fail — the number is the log."
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

function CalorieTrend({ recent }) {
  if (!recent.length) {
    return (
      <p className="weight-empty">
        No calories logged yet. Add the Cal AI total on Today → Night.
      </p>
    );
  }
  const max = Math.max(...recent.map((r) => r.kcal));
  const min = Math.min(...recent.map((r) => r.kcal));
  const span = Math.max(max - min, 1);
  return (
    <div className="weight-trend">
      <ul className="weight-history">
        {recent.map((r) => {
          const bar = 20 + ((r.kcal - min) / span) * 48;
          return (
            <li key={r.key}>
              <span className="wh-date">{formatDayLabel(r.key)}</span>
              <span
                className="wh-bar cal-bar"
                style={{ height: `${bar}px` }}
                title={`${r.kcal} kcal`}
              />
              <span className="wh-lbs mono">{r.kcal}</span>
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
  const { recent: calRecent } = useCalories(todayKey);

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
          <span className="card-sub">Morning habit · lbs</span>
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
          <h2>Calories</h2>
          <span className="card-sub">Night log · kcal from Cal AI</span>
        </div>
        <CalorieTrend recent={calRecent} />
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
        <p>Manuel OS · local only · v7</p>
      </footer>
    </div>
  );
}

function WeeklyView({ days, weekStrip, weekPcts, todayKey, todayPct }) {
  const { weights } = useWeight(todayKey);
  const { calories } = useCalories(todayKey);

  const weekDays = useMemo(
    () =>
      weekStrip.map((d) => {
        const day = days[d.key];
        const pct = d.key === todayKey ? todayPct : weekPcts[d.key] ?? null;
        return {
          key: d.key,
          dow: d.dow,
          today: d.today,
          checks: day?.checks || {},
          pct,
          closed: Boolean(day?.closed),
        };
      }),
    [weekStrip, days, weekPcts, todayKey, todayPct],
  );

  const report = useMemo(
    () => buildWeeklyReport(weekDays, { weights, calories }),
    [weekDays, weights, calories],
  );

  const avgTone =
    report.avg == null
      ? 'muted'
      : report.avg >= 80
        ? 'hot'
        : report.avg >= 50
          ? 'mid'
          : 'cold';

  return (
    <div className="view weekly-view">
      <header className="progress-header">
        <h1>Weekly</h1>
        <p className="date-line">The harder mirror · no flattery</p>
      </header>

      <section className="card honesty-card">
        <div className="card-head">
          <h2>Week performance</h2>
          <span className="card-sub">
            {report.gradedCount
              ? `${report.gradedCount} graded · Mon–Sun`
              : 'No graded days yet'}
          </span>
        </div>
        <div className={`honesty-score tone-${avgTone}`}>
          {report.avg == null ? '—' : `${report.avg}%`}
        </div>
        <p className="honesty-line">
          Morning {report.morningRate == null ? '—' : `${report.morningRate}%`}
          {' · '}
          Night {report.nightRate == null ? '—' : `${report.nightRate}%`}
        </p>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Day strip</h2>
          <span className="card-sub">This week</span>
        </div>
        <div className="week-strip" role="list">
          {weekDays.map((d) => (
            <div
              key={d.key}
              className={`day-cell ${d.today ? 'today' : ''} ${d.pct == null ? 'empty' : ''}`}
              role="listitem"
            >
              <span className="dow">{d.dow}</span>
              <span className="day-pct">
                {d.pct == null ? '—' : `${d.pct}%`}
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

      {report.patterns.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>Streak / miss patterns</h2>
            <span className="card-sub">From Pass/Fail</span>
          </div>
          <ul className="pattern-list">
            {report.patterns.map((p) => (
              <li key={p.id} className={`pattern ${p.kind}`}>
                <strong>{p.label}</strong>
                <span>{p.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2>Body metrics</h2>
          <span className="card-sub">Weight · calories</span>
        </div>
        <div className="metric-grid">
          <div className="metric-tile">
            <span className="metric-kicker">Weight</span>
            <strong className="mono">
              {report.weightTrend
                ? report.weightTrend.count === 1
                  ? `${report.weightTrend.last} lbs`
                  : `${report.weightTrend.first} → ${report.weightTrend.last}`
                : '—'}
            </strong>
            <span className="metric-sub">
              {report.weightTrend
                ? report.weightTrend.count < 2
                  ? 'Need more mornings'
                  : report.weightTrend.delta === 0
                    ? 'Flat'
                    : report.weightTrend.delta < 0
                      ? `Down ${Math.abs(report.weightTrend.delta)} lbs`
                      : `Up ${report.weightTrend.delta} lbs`
                : 'No logs this week'}
            </span>
          </div>
          <div className="metric-tile">
            <span className="metric-kicker">Calories</span>
            <strong className="mono">
              {report.calorieAvg == null ? '—' : `${report.calorieAvg}`}
            </strong>
            <span className="metric-sub">
              {report.calLogged
                ? `avg kcal · ${report.calLogged} day${report.calLogged === 1 ? '' : 's'} · sum ${report.calorieSum}`
                : 'No totals typed'}
            </span>
          </div>
        </div>
      </section>

      <section className="card truth-card">
        <div className="card-head">
          <h2>Uncomfortable truth</h2>
          <span className="card-sub">Health · Faith · Family · Discipline</span>
        </div>
        <ul className="truth-list">
          {report.truths.map((t) => (
            <li key={`${t.theme}-${t.line.slice(0, 32)}`}>
              <span className="truth-theme">{t.theme}</span>
              <p>{t.line}</p>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mos-footer">
        <p>Manuel OS · weekly mirror · v7</p>
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
          {tab === 'today' && (
            <TodayView
              today={today}
              todayPct={todayPct}
              todayStats={todayStats}
              setStatus={setStatus}
              closeDay={closeDay}
              ny={ny}
              todayKey={todayKey}
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
          {tab === 'weekly' && (
            <WeeklyView
              days={days}
              weekStrip={weekStrip}
              weekPcts={weekPcts}
              todayKey={todayKey}
              todayPct={todayPct}
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
            <span className="nav-label">{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

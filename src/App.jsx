import { useEffect, useMemo, useState } from 'react';
import { CHECK_DEFS, DAY_PARTS, GOALS, IMPROVE_TIPS } from './data/seed';
import WeatherCard from './components/WeatherCard';
import AgendaView from './components/AgendaView';
import { useCheckins } from './hooks/useCheckins';
import { useAgenda } from './hooks/useAgenda';
import { useWeather } from './hooks/useWeather';
import { useWeight } from './hooks/useWeight';
import { useWeekWeight } from './hooks/useWeekWeight';
import { useStreak } from './hooks/useStreak';
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
 * - Progress: lifetime start weight configured (no daily weigh-in)
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

/** Flame icon for streak accents (inline SVG, light UI). */
function FlameIcon({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M12 2c.4 2.2-.3 3.9-1.5 5.3C9 9 7.5 10.1 7.1 12.2c-.3 1.6.2 3.1 1.3 4.2-.9-.3-1.6-1-2-1.9-.2 2.4 1 4.7 3.1 5.9 2.3 1.3 5.2 1.1 7.3-.5 2.3-1.8 3.2-4.8 2.3-7.5-.6-1.8-1.8-3.2-2.8-4.7C14.9 5.7 14 3.9 12 2zm0 7.5c.7 1.1 1.6 2.1 2.1 3.4.6 1.5.4 3.2-.7 4.4-1.1 1.2-2.9 1.5-4.4.8-1.4-.7-2.2-2.2-2-3.8.2-1.4 1.2-2.4 2.1-3.4.6-.7 1.4-1.5 2.9-1.4z"
      />
    </svg>
  );
}

/** One horizontal line: label left, Pass | Fail chips right. Neon glow on PASS. */
function CheckRow({ def, row, setStatus }) {
  const status = row?.status || 'PENDING';
  const [xpFlash, setXpFlash] = useState(false);

  useEffect(() => {
    if (!xpFlash) return undefined;
    const t = setTimeout(() => setXpFlash(false), 1000);
    return () => clearTimeout(t);
  }, [xpFlash]);

  const onPass = () => {
    const wasPass = status === 'PASS';
    setStatus(def.id, 'PASS');
    if (!wasPass) setXpFlash(true);
  };

  return (
    <li id={`check-${def.id}`} className={`check-row ${statusClass(status)}`}>
      <div className="check-label">
        <strong>{def.label}</strong>
        {xpFlash ? (
          <span className="xp-flash" aria-hidden="true">
            +10 XP
          </span>
        ) : null}
      </div>
      <div className="pf-row" role="group" aria-label={`${def.label} grade`}>
        <button
          type="button"
          className={`pf-btn pass ${status === 'PASS' ? 'selected' : ''}`}
          onClick={onPass}
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
  const passed = rows.filter((r) => r.row?.status === 'PASS').length;
  const total = rows.length;
  const meterPct = total ? Math.round((passed / total) * 100) : 0;

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
          {passed}/{total}
        </span>
      </div>

      <ul className="check-list">
        {rows.map(({ def, row }) => (
          <CheckRow key={def.id} def={def} row={row} setStatus={setStatus} />
        ))}
      </ul>

      {footerSlot}

      <div
        className="period-meter"
        role="progressbar"
        aria-valuenow={passed}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${part.title} passed ${passed} of ${total}`}
      >
        <div className="period-meter-fill" style={{ width: `${meterPct}%` }} />
      </div>
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
  streak,
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
          <div className="header-pills">
            <ScorePill pct={todayPct} />
            <span className="xp-chip" title="Lifetime XP from Pass grades">
              Lv {streak.level} · {streak.xp} XP
            </span>
          </div>
        </div>
        <div className="streak-strip" aria-label={`${streak.current} day streak`}>
          <FlameIcon className="streak-flame" />
          <strong className="streak-strip-num">{streak.current}</strong>
          <span className="streak-strip-label">day streak</span>
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

/** Live −30 cut % from lifetime start + preferred current (week end → week start → stored). */
function cutBarStats(lifetimeStart, preferredCurrent, cutLbs, deadlineLabel) {
  if (lifetimeStart == null) {
    return {
      configured: false,
      start: null,
      current: preferredCurrent,
      target: null,
      left: null,
      pct: null,
      cutLbs,
      deadlineLabel,
    };
  }
  const target = Math.round((lifetimeStart - cutLbs) * 10) / 10;
  const current = preferredCurrent;
  const lost =
    current == null ? null : Math.round((lifetimeStart - current) * 10) / 10;
  const left =
    current == null ? cutLbs : Math.round((current - target) * 10) / 10;
  const pct =
    lost == null
      ? null
      : Math.max(0, Math.min(100, Math.round((lost / cutLbs) * 100)));
  return {
    configured: true,
    start: lifetimeStart,
    current,
    target,
    left,
    pct,
    cutLbs,
    deadlineLabel,
  };
}

function WeekWeightCard({ weekWeight, weight }) {
  const { stats, setWeekStart, setWeekEnd } = weekWeight;
  const { startLbs, endLbs, lost, windowLabel } = stats;
  const {
    startWeight,
    currentWeight,
    setStart,
    setCurrent,
    stats: weightStats,
  } = weight;

  // Prefer week end → week start → stored current for the −30 bar
  const preferredCurrent =
    endLbs != null ? endLbs : startLbs != null ? startLbs : currentWeight;

  const onWeekEnd = (value) => {
    setWeekEnd(value);
    // Optionally sync lifetime "current" from week end when set
    if (startWeight != null && String(value ?? '').trim() !== '') {
      setCurrent(value);
    }
  };

  const cut = cutBarStats(
    startWeight,
    preferredCurrent,
    weightStats.cutLbs,
    weightStats.deadlineLabel,
  );

  let reductionLine = 'Set end Friday';
  let reductionTone = 'muted';
  if (startLbs != null && endLbs != null && lost != null) {
    if (lost > 0) {
      reductionLine = `−${lost.toFixed(1)} lbs this week`;
      reductionTone = 'hot';
    } else if (lost < 0) {
      reductionLine = `+${Math.abs(lost).toFixed(1)} lbs this week`;
      reductionTone = 'cold';
    } else {
      reductionLine = '0.0 lbs this week';
      reductionTone = 'mid';
    }
  } else if (startLbs == null && endLbs == null) {
    reductionLine = 'Set start & end Friday';
  } else if (startLbs == null) {
    reductionLine = 'Set start Friday';
  }

  const markerPct = cut.pct == null ? 0 : Math.max(0, Math.min(100, cut.pct));

  let cutLine = null;
  if (!cut.configured) {
    cutLine = null; // prompt is the compact field
  } else if (cut.current == null) {
    cutLine = 'Set end or start Friday for live cut %';
  } else if (cut.left <= 0) {
    cutLine = (
      <>
        <strong>Cut done</strong> · at or under target
      </>
    );
  } else {
    cutLine = (
      <>
        <strong>{cut.left}</strong> lbs left · <strong>{cut.pct}%</strong> of{' '}
        {cut.cutLbs}-lb cut
      </>
    );
  }

  return (
    <section className="card week-weight-card">
      <div className="card-head">
        <h2>This week weight</h2>
        <span className="card-sub">Fri → Fri</span>
      </div>
      <p className="ww-window">{windowLabel}</p>
      <div className="ww-fields">
        <NumberField
          id="week-weight-start"
          label="Start Friday"
          unit="lbs"
          value={startLbs ?? ''}
          onChange={setWeekStart}
          min={50}
          max={500}
          step={0.1}
          placeholder="—"
        />
        <NumberField
          id="week-weight-end"
          label="End Friday"
          unit="lbs"
          value={endLbs ?? ''}
          onChange={onWeekEnd}
          min={50}
          max={500}
          step={0.1}
          placeholder="—"
        />
      </div>
      <p className={`ww-reduction tone-${reductionTone}`}>{reductionLine}</p>

      <div className="ww-cut">
        <div className="ww-cut-head">
          <span className="ww-cut-title">−{weightStats.cutLbs} lb cut</span>
          <span className="ww-cut-deadline muted">{weightStats.deadlineLabel}</span>
        </div>

        {!cut.configured && (
          <NumberField
            id="lifetime-start-weight"
            label="Start weight (for −30 cut)"
            unit="lbs"
            value={startWeight ?? ''}
            onChange={setStart}
            min={50}
            max={500}
            step={0.1}
            placeholder="e.g. 210"
          />
        )}

        {cut.configured && (
          <>
            <div className="wg-track" aria-hidden="true">
              <div className="wg-track-bar">
                <div className="wg-track-fill" style={{ width: `${markerPct}%` }} />
                {cut.current != null && (
                  <span
                    className="wg-track-marker"
                    style={{ left: `${markerPct}%` }}
                    title={`${cut.current} lbs`}
                  />
                )}
              </div>
              <div className="wg-track-labels">
                <span>{cut.start}</span>
                <span>{cut.target}</span>
              </div>
              <div className="wg-track-captions">
                <span>Start</span>
                <span>Target</span>
              </div>
            </div>
            <div className="wg-stats">
              <p>{cutLine}</p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function ProgressView({ weekHonesty, days, todayKey, weight, weekWeight, streak }) {
  const { startWeight, currentWeight, stats: weightStats } = weight;
  const { startLbs, endLbs } = weekWeight.stats;

  const preferredCurrent =
    endLbs != null ? endLbs : startLbs != null ? startLbs : currentWeight;
  const cut = cutBarStats(
    startWeight,
    preferredCurrent,
    weightStats.cutLbs,
    weightStats.deadlineLabel,
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
        <div className="greeting-row">
          <div>
            <h1>Progress</h1>
            <p className="date-line">Streak · honesty · week cut · goals</p>
          </div>
          <span className="xp-chip" title="Lifetime XP from Pass grades">
            Lv {streak.level} · {streak.xp} XP
          </span>
        </div>
      </header>

      <section className="card streak-hero" aria-label="Your streak">
        <div className="streak-hero-top">
          <FlameIcon className="streak-flame streak-flame-lg" />
          <div className="streak-hero-num">{streak.current}</div>
          <p className="streak-hero-label">Day streak</p>
        </div>
        <div className="streak-hero-stats">
          <div className="streak-stat">
            <strong>{streak.longest}</strong>
            <span>Longest streak</span>
          </div>
          <div className="streak-stat-divider" aria-hidden="true" />
          <div className="streak-stat">
            <strong>{streak.lastActivityLabel}</strong>
            <span>Last activity</span>
          </div>
        </div>
      </section>

      <section className="card streak-rules-card">
        <div className="card-head">
          <h2>What counts as a streak?</h2>
        </div>
        <ul className="streak-rules-list">
          <li>
            <span className="streak-rule-mark" aria-hidden="true">
              ✓
            </span>
            <span>Wake 5:00 Pass</span>
          </li>
          <li>
            <span className="streak-rule-mark" aria-hidden="true">
              ✓
            </span>
            <span>Leave 5:30 Pass</span>
          </li>
          <li>
            <span className="streak-rule-mark" aria-hidden="true">
              ✓
            </span>
            <span>Exercise 6:00 Pass</span>
          </li>
        </ul>
        <p className="streak-rules-copy">
          All three must Pass. Miss a day and the streak resets to zero.
        </p>
      </section>

      <section className="card honesty-card">
        <div className="card-head">
          <h2>Week honesty</h2>
          <span className={`honesty-score tone-${honestyTone}`}>
            {weekHonesty.avg == null ? '—' : `${weekHonesty.avg}%`}
          </span>
        </div>
        <p className="honesty-line">{weekHonesty.line}</p>
      </section>

      <WeekWeightCard weekWeight={weekWeight} weight={weight} />

      <section className="card goals-card">
        <div className="card-head">
          <h2>Goals</h2>
          <span className="card-sub">North stars</span>
        </div>
        <ul className="goal-list">
          {GOALS.map((g) => {
            const pct =
              g.id === 'lbs' && cut.pct != null ? cut.pct : g.progress;
            return (
              <li key={g.id} className="goal-row">
                <div className="goal-copy">
                  <strong>{g.title}</strong>
                  <span>{g.meta}</span>
                </div>
                <span className="goal-pct">{pct}%</span>
                <div className="goal-meter" aria-hidden="true">
                  <div className="goal-fill" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card streak-cal-card" aria-label="Last 14 days">
        <div className="card-head">
          <h2>Last 14 days</h2>
          <span className="card-sub">Morning stack</span>
        </div>
        <div className="streak-cal">
          {streak.calendar.map((d) => (
            <div
              key={d.key}
              className={`streak-cal-cell${d.earned ? ' earned' : ''}${d.today ? ' today' : ''}`}
              title={`${d.key}${d.earned ? ' · earned' : ' · miss'}`}
            >
              <span className="streak-cal-dow">{d.dow}</span>
              {d.earned ? (
                <FlameIcon className="streak-flame streak-flame-sm" />
              ) : (
                <span className="streak-cal-dot" aria-hidden="true" />
              )}
            </div>
          ))}
        </div>
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
        <p>Manuel OS · local only · v15</p>
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
  const streak = useStreak(days, todayKey);
  const weight = useWeight();
  const weekWeight = useWeekWeight(todayKey);
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
              streak={streak}
            />
          )}
          {tab === 'progress' && (
            <ProgressView
              weekHonesty={weekHonesty}
              days={days}
              todayKey={todayKey}
              weight={weight}
              weekWeight={weekWeight}
              streak={streak}
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

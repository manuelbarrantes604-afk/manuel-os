import { useEffect, useState } from 'react';
import { CHECK_DEFS, DAY_PARTS, IMPROVE_TIPS } from './data/seed';
import WeatherCard from './components/WeatherCard';
import AgendaView from './components/AgendaView';
import { useCheckins } from './hooks/useCheckins';
import { useAgenda } from './hooks/useAgenda';
import { useWeather } from './hooks/useWeather';
import { useWeekWeight } from './hooks/useWeekWeight';
import { useStreak } from './hooks/useStreak';
import { activePeriodId } from './lib/time';
import './App.css';

const NAV = [
  { id: 'agenda', label: 'Agenda', icon: '☐' },
  { id: 'today', label: 'Today', icon: '○' },
  { id: 'progress', label: 'Progress', icon: '◎' },
];

const CHECK_BY_ID = Object.fromEntries(CHECK_DEFS.map((d) => [d.id, d]));

/*
 * Tab ✓ completion rules (v12):
 * - Today:   day closed OR all morning+night checks graded (no PENDING)
 * - Progress: week start or end weight entered (Fri→Fri)
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
        {pending ? `${pending} open` : 'Locks score'}
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
        <p className="coach-banner">Faith · Health · Discipline · Family</p>
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

function WeekWeightCard({ weekWeight }) {
  const { stats, setWeekStart, setWeekEnd } = weekWeight;
  const { startLbs, endLbs, lost, windowLabel } = stats;

  let changeLine = '—';
  let changeTone = 'muted';
  if (startLbs != null && endLbs != null && lost != null) {
    if (lost > 0) {
      changeLine = `−${lost.toFixed(1)} lbs`;
      changeTone = 'hot';
    } else if (lost < 0) {
      changeLine = `+${Math.abs(lost).toFixed(1)} lbs`;
      changeTone = 'cold';
    } else {
      changeLine = '0.0 lbs';
      changeTone = 'mid';
    }
  }

  return (
    <section className="card week-weight-card">
      <div className="card-head">
        <h2>Week weight</h2>
        <span className="card-sub">Fri → Fri</span>
      </div>
      {windowLabel ? <p className="ww-window">{windowLabel}</p> : null}
      <div className="ww-fields">
        <NumberField
          id="week-weight-start"
          label="Start"
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
          label="End"
          unit="lbs"
          value={endLbs ?? ''}
          onChange={setWeekEnd}
          min={50}
          max={500}
          step={0.1}
          placeholder="—"
        />
      </div>
      <p className={`ww-reduction tone-${changeTone}`}>{changeLine}</p>
    </section>
  );
}

function ProgressView({ weekHonesty, weekWeight, streak }) {
  const honestyTone =
    weekHonesty.avg == null
      ? 'muted'
      : weekHonesty.avg >= 80
        ? 'hot'
        : weekHonesty.avg >= 50
          ? 'mid'
          : 'cold';

  const stick =
    weekHonesty.avg == null ? '—' : `${weekHonesty.avg}%`;

  return (
    <div className="view progress-view">
      <header className="progress-header">
        <div className="greeting-row">
          <div>
            <h1>Progress</h1>
            <p className="date-line">Stay consistent · habit scoreboard</p>
          </div>
        </div>
      </header>

      <section className="card habit-scoreboard" aria-label="Habit consistency">
        <div className="habit-score-grid">
          <div className="habit-score">
            <FlameIcon className="streak-flame" />
            <strong>{streak.current}</strong>
            <span>Current streak</span>
          </div>
          <div className="habit-score">
            <strong>{streak.longest}</strong>
            <span>Longest</span>
          </div>
          <div className="habit-score">
            <strong className={`tone-${honestyTone}`}>{stick}</strong>
            <span>Week stick</span>
          </div>
        </div>
        <p className="habit-earn-line">
          Streak = wake + leave + exercise Pass. Miss resets to 0.
        </p>
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

      <WeekWeightCard weekWeight={weekWeight} />

      <footer className="mos-footer">
        <p>Manuel OS · local · v18</p>
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
  const weekWeight = useWeekWeight(todayKey);
  const weather = useWeather(ny.hour);
  const agenda = useAgenda(todayKey);
  const [tab, setTab] = useState('agenda');
  const [focusComposer, setFocusComposer] = useState(false);

  useEffect(() => {
    if (tab !== 'agenda') setFocusComposer(false);
  }, [tab]);

  const tabDone = {
    today: Boolean(today?.closed) || Boolean(todayStats?.allGraded),
    progress: Boolean(
      weekWeight.stats.startLbs != null || weekWeight.stats.endLbs != null,
    ),
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
              restore={agenda.restore}
              getItem={agenda.getItem}
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

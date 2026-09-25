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
import { iconForCheck } from './lib/tiimoIcons';
import './App.css';

const NAV = [
  { id: 'agenda', label: 'Agenda', icon: '☰' },
  { id: 'today', label: 'Today', icon: '◉' },
  { id: 'progress', label: 'Progress', icon: '▦' },
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

/** Tiimo-style row: pastel icon · title · circular Pass check · soft Fail. */
function CheckRow({ def, row, setStatus }) {
  const status = row?.status || 'PENDING';
  const [xpFlash, setXpFlash] = useState(false);
  const icon = iconForCheck(def.id);

  useEffect(() => {
    if (!xpFlash) return undefined;
    const t = setTimeout(() => setXpFlash(false), 1000);
    return () => clearTimeout(t);
  }, [xpFlash]);

  const onPassToggle = () => {
    if (status === 'PASS') {
      setStatus(def.id, 'PENDING');
      return;
    }
    setStatus(def.id, 'PASS');
    setXpFlash(true);
  };

  return (
    <li id={`check-${def.id}`} className={`tiimo-task check-row ${statusClass(status)}`}>
      <span
        className="tiimo-icon"
        style={{ background: icon.bg, width: 40, height: 40, fontSize: 17 }}
        aria-hidden="true"
      >
        {icon.emoji}
      </span>
      <div className="tiimo-task-main check-label">
        <strong className="tiimo-task-title">{def.label}</strong>
        {def.target ? <span className="tiimo-task-sub">{def.target}</span> : null}
        {xpFlash ? (
          <span className="xp-flash" aria-hidden="true">
            +10 XP
          </span>
        ) : null}
      </div>
      <div className="tiimo-check-cluster" role="group" aria-label={`${def.label} grade`}>
        <button
          type="button"
          className={`tiimo-fail-soft ${status === 'FAIL' ? 'selected' : ''}`}
          onClick={() => setStatus(def.id, status === 'FAIL' ? 'PENDING' : 'FAIL')}
          aria-pressed={status === 'FAIL'}
          aria-label="Fail"
          title="Fail"
        >
          ✕
        </button>
        <button
          type="button"
          className={`tiimo-check ${status === 'PASS' ? 'on' : ''}`}
          onClick={onPassToggle}
          aria-pressed={status === 'PASS'}
          aria-label={status === 'PASS' ? 'Clear pass' : 'Pass'}
        >
          {status === 'PASS' ? '✓' : ''}
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
  const glyph = part.id === 'night' ? '☾' : '☀';
  const label = part.id === 'night' ? 'NIGHT' : 'MORNING';

  return (
    <article
      className={`tiimo-period period-card ${isActive ? 'period-active' : ''} open`}
      id={`period-${part.id}`}
    >
      <div className="tiimo-period-head static">
        <div className="tiimo-period-toggle" role="heading" aria-level={2}>
          <span className="tiimo-period-glyph" aria-hidden="true">
            {glyph}
          </span>
          <span className="tiimo-period-label">
            {label} ({passed}/{total})
          </span>
          {isActive ? <span className="now-badge">Now</span> : null}
        </div>
      </div>
      <p className="coach-line tiimo-coach">{part.coachLine}</p>
      <ul className="check-list tiimo-task-list">
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
      <header className="today-header tiimo-today-header">
        <div className="tiimo-topbar">
          <div className="tiimo-chips">
            <span className="tiimo-streak-chip" title="Day streak">
              <span aria-hidden="true">🔥</span> {streak.current}
            </span>
            <span className="tiimo-xp-chip" title="Lifetime XP">
              ✦ {streak.xp}
            </span>
            <ScorePill pct={todayPct} />
          </div>
        </div>
        <div className="tiimo-day-head">
          <h1 className="tiimo-day-title">Today</h1>
          <span className="tiimo-month-link static">
            {today?.label || 'Today'}
          </span>
        </div>
        <p className="hello">{greetingForHour(ny.hour)}, Manuel</p>
        {weather.metaLine ? (
          <p className="weather-meta">{weather.metaLine}</p>
        ) : null}
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

function shortHabitLabel(label) {
  const map = {
    'Wake 5:00': 'Wake',
    'Leave 5:30': 'Leave',
    'Exercise 6:00': 'Exercise',
    '1hr AI': 'AI hour',
    'Cal AI review': 'Cal AI',
    'Family time': 'Family',
  };
  return map[label] || label;
}

function ProgressView({ weekHonesty, weekWeight, streak, habitInsights }) {
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

  const rates = habitInsights?.thisRates || [];
  const compareLine = (() => {
    const a = habitInsights?.thisAvg;
    const b = habitInsights?.lastAvg;
    if (a == null && b == null) return null;
    if (a == null) return `Last week stick ${b}% · this week still opening`;
    if (b == null) return `This week stick ${a}% · no graded days last week`;
    const delta = a - b;
    if (delta === 0) return `This week ${a}% · even with last week`;
    if (delta > 0) return `This week ${a}% · +${delta} vs last week`;
    return `This week ${a}% · ${delta} vs last week`;
  })();

  const patternLine = (() => {
    const best = habitInsights?.best;
    const worst = habitInsights?.worst;
    if (!best || !worst || best.key === worst.key) return null;
    const fmt = (key) => {
      const [, m, d] = key.split('-');
      return `${Number(m)}/${Number(d)}`;
    };
    return `Best ${fmt(best.key)} (${best.pct}%) · softest ${fmt(worst.key)} (${worst.pct}%)`;
  })();

  return (
    <div className="view progress-view">
      <header className="progress-header tiimo-progress-header">
        <div className="tiimo-topbar">
          <div className="tiimo-chips">
            <span className="tiimo-streak-chip" title="Day streak">
              <span aria-hidden="true">🔥</span> {streak.current}
            </span>
            <span className="tiimo-xp-chip" title="Lifetime XP">
              ✦ {streak.xp}
            </span>
          </div>
        </div>
        <div className="tiimo-day-head">
          <h1 className="tiimo-day-title">Progress</h1>
          <span className="tiimo-month-link static">Habits</span>
        </div>
        <p className="date-line">Stay consistent · habit scoreboard</p>
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
              <span className="streak-cal-num">{d.dayNum}</span>
              {d.earned ? (
                <FlameIcon className="streak-flame streak-flame-sm" />
              ) : (
                <span className="streak-cal-dot" aria-hidden="true" />
              )}
            </div>
          ))}
        </div>
      </section>

      {rates.some((r) => r.graded > 0) ? (
        <section className="card" aria-label="Habit stick rates">
          <div className="card-head">
            <h2>This week by habit</h2>
            <span className="card-sub">Stick %</span>
          </div>
          <div className="habit-rates">
            {rates.map((r) => {
              const tone =
                r.pct == null ? '' : r.pct >= 80 ? '' : r.pct >= 50 ? 'mid' : 'cold';
              return (
                <div key={r.id} className="habit-rate-row">
                  <span className="habit-rate-label">{shortHabitLabel(r.label)}</span>
                  <span className="habit-rate-meta">
                    {r.pct == null ? '—' : `${r.pct}%`}
                  </span>
                  <div className="habit-rate-track" aria-hidden="true">
                    <div
                      className={`habit-rate-fill ${tone}`}
                      style={{ width: `${r.pct ?? 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {compareLine || patternLine || habitInsights?.tip ? (
        <section className="card" aria-label="Consistency notes">
          <div className="card-head">
            <h2>Consistency</h2>
            <span className="card-sub">Signals</span>
          </div>
          {compareLine ? <p className="habit-compare">{compareLine}</p> : null}
          {patternLine ? <p className="habit-compare">{patternLine}</p> : null}
          {habitInsights?.tip ? <p className="habit-tip">{habitInsights.tip}</p> : null}
        </section>
      ) : null}

      <WeekWeightCard weekWeight={weekWeight} />

      <footer className="mos-footer">
        <p>Manuel OS · local · v20</p>
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
    habitInsights,
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
              habitInsights={habitInsights}
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
              setPeriod={agenda.setPeriod}
              focusComposer={focusComposer}
              streak={streak}
            />
          )}
        </main>
      </div>

      <nav className="bottom-nav tabs-3 tiimo-nav" aria-label="Main">
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

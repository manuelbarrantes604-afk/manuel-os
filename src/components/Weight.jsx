import { useEffect, useMemo, useRef, useState } from 'react';
import { fmtDelta, fmtLbs, parseLbs } from '../hooks/useDailyWeight';

function fmtAt(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

/** Today: one weigh-in row (morning or night). Decimal keypad on iPhone. */
export function WeightEntry({ slot, entry, compareTo, onSave }) {
  const isAm = slot === 'am';
  const label = isAm ? 'Morning weight' : 'Night weight';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const inputRef = useRef(null);
  const logged = entry && typeof entry.lbs === 'number';

  useEffect(() => {
    if (editing) requestAnimationFrame(() => inputRef.current?.focus());
  }, [editing]);

  const startEdit = () => {
    setDraft(logged ? String(entry.lbs) : '');
    setError(false);
    setConfirmClear(false);
    setEditing(true);
  };

  const commit = () => {
    const v = parseLbs(draft);
    if (v === undefined) {
      setError(true);
      return;
    }
    if (v == null) {
      setEditing(false);
      return;
    }
    onSave(slot, String(v));
    setEditing(false);
  };

  const delta =
    !isAm && logged && compareTo && typeof compareTo.lbs === 'number'
      ? Math.round((entry.lbs - compareTo.lbs) * 10) / 10
      : null;

  return (
    <div className={`weight-entry ${logged ? 'logged' : ''} ${editing ? 'editing' : ''}`} id={`weight-${slot}`}>
      <span className="tiimo-icon weight-icon" style={{ background: isAm ? 'var(--pastel-sky)' : 'var(--pastel-lilac)' }} aria-hidden="true">
        ⚖️
      </span>
      {editing ? (
        <form
          className="weight-form"
          onSubmit={(e) => {
            e.preventDefault();
            commit();
          }}
        >
          <label className="weight-label" htmlFor={`weight-input-${slot}`}>
            {label}
          </label>
          <div className="weight-input-row">
            <div className={`weight-input-wrap ${error ? 'error' : ''}`}>
              <input
                id={`weight-input-${slot}`}
                ref={inputRef}
                className="weight-input"
                type="text"
                inputMode="decimal"
                enterKeyHint="done"
                autoComplete="off"
                placeholder="000.0"
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value.replace(/[^0-9.,]/g, ''));
                  setError(false);
                }}
                aria-invalid={error}
              />
              <span className="weight-unit">lb</span>
            </div>
            <button type="button" className="proof-mini-btn" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button type="submit" className="weight-save">
              Save
            </button>
          </div>
          {error ? <span className="weight-error">Enter a weight like 182.4</span> : null}
        </form>
      ) : logged ? (
        <>
          <button type="button" className="weight-main" onClick={startEdit} aria-label={`${label} ${fmtLbs(entry.lbs)} pounds. Tap to edit`}>
            <span className="weight-label">{label}</span>
            <strong className="weight-value">
              {fmtLbs(entry.lbs)} <span className="weight-unit-inline">lb</span>
            </strong>
            <span className="weight-meta">
              {entry.legacy ? 'From earlier log' : fmtAt(entry.at) ? `Logged ${fmtAt(entry.at)}` : 'Logged'}
              {delta != null ? ` · ${fmtDelta(delta)} vs morning` : ''}
            </span>
          </button>
          {confirmClear ? (
            <div className="weight-actions">
              <button type="button" className="proof-mini-btn" onClick={() => setConfirmClear(false)}>
                Keep
              </button>
              <button
                type="button"
                className="proof-mini-btn danger"
                onClick={() => {
                  setConfirmClear(false);
                  onSave(slot, '');
                }}
              >
                Clear
              </button>
            </div>
          ) : (
            <div className="weight-actions">
              <button type="button" className="proof-mini-btn" onClick={startEdit}>
                Edit
              </button>
              <button type="button" className="proof-mini-btn ghost" onClick={() => setConfirmClear(true)} aria-label={`Clear ${label.toLowerCase()}`}>
                Clear
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="weight-main static">
            <span className="weight-label">{label}</span>
            <span className="weight-meta">{isAm ? 'After waking · lb' : 'Before bed · lb'}</span>
          </div>
          <button type="button" className="weight-log" onClick={startEdit}>
            Log
          </button>
        </>
      )}
    </div>
  );
}

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function dowOf(key) {
  const [y, m, d] = key.split('-').map(Number);
  return DOW[new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()];
}

/** Lightweight SVG line chart: morning solid, night dashed. */
export function WeightChart({ days }) {
  const W = 340;
  const H = 176;
  const padL = 34;
  const padR = 12;
  const padT = 14;
  const padB = 34;
  const vals = days.flatMap((d) => [d.am, d.pm]).filter((v) => typeof v === 'number');
  const has = vals.length > 0;
  let lo = has ? Math.min(...vals) : 0;
  let hi = has ? Math.max(...vals) : 1;
  const span = Math.max(2, hi - lo);
  const mid = (hi + lo) / 2;
  lo = Math.floor(mid - span / 2 - 0.5);
  hi = Math.ceil(mid + span / 2 + 0.5);
  const x = (i) => padL + (i * (W - padL - padR)) / (days.length - 1);
  const y = (v) => padT + ((hi - v) * (H - padT - padB)) / (hi - lo);
  const ticks = [hi, (hi + lo) / 2, lo];

  const pts = (k) => days.map((d, i) => (typeof d[k] === 'number' ? [x(i), y(d[k]), d[k]] : null)).filter(Boolean);
  const path = (p) => p.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ');
  const am = pts('am');
  const pm = pts('pm');
  const lastAm = am[am.length - 1];
  const todayIdx = days.findIndex((d) => d.today);

  return (
    <svg className="weight-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Morning and night weight this week">
      {todayIdx >= 0 ? (
        <rect x={x(todayIdx) - 15} y={padT - 8} width={30} height={H - padT - padB + 16} rx={10} className="wc-today" />
      ) : null}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} className="wc-grid" />
          <text x={padL - 8} y={y(t) + 3.5} className="wc-ytick" textAnchor="end">
            {has ? (Number.isInteger(t) ? t : t.toFixed(1)) : ''}
          </text>
        </g>
      ))}
      {days.map((d, i) => (
        <g key={d.key}>
          <text x={x(i)} y={H - 18} className={`wc-xdow ${d.today ? 'today' : ''}`} textAnchor="middle">
            {dowOf(d.key)}
          </text>
          <text x={x(i)} y={H - 5} className={`wc-xnum ${d.today ? 'today' : ''}`} textAnchor="middle">
            {Number(d.key.slice(8))}
          </text>
        </g>
      ))}
      {pm.length > 1 ? <path d={path(pm)} className="wc-line pm" /> : null}
      {am.length > 1 ? <path d={path(am)} className="wc-line am" /> : null}
      {pm.map(([px, py], i) => (
        <circle key={`pm${i}`} cx={px} cy={py} r={3.4} className="wc-dot pm" />
      ))}
      {am.map(([px, py], i) => (
        <circle key={`am${i}`} cx={px} cy={py} r={3.8} className="wc-dot am" />
      ))}
      {lastAm ? (
        <text x={Math.min(lastAm[0], W - padR - 14)} y={lastAm[1] - 9} className="wc-label" textAnchor="middle">
          {lastAm[2].toFixed(1)}
        </text>
      ) : null}
      {!has ? (
        <text x={(W + padL - padR) / 2} y={(H - padB + padT) / 2 + 4} className="wc-empty" textAnchor="middle">
          Log a weight on Today to start the line
        </text>
      ) : null}
    </svg>
  );
}

/** Progress: Fri→Fri weight week with chart + result. */
export function WeightWeekCard({ weekFor }) {
  const [offset, setOffset] = useState(0);
  const w = useMemo(() => weekFor(offset), [weekFor, offset]);
  const lossTone = w.delta == null ? '' : w.delta < 0 ? 'good' : w.delta > 0 ? 'bad' : '';
  const shortDate = (k) => `${Number(k.slice(5, 7))}/${Number(k.slice(8))}`;

  return (
    <section className="card weight-week-card" aria-label="Weight this week">
      <div className="card-head">
        <h2>Weight</h2>
        <span className="card-sub">Fri → Fri</span>
      </div>
      <div className="ww-nav" role="group" aria-label="Choose week">
        <button type="button" className="ww-nav-btn" onClick={() => setOffset((o) => o - 1)} aria-label="Previous week">
          ‹
        </button>
        <span className="ww-nav-label">
          {w.label}
          {w.isCurrent ? <span className="ww-nav-now">This week</span> : null}
        </span>
        <button
          type="button"
          className="ww-nav-btn"
          onClick={() => setOffset((o) => Math.min(0, o + 1))}
          disabled={offset >= 0}
          aria-label="Next week"
        >
          ›
        </button>
      </div>
      <WeightChart days={w.days} />
      <div className="wc-legend" aria-hidden="true">
        <span className="wc-key am">Morning</span>
        <span className="wc-key pm">Night</span>
      </div>
      <div className="ww-result">
        <div className="ww-stat">
          <span className="ww-stat-label">Start</span>
          <strong className="ww-stat-value">{fmtLbs(w.first?.am)}</strong>
          <span className="ww-stat-sub">{w.first ? `AM · ${shortDate(w.first.key)}` : 'AM'}</span>
        </div>
        <div className="ww-stat">
          <span className="ww-stat-label">{w.finished ? 'End' : 'Latest'}</span>
          <strong className="ww-stat-value">{fmtLbs(w.last?.am)}</strong>
          <span className="ww-stat-sub">{w.last ? `AM · ${shortDate(w.last.key)}` : 'AM'}</span>
        </div>
        <div className={`ww-stat delta ${lossTone}`}>
          <span className="ww-stat-label">{w.finished ? 'Week result' : 'So far'}</span>
          <strong className="ww-stat-value">{fmtDelta(w.delta)}</strong>
          <span className="ww-stat-sub">morning vs start</span>
        </div>
      </div>
      <div className="ww-avgs">
        <div className="ww-avg">
          <span>Avg morning</span>
          <strong>{w.avgAm != null ? `${fmtLbs(w.avgAm)} lb` : '—'}</strong>
          <em>{w.amCount} logged</em>
        </div>
        <div className="ww-avg">
          <span>Avg night</span>
          <strong>{w.avgPm != null ? `${fmtLbs(w.avgPm)} lb` : '—'}</strong>
          <em>{w.pmCount} logged</em>
        </div>
      </div>
    </section>
  );
}

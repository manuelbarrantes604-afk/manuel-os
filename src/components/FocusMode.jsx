import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/*
 * v27 Focus mode: ONE thing on screen. Optional countdown ring.
 * Timer state = { total, endAt, left, running } with absolute timestamps so it stays
 * correct across app switching / suspension.
 */

const PRESETS = [5, 10, 25];
const R = 112;
const C = 2 * Math.PI * R;

const fmt = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export default function FocusMode({ item, initial, onChange, onDone, onExit }) {
  const [timer, setTimer] = useState(initial || null); // {total,endAt,left,running}
  const [, tick] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const alerted = useRef(false);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 250);
    const on = () => tick((n) => n + 1);
    document.addEventListener('visibilitychange', on);
    window.addEventListener('pageshow', on);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', on);
      window.removeEventListener('pageshow', on);
    };
  }, []);

  const set = (t) => {
    setTimer(t);
    onChange(t);
  };

  const remaining = timer ? (timer.running ? timer.endAt - Date.now() : timer.left) : 0;
  const finished = Boolean(timer) && remaining <= 0;

  useEffect(() => {
    if (finished && !alerted.current) {
      alerted.current = true;
      try {
        navigator.vibrate?.([120, 80, 120]);
      } catch {
        /* ignore */
      }
    }
    if (!finished) alerted.current = false;
  }, [finished]);

  const start = (min) => set({ total: min * 60000, endAt: Date.now() + min * 60000, left: min * 60000, running: true });
  const addFive = () => {
    if (!timer) return;
    const now = Date.now();
    const base = Math.max(0, remaining);
    set({ total: Math.max(timer.total, base + 300000), endAt: now + base + 300000, left: base + 300000, running: true });
  };
  const toggle = () => {
    if (!timer || finished) return;
    if (timer.running) set({ ...timer, running: false, left: Math.max(0, timer.endAt - Date.now()) });
    else set({ ...timer, running: true, endAt: Date.now() + timer.left });
  };

  const frac = timer ? Math.min(1, Math.max(0, remaining / timer.total)) : 1;

  const finish = () => {
    if (celebrate) return;
    setCelebrate(true);
    try {
      navigator.vibrate?.(30);
    } catch {
      /* ignore */
    }
    setTimeout(() => onDone(), 1300);
  };

  return createPortal(
    <div className="focus-root" role="dialog" aria-modal="true" aria-label="Focus mode">
      <button type="button" className="focus-exit" onClick={onExit} aria-label="Exit focus">
        Exit
      </button>
      {celebrate ? (
        <div className="focus-done-moment" role="status">
          <svg viewBox="0 0 80 80" width="96" height="96" aria-hidden="true">
            <circle cx="40" cy="40" r="34" fill="none" stroke="#6bc48a" strokeWidth="5" className="focus-done-ring" />
            <path d="M25 41l11 11 20-23" fill="none" stroke="#6bc48a" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" className="focus-done-tick" />
          </svg>
          <p>Nicely done</p>
        </div>
      ) : (
        <div className="focus-body">
          <p className="focus-kicker">Focus on</p>
          <h1 className="focus-title">{item.title}</h1>

          {timer ? (
            <div className="focus-ring-wrap">
              <svg viewBox="0 0 260 260" className="focus-ring" aria-hidden="true">
                <circle cx="130" cy="130" r={R} fill="none" stroke="#ece8fb" strokeWidth="14" />
                <circle
                  cx="130"
                  cy="130"
                  r={R}
                  fill="none"
                  stroke="#9b87e8"
                  strokeWidth="14"
                  strokeLinecap="round"
                  strokeDasharray={C}
                  strokeDashoffset={C * (1 - frac)}
                  transform="rotate(-90 130 130)"
                />
              </svg>
              <div className="focus-time" aria-live="off">
                <strong>{finished ? "Time's up" : fmt(remaining)}</strong>
                {!finished && !timer.running ? <span>Paused</span> : null}
              </div>
            </div>
          ) : (
            <div className="focus-presets" role="group" aria-label="Start a timer">
              <span className="focus-presets-label">Optional timer</span>
              <div>
                {PRESETS.map((m) => (
                  <button key={m} type="button" className="focus-chip" onClick={() => start(m)}>
                    {m} min
                  </button>
                ))}
              </div>
            </div>
          )}

          {timer ? (
            <div className="focus-controls">
              <button type="button" className="focus-chip" onClick={addFive}>
                +5
              </button>
              <button type="button" className="focus-chip main" onClick={toggle} disabled={finished}>
                {timer.running ? 'Pause' : 'Resume'}
              </button>
              <button type="button" className="focus-chip" onClick={() => set(null)}>
                Clear
              </button>
            </div>
          ) : null}

          <button type="button" className="focus-done-btn" onClick={finish}>
            {item.done ? 'Already done' : 'Done'}
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}

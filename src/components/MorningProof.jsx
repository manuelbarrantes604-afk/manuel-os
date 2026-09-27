import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { iconForCheck } from '../lib/tiimoIcons';
import {
  PROOF_RULES,
  deletePhoto,
  downscaleImage,
  fmtClock,
  fmtClockShort,
  getPhoto,
  localDateKey,
  putPhoto,
  requestPersistence,
  windowPassed,
} from '../lib/proof';

/** Load / save / remove the workout photo for a date (IndexedDB). */
export function useProofPhoto(dateKey, row, { setExercisePhoto, clearProof }) {
  const [url, setUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const stamp = row?.photo?.loggedAt || null;

  useEffect(() => {
    let alive = true;
    let objectUrl = null;
    if (!stamp) {
      setUrl(null);
      return undefined;
    }
    getPhoto(dateKey)
      .then((rec) => {
        if (!alive) return;
        if (rec?.bytes) {
          objectUrl = URL.createObjectURL(new Blob([rec.bytes], { type: rec.type || 'image/jpeg' }));
          setUrl(objectUrl);
        } else {
          setUrl(null);
        }
      })
      .catch(() => alive && setUrl(null));
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [dateKey, stamp]);

  const save = useCallback(
    async (file) => {
      if (!file) return;
      setBusy(true);
      setError(null);
      try {
        const now = new Date();
        const { blob, width, height } = await downscaleImage(file, 1080, 0.75);
        const bytes = await blob.arrayBuffer();
        // Use the photo's own timestamp when it's from today (camera or a
        // same-morning library pick); otherwise the upload time.
        const lm = Number(file.lastModified);
        const lmDate = Number.isFinite(lm) && lm > 0 ? new Date(lm) : null;
        const takenAt =
          lmDate &&
          localDateKey(lmDate) === localDateKey(now) &&
          lmDate.getTime() <= now.getTime() + 60000
            ? lmDate.toISOString()
            : now.toISOString();
        const key = localDateKey(now);
        const loggedAt = now.toISOString();
        await putPhoto({ dateKey: key, bytes, type: 'image/jpeg', width, height, takenAt, loggedAt });
        requestPersistence();
        setExercisePhoto(key, { takenAt, loggedAt, width, height });
      } catch (e) {
        setError(e?.message || 'Could not save photo');
      } finally {
        setBusy(false);
      }
    },
    [setExercisePhoto],
  );

  const remove = useCallback(async () => {
    setBusy(true);
    try {
      await deletePhoto(dateKey);
    } catch {
      /* still clear the check */
    }
    clearProof('exercise', dateKey);
    setBusy(false);
  }, [dateKey, clearProof]);

  return { url, busy, error, save, remove };
}

function ProofIcon({ id }) {
  const icon = iconForCheck(id);
  return (
    <span
      className="tiimo-icon"
      style={{ background: icon.bg, width: 40, height: 40, fontSize: 17 }}
      aria-hidden="true"
    >
      {icon.emoji}
    </span>
  );
}

function ConfirmStrip({ text, confirmLabel, onConfirm, onCancel }) {
  return (
    <div className="proof-confirm" role="alertdialog" aria-label={text}>
      <span className="proof-confirm-text">{text}</span>
      <button type="button" className="proof-mini-btn" onClick={onCancel}>
        Keep
      </button>
      <button type="button" className="proof-mini-btn danger" onClick={onConfirm}>
        {confirmLabel}
      </button>
    </div>
  );
}

function StatusTag({ late }) {
  return late ? (
    <span className="proof-tag late">Late</span>
  ) : (
    <span className="proof-tag ok" aria-label="On time">
      ✓
    </span>
  );
}

/** Wake / Leave: one big timestamp button; logged rows can be cleared (with confirm). */
export function ProofTapRow({ checkId, def, row, onLog, onClear, now }) {
  const rule = PROOF_RULES[checkId];
  const [confirming, setConfirming] = useState(false);
  const logged = Boolean(row?.loggedAt);
  const legacy = !logged && row && row.status !== 'PENDING';
  const passed = !logged && !legacy && windowPassed(checkId, now);

  useEffect(() => {
    if (!logged && !legacy) setConfirming(false);
  }, [logged, legacy]);

  if (logged || legacy) {
    return (
      <li
        id={`check-${checkId}`}
        className={`tiimo-task check-row proof-row logged ${row.late || row.status === 'FAIL' ? 'late' : 'pass'}`}
      >
        <ProofIcon id={checkId} />
        <button
          type="button"
          className="proof-row-main"
          onClick={() => setConfirming((v) => !v)}
          aria-expanded={confirming}
          aria-label={`${rule.doneLabel} ${logged ? fmtClock(row.loggedAt) : ''}. Tap to clear`}
        >
          <strong className="tiimo-task-title">
            {logged
              ? `${rule.doneLabel} ${fmtClock(row.loggedAt)}`
              : `${def.label} · ${row.status === 'PASS' ? 'self-marked' : 'marked fail'}`}
          </strong>
          <span className="tiimo-task-sub">
            {logged ? (row.late ? `Deadline ${rule.by} · late` : `On time · by ${rule.by}`) : 'Tap to clear and log proof'}
          </span>
        </button>
        {logged ? <StatusTag late={row.late} /> : null}
        {confirming ? (
          <ConfirmStrip
            text={`Clear ${rule.doneLabel.toLowerCase()} log?`}
            confirmLabel="Clear"
            onCancel={() => setConfirming(false)}
            onConfirm={() => {
              setConfirming(false);
              onClear(checkId);
            }}
          />
        ) : null}
      </li>
    );
  }

  return (
    <li id={`check-${checkId}`} className="tiimo-task check-row proof-row pending">
      <ProofIcon id={checkId} />
      <div className="tiimo-task-main check-label">
        <strong className="tiimo-task-title">{def.label}</strong>
        <span className={`proof-deadline ${passed ? 'passed' : ''}`}>
          by {rule.by}
          {passed ? ' · window passed' : ''}
        </span>
      </div>
      <button type="button" className="proof-action" onClick={() => onLog(checkId)}>
        {rule.label}
      </button>
    </li>
  );
}

/** Exercise: workout photo (camera or library). PASS requires a stored photo. */
export function PhotoProofRow({ def, row, photo, onView }) {
  const inputRef = useRef(null);
  const [confirming, setConfirming] = useState(false);
  const has = Boolean(row?.photo);
  const legacy = !has && row && row.status !== 'PENDING';
  const pick = () => inputRef.current?.click();

  const input = (
    <input
      ref={inputRef}
      className="visually-hidden-input"
      type="file"
      accept="image/*"
      capture="environment"
      tabIndex={-1}
      aria-hidden="true"
      onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (f) photo.save(f);
      }}
    />
  );

  if (has) {
    return (
      <li id="check-exercise" className="tiimo-task check-row proof-row logged pass photo">
        <button
          type="button"
          className="proof-thumb"
          onClick={() => photo.url && onView(photo.url, row.photo.takenAt)}
          aria-label="Open workout photo"
        >
          {photo.url ? <img src={photo.url} alt="Workout proof" /> : <span aria-hidden="true">📷</span>}
        </button>
        <div className="tiimo-task-main check-label">
          <strong className="tiimo-task-title">Workout {fmtClock(row.photo.takenAt)}</strong>
          <span className="tiimo-task-sub">Photo proof · by {PROOF_RULES.exercise.by}</span>
        </div>
        <StatusTag late={false} />
        <div className="proof-photo-actions">
          <button type="button" className="proof-mini-btn" onClick={pick} disabled={photo.busy}>
            Replace
          </button>
          <button
            type="button"
            className="proof-mini-btn"
            onClick={() => setConfirming(true)}
            disabled={photo.busy}
          >
            Remove
          </button>
        </div>
        {confirming ? (
          <ConfirmStrip
            text="Remove workout photo?"
            confirmLabel="Remove"
            onCancel={() => setConfirming(false)}
            onConfirm={() => {
              setConfirming(false);
              photo.remove();
            }}
          />
        ) : null}
        {input}
      </li>
    );
  }

  return (
    <li id="check-exercise" className={`tiimo-task check-row proof-row pending ${legacy ? 'legacy' : ''}`}>
      <ProofIcon id="exercise" />
      <div className="tiimo-task-main check-label">
        <strong className="tiimo-task-title">{def.label}</strong>
        <span className="proof-deadline">
          {legacy
            ? `${row.status === 'PASS' ? 'Self-marked' : 'Marked fail'} · add a photo`
            : `by ${PROOF_RULES.exercise.by} · photo required`}
        </span>
        {photo.error ? <span className="proof-error">{photo.error}</span> : null}
      </div>
      <button type="button" className="proof-action photo" onClick={pick} disabled={photo.busy}>
        {photo.busy ? 'Saving…' : (
          <>
            <span aria-hidden="true">📷</span> Workout photo
          </>
        )}
      </button>
      {input}
    </li>
  );
}

export function PhotoViewer({ view, onClose }) {
  useEffect(() => {
    if (!view) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [view, onClose]);
  if (!view) return null;
  return createPortal(
    <button type="button" className="proof-viewer" onClick={onClose} aria-label="Close photo">
      <img src={view.url} alt="Workout proof full size" />
      <span className="proof-viewer-cap">Workout · {fmtClock(view.takenAt)} · tap to close</span>
    </button>,
    document.body,
  );
}

/** Compact, screenshot-friendly summary for the evening coach review. */
export function MorningProofCard({ today, photoUrl, earned, rulesApply, onView }) {
  const c = today?.checks || {};
  const cell = (id, label) => {
    const row = c[id];
    const logged = Boolean(row?.loggedAt);
    return (
      <div className={`mp-cell ${logged ? (row.late ? 'late' : 'ok') : 'open'}`}>
        <span className="mp-label">{label}</span>
        <strong className="mp-time">{logged ? fmtClockShort(row.loggedAt) : '—'}</strong>
        <span className="mp-sub">
          {logged ? (row.late ? 'Late' : 'On time ✓') : `by ${PROOF_RULES[id].by}`}
        </span>
      </div>
    );
  };
  const photo = c.exercise?.photo;
  const done = [c.wake?.loggedAt && !c.wake?.late, c.leave?.loggedAt && !c.leave?.late, photo].filter(Boolean).length;

  return (
    <section className="card morning-proof-card" aria-label="Morning proof">
      <div className="mp-head">
        <h2>Morning proof</h2>
        <span className="mp-date">{today?.label}</span>
        <span className={`mp-badge ${earned ? 'earned' : ''}`}>
          {earned ? '🔥 Streak day' : rulesApply ? `${done}/3` : 'Pre-v23 day'}
        </span>
      </div>
      <div className="mp-grid">
        {cell('wake', 'Up')}
        {cell('leave', 'Left')}
        <div className={`mp-cell photo ${photo ? 'ok' : 'open'}`}>
          {photo && photoUrl ? (
            <button type="button" className="mp-thumb" onClick={() => onView(photoUrl, photo.takenAt)} aria-label="Open workout photo">
              <img src={photoUrl} alt="Workout proof" />
            </button>
          ) : (
            <span className="mp-thumb empty" aria-hidden="true">
              📷
            </span>
          )}
          <div className="mp-photo-copy">
            <span className="mp-label">Workout</span>
            <strong className="mp-time">{photo ? fmtClockShort(photo.takenAt) : '—'}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}

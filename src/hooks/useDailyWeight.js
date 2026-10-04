import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDaysKey, fridayWeekStart, friShortLabel, WEEK_WEIGHT_KEY } from './useWeekWeight';

/**
 * v24: morning + night weigh-ins per date.
 * New key only: { [dateKey]: { am: {lbs, at} | null, pm: {lbs, at} | null } }
 * `null` means "explicitly cleared" (hides any legacy fallback for that slot).
 *
 * Read-only fallbacks for morning weight (never rewritten):
 *  - manuel-os-weight-v1   { [dateKey]: lbs }     (v8 daily weigh-in)
 *  - manuel-os-week-weight-v1 [{ weekStart, startLbs, endLbs }]
 *      startLbs → morning of that Friday, endLbs → morning of the next Friday
 */
export const DAILY_WEIGHT_KEY = 'manuel-os-daily-weight-v1';
const LEGACY_DAILY_KEY = 'manuel-os-weight-v1';

export function parseLbs(value) {
  const trimmed = String(value ?? '').trim().replace(',', '.');
  if (trimmed === '') return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num < 50 || num > 700) return undefined; // invalid
  return Math.round(num * 10) / 10;
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function loadLegacyMorning() {
  const out = {};
  const okNum = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
  const weeks = readJson(WEEK_WEIGHT_KEY, []);
  if (Array.isArray(weeks)) {
    for (const w of weeks) {
      if (!w || typeof w.weekStart !== 'string') continue;
      const s = Number(w.startLbs);
      const e = Number(w.endLbs);
      if (okNum(s)) out[w.weekStart] = Math.round(s * 10) / 10;
      if (okNum(e)) {
        const k = addDaysKey(w.weekStart, 7);
        if (out[k] == null) out[k] = Math.round(e * 10) / 10;
      }
    }
  }
  const daily = readJson(LEGACY_DAILY_KEY, {});
  if (daily && typeof daily === 'object' && !Array.isArray(daily)) {
    for (const [k, v] of Object.entries(daily)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(k) && okNum(Number(v))) out[k] = Math.round(Number(v) * 10) / 10;
    }
  }
  return out;
}

function loadDaily() {
  const v = readJson(DAILY_WEIGHT_KEY, {});
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}

function avg(xs) {
  const list = xs.filter((x) => typeof x === 'number');
  if (!list.length) return null;
  return Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 10) / 10;
}

export function fmtLbs(n) {
  return typeof n === 'number' ? n.toFixed(1) : '—';
}

/** "−1.4 lb" / "+0.6 lb" / "0.0 lb" */
export function fmtDelta(d) {
  if (typeof d !== 'number') return '—';
  if (d === 0) return '0.0 lb';
  return `${d < 0 ? '−' : '+'}${Math.abs(d).toFixed(1)} lb`;
}

export function useDailyWeight(todayKey) {
  const [daily, setDaily] = useState(loadDaily);
  const [legacy] = useState(loadLegacyMorning);

  useEffect(() => {
    try {
      localStorage.setItem(DAILY_WEIGHT_KEY, JSON.stringify(daily));
    } catch {
      /* ignore quota */
    }
  }, [daily]);

  /** Resolved { am, pm } for a date: each { lbs, at, legacy } or null. */
  const entryFor = useCallback(
    (dateKey) => {
      const d = daily[dateKey] || {};
      let am = null;
      if (d.am && typeof d.am.lbs === 'number') am = { lbs: d.am.lbs, at: d.am.at || null, legacy: false };
      else if (d.am !== null && legacy[dateKey] != null) am = { lbs: legacy[dateKey], at: null, legacy: true };
      const pm = d.pm && typeof d.pm.lbs === 'number' ? { lbs: d.pm.lbs, at: d.pm.at || null, legacy: false } : null;
      return { am, pm };
    },
    [daily, legacy],
  );

  /** slot: 'am' | 'pm'. value '' clears. Returns false if invalid. */
  const setWeight = useCallback((dateKey, slot, value) => {
    const lbs = parseLbs(value);
    if (lbs === undefined) return false;
    setDaily((prev) => {
      const day = { ...(prev[dateKey] || {}) };
      day[slot] = lbs == null ? null : { lbs, at: new Date().toISOString() };
      return { ...prev, [dateKey]: day };
    });
    return true;
  }, []);

  const today = useMemo(() => entryFor(todayKey), [entryFor, todayKey]);

  /** Fri→Fri window (8 points) for the week `offset` weeks from the current one. */
  const weekFor = useCallback(
    (offset = 0) => {
      const start = addDaysKey(fridayWeekStart(todayKey), offset * 7);
      const end = addDaysKey(start, 7);
      const days = [];
      for (let i = 0; i <= 7; i += 1) {
        const key = addDaysKey(start, i);
        const e = entryFor(key);
        days.push({ key, am: e.am?.lbs ?? null, pm: e.pm?.lbs ?? null, future: key > todayKey, today: key === todayKey });
      }
      const ams = days.filter((d) => d.am != null);
      const first = ams[0] || null;
      const last = ams.length > 1 ? ams[ams.length - 1] : null;
      const delta = first && last ? Math.round((last.am - first.am) * 10) / 10 : null;
      const finished = end < todayKey || (end === todayKey && days[7].am != null);
      return {
        start,
        end,
        label: `${friShortLabel(start)} → ${friShortLabel(end)}`,
        days,
        first,
        last,
        delta,
        finished,
        avgAm: avg(days.map((d) => d.am)),
        avgPm: avg(days.map((d) => d.pm)),
        amCount: ams.length,
        pmCount: days.filter((d) => d.pm != null).length,
        isCurrent: offset === 0,
      };
    },
    [entryFor, todayKey],
  );

  const thisWeekLogged = useMemo(() => {
    const w = weekFor(0);
    return w.amCount + w.pmCount > 0;
  }, [weekFor]);

  return { today, entryFor, setWeight, weekFor, thisWeekLogged };
}

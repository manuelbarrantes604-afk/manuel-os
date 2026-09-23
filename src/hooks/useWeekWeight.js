import { useCallback, useEffect, useMemo, useState } from 'react';

/** Friday→Friday week weight (start Fri / end Fri). No invented numbers. */
export const WEEK_WEIGHT_KEY = 'manuel-os-week-weight-v1';

function parseLbs(value) {
  const trimmed = String(value ?? '').trim();
  if (trimmed === '') return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num <= 0 || num > 1000) return null;
  return Math.round(num * 10) / 10;
}

/** Most recent Friday on or before dateKey (YYYY-MM-DD). If today is Fri, that Friday. */
export function fridayWeekStart(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const noon = new Date(Date.UTC(y, m - 1, d, 12));
  const dow = noon.getUTCDay(); // 0 Sun … 5 Fri 6 Sat
  const daysSinceFri = (dow - 5 + 7) % 7;
  noon.setUTCDate(noon.getUTCDate() - daysSinceFri);
  return noon.toISOString().slice(0, 10);
}

export function addDaysKey(dateKey, n) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const noon = new Date(Date.UTC(y, m - 1, d + n, 12));
  return noon.toISOString().slice(0, 10);
}

/** e.g. "Fri 9/18" */
export function friShortLabel(dateKey) {
  const [, m, d] = dateKey.split('-').map(Number);
  return `Fri ${m}/${d}`;
}

function loadWeeks() {
  try {
    const raw = localStorage.getItem(WEEK_WEIGHT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((w) => w && typeof w.weekStart === 'string')
      .map((w) => ({
        weekStart: w.weekStart,
        startLbs: parseLbs(w.startLbs),
        endLbs: parseLbs(w.endLbs),
      }));
  } catch {
    return [];
  }
}

export function useWeekWeight(todayKey) {
  const [weeks, setWeeks] = useState(loadWeeks);

  useEffect(() => {
    try {
      localStorage.setItem(WEEK_WEIGHT_KEY, JSON.stringify(weeks));
    } catch {
      /* ignore */
    }
  }, [weeks]);

  const weekStart = useMemo(
    () => (todayKey ? fridayWeekStart(todayKey) : null),
    [todayKey],
  );
  const weekEnd = useMemo(
    () => (weekStart ? addDaysKey(weekStart, 7) : null),
    [weekStart],
  );

  const current = useMemo(() => {
    if (!weekStart) return { startLbs: null, endLbs: null };
    const found = weeks.find((w) => w.weekStart === weekStart);
    return {
      startLbs: found?.startLbs ?? null,
      endLbs: found?.endLbs ?? null,
    };
  }, [weeks, weekStart]);

  const upsert = useCallback((weekStartKey, patch) => {
    setWeeks((prev) => {
      const idx = prev.findIndex((w) => w.weekStart === weekStartKey);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...patch };
        return next;
      }
      return [
        ...prev,
        {
          weekStart: weekStartKey,
          startLbs: null,
          endLbs: null,
          ...patch,
        },
      ];
    });
  }, []);

  const setWeekStart = useCallback(
    (value) => {
      if (!weekStart) return;
      upsert(weekStart, { startLbs: parseLbs(value) });
    },
    [weekStart, upsert],
  );

  const setWeekEnd = useCallback(
    (value) => {
      if (!weekStart) return;
      upsert(weekStart, { endLbs: parseLbs(value) });
    },
    [weekStart, upsert],
  );

  const stats = useMemo(() => {
    const startLbs = current.startLbs;
    const endLbs = current.endLbs;
    const lost =
      startLbs != null && endLbs != null
        ? Math.round((startLbs - endLbs) * 10) / 10
        : null;
    const windowLabel =
      weekStart && weekEnd
        ? `${friShortLabel(weekStart)} → ${friShortLabel(weekEnd)}`
        : '';
    return {
      weekStart,
      weekEnd,
      startLbs,
      endLbs,
      lost,
      windowLabel,
    };
  }, [current, weekStart, weekEnd]);

  return {
    stats,
    setWeekStart,
    setWeekEnd,
    weeks,
  };
}

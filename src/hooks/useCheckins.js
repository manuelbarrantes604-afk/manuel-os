import { useCallback, useEffect, useMemo, useState } from 'react';
import { blankDay, CHECK_DEFS, SEED_DAYS, STORAGE_KEY } from '../data/seed';
import { getNyParts, weekStripFor } from '../lib/time';

function cloneSeed() {
  return structuredClone(SEED_DAYS);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneSeed();
    const parsed = JSON.parse(raw);
    return { ...cloneSeed(), ...parsed };
  } catch {
    return cloneSeed();
  }
}

function nowTime() {
  return new Date().toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** Score = (PASS count / total checks) * 100. PENDING do not count as pass. */
function calcPct(checks) {
  const ids = CHECK_DEFS.map((c) => c.id);
  const passes = ids.filter((id) => checks[id]?.status === 'PASS').length;
  const anyMarked = ids.some((id) => checks[id]?.status !== 'PENDING');
  if (!anyMarked) return null;
  return Math.round((passes / ids.length) * 100);
}

function calcDayStats(checks) {
  const ids = CHECK_DEFS.map((c) => c.id);
  const passes = ids.filter((id) => checks[id]?.status === 'PASS');
  const fails = ids.filter((id) => checks[id]?.status === 'FAIL');
  const pending = ids.filter(
    (id) => !checks[id] || checks[id].status === 'PENDING',
  );
  const allGraded = pending.length === 0;
  const pct = Math.round((passes.length / ids.length) * 100);
  return {
    passIds: passes,
    failIds: fails,
    pendingIds: pending,
    allGraded,
    pct,
    passCount: passes.length,
    failCount: fails.length,
    total: ids.length,
  };
}

export function useCheckins() {
  const ny = useMemo(() => getNyParts(), []);
  const todayKey = ny.dateKey;

  const [days, setDays] = useState(() => {
    const initial = loadState();
    if (!initial[todayKey]) {
      initial[todayKey] = blankDay(todayKey);
    }
    return initial;
  });

  // Ensure today exists if date rolls over in a long session
  useEffect(() => {
    setDays((prev) => {
      if (prev[todayKey]) return prev;
      return { ...prev, [todayKey]: blankDay(todayKey) };
    });
  }, [todayKey]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(days));
  }, [days]);

  const today = days[todayKey];

  const todayPct = useMemo(
    () => calcPct(today?.checks || {}),
    [today],
  );

  const todayStats = useMemo(
    () => calcDayStats(today?.checks || {}),
    [today],
  );

  const setStatus = useCallback(
    (checkId, status) => {
      if (status !== 'PASS' && status !== 'FAIL') return;
      setDays((prev) => {
        const day = prev[todayKey] || blankDay(todayKey);
        const prevRow = day.checks[checkId] || {};
        return {
          ...prev,
          [todayKey]: {
            ...day,
            checks: {
              ...day.checks,
              [checkId]: {
                ...prevRow,
                status,
                time: nowTime(),
                note: status === 'PASS' ? 'Marked pass' : 'Marked fail',
              },
            },
          },
        };
      });
    },
    [todayKey],
  );

  const weekStrip = useMemo(() => weekStripFor(todayKey), [todayKey]);

  const weekPcts = useMemo(() => {
    const map = {};
    for (const [key, day] of Object.entries(days)) {
      map[key] = calcPct(day.checks);
    }
    return map;
  }, [days]);

  const weekHonesty = useMemo(() => {
    const scored = weekStrip
      .map((d) => weekPcts[d.key])
      .filter((p) => p != null);
    if (!scored.length) {
      return { avg: null, count: 0, line: 'No graded days yet this week.' };
    }
    const avg = Math.round(
      scored.reduce((a, b) => a + b, 0) / scored.length,
    );
    let line;
    if (avg < 50) line = 'Below standard. Fix the morning stack.';
    else if (avg < 80) line = 'Partial. Close open items.';
    else line = 'On standard. Protect it.';
    return { avg, count: scored.length, line };
  }, [weekStrip, weekPcts]);

  return {
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
  };
}

export { calcPct, calcDayStats };

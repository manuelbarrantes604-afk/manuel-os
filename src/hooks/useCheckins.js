import { useCallback, useEffect, useMemo, useState } from 'react';
import { CHECK_DEFS, SEED_DAYS, STORAGE_KEY, TODAY_KEY } from '../data/seed';

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
  const [days, setDays] = useState(loadState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(days));
  }, [days]);

  const today = days[TODAY_KEY];

  const todayPct = useMemo(
    () => calcPct(today?.checks || {}),
    [today],
  );

  const todayStats = useMemo(
    () => calcDayStats(today?.checks || {}),
    [today],
  );

  const setStatus = useCallback((checkId, status) => {
    if (status !== 'PASS' && status !== 'FAIL') return;
    setDays((prev) => {
      const day = prev[TODAY_KEY];
      if (!day) return prev;
      const prevRow = day.checks[checkId] || {};
      return {
        ...prev,
        [TODAY_KEY]: {
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
  }, []);

  const clearStatus = useCallback((checkId) => {
    setDays((prev) => {
      const day = prev[TODAY_KEY];
      if (!day) return prev;
      const seedNote =
        SEED_DAYS[TODAY_KEY]?.checks?.[checkId]?.note || 'Reset to pending';
      const seedTime = SEED_DAYS[TODAY_KEY]?.checks?.[checkId]?.time || '—';
      return {
        ...prev,
        [TODAY_KEY]: {
          ...day,
          checks: {
            ...day.checks,
            [checkId]: {
              ...day.checks[checkId],
              status: 'PENDING',
              time: seedTime,
              note: seedNote,
            },
          },
        },
      };
    });
  }, []);

  const markProof = useCallback((checkId) => {
    setDays((prev) => {
      const day = prev[TODAY_KEY];
      if (!day) return prev;
      return {
        ...prev,
        [TODAY_KEY]: {
          ...day,
          checks: {
            ...day.checks,
            [checkId]: {
              ...day.checks[checkId],
              status: 'PASS',
              time: nowTime(),
              note: 'Proof received',
            },
          },
        },
      };
    });
  }, []);

  const resetToday = useCallback(() => {
    setDays((prev) => ({
      ...prev,
      [TODAY_KEY]: structuredClone(SEED_DAYS[TODAY_KEY]),
    }));
  }, []);

  const weekPcts = useMemo(() => {
    const map = {};
    for (const [key, day] of Object.entries(days)) {
      map[key] = calcPct(day.checks);
    }
    return map;
  }, [days]);

  return {
    days,
    today,
    todayPct,
    todayStats,
    weekPcts,
    setStatus,
    clearStatus,
    markProof,
    resetToday,
  };
}

export { calcPct, calcDayStats };

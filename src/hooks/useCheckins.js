import { useCallback, useEffect, useMemo, useState } from 'react';
import { CHECK_DEFS, SEED_DAYS, STORAGE_KEY, TODAY_KEY } from '../data/seed';

const STATUS_CYCLE = ['PENDING', 'PASS', 'FAIL'];

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

function calcPct(checks) {
  const ids = CHECK_DEFS.map((c) => c.id);
  const scored = ids.filter((id) => checks[id]?.status !== 'PENDING');
  if (scored.length === 0) return null;
  const passes = scored.filter((id) => checks[id].status === 'PASS').length;
  return Math.round((passes / ids.length) * 100);
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

  const cycleStatus = useCallback((checkId) => {
    setDays((prev) => {
      const day = prev[TODAY_KEY];
      if (!day) return prev;
      const current = day.checks[checkId]?.status || 'PENDING';
      const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length];
      const note =
        next === 'PASS'
          ? 'Marked pass'
          : next === 'FAIL'
            ? 'Marked fail'
            : 'Reset to pending';
      const time =
        next === 'PENDING'
          ? '—'
          : new Date().toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            });
      return {
        ...prev,
        [TODAY_KEY]: {
          ...day,
          checks: {
            ...day.checks,
            [checkId]: {
              ...day.checks[checkId],
              status: next,
              time,
              note,
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
      const time = new Date().toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      return {
        ...prev,
        [TODAY_KEY]: {
          ...day,
          checks: {
            ...day.checks,
            [checkId]: {
              ...day.checks[checkId],
              status: 'PASS',
              time,
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
    weekPcts,
    cycleStatus,
    markProof,
    resetToday,
  };
}

export { calcPct };

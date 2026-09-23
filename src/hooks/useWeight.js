import { useCallback, useEffect, useMemo, useState } from 'react';

/** Simple start/current goal — no daily weigh-in history. */
export const WEIGHT_GOAL_KEY = 'manuel-os-weight-goal-v1';
const CUT_LBS = 30;
const DEADLINE_LABEL = 'by week of Jan 5, 2027';

function parseLbs(value) {
  const trimmed = String(value ?? '').trim();
  if (trimmed === '') return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num <= 0 || num > 1000) return null;
  return Math.round(num * 10) / 10;
}

function loadGoal() {
  try {
    const raw = localStorage.getItem(WEIGHT_GOAL_KEY);
    if (!raw) return { start: null, current: null };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { start: null, current: null };
    }
    return {
      start: parseLbs(parsed.start),
      current: parseLbs(parsed.current),
    };
  } catch {
    return { start: null, current: null };
  }
}

export function useWeight() {
  const [goal, setGoal] = useState(loadGoal);

  useEffect(() => {
    try {
      localStorage.setItem(WEIGHT_GOAL_KEY, JSON.stringify(goal));
    } catch {
      /* ignore */
    }
  }, [goal]);

  const setStart = useCallback((value) => {
    setGoal((prev) => {
      const start = parseLbs(value);
      // Clearing start also clears current so we never invent numbers
      if (start == null) return { start: null, current: null };
      return { ...prev, start };
    });
  }, []);

  const setCurrent = useCallback((value) => {
    setGoal((prev) => {
      if (prev.start == null) return prev;
      return { ...prev, current: parseLbs(value) };
    });
  }, []);

  const stats = useMemo(() => {
    const start = goal.start;
    if (start == null) {
      return {
        start: null,
        current: null,
        target: null,
        lost: null,
        left: null,
        pct: null,
        cutLbs: CUT_LBS,
        deadlineLabel: DEADLINE_LABEL,
        configured: false,
      };
    }
    const target = Math.round((start - CUT_LBS) * 10) / 10;
    const current = goal.current;
    const lost =
      current == null ? null : Math.round((start - current) * 10) / 10;
    const left =
      current == null ? CUT_LBS : Math.round((current - target) * 10) / 10;
    const pct =
      lost == null
        ? null
        : Math.max(0, Math.min(100, Math.round((lost / CUT_LBS) * 100)));
    return {
      start,
      current,
      target,
      lost,
      left,
      pct,
      cutLbs: CUT_LBS,
      deadlineLabel: DEADLINE_LABEL,
      configured: true,
    };
  }, [goal]);

  return {
    startWeight: goal.start,
    currentWeight: goal.current,
    setStart,
    setCurrent,
    stats,
  };
}

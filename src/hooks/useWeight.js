import { useCallback, useEffect, useMemo, useState } from 'react';
import { WEIGHT_STORAGE_KEY } from '../data/seed';

function loadWeights() {
  try {
    const raw = localStorage.getItem(WEIGHT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}

export function useWeight(dateKey) {
  const [weights, setWeights] = useState(loadWeights);

  useEffect(() => {
    localStorage.setItem(WEIGHT_STORAGE_KEY, JSON.stringify(weights));
  }, [weights]);

  const todayWeight = weights[dateKey] ?? '';

  const setTodayWeight = useCallback(
    (value) => {
      setWeights((prev) => {
        const next = { ...prev };
        const trimmed = String(value).trim();
        if (trimmed === '') {
          delete next[dateKey];
        } else {
          const num = Number(trimmed);
          if (!Number.isFinite(num) || num <= 0 || num > 1000) {
            return prev;
          }
          // Store as number, keep one decimal if needed
          next[dateKey] = Math.round(num * 10) / 10;
        }
        return next;
      });
    },
    [dateKey],
  );

  const recent = useMemo(() => {
    return Object.entries(weights)
      .filter(([, v]) => typeof v === 'number' && Number.isFinite(v))
      .map(([key, lbs]) => ({ key, lbs }))
      .sort((a, b) => (a.key < b.key ? 1 : -1))
      .slice(0, 14);
  }, [weights]);

  const trend = useMemo(() => {
    if (recent.length < 2) return null;
    const newest = recent[0].lbs;
    const oldest = recent[recent.length - 1].lbs;
    const delta = Math.round((newest - oldest) * 10) / 10;
    return { delta, newest, oldest, days: recent.length };
  }, [recent]);

  return {
    todayWeight,
    setTodayWeight,
    recent,
    trend,
    weights,
  };
}

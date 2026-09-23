import { useCallback, useEffect, useMemo, useState } from 'react';
import { CALORIES_STORAGE_KEY } from '../data/seed';

function loadCalories() {
  try {
    const raw = localStorage.getItem(CALORIES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}

export function useCalories(dateKey) {
  const [calories, setCalories] = useState(loadCalories);

  useEffect(() => {
    localStorage.setItem(CALORIES_STORAGE_KEY, JSON.stringify(calories));
  }, [calories]);

  const todayCalories = calories[dateKey] ?? '';

  const setTodayCalories = useCallback(
    (value) => {
      setCalories((prev) => {
        const next = { ...prev };
        const trimmed = String(value).trim();
        if (trimmed === '') {
          delete next[dateKey];
        } else {
          const num = Number(trimmed);
          if (!Number.isFinite(num) || num < 0 || num > 20000) {
            return prev;
          }
          next[dateKey] = Math.round(num);
        }
        return next;
      });
    },
    [dateKey],
  );

  const recent = useMemo(() => {
    return Object.entries(calories)
      .filter(([, v]) => typeof v === 'number' && Number.isFinite(v))
      .map(([key, kcal]) => ({ key, kcal }))
      .sort((a, b) => (a.key < b.key ? 1 : -1))
      .slice(0, 14);
  }, [calories]);

  return {
    todayCalories,
    setTodayCalories,
    recent,
    calories,
  };
}

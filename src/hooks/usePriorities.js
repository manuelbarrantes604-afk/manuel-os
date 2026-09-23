import { useCallback, useEffect, useState } from 'react';

const PRIORITIES_KEY = 'manuel-os-priorities-v1';

function loadAll() {
  try {
    const raw = localStorage.getItem(PRIORITIES_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function usePriorities(dateKey) {
  const [all, setAll] = useState(loadAll);

  useEffect(() => {
    localStorage.setItem(PRIORITIES_KEY, JSON.stringify(all));
  }, [all]);

  const priorities = all[dateKey] || ['', '', ''];

  const setPriority = useCallback(
    (index, value) => {
      setAll((prev) => {
        const current = prev[dateKey] || ['', '', ''];
        const next = [...current];
        next[index] = value;
        return { ...prev, [dateKey]: next };
      });
    },
    [dateKey],
  );

  const filledCount = priorities.filter((p) => p.trim().length > 0).length;

  return { priorities, setPriority, filledCount };
}

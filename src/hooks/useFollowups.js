import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FOLLOWUPS_SEED,
  FOLLOWUPS_STORAGE_KEY,
} from '../data/followupsSeed';
import { getNyParts, weekStripFor } from '../lib/time';

function uid() {
  return `fu-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadItems() {
  try {
    const raw = localStorage.getItem(FOLLOWUPS_STORAGE_KEY);
    if (!raw) {
      const seeded = structuredClone(FOLLOWUPS_SEED);
      localStorage.setItem(FOLLOWUPS_STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      const seeded = structuredClone(FOLLOWUPS_SEED);
      localStorage.setItem(FOLLOWUPS_STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    // Empty array = first load seed
    if (parsed.length === 0) {
      const seeded = structuredClone(FOLLOWUPS_SEED);
      localStorage.setItem(FOLLOWUPS_STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return parsed;
  } catch {
    return structuredClone(FOLLOWUPS_SEED);
  }
}

function addDays(dateKey, n) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

function inWeek(dateKey, todayKey) {
  const strip = weekStripFor(todayKey);
  return strip.some((d) => d.key === dateKey);
}

/** Friday night / Sat early: surface earlySurface items on Today strip. */
export function shouldEarlySurface(item, todayKey, hour) {
  if (!item?.earlySurface || item.done || !item.due) return false;
  const fri = addDays(item.due, -1);
  if (todayKey === fri && hour >= 18) return true;
  if (todayKey === item.due && hour < 8) return true;
  return false;
}

export function useFollowups(todayKey) {
  const [items, setItems] = useState(loadItems);
  const ny = useMemo(() => getNyParts(), []);

  useEffect(() => {
    localStorage.setItem(FOLLOWUPS_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const add = useCallback(
    (title, due) => {
      const t = String(title || '').trim();
      if (!t) return;
      const dueDate = due || todayKey;
      setItems((prev) => [
        {
          id: uid(),
          title: t,
          due: dueDate,
          month: null,
          done: false,
          doneAt: null,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    },
    [todayKey],
  );

  const toggle = useCallback((id) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        if (it.done) {
          return { ...it, done: false, doneAt: null };
        }
        return {
          ...it,
          done: true,
          doneAt: new Date().toISOString(),
        };
      }),
    );
  }, []);

  const remove = useCallback((id) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const rename = useCallback((id, title) => {
    const t = String(title || '').trim();
    if (!t) return;
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, title: t } : it)),
    );
  }, []);

  const setDue = useCallback((id, due) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, due: due || null, month: due ? null : it.month } : it,
      ),
    );
  }, []);

  const groups = useMemo(() => {
    const open = items.filter((i) => !i.done);
    const done = items.filter((i) => i.done);
    const overdue = [];
    const today = [];
    const next7 = [];
    const later = [];
    const month = [];
    const horizon = addDays(todayKey, 7);
    const tomorrow = addDays(todayKey, 1);

    for (const it of open) {
      if (it.month && !it.due) {
        month.push(it);
        continue;
      }
      if (!it.due) {
        later.push(it);
        continue;
      }
      if (it.due < todayKey) overdue.push(it);
      else if (it.due === todayKey) today.push(it);
      else if (it.due >= tomorrow && it.due <= horizon) next7.push(it);
      else later.push(it);
    }

    const sortDue = (a, b) => {
      if (!a.due && !b.due) return 0;
      if (!a.due) return 1;
      if (!b.due) return -1;
      return a.due < b.due ? -1 : a.due > b.due ? 1 : 0;
    };
    overdue.sort(sortDue);
    today.sort(sortDue);
    next7.sort(sortDue);
    later.sort(sortDue);

    const doneThisWeek = done
      .filter((it) => {
        if (!it.doneAt) return false;
        try {
          const parts = getNyParts(new Date(it.doneAt));
          return inWeek(parts.dateKey, todayKey);
        } catch {
          return false;
        }
      })
      .sort((a, b) => (a.doneAt < b.doneAt ? 1 : -1));

    return { overdue, today, next7, later, month, doneThisWeek };
  }, [items, todayKey]);

  const counts = useMemo(
    () => ({
      overdue: groups.overdue.length,
      today: groups.today.length,
      upcoming:
        groups.next7.length + groups.later.length + groups.month.length,
    }),
    [groups],
  );

  const stripItems = useMemo(() => {
    const map = new Map();
    for (const it of groups.today) map.set(it.id, it);
    for (const it of groups.overdue) map.set(it.id, it);
    for (const it of items) {
      if (
        !it.done &&
        shouldEarlySurface(it, todayKey, ny.hour) &&
        !map.has(it.id)
      ) {
        map.set(it.id, it);
      }
    }
    return Array.from(map.values());
  }, [groups, items, todayKey, ny.hour]);

  const showStrip =
    groups.today.length > 0 ||
    groups.overdue.length > 0 ||
    stripItems.some((it) => shouldEarlySurface(it, todayKey, ny.hour));

  const tended = groups.overdue.length === 0;

  return {
    items,
    groups,
    counts,
    stripItems,
    showStrip,
    tended,
    overdueCount: groups.overdue.length,
    add,
    toggle,
    remove,
    rename,
    setDue,
  };
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AGENDA_SEED,
  AGENDA_STORAGE_KEY,
  FOLLOWUPS_LEGACY_KEY,
} from '../data/agendaSeed';
import { weekStripFor } from '../lib/time';

function uid() {
  return `ag-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function addDays(dateKey, n) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

function daysInMonth(year, month /* 1-12 */) {
  return new Date(Date.UTC(year, month, 0, 12)).getUTCDate();
}

function loadItems() {
  try {
    const raw = localStorage.getItem(AGENDA_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      if (Array.isArray(parsed) && parsed.length === 0) {
        const seeded = structuredClone(AGENDA_SEED);
        localStorage.setItem(AGENDA_STORAGE_KEY, JSON.stringify(seeded));
        return seeded;
      }
    }

    // Migrate from follow-ups v2
    const legacy = localStorage.getItem(FOLLOWUPS_LEGACY_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (Array.isArray(parsed) && parsed.length > 0) {
        localStorage.setItem(AGENDA_STORAGE_KEY, JSON.stringify(parsed));
        return parsed;
      }
    }

    const seeded = structuredClone(AGENDA_SEED);
    localStorage.setItem(AGENDA_STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  } catch {
    return structuredClone(AGENDA_SEED);
  }
}

/** Mon–Sun week strip containing dateKey. */
export function weekContaining(dateKey) {
  return weekStripFor(dateKey);
}

/** Sunday start of week for a dateKey (UTC noon keys). Stick Mon–Sun via weekStripFor. */
export function weekRangeLabel(weekDays) {
  if (!weekDays?.length) return '';
  const first = weekDays[0].key;
  const last = weekDays[6].key;
  const fmt = (k) => {
    const [, m, d] = k.split('-');
    return `${Number(m)}/${Number(d)}`;
  };
  return `${fmt(first)}–${fmt(last)}`;
}

export function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  const names = [
    '',
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return `${names[m]} ${y}`;
}

export function shortMonth(ym) {
  const [, m] = ym.split('-').map(Number);
  const names = [
    '',
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return names[m] || ym;
}

/** Build Sep–Dec 2026 month keys (and extend if today is beyond). */
export function agendaMonthKeys(todayKey) {
  const keys = ['2026-09', '2026-10', '2026-11', '2026-12'];
  const tm = todayKey.slice(0, 7);
  if (tm < '2026-09') {
    // include current month if earlier
    if (!keys.includes(tm)) keys.unshift(tm);
  } else if (tm > '2026-12') {
    // extend forward month by month to today
    let cur = '2026-12';
    while (cur < tm) {
      const [y, m] = cur.split('-').map(Number);
      const nm = m === 12 ? 1 : m + 1;
      const ny = m === 12 ? y + 1 : y;
      cur = `${ny}-${String(nm).padStart(2, '0')}`;
      keys.push(cur);
    }
  }
  return keys;
}

/** Weeks that intersect a calendar month (Mon–Sun). */
export function weeksInMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  const dim = daysInMonth(y, m);
  const seen = new Set();
  const weeks = [];
  for (let d = 1; d <= dim; d++) {
    const key = `${ym}-${String(d).padStart(2, '0')}`;
    const strip = weekStripFor(key);
    const id = strip[0].key;
    if (seen.has(id)) continue;
    seen.add(id);
    weeks.push({
      id,
      label: weekRangeLabel(strip),
      days: strip,
    });
  }
  return weeks;
}

export function useAgenda(todayKey) {
  const [items, setItems] = useState(loadItems);

  useEffect(() => {
    localStorage.setItem(AGENDA_STORAGE_KEY, JSON.stringify(items));
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

  /** Re-insert a full item snapshot (for undo of delete). */
  const restore = useCallback((item) => {
    if (!item?.id) return;
    setItems((prev) => {
      if (prev.some((it) => it.id === item.id)) {
        return prev.map((it) => (it.id === item.id ? { ...item } : it));
      }
      return [{ ...item }, ...prev];
    });
  }, []);

  const getItem = useCallback(
    (id) => items.find((it) => it.id === id) || null,
    [items],
  );

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
        it.id === id
          ? { ...it, due: due || null, month: due ? null : it.month }
          : it,
      ),
    );
  }, []);

  const openItems = useMemo(() => items.filter((i) => !i.done), [items]);

  const overdue = useMemo(
    () =>
      openItems
        .filter((it) => it.due && it.due < todayKey)
        .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0)),
    [openItems, todayKey],
  );

  /** Items for a specific date key (open + done that day). Overdue also listed on original due. */
  const itemsForDate = useCallback(
    (dateKey) => {
      const list = items.filter((it) => it.due === dateKey);
      return list.sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return a.title.localeCompare(b.title);
      });
    },
    [items],
  );

  /** Month-only queue (no due date). */
  const monthQueue = useCallback(
    (ym) =>
      openItems
        .filter((it) => it.month === ym && !it.due)
        .sort((a, b) => a.title.localeCompare(b.title)),
    [openItems],
  );

  /**
   * For weekly view: items dated in the week, plus overdue rolled onto today
   * when today is in this week.
   */
  const itemsForWeekDay = useCallback(
    (dateKey, weekKeys) => {
      const dated = items.filter((it) => it.due === dateKey);
      const rolled =
        dateKey === todayKey
          ? overdue.filter((it) => !weekKeys.includes(it.due))
          : [];
      const map = new Map();
      for (const it of [...rolled, ...dated]) map.set(it.id, it);
      return Array.from(map.values()).sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return a.title.localeCompare(b.title);
      });
    },
    [items, overdue, todayKey],
  );

  const counts = useMemo(() => {
    const todayCount = openItems.filter((it) => it.due === todayKey).length;
    const upcoming = openItems.filter(
      (it) => (it.due && it.due > todayKey) || (it.month && !it.due),
    ).length;
    return {
      overdue: overdue.length,
      today: todayCount,
      upcoming,
    };
  }, [openItems, overdue, todayKey]);

  const tended = overdue.length === 0;

  return {
    items,
    overdue,
    counts,
    tended,
    overdueCount: overdue.length,
    itemsForDate,
    itemsForWeekDay,
    monthQueue,
    add,
    toggle,
    remove,
    restore,
    getItem,
    rename,
    setDue,
  };
}

export { addDays };

/** America/New_York helpers for Manuel OS */

export const TZ = 'America/New_York';

export const CHECK_ORDER = [
  'wake',
  'leave',
  'exercise',
  'aiHour',
  'calAi',
  'familyPass',
];

export function getNyParts(date = new Date()) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const map = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  let hour = Number(map.hour);
  if (hour === 24) hour = 0;
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour,
    minute: Number(map.minute),
    weekday: map.weekday,
    dateKey: `${map.year}-${map.month}-${map.day}`,
  };
}

export function formatDayLabel(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return utc.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** Agenda day header parts: "Monday," + "9/21" (weekday full + M/D). */
export function formatAgendaDayParts(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const weekday = utc.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
  });
  return {
    weekday,
    date: `${m}/${d}`,
    label: `${weekday}, ${m}/${d}`,
  };
}

/** ISO week number (UTC noon of dateKey). */
export function weekLabel(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `W${weekNo}`;
}

/** Monday–Sunday keys for the week containing dateKey (NY calendar date). */
export function weekStripFor(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const noon = new Date(Date.UTC(y, m - 1, d, 12));
  const dow = noon.getUTCDay(); // 0 Sun … 6 Sat
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const days = [];
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(noon);
    dt.setUTCDate(noon.getUTCDate() + mondayOffset + i);
    const key = dt.toISOString().slice(0, 10);
    days.push({
      key,
      dow: names[i],
      today: key === dateKey,
      empty: false,
      pct: null,
    });
  }
  return days;
}

/**
 * Clock-suggested check — Morning vs Night only.
 * wake → leave → exercise → aiHour → calAi → familyPass
 */
export function suggestedCheckId(hour, minute) {
  const mins = hour * 60 + minute;
  if (mins < 5 * 60 + 30) return 'wake';
  if (mins < 6 * 60) return 'leave';
  if (mins < 8 * 60) return 'exercise';
  if (mins < 17 * 60) return 'aiHour';
  if (mins < 20 * 60) return 'calAi';
  return 'familyPass';
}

export function getNextUp(checks, hour, minute) {
  const allGraded = CHECK_ORDER.every(
    (id) => checks?.[id]?.status && checks[id].status !== 'PENDING',
  );
  if (allGraded) {
    return { id: null, closed: true, label: 'Day closed — see result below' };
  }

  const startId = suggestedCheckId(hour, minute);
  const startIdx = CHECK_ORDER.indexOf(startId);

  for (let i = startIdx; i < CHECK_ORDER.length; i++) {
    const id = CHECK_ORDER[i];
    if (!checks?.[id] || checks[id].status === 'PENDING') {
      return { id, closed: false, label: null };
    }
  }
  for (let i = 0; i < startIdx; i++) {
    const id = CHECK_ORDER[i];
    if (!checks?.[id] || checks[id].status === 'PENDING') {
      return { id, closed: false, label: null };
    }
  }
  return { id: null, closed: true, label: 'Day closed — see result below' };
}

/** Active day-part: Morning (< 5pm) or Night. */
export function activePeriodId(hour) {
  if (hour < 17) return 'morning';
  return 'night';
}

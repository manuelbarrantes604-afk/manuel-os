import { useMemo } from 'react';
import { CHECK_DEFS } from '../data/seed';

/** Morning stack that earns a calendar day for the streak. */
export const STREAK_CHECK_IDS = ['wake', 'leave', 'exercise'];

const XP_PER_PASS = 10;
const XP_PER_LEVEL = 100;

function shiftDateKey(dateKey, deltaDays) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

/**
 * v23: from `proofSince` onward a day is earned only with proof —
 * Wake + Leave logged on time (a tap, not a self-pass) and an Exercise photo.
 * Earlier days keep their original self-graded result.
 */
function dayEarned(day, key, proofSince) {
  if (!day?.checks) return false;
  const c = day.checks;
  if (proofSince && key && key >= proofSince) {
    return (
      c.wake?.status === 'PASS' &&
      Boolean(c.wake?.loggedAt) &&
      !c.wake?.late &&
      c.leave?.status === 'PASS' &&
      Boolean(c.leave?.loggedAt) &&
      !c.leave?.late &&
      c.exercise?.status === 'PASS' &&
      Boolean(c.exercise?.photo)
    );
  }
  return STREAK_CHECK_IDS.every((id) => c[id]?.status === 'PASS');
}

function minutesOf(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.getHours() * 60 + d.getMinutes();
}

function avg(list) {
  const xs = list.filter((x) => x != null);
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Compact activity label: Today / Yesterday / Mon 9/22 */
export function activityLabel(dateKey, todayKey) {
  if (!dateKey) return '—';
  if (dateKey === todayKey) return 'Today';
  if (dateKey === shiftDateKey(todayKey, -1)) return 'Yesterday';
  const [y, m, d] = dateKey.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d, 12));
  const weekday = utc.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
  });
  return `${weekday} ${m}/${d}`;
}

/**
 * Streak + XP derived from check-in history.
 * Earn day iff wake + leave + exercise are all PASS.
 * XP = count of PASS statuses across all days × 10 (deterministic).
 */
export function useStreak(days, todayKey, proofSince) {
  return useMemo(() => {
    const earnedKeys = new Set();
    let passCount = 0;

    for (const [key, day] of Object.entries(days || {})) {
      if (dayEarned(day, key, proofSince)) earnedKeys.add(key);
      if (day?.checks) {
        for (const def of CHECK_DEFS) {
          if (day.checks[def.id]?.status === 'PASS') passCount += 1;
        }
      }
    }

    const todayEarned = earnedKeys.has(todayKey);
    const yesterdayKey = shiftDateKey(todayKey, -1);

    // Current streak: consecutive earned days ending today (if earned)
    // or ending yesterday (if today still in progress / not earned).
    let current = 0;
    if (todayEarned) {
      let cursor = todayKey;
      while (earnedKeys.has(cursor)) {
        current += 1;
        cursor = shiftDateKey(cursor, -1);
      }
    } else if (earnedKeys.has(yesterdayKey)) {
      let cursor = yesterdayKey;
      while (earnedKeys.has(cursor)) {
        current += 1;
        cursor = shiftDateKey(cursor, -1);
      }
    } else {
      current = 0;
    }

    // Longest consecutive earned run in history
    const sorted = [...earnedKeys].sort();
    let longest = 0;
    let run = 0;
    let prev = null;
    for (const key of sorted) {
      if (prev && key === shiftDateKey(prev, 1)) {
        run += 1;
      } else {
        run = 1;
      }
      if (run > longest) longest = run;
      prev = key;
    }

    const lastEarnedKey = sorted.length ? sorted[sorted.length - 1] : null;
    const lastActivityLabel = activityLabel(lastEarnedKey, todayKey);

    const xp = passCount * XP_PER_PASS;
    const level = Math.floor(xp / XP_PER_LEVEL) + 1;

    // Mini calendar: last 14 days inclusive of today
    const calendar = [];
    for (let i = 13; i >= 0; i -= 1) {
      const key = shiftDateKey(todayKey, -i);
      const [y, m, d] = key.split('-').map(Number);
      const utc = new Date(Date.UTC(y, m - 1, d, 12));
      const dow = utc.toLocaleDateString('en-US', {
        timeZone: 'UTC',
        weekday: 'narrow',
      });
      const c = days?.[key]?.checks;
      calendar.push({
        key,
        dow,
        dayNum: d,
        earned: earnedKeys.has(key),
        today: key === todayKey,
        wakeAt: c?.wake?.loggedAt || null,
        leaveAt: c?.leave?.loggedAt || null,
        hasPhoto: Boolean(c?.exercise?.photo),
      });
    }

    // Logged proof times: last 7 days incl. today (avg minutes since midnight).
    const last7 = calendar.slice(-7);
    const proofTimes = {
      avgWake: avg(last7.map((d) => minutesOf(d.wakeAt))),
      avgLeave: avg(last7.map((d) => minutesOf(d.leaveAt))),
      wakeCount: last7.filter((d) => d.wakeAt).length,
      leaveCount: last7.filter((d) => d.leaveAt).length,
      photoCount: last7.filter((d) => d.hasPhoto).length,
    };

    return {
      current,
      longest,
      lastActivityLabel,
      lastEarnedKey,
      earnedKeys,
      todayEarned,
      xp,
      level,
      calendar,
      proofTimes,
      proofSince,
      xpPerPass: XP_PER_PASS,
    };
  }, [days, todayKey, proofSince]);
}

export { shiftDateKey, dayEarned, XP_PER_PASS };

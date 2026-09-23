/** Seed data for Manuel OS — W39 2026 + blank-day factory */

import { formatDayLabel, weekLabel } from '../lib/time';

export const CHECK_DEFS = [
  {
    id: 'wake',
    label: 'Wake',
    target: '5:00am',
    dueHour: 5,
    dueMinute: 15,
    proof: false,
  },
  {
    id: 'leave',
    label: 'Leave by',
    target: '5:30am',
    dueHour: 5,
    dueMinute: 45,
    proof: false,
  },
  {
    id: 'exercise',
    label: 'Exercise',
    target: '6:00am',
    dueHour: 6,
    dueMinute: 30,
    proof: false,
  },
  {
    id: 'priorities',
    label: 'Priorities set',
    target: 'morning',
    dueHour: 9,
    dueMinute: 0,
    proof: false,
  },
  {
    id: 'calories',
    label: 'Calories',
    target: 'evening',
    dueHour: 20,
    dueMinute: 0,
    proof: false,
  },
  {
    id: 'sleep',
    label: 'Sleep by',
    target: '8:30pm',
    dueHour: 20,
    dueMinute: 45,
    proof: false,
  },
];

export const DAY_PARTS = [
  {
    id: 'morning',
    title: 'Morning',
    coachLine: 'Win the morning. Faith, body, then priorities.',
    checkIds: ['wake', 'leave', 'exercise', 'priorities'],
  },
  {
    id: 'night',
    title: 'Night',
    coachLine: 'Close the loop. Fuel logged. Lights out by 8:30.',
    checkIds: ['calories', 'sleep'],
  },
];

export const IMPROVE_TIPS = {
  wake: {
    title: 'Wake 5:00',
    tip: 'Phone out of reach. Get vertical before the negotiation starts. Faith first.',
  },
  leave: {
    title: 'Leave by 5:30',
    tip: 'Shoes on by 5:25. Discipline is the clock, not the mood.',
  },
  exercise: {
    title: 'Exercise 6:00',
    tip: 'Move the body on schedule. Health is earned in the work you do.',
  },
  priorities: {
    title: 'Priorities set',
    tip: 'Lock three priorities in writing before the day drifts. Name the work.',
  },
  calories: {
    title: 'Calories',
    tip: 'Log before dinner winds down. Fuel logged is honesty.',
  },
  sleep: {
    title: 'Sleep by 8:30',
    tip: "Lights out protects tomorrow's morning. Phone down so Faith can lead at 5:00.",
  },
};

export const VALUES = [
  {
    id: 'faith',
    title: 'Faith',
    blurb: 'Stay rooted. Prayer before performance.',
  },
  {
    id: 'health',
    title: 'Health',
    blurb: 'Body is the operating system. Fuel it.',
  },
  {
    id: 'discipline',
    title: 'Discipline',
    blurb: 'Do the non-negotiables. No negotiation.',
  },
];

export const GOALS = [
  { id: 'lbs', title: 'Lose 30 lbs', meta: 'Body recomposition', progress: 12 },
  { id: 'hm', title: 'Half marathon', meta: 'Race-ready endurance', progress: 28 },
  { id: 'mos', title: 'Launch Manuel OS', meta: 'Accountability product', progress: 45 },
  { id: 'ai', title: 'AI mastery', meta: 'Ship with agents daily', progress: 55 },
  { id: 'family', title: 'Family', meta: 'Present & protective', progress: 70 },
  { id: 'strength', title: 'Fitness / emotional strength', meta: 'Hard body, calm mind', progress: 35 },
];

export function blankDay(dateKey) {
  const checks = {};
  for (const def of CHECK_DEFS) {
    checks[def.id] = {
      status: 'PENDING',
      time: '—',
      note: 'Not graded yet',
    };
  }
  return {
    date: dateKey,
    week: weekLabel(dateKey),
    label: formatDayLabel(dateKey),
    closed: false,
    checks,
    review: {
      ran: false,
      title: 'Evening review',
      score: null,
      body: 'Review opens when the day is closed.',
      wins: [],
      misses: [],
    },
  };
}

/** Remap legacy midday check → priorities (v5 → v6). */
export function migrateDay(day) {
  if (!day || !day.checks) return day;
  const next = { ...day, checks: { ...day.checks } };
  if (next.checks.midday && !next.checks.priorities) {
    next.checks.priorities = { ...next.checks.midday };
  }
  if (next.checks.midday) {
    delete next.checks.midday;
  }
  // Ensure all current check ids exist
  for (const def of CHECK_DEFS) {
    if (!next.checks[def.id]) {
      next.checks[def.id] = {
        status: 'PENDING',
        time: '—',
        note: 'Not graded yet',
      };
    }
  }
  if (typeof next.closed !== 'boolean') {
    next.closed = false;
  }
  return next;
}

/** Tue Sep 22 — first day of stack, rough execution */
export const SEED_DAYS = {
  '2026-09-22': {
    date: '2026-09-22',
    week: 'W39',
    label: 'Tue Sep 22',
    closed: true,
    checks: {
      wake: { status: 'FAIL', time: '—', note: 'Missed wake window' },
      leave: { status: 'FAIL', time: '—', note: 'Cold-plunge / leave missed' },
      exercise: { status: 'FAIL', time: '—', note: 'No proof submitted' },
      priorities: { status: 'FAIL', time: '—', note: 'Priorities not locked' },
      calories: { status: 'FAIL', time: '—', note: 'Log miss' },
      sleep: { status: 'PASS', time: '8:28pm', note: 'Hit lights-out' },
    },
    review: {
      ran: true,
      title: 'Evening review — Day 1',
      score: 17,
      body: 'First day of the stack. Wake, leave, exercise, priorities, and calories all missed. Sleep was the only pass. Honesty > comfort.',
      wins: ['Stack is live', 'Evening review completed'],
      misses: ['Wake 5:00', 'Leave 5:30', 'Exercise', 'Priorities', 'Calories'],
    },
  },
  '2026-09-23': {
    date: '2026-09-23',
    week: 'W39',
    label: 'Wed Sep 23',
    closed: false,
    checks: {
      wake: {
        status: 'FAIL',
        time: '5:02am',
        note: 'Check fired ~5:02 — no reply (coach honesty)',
      },
      leave: {
        status: 'FAIL',
        time: '5:41am',
        note: 'Fired ~5:41 — no confirmation',
      },
      exercise: {
        status: 'FAIL',
        time: '6:12am',
        note: 'Proof request ~6:12 — no photo',
      },
      priorities: {
        status: 'PENDING',
        time: '—',
        note: 'Set Top 3, then Pass/Fail',
      },
      calories: {
        status: 'PENDING',
        time: '—',
        note: 'Pass/Fail when logged',
      },
      sleep: {
        status: 'PENDING',
        time: '—',
        note: 'Target 8:30pm',
      },
    },
    review: {
      ran: false,
      title: 'Evening review — Day 2',
      score: null,
      body: 'Review opens after you close the day. Morning stack already needs a reset.',
      wins: [],
      misses: [],
    },
  },
};

export const STREAKS = [
  { id: 'wake', label: 'Wake 5:00', count: 0, unit: 'days' },
  { id: 'exercise', label: 'Exercise', count: 0, unit: 'days' },
  { id: 'sleep', label: 'Sleep 8:30', count: 1, unit: 'day' },
];

export const STORAGE_KEY = 'manuel-os-v6';

export const PRIORITY_PLACEHOLDERS = [
  'Family dinner present',
  'Manuel OS iteration',
  'AI learning block',
];

export const WEIGHT_STORAGE_KEY = 'manuel-os-weight-v1';
export const CALORIES_STORAGE_KEY = 'manuel-os-calories-v1';

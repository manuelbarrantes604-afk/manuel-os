/** Seed data for Manuel OS — compact Morning + Night (v9) */

import { formatDayLabel, weekLabel } from '../lib/time';

export const CHECK_DEFS = [
  {
    id: 'wake',
    label: 'Wake 5:00',
    target: '5:00am',
    dueHour: 5,
    dueMinute: 15,
    proof: false,
  },
  {
    id: 'leave',
    label: 'Leave 5:30',
    target: '5:30am',
    dueHour: 5,
    dueMinute: 45,
    proof: false,
  },
  {
    id: 'exercise',
    label: 'Exercise 6:00',
    target: '6:00am',
    dueHour: 6,
    dueMinute: 30,
    proof: false,
  },
  {
    id: 'aiHour',
    label: '1hr AI',
    target: 'after exercise',
    dueHour: 8,
    dueMinute: 0,
    proof: false,
  },
  {
    id: 'calAi',
    label: 'Cal AI review',
    target: 'end of day',
    dueHour: 20,
    dueMinute: 0,
    proof: false,
  },
  {
    id: 'familyPass',
    label: 'Family time',
    target: 'evening',
    dueHour: 20,
    dueMinute: 30,
    proof: false,
  },
];

export const DAY_PARTS = [
  {
    id: 'morning',
    title: 'Morning',
    coachLine: 'Wake · Leave · Move · AI hour',
    checkIds: ['wake', 'leave', 'exercise', 'aiHour'],
  },
  {
    id: 'night',
    title: 'Night',
    coachLine: 'Cal AI · Family · Close',
    checkIds: ['calAi', 'familyPass'],
  },
];

export const IMPROVE_TIPS = {
  wake: {
    title: 'Wake 5:00',
    tip: 'Phone out of reach. Get vertical before the negotiation starts. Faith first.',
  },
  leave: {
    title: 'Leave 5:30',
    tip: 'Shoes on by 5:25. Discipline is the clock, not the mood.',
  },
  exercise: {
    title: 'Exercise 6:00',
    tip: 'Move the body on schedule. Health is earned in the work you do.',
  },
  aiHour: {
    title: '1hr AI',
    tip: 'After exercise, protect one focused hour. AI mastery is a calendar block, not a vibe.',
  },
  calAi: {
    title: 'Cal AI review',
    tip: 'Open Cal AI. Review the day honestly. Pass only if the review happened — no number to type here.',
  },
  familyPass: {
    title: 'Family time',
    tip: 'Be present. Put the phone down. Family does not get the leftovers of your attention.',
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

const LEGACY_DROP = [
  'midday',
  'priorities',
  'calories',
  'sleep',
  'caloriesPass',
];

/** Remap legacy days → v9 (same checks as v8; drop midday/priorities/sleep/calorie-number). */
export function migrateDay(day) {
  if (!day || !day.checks) return day;
  const next = { ...day, checks: { ...day.checks } };

  for (const id of LEGACY_DROP) {
    if (next.checks[id]) delete next.checks[id];
  }

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
      aiHour: { status: 'FAIL', time: '—', note: 'AI hour missed' },
      calAi: { status: 'FAIL', time: '—', note: 'Cal AI review missed' },
      familyPass: { status: 'PASS', time: '—', note: 'Family time held' },
    },
    review: {
      ran: true,
      title: 'Evening review — Day 1',
      score: 17,
      body: 'First day of the stack. Morning stack and Cal AI review missed. Family time was the only pass. Honesty > comfort.',
      wins: ['Stack is live', 'Evening review completed'],
      misses: ['Wake 5:00', 'Leave 5:30', 'Exercise', '1hr AI', 'Cal AI review'],
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
      aiHour: {
        status: 'PENDING',
        time: '—',
        note: 'After exercise',
      },
      calAi: {
        status: 'PENDING',
        time: '—',
        note: 'End of day review',
      },
      familyPass: {
        status: 'PENDING',
        time: '—',
        note: 'Evening presence',
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
  { id: 'aiHour', label: 'AI hour', count: 0, unit: 'days' },
];

export const STORAGE_KEY = 'manuel-os-v9';

/** @deprecated daily weigh-in history — Progress now uses weight-goal-v1 */
export const WEIGHT_STORAGE_KEY = 'manuel-os-weight-v1';
export const WEIGHT_GOAL_KEY = 'manuel-os-weight-goal-v1';
export const WEEK_WEIGHT_KEY = 'manuel-os-week-weight-v1';

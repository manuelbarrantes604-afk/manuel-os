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
    proof: true,
  },
  {
    id: 'midday',
    label: 'Midday priorities',
    target: '12:00pm',
    dueHour: 12,
    dueMinute: 30,
    proof: false,
  },
  {
    id: 'calories',
    label: 'Cal AI calories',
    target: 'evening',
    dueHour: 20,
    dueMinute: 0,
    proof: true,
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
    coachLine: 'Win the morning, win the day. Faith first, then the body.',
    checkIds: ['wake', 'leave', 'exercise'],
  },
  {
    id: 'midday',
    title: 'Midday',
    coachLine: 'Lock three priorities. Protect family time. No drift.',
    checkIds: ['midday'],
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
    tip: 'Phone out of reach. Reply to the 5am check immediately. Faith first — get vertical before the negotiation starts.',
  },
  leave: {
    title: 'Leave by 5:30',
    tip: 'Shoes on by 5:25. Confirm leave in chat. Discipline is the clock, not the mood.',
  },
  exercise: {
    title: 'Exercise 6:00',
    tip: 'Photo is the proof (in chat). No text-only. Health is earned in the work you do.',
  },
  midday: {
    title: 'Midday priorities',
    tip: 'Lock three priorities in writing. Protect family time. Name the work — no drift.',
  },
  calories: {
    title: 'Cal AI calories',
    tip: 'Log before dinner winds down. Fuel logged is honesty. Intentions do not burn calories.',
  },
  sleep: {
    title: 'Sleep by 8:30',
    tip: "Lights out protects tomorrow's morning. Phone down. Win the night so Faith can lead at 5:00.",
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
    checks,
    review: {
      ran: false,
      title: 'Evening review',
      score: null,
      body: 'Review opens when every check is Pass or Fail.',
      wins: [],
      misses: [],
    },
  };
}

/** Tue Sep 22 — first day of stack, rough execution */
export const SEED_DAYS = {
  '2026-09-22': {
    date: '2026-09-22',
    week: 'W39',
    label: 'Tue Sep 22',
    checks: {
      wake: { status: 'FAIL', time: '—', note: 'Missed wake window' },
      leave: { status: 'FAIL', time: '—', note: 'Cold-plunge / leave missed' },
      exercise: { status: 'FAIL', time: '—', note: 'No proof submitted' },
      midday: { status: 'FAIL', time: '—', note: 'Priorities not locked' },
      calories: { status: 'FAIL', time: '—', note: 'Screenshot miss' },
      sleep: { status: 'PASS', time: '8:28pm', note: 'Hit lights-out' },
    },
    review: {
      ran: true,
      title: 'Evening review — Day 1',
      score: 17,
      body: 'First day of the stack. Wake, leave, exercise, midday, and calories all missed. Sleep was the only pass. Honesty > comfort. Tomorrow: fire checks on time and reply.',
      wins: ['Stack is live', 'Evening review completed'],
      misses: ['Wake 5:00', 'Leave 5:30', 'Exercise proof', 'Midday lock', 'Cal AI'],
    },
  },
  '2026-09-23': {
    date: '2026-09-23',
    week: 'W39',
    label: 'Wed Sep 23',
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
      midday: {
        status: 'PENDING',
        time: '12:41pm',
        note: 'Check fired ~12:41 — still waiting on your reply',
      },
      calories: {
        status: 'PENDING',
        time: '—',
        note: 'Awaiting Cal AI log',
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
      body: 'Review opens after sleep check. Morning stack already needs a reset. Midday fired — reply when priorities are locked.',
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

export const STORAGE_KEY = 'manuel-os-v5';

export const PRIORITY_PLACEHOLDERS = [
  'Family dinner present',
  'Manuel OS iteration',
  'AI learning block',
];

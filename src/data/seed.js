/** Seed data for Manuel OS — W39 2026 */

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
    label: 'Exercise photo',
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
    target: 'screenshot',
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
        note: 'Awaiting Cal AI screenshot',
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

export const WEEK_STRIP = [
  { key: '2026-09-21', dow: 'Mon', pct: null, empty: true },
  { key: '2026-09-22', dow: 'Tue', pct: 17, empty: false },
  { key: '2026-09-23', dow: 'Wed', pct: null, empty: false, today: true },
  { key: '2026-09-24', dow: 'Thu', pct: null, empty: true },
  { key: '2026-09-25', dow: 'Fri', pct: null, empty: true },
  { key: '2026-09-26', dow: 'Sat', pct: null, empty: true },
  { key: '2026-09-27', dow: 'Sun', pct: null, empty: true },
];

export const STREAKS = [
  { id: 'wake', label: 'Wake 5:00', count: 0, unit: 'days' },
  { id: 'exercise', label: 'Exercise', count: 0, unit: 'days' },
  { id: 'sleep', label: 'Sleep 8:30', count: 1, unit: 'day' },
];

export const STORAGE_KEY = 'manuel-os-v2';
export const TODAY_KEY = '2026-09-23';

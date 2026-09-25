/** Soft pastel task icons + period bucketing for Manuel OS v20 (Tiimo-inspired, no brand). */

export const PERIODS = [
  { id: 'morning', label: 'MORNING', icon: '☀' },
  { id: 'afternoon', label: 'AFTERNOON', icon: '☼' },
  { id: 'evening', label: 'EVENING', icon: '☾' },
];

const PASTELS = [
  'var(--pastel-mint)',
  'var(--pastel-peach)',
  'var(--pastel-sky)',
  'var(--pastel-lilac)',
  'var(--pastel-butter)',
  'var(--pastel-rose)',
  'var(--pastel-sage)',
];

const ICON_RULES = [
  { re: /bike|cycl|ride|uber|drive|truck|car|bus/i, emoji: '🚲' },
  { re: /clean|laundry|wash|springdale|dima clean/i, emoji: '🧺' },
  { re: /food|lunch|dinner|salad|eat|factor|meal/i, emoji: '🥗' },
  { re: /church|faith|pray|bible/i, emoji: '✝' },
  { re: /photo|camera|shoot/i, emoji: '📷' },
  { re: /pack|clothes|bag|travel|airport|baltimore/i, emoji: '🧳' },
  { re: /meet|biz|work|office|loa|approval|paycheck|pay|receipt|money|\$/i, emoji: '💼' },
  { re: /family|josh|ivania|dunia|marina|laura|marvin/i, emoji: '💛' },
  { re: /health|exercise|gym|run|walk|ring/i, emoji: '💪' },
  { re: /ai|cal|review|write|note|read|book/i, emoji: '📘' },
  { re: /wake|morning|sun/i, emoji: '🌅' },
  { re: /night|sleep|close|evening/i, emoji: '🌙' },
  { re: /plant|flower|garden/i, emoji: '🌿' },
  { re: /map|pin|location|place/i, emoji: '📍' },
];

const CHECK_ICONS = {
  wake: { emoji: '🌅', bg: 'var(--pastel-butter)' },
  leave: { emoji: '🚪', bg: 'var(--pastel-peach)' },
  exercise: { emoji: '💪', bg: 'var(--pastel-mint)' },
  aiHour: { emoji: '✨', bg: 'var(--pastel-lilac)' },
  calAi: { emoji: '📘', bg: 'var(--pastel-sky)' },
  familyPass: { emoji: '💛', bg: 'var(--pastel-rose)' },
};

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function iconForTitle(title = '') {
  for (const rule of ICON_RULES) {
    if (rule.re.test(title)) {
      return {
        emoji: rule.emoji,
        bg: PASTELS[hashStr(title) % PASTELS.length],
      };
    }
  }
  const fallback = ['📝', '✦', '🎯', '🪴', '☕', '📌'];
  const h = hashStr(title || 'x');
  return { emoji: fallback[h % fallback.length], bg: PASTELS[h % PASTELS.length] };
}

export function iconForCheck(id) {
  return CHECK_ICONS[id] || { emoji: '○', bg: 'var(--pastel-sage)' };
}

/** Infer morning/afternoon/evening from title time cues; default afternoon. */
export function inferPeriod(title = '', existing) {
  if (existing === 'morning' || existing === 'afternoon' || existing === 'evening') {
    return existing;
  }
  const t = String(title || '');

  // Explicit early hours like 3am, 5:00, 5am–11am
  const am = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?)/i);
  const pm = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(p\.?m\.?)/i);
  const h24 = t.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);

  let hour = null;
  if (am) {
    hour = Number(am[1]) % 12;
  } else if (pm) {
    hour = (Number(pm[1]) % 12) + 12;
  } else if (h24) {
    hour = Number(h24[1]);
  }

  if (hour != null) {
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  }

  if (/\b(morning|wake|breakfast|am)\b/i.test(t)) return 'morning';
  if (/\b(evening|night|dinner|bed)\b/i.test(t)) return 'evening';
  if (/\b(afternoon|lunch)\b/i.test(t)) return 'afternoon';
  return 'afternoon';
}

export function monthAbbrev(dateKey) {
  const [, m] = dateKey.split('-').map(Number);
  const names = [
    '',
    'JAN',
    'FEB',
    'MAR',
    'APR',
    'MAY',
    'JUN',
    'JUL',
    'AUG',
    'SEP',
    'OCT',
    'NOV',
    'DEC',
  ];
  const y = dateKey.slice(0, 4);
  return `${names[m]} ${y}`;
}

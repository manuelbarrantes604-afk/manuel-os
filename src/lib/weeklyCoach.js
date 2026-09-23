/** Hard weekly truth lines from Pass/Fail + metrics — no flattery. */

import { CHECK_DEFS } from '../data/seed';

const MORNING_IDS = ['wake', 'leave', 'exercise', 'priorities'];
const NIGHT_IDS = ['calories', 'sleep'];

function rate(pass, total) {
  if (!total) return null;
  return Math.round((pass / total) * 100);
}

/**
 * @param {Array<{ key: string, checks: object, pct: number|null }>} weekDays
 * @param {{ weights: Record<string, number>, calories: Record<string, number> }} metrics
 */
export function buildWeeklyReport(weekDays, metrics = {}) {
  const graded = weekDays.filter((d) => d.pct != null);
  const avg =
    graded.length === 0
      ? null
      : Math.round(
          graded.reduce((a, d) => a + d.pct, 0) / graded.length,
        );

  const byCheck = {};
  for (const def of CHECK_DEFS) {
    let pass = 0;
    let fail = 0;
    let pending = 0;
    for (const d of weekDays) {
      const s = d.checks?.[def.id]?.status;
      if (s === 'PASS') pass += 1;
      else if (s === 'FAIL') fail += 1;
      else pending += 1;
    }
    byCheck[def.id] = { pass, fail, pending, total: weekDays.length };
  }

  const morningFails = MORNING_IDS.reduce(
    (n, id) => n + (byCheck[id]?.fail || 0),
    0,
  );
  const morningPasses = MORNING_IDS.reduce(
    (n, id) => n + (byCheck[id]?.pass || 0),
    0,
  );
  const nightFails = NIGHT_IDS.reduce(
    (n, id) => n + (byCheck[id]?.fail || 0),
    0,
  );
  const nightPasses = NIGHT_IDS.reduce(
    (n, id) => n + (byCheck[id]?.pass || 0),
    0,
  );

  const morningRate = rate(morningPasses, morningPasses + morningFails);
  const nightRate = rate(nightPasses, nightPasses + nightFails);

  // Miss / hit patterns
  const patterns = [];
  for (const def of CHECK_DEFS) {
    const c = byCheck[def.id];
    if (c.fail >= 2) {
      patterns.push({
        id: def.id,
        kind: 'leak',
        label: def.label,
        detail: `${c.fail} fails this week`,
      });
    } else if (c.pass >= 3 && c.fail === 0) {
      patterns.push({
        id: def.id,
        kind: 'hold',
        label: def.label,
        detail: `${c.pass} passes · no fails`,
      });
    }
  }

  // Weight trend for week keys
  const weekKeys = new Set(weekDays.map((d) => d.key));
  const weightEntries = Object.entries(metrics.weights || {})
    .filter(([k, v]) => weekKeys.has(k) && typeof v === 'number')
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));
  let weightTrend = null;
  if (weightEntries.length >= 2) {
    const first = weightEntries[0][1];
    const last = weightEntries[weightEntries.length - 1][1];
    weightTrend = {
      first,
      last,
      delta: Math.round((last - first) * 10) / 10,
      count: weightEntries.length,
    };
  } else if (weightEntries.length === 1) {
    weightTrend = {
      first: weightEntries[0][1],
      last: weightEntries[0][1],
      delta: 0,
      count: 1,
    };
  }

  const calEntries = Object.entries(metrics.calories || {})
    .filter(([k, v]) => weekKeys.has(k) && typeof v === 'number')
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const calorieSum = calEntries.reduce((a, [, v]) => a + v, 0);
  const calorieAvg =
    calEntries.length === 0
      ? null
      : Math.round(calorieSum / calEntries.length);

  const truths = buildTruths({
    avg,
    gradedCount: graded.length,
    morningRate,
    nightRate,
    morningFails,
    nightFails,
    byCheck,
    weightTrend,
    calorieAvg,
    calLogged: calEntries.length,
  });

  return {
    avg,
    gradedCount: graded.length,
    dayCount: weekDays.length,
    byCheck,
    patterns,
    morningRate,
    nightRate,
    weightTrend,
    calorieAvg,
    calorieSum: calEntries.length ? calorieSum : null,
    calLogged: calEntries.length,
    truths,
  };
}

function buildTruths(ctx) {
  const lines = [];

  if (ctx.gradedCount === 0) {
    lines.push({
      theme: 'Discipline',
      line: 'Zero graded days. Manuel OS cannot coach ghosts. Close a day.',
    });
    lines.push({
      theme: 'Faith',
      line: 'Faith without a record is talk. Start logging Pass/Fail.',
    });
    return lines;
  }

  if (ctx.avg != null && ctx.avg < 50) {
    lines.push({
      theme: 'Discipline',
      line: `Week average ${ctx.avg}%. Below standard. The stack is not optional — it is the operating system.`,
    });
  } else if (ctx.avg != null && ctx.avg < 80) {
    lines.push({
      theme: 'Discipline',
      line: `Week average ${ctx.avg}%. Partial execution. Close the open holes or stop pretending this is serious.`,
    });
  } else if (ctx.avg != null) {
    lines.push({
      theme: 'Discipline',
      line: `Week average ${ctx.avg}%. On standard — protect it. One soft morning undoes three hard ones.`,
    });
  }

  if (ctx.morningRate != null && ctx.morningRate < 50) {
    lines.push({
      theme: 'Health',
      line: `Mornings are the leak (${ctx.morningRate}% pass rate). Wake / leave / exercise failing kills the 30 lb loss and the half marathon. Fix 5:00 before you negotiate dinner.`,
    });
  } else if (ctx.byCheck.exercise?.fail >= 2) {
    lines.push({
      theme: 'Health',
      line: `Exercise failed ${ctx.byCheck.exercise.fail}×. Fitness and emotional strength are not mood projects — they are calendar projects.`,
    });
  }

  if (ctx.weightTrend) {
    if (ctx.weightTrend.count === 1) {
      lines.push({
        theme: 'Health',
        line: `One weight entry (${ctx.weightTrend.last} lbs). One data point is not a trend. Weigh every morning or stop claiming the cut.`,
      });
    } else if (ctx.weightTrend.delta > 0.5) {
      lines.push({
        theme: 'Health',
        line: `Weight up ${ctx.weightTrend.delta} lbs this week (${ctx.weightTrend.first} → ${ctx.weightTrend.last}). The 30 lb goal is moving the wrong way. Calories and mornings, not vibes.`,
      });
    } else if (ctx.weightTrend.delta < -0.5) {
      lines.push({
        theme: 'Health',
        line: `Weight down ${Math.abs(ctx.weightTrend.delta)} lbs (${ctx.weightTrend.first} → ${ctx.weightTrend.last}). Keep the deficit honest — half marathon still needs the legs.`,
      });
    }
  } else {
    lines.push({
      theme: 'Health',
      line: 'No weight logged this week. You cannot lose 30 lbs on memory. Scale in the morning.',
    });
  }

  if (ctx.calLogged === 0) {
    lines.push({
      theme: 'Health',
      line: 'Zero calorie totals typed. Cal AI stay in the app — your number still has to land here. Blind eating is not a cut.',
    });
  } else if (ctx.calorieAvg != null && ctx.calorieAvg > 2800) {
    lines.push({
      theme: 'Health',
      line: `Avg ${ctx.calorieAvg} kcal logged. High for a cut unless you earned it in training. Discipline is the number, not the story.`,
    });
  }

  if (ctx.byCheck.priorities?.fail >= 1 || ctx.byCheck.priorities?.pass === 0) {
    lines.push({
      theme: 'Family',
      line: 'Priorities weak or missing. Family meaningful time does not appear by accident — name it in the Top 3 or it gets crowded out.',
    });
  }

  if (ctx.byCheck.sleep?.fail >= 2) {
    lines.push({
      theme: 'Faith',
      line: `Sleep failed ${ctx.byCheck.sleep.fail}×. You cannot lead at 5:00 with a wrecked night. Faith starts with lights out.`,
    });
  } else if (ctx.nightRate != null && ctx.nightRate < 50) {
    lines.push({
      theme: 'Faith',
      line: `Night stack at ${ctx.nightRate}%. Closing the day poorly steals tomorrow's prayer-before-performance window.`,
    });
  }

  if (ctx.byCheck.wake?.fail >= 2) {
    lines.push({
      theme: 'Faith',
      line: `Wake failed ${ctx.byCheck.wake.fail}×. The 5:00 alarm is a covenant with yourself — break it and everything downstream softens.`,
    });
  }

  // Cap to keep UI tight but keep the hardest ones
  const order = ['Discipline', 'Health', 'Faith', 'Family'];
  lines.sort(
    (a, b) => order.indexOf(a.theme) - order.indexOf(b.theme),
  );
  return lines.slice(0, 6);
}

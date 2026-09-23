# Manuel OS

Evaluate execution, not intentions.

Live: https://manuelbarrantes604-afk.github.io/manuel-os/

## What it is

Local-first daily OS for Manuel — six Pass/Fail checks (Morning + Night), Close day, Progress (weight cut goal), Agenda (executive calendar), and a compact weather brief.

- **6 checks:** Wake 5:00 · Leave 5:30 · Exercise 6:00 · 1hr AI · Cal AI review · Family time
- **Weather:** Open-Meteo — **Arlington, VA** (default), Washington DC, Baltimore — temp, rain today?, H/L, dress line, expandable hourly — not a Pass/Fail
- **Progress:** start → current → target (−30 lbs), deadline 1st week of Jan 2027 — no daily weigh-in, no streaks
- **Agenda:** By date / Weekly / Monthly; hold/drag to move; voice add (Web Speech); overdue rolls forward; never blocks Close day
- **Nav:** Today · Progress · Agenda
- **Data:** `localStorage` only (`manuel-os-v9` checks, `manuel-os-agenda-v1`, `manuel-os-weight-goal-v1`, weather cache/loc)
- **Timezone:** America/New_York

## Local

```bash
npm install
npm run dev
npm run build
```

Base path for GitHub Pages: `/manuel-os/`.

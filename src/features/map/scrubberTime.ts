// Ren tids-matematik for TimeScrubber — ingen React/gesture-afhængigheder,
// så logikken kan unit-testes ligesom mapQuery og overlapsTime.
//
// Redesign 2026-07, 2. iteration: RULLENDE døgnakse fra nu−6t til nu+18t
// (rundet til hele timer). Den faste 06→06-akse knækkede om natten — kl. 05
// var der bogstaveligt talt intet at scrubbe. Den rullende akse giver altid
// mindst 15 timers fremtid (inkl. næste morgen), og fortiden (~25%) vises
// som stribet, låst kontekst.

export type TimeWindow = { mode: 'now' } | { mode: 'at'; at: Date };

export const AXIS_PAST_HOURS = 6;
export const AXIS_MINUTES = 24 * 60;

// Committede tider rundes til kvarter
export const SNAP_STEP_MINUTES = 15;

// Vindues-starter inden for dette af nu snapper tilbage til "NU"
export const NOW_SNAP_MINUTES = 20;

// Aksens venstre kant: nu rundet NED til hel time, minus AXIS_PAST_HOURS.
// Hele timer gør timelabels læselige selv om aksen ruller med døgnet.
export function axisStart(now: Date): Date {
  const start = new Date(now);
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() - AXIS_PAST_HOURS);
  return start;
}

export function axisEnd(now: Date): Date {
  const end = axisStart(now);
  end.setHours(end.getHours() + 24);
  return end;
}

// Tidspunkt → fraktion [0..1] på den rullende akse
export function fractionForTime(time: Date, now: Date): number {
  const startMs = axisStart(now).getTime();
  const f = (time.getTime() - startMs) / (AXIS_MINUTES * 60_000);
  return Math.min(Math.max(f, 0), 1);
}

// Oversæt en sluppet kapsel-position til det committede vindue.
// Vinduet kan aldrig starte før nu (fortiden er låst), og aldrig så
// sent at det ikke er windowMinutes langt inden for aksen.
export function windowForFraction(
  fraction: number,
  now: Date,
  windowMinutes: number,
): TimeWindow {
  const startMs = axisStart(now).getTime();
  const stepMs = SNAP_STEP_MINUTES * 60_000;
  const clamped = Math.min(Math.max(fraction, 0), 1);
  let ms = Math.round((startMs + clamped * AXIS_MINUTES * 60_000) / stepMs) * stepMs;
  const maxMs = Math.max(axisEnd(now).getTime() - windowMinutes * 60_000, now.getTime());
  ms = Math.min(Math.max(ms, now.getTime()), maxMs);
  if (ms <= now.getTime() + NOW_SNAP_MINUTES * 60_000) return { mode: 'now' };
  return { mode: 'at', at: new Date(ms) };
}

// Kapsel-position for et committet vindue
export function fractionForWindow(window: TimeWindow, now: Date): number {
  return fractionForTime(window.mode === 'at' ? window.at : now, now);
}

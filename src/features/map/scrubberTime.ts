// Ren tids-matematik for TimeScrubber — ingen React/gesture-afhængigheder,
// så logikken kan unit-testes ligesom mapQuery og overlapsTime.
//
// Redesign 2026-07: fast døgnakse 06→06 i stedet for NU→midnat. Aksen er
// læselig (faste timelabels), fortiden er synlig men låst, og selve
// synligheds-vinduet er en kapsel man trækker langs aksen.

export type TimeWindow = { mode: 'now' } | { mode: 'at'; at: Date };

// Aksen starter kl. 06 — natten hører til det foregående døgn
export const AXIS_START_HOUR = 6;
export const AXIS_MINUTES = 24 * 60;

// Committede tider rundes til kvarter
export const SNAP_STEP_MINUTES = 15;

// Vindues-starter inden for dette af nu snapper tilbage til "NU"
export const NOW_SNAP_MINUTES = 20;

// Seneste kl. 06 (lokal tid) — aksens venstre kant. Før kl. 06 om
// morgenen er det gårsdagens kl. 06.
export function axisStart(now: Date): Date {
  const start = new Date(now);
  start.setHours(AXIS_START_HOUR, 0, 0, 0);
  if (start.getTime() > now.getTime()) start.setDate(start.getDate() - 1);
  return start;
}

export function axisEnd(now: Date): Date {
  const end = axisStart(now);
  end.setDate(end.getDate() + 1);
  return end;
}

// Tidspunkt → fraktion [0..1] på 06→06-aksen
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

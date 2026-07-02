// Ren tids-matematik for TimeScrubber — ingen React/gesture-afhængigheder,
// så logikken kan unit-testes ligesom mapQuery og overlapsTime.

export type TimeWindow = { mode: 'now' } | { mode: 'at'; at: Date };

// Scrubberen dækker fra NU til midnat. Committede tider rundes til kvarter.
export const SNAP_STEP_MINUTES = 15;

// Thumb-positioner under denne fraktion snapper tilbage til "NU"
export const NOW_SNAP_FRACTION = 0.04;

// Næste midnat efter `now` (lokal tid)
export function endOfDay(now: Date): Date {
  const end = new Date(now);
  end.setHours(24, 0, 0, 0);
  return end;
}

// Fraktion [0..1] på tracken → tidspunkt mellem nu og midnat
export function timeAtFraction(fraction: number, now: Date): Date {
  const clamped = Math.min(Math.max(fraction, 0), 1);
  const endMs = endOfDay(now).getTime();
  return new Date(now.getTime() + clamped * (endMs - now.getTime()));
}

// Tidspunkt → fraktion [0..1] på tracken. Tider før nu (fx aktiviteter
// der allerede er i gang) lander på 0 = "NU".
export function fractionForTime(time: Date, now: Date): number {
  const endMs = endOfDay(now).getTime();
  const span = endMs - now.getTime();
  if (span <= 0) return 0;
  const fraction = (time.getTime() - now.getTime()) / span;
  return Math.min(Math.max(fraction, 0), 1);
}

// Rund et tidspunkt til nærmeste kvarter — dog aldrig før `now` og
// aldrig efter midnat (grænserne for scrubberens interval).
export function roundToStep(time: Date, now: Date): Date {
  const stepMs = SNAP_STEP_MINUTES * 60 * 1000;
  const rounded = new Date(Math.round(time.getTime() / stepMs) * stepMs);
  if (rounded.getTime() <= now.getTime()) return new Date(now);
  const endMs = endOfDay(now).getTime();
  if (rounded.getTime() > endMs) return new Date(endMs);
  return rounded;
}

// Oversæt en sluppet thumb-position til det committede tidsvindue.
// Nær venstre kant → "NU"; ellers kvarter-rundet fremtidigt tidspunkt.
export function windowForFraction(fraction: number, now: Date): TimeWindow {
  if (fraction <= NOW_SNAP_FRACTION) return { mode: 'now' };
  const at = roundToStep(timeAtFraction(fraction, now), now);
  if (at.getTime() <= now.getTime()) return { mode: 'now' };
  return { mode: 'at', at };
}

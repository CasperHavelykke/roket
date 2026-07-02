import {
  endOfDay,
  timeAtFraction,
  fractionForTime,
  roundToStep,
  windowForFraction,
  NOW_SNAP_FRACTION,
} from '../../../../src/features/map/scrubberTime';

// Fast "nu": middag lokal tid — giver et 12-timers scrubber-interval
const noon = new Date(2026, 5, 15, 12, 0, 0, 0);

describe('endOfDay', () => {
  test('returnerer næste midnat lokal tid', () => {
    expect(endOfDay(noon)).toEqual(new Date(2026, 5, 16, 0, 0, 0, 0));
  });
});

describe('timeAtFraction', () => {
  test('0 giver nu, 1 giver midnat', () => {
    expect(timeAtFraction(0, noon)).toEqual(noon);
    expect(timeAtFraction(1, noon)).toEqual(endOfDay(noon));
  });

  test('0.5 giver midtpunktet mellem nu og midnat', () => {
    expect(timeAtFraction(0.5, noon)).toEqual(new Date(2026, 5, 15, 18, 0, 0, 0));
  });

  test('clamper fraktioner uden for [0..1]', () => {
    expect(timeAtFraction(-0.5, noon)).toEqual(noon);
    expect(timeAtFraction(1.5, noon)).toEqual(endOfDay(noon));
  });
});

describe('fractionForTime', () => {
  test('er invers af timeAtFraction', () => {
    const t = timeAtFraction(0.3, noon);
    expect(fractionForTime(t, noon)).toBeCloseTo(0.3, 10);
  });

  test('tidspunkter før nu (igangværende aktiviteter) lander på 0', () => {
    const started = new Date(2026, 5, 15, 10, 30);
    expect(fractionForTime(started, noon)).toBe(0);
  });
});

describe('roundToStep', () => {
  test('runder til nærmeste kvarter', () => {
    expect(roundToStep(new Date(2026, 5, 15, 18, 7), noon)).toEqual(new Date(2026, 5, 15, 18, 0));
    expect(roundToStep(new Date(2026, 5, 15, 18, 8), noon)).toEqual(new Date(2026, 5, 15, 18, 15));
  });

  test('runder aldrig til før nu', () => {
    const justAfterNoon = new Date(2026, 5, 15, 12, 4);
    expect(roundToStep(justAfterNoon, noon).getTime()).toBeGreaterThanOrEqual(noon.getTime());
  });

  test('runder aldrig til efter midnat', () => {
    const nearMidnight = new Date(2026, 5, 15, 23, 59);
    expect(roundToStep(nearMidnight, noon).getTime()).toBeLessThanOrEqual(endOfDay(noon).getTime());
  });
});

describe('windowForFraction', () => {
  test('nær venstre kant giver NU-vinduet', () => {
    expect(windowForFraction(0, noon)).toEqual({ mode: 'now' });
    expect(windowForFraction(NOW_SNAP_FRACTION, noon)).toEqual({ mode: 'now' });
  });

  test('midt på tracken giver kvarter-rundet fremtidigt tidspunkt', () => {
    const w = windowForFraction(0.5, noon);
    expect(w.mode).toBe('at');
    if (w.mode === 'at') {
      expect(w.at).toEqual(new Date(2026, 5, 15, 18, 0));
      expect(w.at.getMinutes() % 15).toBe(0);
    }
  });

  test('helt til højre giver midnat', () => {
    const w = windowForFraction(1, noon);
    expect(w.mode).toBe('at');
    if (w.mode === 'at') {
      expect(w.at).toEqual(endOfDay(noon));
    }
  });
});

import {
  axisStart,
  axisEnd,
  fractionForTime,
  fractionForWindow,
  windowForFraction,
  AXIS_PAST_HOURS,
  NOW_SNAP_MINUTES,
} from '../../../../src/features/map/scrubberTime';

// Vinduesbredden er en parameter i modellen — testene bruger appens reelle
const WINDOW = 180;

// "Nu" med skæve minutter — aksen skal runde ned til hel time
const afternoon = new Date(2026, 5, 15, 14, 34, 0, 0);
// Kl. 04:10 om natten — den rullende akse skal stadig have 18 timers fremtid
const night = new Date(2026, 5, 15, 4, 10, 0, 0);

describe('axisStart / axisEnd', () => {
  test('starter AXIS_PAST_HOURS før nu, rundet ned til hel time', () => {
    expect(axisStart(afternoon)).toEqual(new Date(2026, 5, 15, 14 - AXIS_PAST_HOURS, 0, 0, 0));
    expect(axisEnd(afternoon)).toEqual(new Date(2026, 5, 16, 14 - AXIS_PAST_HOURS, 0, 0, 0));
  });

  test('ruller over midnat om natten', () => {
    // 04:10 → hel time 04:00 → minus 6t = 22:00 dagen før
    expect(axisStart(night)).toEqual(new Date(2026, 5, 14, 22, 0, 0, 0));
    // +24t = 22:00 samme dag — altid 18 timers fremtid
    expect(axisEnd(night)).toEqual(new Date(2026, 5, 15, 22, 0, 0, 0));
  });
});

describe('fractionForTime', () => {
  test('aksens kanter giver 0 og 1, midten 0.5', () => {
    expect(fractionForTime(axisStart(afternoon), afternoon)).toBe(0);
    expect(fractionForTime(new Date(2026, 5, 15, 20, 0), afternoon)).toBe(0.5);
    expect(fractionForTime(axisEnd(afternoon), afternoon)).toBe(1);
  });

  test('nu ligger lige efter kvart inde på aksen (6t + skæve minutter)', () => {
    expect(fractionForTime(afternoon, afternoon)).toBeCloseTo((6 * 60 + 34) / (24 * 60), 10);
  });

  test('clamper tider uden for aksen', () => {
    expect(fractionForTime(new Date(2026, 5, 15, 1, 0), afternoon)).toBe(0);
    expect(fractionForTime(new Date(2026, 5, 17, 12, 0), afternoon)).toBe(1);
  });
});

describe('windowForFraction', () => {
  test('positioner i fortiden clampes til NU', () => {
    expect(windowForFraction(0, afternoon, WINDOW)).toEqual({ mode: 'now' });
    expect(windowForFraction(0.2, afternoon, WINDOW)).toEqual({ mode: 'now' });
  });

  test('positioner tæt på nu snapper til NU (også efter kvarter-runding)', () => {
    const nowF = fractionForTime(afternoon, afternoon);
    // +10 min fra 14:34 = 14:44 → kvarter-rundet 14:45 = 11 min efter nu → NU
    const justAhead = nowF + 10 / (24 * 60);
    expect(windowForFraction(justAhead, afternoon, WINDOW)).toEqual({ mode: 'now' });
  });

  test('midt på aksen giver kvarter-rundet fremtidigt starttidspunkt', () => {
    const w = windowForFraction(0.5, afternoon, WINDOW);
    expect(w.mode).toBe('at');
    if (w.mode === 'at') {
      expect(w.at).toEqual(new Date(2026, 5, 15, 20, 0));
      expect(w.at.getMinutes() % 15).toBe(0);
    }
  });

  test('helt til højre clamper så vinduet stadig er inden for aksen', () => {
    const w = windowForFraction(1, afternoon, WINDOW);
    expect(w.mode).toBe('at');
    if (w.mode === 'at') {
      // axisEnd (08:00 næste dag) minus 3 timer = 05:00
      expect(w.at).toEqual(new Date(2026, 5, 16, 5, 0));
    }
  });

  test('om natten er der stadig masser af scrubbe-rum', () => {
    const w = windowForFraction(0.9, night, WINDOW);
    expect(w.mode).toBe('at');
    if (w.mode === 'at') {
      // 0.9 på 22:00→22:00-aksen = 19:36 → kvarter-rundet 19:30, langt ude i fremtiden
      expect(w.at.getTime()).toBeGreaterThan(night.getTime());
    }
  });
});

describe('fractionForWindow', () => {
  test('NU-vinduet lander på nu-positionen', () => {
    expect(fractionForWindow({ mode: 'now' }, afternoon)).toBeCloseTo((6 * 60 + 34) / (24 * 60), 10);
  });

  test('er invers af windowForFraction for frie positioner', () => {
    const w = windowForFraction(0.5, afternoon, WINDOW);
    expect(w.mode).toBe('at');
    if (w.mode === 'at') {
      expect(fractionForWindow(w, afternoon)).toBeCloseTo(0.5, 10);
    }
  });
});

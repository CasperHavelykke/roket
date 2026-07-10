import {
  axisStart,
  axisEnd,
  fractionForTime,
  fractionForWindow,
  windowForFraction,
  NOW_SNAP_MINUTES,
} from '../../../../src/features/map/scrubberTime';

// Vinduesbredden er en parameter i modellen — testene bruger appens reelle
const WINDOW = 180;

// Fast "nu": middag lokal tid — midt på 06→06-aksen
const noon = new Date(2026, 5, 15, 12, 0, 0, 0);
// Kl. 02 om natten — aksen skal stadig være GÅRSDAGENS 06→06
const night = new Date(2026, 5, 15, 2, 0, 0, 0);

describe('axisStart / axisEnd', () => {
  test('efter kl. 06 starter aksen samme dag kl. 06', () => {
    expect(axisStart(noon)).toEqual(new Date(2026, 5, 15, 6, 0, 0, 0));
    expect(axisEnd(noon)).toEqual(new Date(2026, 5, 16, 6, 0, 0, 0));
  });

  test('før kl. 06 hører natten til det foregående døgn', () => {
    expect(axisStart(night)).toEqual(new Date(2026, 5, 14, 6, 0, 0, 0));
    expect(axisEnd(night)).toEqual(new Date(2026, 5, 15, 6, 0, 0, 0));
  });
});

describe('fractionForTime', () => {
  test('aksens kanter giver 0 og 1, midten 0.5', () => {
    expect(fractionForTime(new Date(2026, 5, 15, 6, 0), noon)).toBe(0);
    expect(fractionForTime(new Date(2026, 5, 15, 18, 0), noon)).toBe(0.5);
    expect(fractionForTime(new Date(2026, 5, 16, 6, 0), noon)).toBe(1);
  });

  test('middag ligger kvart inde på aksen', () => {
    expect(fractionForTime(noon, noon)).toBe(0.25);
  });

  test('clamper tider uden for aksen', () => {
    expect(fractionForTime(new Date(2026, 5, 15, 3, 0), noon)).toBe(0);
    expect(fractionForTime(new Date(2026, 5, 17, 12, 0), noon)).toBe(1);
  });
});

describe('windowForFraction', () => {
  test('positioner i fortiden clampes til NU', () => {
    expect(windowForFraction(0, noon, WINDOW)).toEqual({ mode: 'now' });
    expect(windowForFraction(0.1, noon, WINDOW)).toEqual({ mode: 'now' });
  });

  test('positioner tæt på nu snapper til NU', () => {
    // Middag = 0.25; NOW_SNAP_MINUTES efter nu er stadig NU
    const justAhead = 0.25 + (NOW_SNAP_MINUTES - 1) / (24 * 60);
    expect(windowForFraction(justAhead, noon, WINDOW)).toEqual({ mode: 'now' });
  });

  test('midt på aksen giver kvarter-rundet fremtidigt starttidspunkt', () => {
    const w = windowForFraction(0.5, noon, WINDOW);
    expect(w.mode).toBe('at');
    if (w.mode === 'at') {
      expect(w.at).toEqual(new Date(2026, 5, 15, 18, 0));
      expect(w.at.getMinutes() % 15).toBe(0);
    }
  });

  test('helt til højre clamper så vinduet stadig er inden for aksen', () => {
    const w = windowForFraction(1, noon, WINDOW);
    expect(w.mode).toBe('at');
    if (w.mode === 'at') {
      // axisEnd 06:00 minus 3 timer = 03:00
      expect(w.at).toEqual(new Date(2026, 5, 16, 3, 0));
    }
  });

  test('sent på aksen hvor nu > maks-position giver NU', () => {
    // Kl. 04: axisEnd er 06, maks-start (06-3h=03) ligger FØR nu → alt clamper til nu
    const late = new Date(2026, 5, 15, 4, 0, 0, 0);
    expect(windowForFraction(1, late, WINDOW)).toEqual({ mode: 'now' });
  });
});

describe('fractionForWindow', () => {
  test('NU-vinduet lander på nu-positionen', () => {
    expect(fractionForWindow({ mode: 'now' }, noon)).toBe(0.25);
  });

  test('er invers af windowForFraction for frie positioner', () => {
    const w = windowForFraction(0.5, noon, WINDOW);
    expect(w.mode).toBe('at');
    if (w.mode === 'at') {
      expect(fractionForWindow(w, noon)).toBeCloseTo(0.5, 10);
    }
  });
});

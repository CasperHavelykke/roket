process.env.TZ = 'Europe/Copenhagen';

import { formatTime } from '../../../src/utils/eventTime';
import translations from '../../../src/translations';

describe('formatTime', () => {
  // Kør før hver test: frys tiden til et fast tidspunkt
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-22T14:00:00Z'));
  });

  // Ryd op efter hver test
  afterEach(() => {
    jest.useRealTimers();
  });

  test('returnerer eventsTimeAgo når tidspunktet er i fortiden', () => {
    const pastTime = new Date('2026-05-22T13:00:00Z'); // 1 time før "nu"
    expect(formatTime(pastTime, translations.da, 'da-DK', false))
      .toBe(translations.da.eventsTimeAgo);
  });
  
  test('returnerer eventsTimeIn når tidspunktet er i fremtiden', () => {
    const futureTime = new Date('2026-05-22T14:30:00Z');
    expect(formatTime(futureTime, translations.da, 'da-DK', false))
      .toBe(translations.da.eventsTimeIn(30));
  });

  
  test('returnerer eventsTimeToday når tidspunktet er i dag', () => {
    const todayTime = new Date('2026-05-22T18:00:00Z');
    expect(formatTime(todayTime, translations.da, 'da-DK', false))
      .toBe(translations.da.eventsTimeToday + ' 20.00');
  });

  test('returnerer eventsTimeTomorrow når tidspunktet er i morgen', () => {
    const tomorrowTime = new Date('2026-05-23T13:00:00Z');
    expect(formatTime(tomorrowTime, translations.da, 'da-DK', false))
      .toBe(translations.da.eventsTimeTomorrow + ' 15.00');
  });
  
  test('returnerer eventsStartsAt når tidspunktet er efter i morgen i fremtiden', () => {
    const futureTime = new Date('2026-05-26T14:00:00Z');
    expect(formatTime(futureTime, translations.da, 'da-DK', false))
      .toBe('26.05 16.00');
  });
});

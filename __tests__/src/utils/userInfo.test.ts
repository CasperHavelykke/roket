process.env.TZ = 'Europe/Copenhagen';

import { isOnline, getAge } from '../../../src/utils/userInfo';

describe('isOnline', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-23T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('returnerer false når lastSeen er undefined', () => {
    expect(isOnline(undefined)).toBe(false);
  });

  test('returnerer true når lastSeen var for 1 minut siden', () => {
    const time = new Date('2026-05-23T11:59:00Z');
    expect(isOnline(time)).toBe(true);
  })

  test('returnerer false når lastSeen var for 10 minutter siden', () => {
    const time = new Date('2026-05-23T11:50:00Z');
    expect(isOnline(time)).toBe(false);
  })

  test('returnerer false når lastSeen var for præcis 5 minutter siden', () => {
    const time = new Date('2026-05-23T11:55:00Z');
    expect(isOnline(time)).toBe(false);
  })
});

describe('getAge', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-23T12:00:00Z')); // 23. maj 2026
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('returnerer korrekt alder når fødselsdagen er passeret i år', () => {
    // født 1. januar 1995 -> har haft fødselsdag i 2026 -> 31 år
    const birthday = { day: 1, month: 1, year: 1995 };
    expect(getAge(birthday)).toBe(31);
  });
  
  test('returnerer korrekt alder når fødselsdagen er senere i år', () => {
    // født 1. december 1995 -> har ikke haft fødselsdag i 2026 -> 30 år
    const birthday = { day: 1, month: 12, year: 1995 };
    expect(getAge(birthday)).toBe(30);
  });

  test('returnerer korrekt alder når fødselsdagen er i dag', () => {
    // født 23. maj 1995 -> har fødselsdag i dag -> 31 år
    const birthday = { day: 23, month: 5, year: 1995 };
    expect(getAge(birthday)).toBe(31);
  });

  test('returnerer korrekt alder når fødselsdagen var i går', () => {
    // født 22. maj 1995 -> havde fødselsdag i går -> 31 år
    const birthday = { day: 22, month: 5, year: 1995 };
    expect(getAge(birthday)).toBe(31);
  });

  test('returnerer korrekt alder når fødselsdagen er i morgen', () => {
    // født 24. maj 1995 -> har fødselsdag i morgen -> 30 år
    const birthday = { day: 24, month: 5, year: 1995 };
    expect(getAge(birthday)).toBe(30);
  });
});

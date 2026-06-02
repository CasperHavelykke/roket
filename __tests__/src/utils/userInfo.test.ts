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

  // TODO: tilføj flere cases
  // - lastSeen 1 minut siden -> true
  // - lastSeen 10 minutter siden -> false
  // - lastSeen præcis 5 minutter siden -> hvad? (tjek < vs <= i koden)
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

  // TODO: tilføj flere cases
  // - fødselsdag senere i år (fx 1. december 1995) -> alder skal være 30, ikke 31
  // - fødselsdag præcis i dag (23. maj 1995) -> hvad?
  // - fødselsdag i går (22. maj 1995) -> hvad?
});

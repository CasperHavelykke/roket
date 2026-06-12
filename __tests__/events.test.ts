import {
  eventEndsAt,
  eventExpiryFromEnd,
  overlapsTime,
  isEventActive,
  isEventFull,
} from '../src/events';

describe('eventEndsAt', () => {
  test('bruger durationMinutes når den er sat', () => {
    const event = { time: new Date('2026-05-22T14:00:00Z'), durationMinutes: 60 };
    expect(eventEndsAt(event)).toEqual(new Date('2026-05-22T15:00:00Z'));
  });

  test('falder tilbage til default (120 min) uden durationMinutes', () => {
    const event = { time: new Date('2026-05-22T14:00:00Z') };
    expect(eventEndsAt(event)).toEqual(new Date('2026-05-22T16:00:00Z'));
  });
});

describe('eventExpiryFromEnd', () => {
  test('returnerer et tidspunkt præcis 4 timer efter slut (grace-perioden)', () => {
    const endsAt = new Date('2026-05-22T16:00:00Z');
    expect(eventExpiryFromEnd(endsAt)).toEqual(new Date('2026-05-22T20:00:00Z'));
  });
});

describe('overlapsTime', () => {
  const event = { time: new Date('2026-05-22T14:00:00Z'), durationMinutes: 120 };

  test('returnerer false før eventet starter', () => {
    expect(overlapsTime(event, new Date('2026-05-22T13:59:59Z'))).toBe(false);
  });

  test('returnerer true præcis ved start (grænseværdi)', () => {
    expect(overlapsTime(event, new Date('2026-05-22T14:00:00Z'))).toBe(true);
  });

  test('returnerer true midt i eventet', () => {
    expect(overlapsTime(event, new Date('2026-05-22T15:00:00Z'))).toBe(true);
  });

  test('returnerer true præcis ved slut (grænseværdi)', () => {
    expect(overlapsTime(event, new Date('2026-05-22T16:00:00Z'))).toBe(true);
  });

  test('returnerer false efter eventet er slut', () => {
    expect(overlapsTime(event, new Date('2026-05-22T16:00:01Z'))).toBe(false);
  });
});

describe('isEventFull', () => {
  test('returnerer false når maxParticipants er null (ubegrænset)', () => {
    const event = { participantIds: ['a', 'b'], maxParticipants: null };
    expect(isEventFull(event)).toBe(false);
  });
  
  test('returnerer false når der er plads endnu', () => {
    const event = { participantIds: ['a', 'b'], maxParticipants: 5 };
    expect(isEventFull(event)).toBe(false);
  });
  
  test('returnerer true når der er fyldt op', () => {
    const event = { participantIds: ['a', 'b', 'c', 'd', 'e'], maxParticipants: 5 };
    expect(isEventFull(event)).toBe(true);
  });
});

describe('isEventActive', () => {
  test('Returnerer true hvis ikke udløbet', () => {
    const futureEvent = {
      time: new Date(), 
      expiresAt: new Date(Date.now() + 1000 * 60 * 60)
    };
    expect(isEventActive(futureEvent)).toBe(true);
  });
  
  test('Returnerer false hvis udløbet', () => {
    const expiredEvent = {
      time: new Date(), 
      expiresAt: new Date(Date.now() - 1000 * 60 * 60)
    };
    expect(isEventActive(expiredEvent)).toBe(false);
  });
});
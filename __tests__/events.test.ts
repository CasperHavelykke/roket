import {
  eventExpiryFromTime,
  isEventActive,
  isEventFull,
} from '../src/events';

describe('eventExpiryFromTime', () => {
  test('returnerer et tidspunkt præcis 4 timer efter input', () => {
    const start = new Date('2026-05-22T14:00:00Z');
    const expected = new Date('2026-05-22T18:00:00Z');
    expect(eventExpiryFromTime(start)).toEqual(expected);
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
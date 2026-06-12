import type { StatusTagId } from './statusTags';

export interface EventDoc {
  id: string;
  creatorId: string;
  title: string;
  description: string;
  meetingPlace: string;
  location: {
    latitude: number;
    longitude: number;
  };
  geohash?: string;
  time: Date;
  durationMinutes?: number;
  maxParticipants: number | null;
  participantIds: string[];
  tag: StatusTagId | null;
  chatId: string;
  createdAt: Date;
  expiresAt: Date;
  distance?: number;
}

export const DEFAULT_EVENT_DURATION_MINUTES = 120;

// Grace-periode efter slut hvor event + chat stadig lever (deltagerne kan
// snakke færdig / "Hold kontakten"), før auto-sletning.
export const EVENT_GRACE_HOURS = 4;

export function eventEndsAt(event: { time: Date; durationMinutes?: number }): Date {
  const duration = event.durationMinutes ?? DEFAULT_EVENT_DURATION_MINUTES;
  return new Date(event.time.getTime() + duration * 60 * 1000);
}

export function eventExpiryFromEnd(endsAt: Date): Date {
  return new Date(endsAt.getTime() + EVENT_GRACE_HOURS * 60 * 60 * 1000);
}

export function isEventActive(event: { time: Date; expiresAt: Date }): boolean {
  const now = Date.now();
  return event.expiresAt.getTime() > now;
}

// Er eventet i gang / kommende på tidspunktet `at`? (scrubber-filteret)
export function overlapsTime(
  event: { time: Date; durationMinutes?: number },
  at: Date,
): boolean {
  return event.time.getTime() <= at.getTime() && eventEndsAt(event).getTime() >= at.getTime();
}

export function isEventFull(event: { participantIds: string[]; maxParticipants: number | null }): boolean {
  if (event.maxParticipants === null) return false;
  return event.participantIds.length >= event.maxParticipants;
}

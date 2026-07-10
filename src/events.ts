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

// Oversæt et Firestore-dokuments rå data til EventDoc med sikre defaults.
// Bevidst uden firestore-import: `data` er resultatet af doc.data(), og
// Timestamps duck-types via toDate() — så filen forbliver ren og testbar.
export function eventFromData(id: string, data: any): EventDoc {
  return {
    id,
    creatorId: data.creatorId,
    title: data.title,
    description: data.description ?? '',
    meetingPlace: data.meetingPlace ?? '',
    location: {
      latitude: data.location?.latitude ?? 0,
      longitude: data.location?.longitude ?? 0,
    },
    geohash: data.geohash,
    time: data.time?.toDate?.() ?? new Date(),
    durationMinutes: data.durationMinutes,
    maxParticipants: data.maxParticipants ?? null,
    participantIds: data.participantIds ?? [],
    tag: data.tag ?? null,
    chatId: data.chatId,
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
    expiresAt: data.expiresAt?.toDate?.() ?? new Date(),
  };
}

// Kortets synligheds-vindue: fra det valgte tidspunkt og så langt frem.
// Uden kig-frem ville "NU" kun vise events der bogstaveligt er i gang —
// et event der starter om 20 min ville være usynligt. 3 timer matcher
// "hvad sker der nu og den nærmeste tid"-semantikken og giver samtidig
// scrubber-kapslen en bredde der er til at gribe.
export const VISIBLE_WINDOW_MINUTES = 180;

// Er eventet i gang, eller starter det inden for vinduet, set fra `from`?
export function overlapsWindow(
  event: { time: Date; durationMinutes?: number },
  from: Date,
  windowMinutes: number = VISIBLE_WINDOW_MINUTES,
): boolean {
  const windowEndMs = from.getTime() + windowMinutes * 60 * 1000;
  return event.time.getTime() <= windowEndMs && eventEndsAt(event).getTime() >= from.getTime();
}

// Er eventet i gang præcis på tidspunktet `at`? (= vindue på 0 minutter)
export function overlapsTime(
  event: { time: Date; durationMinutes?: number },
  at: Date,
): boolean {
  return overlapsWindow(event, at, 0);
}

export function isEventFull(event: { participantIds: string[]; maxParticipants: number | null }): boolean {
  if (event.maxParticipants === null) return false;
  return event.participantIds.length >= event.maxParticipants;
}

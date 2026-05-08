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
    geohash?: string;
  };
  time: Date;
  maxParticipants: number | null;
  participantIds: string[];
  tag: StatusTagId | null;
  chatId: string;
  createdAt: Date;
  expiresAt: Date;
  distance?: number;
}

export const EVENT_DURATION_HOURS = 4;

export function eventExpiryFromTime(time: Date): Date {
  return new Date(time.getTime() + EVENT_DURATION_HOURS * 60 * 60 * 1000);
}

export function isEventActive(event: { time: Date; expiresAt: Date }): boolean {
  const now = Date.now();
  return event.expiresAt.getTime() > now;
}

export function isEventFull(event: { participantIds: string[]; maxParticipants: number | null }): boolean {
  if (event.maxParticipants === null) return false;
  return event.participantIds.length >= event.maxParticipants;
}

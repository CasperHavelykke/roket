export type StatusTagId =
  | 'coffee'
  | 'study'
  | 'workout'
  | 'party'
  | 'newInTown'
  | 'drinks'
  | 'gaming'
  | 'bored'
  | 'food'
  | 'walk'
  | 'music'
  | 'art'
  | 'shopping'
  | 'hike';

export interface StatusTag {
  id: StatusTagId;
  emoji: string;
}

export const STATUS_TAGS: StatusTag[] = [
  { id: 'coffee', emoji: '☕' },
  { id: 'study', emoji: '📚' },
  { id: 'workout', emoji: '🏃' },
  { id: 'party', emoji: '🎉' },
  { id: 'newInTown', emoji: '🌍' },
  { id: 'drinks', emoji: '🍻' },
  { id: 'gaming', emoji: '🎮' },
  { id: 'bored', emoji: '😴' },
  { id: 'food', emoji: '🍽️' },
  { id: 'walk', emoji: '🚶' },
  { id: 'music', emoji: '🎵' },
  { id: 'art', emoji: '🎨' },
  { id: 'shopping', emoji: '🛍️' },
  { id: 'hike', emoji: '🥾' },
];

export function getStatusTag(id: string | null | undefined): StatusTag | null {
  if (!id) return null;
  return STATUS_TAGS.find(t => t.id === id) || null;
}

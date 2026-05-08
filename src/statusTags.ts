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
  | 'walk';

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
];

export function getStatusTag(id: string | null | undefined): StatusTag | null {
  if (!id) return null;
  return STATUS_TAGS.find(t => t.id === id) || null;
}

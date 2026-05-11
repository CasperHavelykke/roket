import React from 'react';
import {
  Coffee, BookOpen, Dumbbell, PartyPopper, Globe, Beer,
  Gamepad2, Moon, Utensils, Footprints,
} from 'lucide-react-native';
import { StatusTagId } from '../statusTags';

interface TagIconProps {
  tag: StatusTagId;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

const ICON_MAP: Record<StatusTagId, React.ComponentType<any>> = {
  coffee: Coffee,
  study: BookOpen,
  workout: Dumbbell,
  party: PartyPopper,
  newInTown: Globe,
  drinks: Beer,
  gaming: Gamepad2,
  bored: Moon,
  food: Utensils,
  walk: Footprints,
};

export default function TagIcon({ tag, size = 16, color, strokeWidth = 2 }: TagIconProps) {
  const Icon = ICON_MAP[tag];
  if (!Icon) return null;
  return <Icon size={size} color={color} strokeWidth={strokeWidth} />;
}

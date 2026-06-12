import React from 'react';
import { View, StyleSheet } from 'react-native';
import { CalendarClock } from 'lucide-react-native';
import GradientView from '../../components/GradientView';
import TagIcon from '../../components/TagIcon';
import { StatusTagId } from '../../statusTags';
import { useTheme } from '../../theme';

interface ActivityMarkerProps {
  tag: StatusTagId | null;
}

const BUBBLE_SIZE = 38;

export default function ActivityMarker({ tag }: ActivityMarkerProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <GradientView
        colors={[colors.primaryBlue, colors.primaryRed]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.bubble}
      >
        {tag ? (
          <TagIcon tag={tag} size={19} color="#fff" strokeWidth={2.2} />
        ) : (
          <CalendarClock size={19} color="#fff" strokeWidth={2.2} />
        )}
      </GradientView>
      <View style={[styles.stem, { borderTopColor: colors.primaryRed }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  bubble: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  stem: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
});

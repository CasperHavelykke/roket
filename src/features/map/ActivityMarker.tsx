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
const STEM_HEIGHT = 7;
// Samlet højde (halen overlapper boblen 1 pt) — bruges af MapHomeScreen til
// iOS' centerOffset, så halens SPIDS står på koordinatet på begge platforme
export const MARKER_HEIGHT = BUBBLE_SIZE + STEM_HEIGHT - 1;
// OBS: brug normal flex-flow her — absolut-positionerede børn i markør-views
// tegnes forkert af react-native-maps' rasterizer på Fabric. Snapshot-racen
// (halvfærdigt view fryses som bitmap) løses i stedet med en kort
// tracksViewChanges-opvarmning i MapHomeScreen.

export default function ActivityMarker({ tag }: ActivityMarkerProps) {
  const { colors, isDark } = useTheme();

  // Ren hvid lyste op på det mørke kort og forsvandt på det lyse —
  // dæmpet hvid/mørk efter tema, på både kant og hale
  const edgeColor = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(50,50,60,0.2)';

  return (
    <View style={styles.container}>
      <GradientView
        colors={[colors.primaryBlue, colors.primaryRed]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.bubble, { borderColor: edgeColor }]}
      >
        {tag ? (
          <TagIcon tag={tag} size={19} color="#fff" strokeWidth={2.2} />
        ) : (
          <CalendarClock size={19} color="#fff" strokeWidth={2.2} />
        )}
      </GradientView>
      <View style={[styles.stem, { borderTopColor: edgeColor }]} />
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
  },
  stem: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: STEM_HEIGHT,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
});

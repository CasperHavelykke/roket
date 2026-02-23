import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../theme';

export default function CommunityGuidelinesScreen({ navigation }: any) {
  const { colors, t } = useTheme();
  const insets = useSafeAreaInsets();

  const guidelines = [
    t.guideline1,
    t.guideline2,
    t.guideline3,
    t.guideline4,
    t.guideline5,
    t.guideline6,
    t.guideline7,
    t.guideline8,
  ];

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.primaryBlue, colors.primaryRed]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: colors.textWhite }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textWhite }]}>{t.guidelinesTitle}</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: colors.white }]}>
          <Text style={[styles.intro, { color: colors.textSecondary }]}>{t.guidelinesIntro}</Text>

          {guidelines.map((g, i) => (
            <View key={i} style={styles.guidelineRow}>
              <Text style={[styles.bullet, { color: colors.primaryBlueText }]}>{i + 1}.</Text>
              <Text style={[styles.guidelineText, { color: colors.textPrimary }]}>{g}</Text>
            </View>
          ))}

          <Text style={[styles.consequence, { color: colors.textMuted }]}>{t.guidelinesConsequence}</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  backButton: {
    marginRight: 12,
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  intro: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  guidelineRow: {
    flexDirection: 'row',
    marginBottom: 14,
    alignItems: 'flex-start',
  },
  bullet: {
    fontSize: 15,
    fontWeight: '700',
    width: 24,
  },
  guidelineText: {
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  consequence: {
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 16,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 10,
  },
  childSafetyText: {
    fontSize: 15,
    lineHeight: 22,
  },
});

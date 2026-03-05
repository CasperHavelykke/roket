import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import GradientView from '../components/GradientView';
import { useTheme } from '../theme';

export default function ChildSafetyScreen({ navigation }: any) {
  const { colors, t } = useTheme();
  const insets = useSafeAreaInsets();

  const prohibitions = [
    t.childSafetyRule1,
    t.childSafetyRule2,
    t.childSafetyRule3,
    t.childSafetyRule4,
  ];

  return (
    <SafeAreaView edges={[]} style={[styles.container, { backgroundColor: colors.background }]}>
      <GradientView
        colors={[colors.primaryBlue, colors.primaryRed]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: colors.textWhite }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textWhite }]}>{t.childSafetyTitle}</Text>
      </GradientView>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]}>
        <View style={[styles.card, { backgroundColor: colors.white }]}>
          <Text style={[styles.sectionTitle, { color: colors.primaryRed }]}>{t.childSafetyZeroTolerance}</Text>
          <Text style={[styles.bodyText, { color: colors.textPrimary }]}>{t.childSafetyIntro}</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.white, marginTop: 16 }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t.childSafetyProhibitedTitle}</Text>
          {prohibitions.map((rule, i) => (
            <View key={i} style={styles.ruleRow}>
              <Text style={[styles.bullet, { color: colors.primaryRed }]}>•</Text>
              <Text style={[styles.ruleText, { color: colors.textPrimary }]}>{rule}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.card, { backgroundColor: colors.white, marginTop: 16 }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t.childSafetyMeasuresTitle}</Text>
          <Text style={[styles.bodyText, { color: colors.textSecondary }]}>{t.childSafetyMeasuresText}</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.white, marginTop: 16 }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t.childSafetyReportTitle}</Text>
          <Text style={[styles.bodyText, { color: colors.textSecondary }]}>{t.childSafetyReportText}</Text>

          <TouchableOpacity
            style={[styles.contactButton, { backgroundColor: colors.primaryRed }]}
            onPress={() => Linking.openURL('mailto:support@roketapp.eu')}
          >
            <Text style={styles.contactButtonText}>support@roketapp.eu</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.footer, { color: colors.textMuted }]}>{t.childSafetyFooter}</Text>
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
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 10,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 22,
  },
  ruleRow: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  bullet: {
    fontSize: 18,
    fontWeight: '700',
    width: 20,
    marginTop: -1,
  },
  ruleText: {
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  contactButton: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  contactButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 20,
    lineHeight: 18,
    textAlign: 'center',
  },
});

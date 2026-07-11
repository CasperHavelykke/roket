import React, { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Alert,
  Linking,
  Switch,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import GradientView from '../../components/GradientView';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useTheme, ThemeMode, TimeFormat, Language, DistanceMode, DistanceUnit } from '../../theme';
import getFirebaseError from '../../utils/getFirebaseError';
import RoketLogo from '../../assets/roket-logo-simpel.svg';
import RoketStars from '../../assets/roket-logo-stars-only.svg';


export default function SettingsScreen({ navigation }: any) {
  const { colors, mode, setMode, timeFormat, setTimeFormat, language, setLanguage, distanceMode, setDistanceMode, distanceUnit, setDistanceUnit, t } = useTheme();
  const insets = useSafeAreaInsets();
  const currentUser = auth().currentUser;
  // Opt-in nærheds-push: læs nuværende værdi fra bruger-doc'et
  const [notifyNearby, setNotifyNearby] = useState(false);
  // Gæste-status som STATE: som always-mounted tab re-renderer skærmen
  // ikke af sig selv ved login/logout — fokus opdaterer den (F4-lektien)
  const [isGuest, setIsGuest] = useState(auth().currentUser?.isAnonymous ?? true);

  useFocusEffect(useCallback(() => {
    const user = auth().currentUser;
    setIsGuest(user?.isAnonymous ?? true);
    if (!user || user.isAnonymous) {
      setNotifyNearby(false);
      return;
    }
    firestore().collection('users').doc(user.uid).get().then(doc => {
      setNotifyNearby(doc.data()?.notifyNearbyActivities === true);
    }).catch(() => {});
  }, []));

  if (!currentUser) return null;

  const themeModes: { value: ThemeMode; label: string }[] = [
    { value: 'light', label: t.settingsThemeLight },
    { value: 'dark', label: t.settingsThemeDark },
    { value: 'system', label: t.settingsThemeSystem },
  ];

  const timeFormats: { value: TimeFormat; label: string }[] = [
    { value: '24h', label: t.settingsTime24 },
    { value: '12h', label: t.settingsTimeAMPM },
  ];

  const languages: { value: Language; label: string }[] = [
    { value: 'da', label: 'Dansk' },
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Español' },
    { value: 'de', label: 'Deutsch' },
    { value: 'fr', label: 'Français' },
    { value: 'pt', label: 'Português' },
  ];

  const distanceModes: { value: DistanceMode; label: string }[] = [
    { value: 'exact', label: t.settingsDistanceExact },
    { value: 'fuzzy', label: distanceUnit === 'mi' ? t.settingsDistanceFuzzyMi : t.settingsDistanceFuzzy },
    { value: 'hidden', label: t.settingsDistanceHidden },
  ];

  const distanceUnits: { value: DistanceUnit; label: string }[] = [
    { value: 'km', label: t.settingsDistanceUnitKm },
    { value: 'mi', label: t.settingsDistanceUnitMi },
  ];


  const handleDistanceModeChange = async (mode: DistanceMode) => {
    setDistanceMode(mode);
  };

  const handleChangePassword = () => {
    Alert.alert(
      t.settingsChangePasswordTitle,
      t.settingsChangePasswordMessage(currentUser.email || ''),
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.send,
          onPress: async () => {
            try {
              await auth().sendPasswordResetEmail(currentUser.email || '');
              Alert.alert(t.settingsChangePasswordSent, t.settingsChangePasswordSentMessage);
            } catch (error: any) {
              Alert.alert(t.error, getFirebaseError(error, t));
            }
          },
        },
      ],
    );
  };

  const handleLogout = () => {
    Alert.alert(t.settingsLogoutTitle, t.settingsLogoutConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.settingsLogout,
        style: 'destructive',
        onPress: async () => {
          // Fjern FCM-token så denne enhed ikke modtager notifikationer for den gamle konto
          try {
            const uid = auth().currentUser?.uid;
            if (uid) {
              await firestore().collection('users').doc(uid).update({ fcmToken: '' });
            }
          } catch (_) {}
          auth().signOut();
          // Pivot 2.0: logout fører til gæste-session, ikke login-skærm.
          // Settings er en TAB — popToTop er en no-op her; hop eksplicit
          // til Kort-fanen så man ikke bliver stående i Mere som gæst
          navigation.navigate('MapHome');
        },
      },
    ]);
  };

  const renderSelector = <T extends string | number>(
    options: { value: T; label: string }[],
    activeValue: T,
    onSelect: (value: T) => void,
    columns?: number,
  ) => (
    <View style={[styles.themeSelector, columns ? { flexWrap: 'wrap' } : undefined]}>
      {options.map(option => {
        const isActive = activeValue === option.value;
        return (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.themeOption,
              { borderColor: colors.inputBorder },
              isActive && { backgroundColor: colors.primaryBlue, borderColor: colors.primaryBlue },
              columns ? { flex: 0, width: `${Math.floor(100 / columns) - 3}%` as any } : undefined,
            ]}
            onPress={() => onSelect(option.value)}
          >
            <Text
              style={[
                styles.themeOptionText,
                { color: colors.textPrimary },
                isActive && { color: colors.textWhite },
              ]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <SafeAreaView edges={[]} style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Tab-rod: flad stor titel i stedet for gradient-header — nav-baren
          i bunden fortæller allerede hvor man er (redesign 2026-07) */}
      <View style={[styles.largeTitleRow, { paddingTop: insets.top + 14 }]}>
        <Text style={[styles.largeTitle, { color: colors.textPrimary }]}>{t.settingsTitle}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Feedback', { category: 'bug' })} style={{ marginLeft: 'auto' }}>
          <RoketLogo width={24} height={24} fill={colors.textPrimary} fillRule="evenodd" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom }]}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t.settingsLanguage}</Text>
        <View style={[styles.card, { backgroundColor: colors.white }]}>
          {renderSelector(languages, language, setLanguage, 3)}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t.settingsTheme}</Text>
        <View style={[styles.card, { backgroundColor: colors.white }]}>
          {renderSelector(themeModes, mode, setMode)}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t.settingsTimeFormat}</Text>
        <View style={[styles.card, { backgroundColor: colors.white }]}>
          {renderSelector(timeFormats, timeFormat, setTimeFormat)}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t.settingsDistanceUnit}</Text>
        <View style={[styles.card, { backgroundColor: colors.white }]}>
          {renderSelector(distanceUnits, distanceUnit, setDistanceUnit)}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t.settingsNotifications}</Text>
        <View style={[styles.card, { backgroundColor: colors.white }]}>
          {/* Opt-in nærheds-push (Pivot 2.0) — kun for rigtige konti */}
          {!isGuest && (
            <View style={[styles.row, { borderBottomColor: colors.borderLight }]}>
              <Text style={[styles.rowText, { color: colors.textPrimary, flex: 1 }]}>{t.settingsNotifyNearby}</Text>
              <Switch
                value={notifyNearby}
                onValueChange={value => {
                  setNotifyNearby(value);
                  const uid = auth().currentUser?.uid;
                  if (uid) {
                    firestore().collection('users').doc(uid)
                      .update({ notifyNearbyActivities: value })
                      .catch(err => {
                        console.warn('Failed to save notifyNearbyActivities:', err);
                        setNotifyNearby(!value);
                      });
                  }
                }}
                trackColor={{ false: colors.inputBorder, true: colors.primaryBlue }}
                thumbColor="#fff"
              />
            </View>
          )}
          <TouchableOpacity
            style={styles.row}
            onPress={() => Linking.openSettings()}
          >
            <Text style={[styles.rowText, { color: colors.textPrimary }]}>{t.settingsNotificationsOpen}</Text>
            <Text style={[styles.rowArrow, { color: colors.textMuted }]}>→</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t.settingsPrivacy}</Text>
        <View style={[styles.card, { backgroundColor: colors.white }]}>
          <TouchableOpacity
            style={[styles.row, { borderBottomColor: colors.borderLight }]}
            onPress={() => navigation.navigate('BlockedUsers')}
          >
            <Text style={[styles.rowText, { color: colors.textPrimary }]}>{t.settingsBlockedUsers}</Text>
            <Text style={[styles.rowArrow, { color: colors.textMuted }]}>→</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.row, { borderBottomColor: colors.borderLight }]}
            onPress={() => navigation.navigate('CommunityGuidelines')}
          >
            <Text style={[styles.rowText, { color: colors.textPrimary }]}>{t.settingsGuidelines}</Text>
            <Text style={[styles.rowArrow, { color: colors.textMuted }]}>→</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.row, { borderBottomColor: colors.borderLight }]}
            onPress={() => navigation.navigate('PrivacyPolicy')}
          >
            <Text style={[styles.rowText, { color: colors.textPrimary }]}>{t.settingsPrivacyPolicy}</Text>
            <Text style={[styles.rowArrow, { color: colors.textMuted }]}>→</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.row, { borderBottomColor: colors.borderLight }]}
            onPress={() => navigation.navigate('TermsConditions')}
          >
            <Text style={[styles.rowText, { color: colors.textPrimary }]}>{t.settingsTerms}</Text>
            <Text style={[styles.rowArrow, { color: colors.textMuted }]}>→</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('ChildSafety')}
          >
            <Text style={[styles.rowText, { color: colors.textPrimary }]}>{t.settingsChildSafety}</Text>
            <Text style={[styles.rowArrow, { color: colors.textMuted }]}>→</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t.settingsSupport}</Text>
        <View style={[styles.card, { backgroundColor: colors.white }]}>
          <GradientView
            colors={[colors.primaryBlue, colors.primaryRed]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <TouchableOpacity
              style={[styles.row, { borderBottomColor: 'rgba(255,255,255,0.2)' }]}
              onPress={() => navigation.navigate('Feedback')}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <RoketStars width={20} height={20} />
                <Text style={[styles.rowText, { color: colors.textWhite, fontWeight: '700' }]}>{t.settingsFeedback}</Text>
              </View>
              <Text style={[styles.rowArrow, { color: colors.textWhite, fontWeight: '700' }]}>→</Text>
            </TouchableOpacity>
          </GradientView>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t.settingsAccount}</Text>
        <View style={[styles.card, { backgroundColor: colors.white }]}>
          {/* Skift adgangskode giver ingen mening for gæster (ingen email-konto) */}
          {!isGuest && (
            <TouchableOpacity
              style={[styles.row, { borderBottomColor: colors.borderLight }]}
              onPress={handleChangePassword}
            >
              <Text style={[styles.rowText, { color: colors.textPrimary }]}>{t.settingsChangePassword}</Text>
              <Text style={[styles.rowArrow, { color: colors.textMuted }]}>→</Text>
            </TouchableOpacity>
          )}

          {isGuest ? (
            // Gæst: vis vej til konto i stedet for logout/slet
            <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('Login')}>
              <Text style={[styles.rowText, { color: colors.primaryBlueText }]}>{t.settingsLogin}</Text>
              <Text style={[styles.rowArrow, { color: colors.textMuted }]}>→</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity style={[styles.row, { borderBottomColor: colors.borderLight }]} onPress={handleLogout}>
                <Text style={[styles.rowText, { color: colors.primaryRed }]}>{t.settingsLogout}</Text>
                <Text style={[styles.rowArrow, { color: colors.textMuted }]}>→</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('DeleteAccount')}>
                <Text style={[styles.rowText, { color: colors.darkRed }]}>{t.settingsDeleteAccount}</Text>
                <Text style={[styles.rowArrow, { color: colors.textMuted }]}>→</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <Text style={styles.copyright}>© 2026 Røket · v2.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  largeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    paddingHorizontal: 18,
  },
  largeTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  content: {
    padding: 20,
    paddingTop: 4,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 16,
    marginLeft: 4,
  },
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  settingDesc: {
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 2,
  },
  themeSelector: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  themeOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  themeOptionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  rowText: {
    fontSize: 16,
    fontWeight: '500',
  },
  rowArrow: {
    fontSize: 18,
    fontWeight: '600',
  },
  copyright: {
    textAlign: 'center',
    color: '#999',
    fontSize: 13,
    marginTop: 24,
  },
});

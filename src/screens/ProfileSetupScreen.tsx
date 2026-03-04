import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
} from 'react-native';
import GradientView from '../components/GradientView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme';
import getFirebaseError from '../utils/getFirebaseError';
import RoketLogo from '../assets/roket-logo-2.svg';

type SimpleGender = 'male' | 'female' | '';
type Attraction = 'men' | 'women' | 'both' | '';

const ALL_BASE_TAGS = [
  'male_straight', 'male_gay', 'male_bisexual',
  'female_straight', 'female_gay', 'female_bisexual',
];

function deriveSexuality(g: 'male' | 'female', a: 'men' | 'women' | 'both'): string {
  if (a === 'both') return 'bisexual';
  if (g === 'male') return a === 'men' ? 'gay' : 'straight';
  return a === 'women' ? 'gay' : 'straight';
}

export default function ProfileSetupScreen() {
  const { colors, language, t } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [gender, setGender] = useState<SimpleGender>('');
  const [attraction, setAttraction] = useState<Attraction>('');
  const [datingOnly, setDatingOnly] = useState(false);

  const [needsBirthday, setNeedsBirthday] = useState(false);
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const monthsByLang: Record<string, string[]> = {
    da: ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'],
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    es: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
    de: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
    fr: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'],
    pt: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
  };
  const placeholders: Record<string, { day: string; month: string; year: string }> = {
    da: { day: 'Dag', month: 'Måned', year: 'År' },
    en: { day: 'Day', month: 'Month', year: 'Year' },
    es: { day: 'Día', month: 'Mes', year: 'Año' },
    de: { day: 'Tag', month: 'Monat', year: 'Jahr' },
    fr: { day: 'Jour', month: 'Mois', year: 'Année' },
    pt: { day: 'Dia', month: 'Mês', year: 'Ano' },
  };
  const monthNames = monthsByLang[language] || monthsByLang.en;
  const ph = placeholders[language] || placeholders.en;

  React.useEffect(() => {
    AsyncStorage.getItem('@roket_birthday').then(stored => {
      if (!stored) setNeedsBirthday(true);
    }).catch(() => setNeedsBirthday(true));
  }, []);

  const handleCompleteProfile = async () => {
    let birthday: { day: number; month: number; year: number } | null = null;
    try {
      const stored = await AsyncStorage.getItem('@roket_birthday');
      if (stored) {
        birthday = JSON.parse(stored);
      }
    } catch {}

    if (!birthday && needsBirthday) {
      const d = parseInt(birthDay, 10);
      const m = parseInt(birthMonth, 10);
      const y = parseInt(birthYear, 10);
      if (!d || !m || !y || d < 1 || d > 31 || m < 1 || m > 12 || y < 1900) {
        Alert.alert(t.error, t.signupErrorNoBirthday);
        return;
      }
      birthday = { day: d, month: m, year: y };
    }

    if (!birthday) {
      Alert.alert(t.error, t.signupErrorNoBirthday);
      return;
    }

    if (!gender) {
      Alert.alert(t.error, t.setupErrorNoGender);
      return;
    }

    if (!attraction) {
      Alert.alert(t.error, t.setupErrorNoAttraction);
      return;
    }

    setLoading(true);

    try {
      const user = auth().currentUser;
      if (!user) {
        Alert.alert(t.error, t.setupErrorNoUser);
        return;
      }

      await AsyncStorage.removeItem('@roket_birthday');

      const sex = deriveSexuality(gender, attraction);
      const baseTag = `${gender}_${sex}`;
      const matchTag = `${baseTag}_${datingOnly ? 'dating' : 'friends'}`;
      const datingCompatibleMap: Record<string, string[]> = {
        male_straight: ['female_straight', 'female_bisexual'],
        male_gay: ['male_gay', 'male_bisexual'],
        male_bisexual: ['male_gay', 'male_bisexual', 'female_straight', 'female_bisexual'],
        female_straight: ['male_straight', 'male_bisexual'],
        female_gay: ['female_gay', 'female_bisexual'],
        female_bisexual: ['male_straight', 'male_bisexual', 'female_gay', 'female_bisexual'],
      };

      const compatible = datingCompatibleMap[baseTag] || [];
      const visibleTo = datingOnly
        ? compatible.flatMap(tag => [`${tag}_friends`, `${tag}_dating`])
        : [...ALL_BASE_TAGS.map(tag => `${tag}_friends`), ...compatible.map(tag => `${tag}_dating`)];

      await firestore().collection('users').doc(user.uid).set({
        displayName: '',
        bio: '',
        email: user.email,
        createdAt: firestore.FieldValue.serverTimestamp(),
        photoURL: null,
        lastSeen: firestore.FieldValue.serverTimestamp(),
        distanceMode: 'exact',
        birthday,
        showAge: true,
        gender,
        showGender: false,
        sexuality: sex,
        showSexuality: false,
        photos: [],
        matchTag,
        visibleTo,
        datingOnly,
      });
    } catch (error: any) {
      console.error('Profile setup error:', error);
      Alert.alert(t.error, getFirebaseError(error, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <GradientView
      colors={[colors.primaryBlue, colors.primaryRed]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
        >
          <RoketLogo width={60} height={60} fill="#fff" fillRule="evenodd" style={styles.logo} />
          <Text style={styles.title}>{t.setupTitle}</Text>
          <Text style={styles.subtitle}>{t.setupSubtitle}</Text>

          {needsBirthday && (
            <>
              <Text style={styles.label}>{t.signupBirthday}</Text>
              <View style={styles.birthdayRow}>
                <TextInput
                  style={styles.birthdayInput}
                  placeholder={ph.day}
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  value={birthDay}
                  onChangeText={v => setBirthDay(v.replace(/[^0-9]/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <TouchableOpacity
                  style={styles.monthPicker}
                  onPress={() => { if (!showMonthPicker) Keyboard.dismiss(); setShowMonthPicker(!showMonthPicker); }}
                >
                  <Text style={[styles.monthPickerText, !birthMonth && { color: 'rgba(255,255,255,0.5)' }]}>
                    {birthMonth ? monthNames[parseInt(birthMonth, 10) - 1] : ph.month}
                  </Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.birthdayInput}
                  placeholder={ph.year}
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  value={birthYear}
                  onChangeText={v => setBirthYear(v.replace(/[^0-9]/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  maxLength={4}
                />
              </View>
              {showMonthPicker && (
                <View style={styles.monthGrid}>
                  {monthNames.map((m, i) => {
                    const isSelected = parseInt(birthMonth, 10) === i + 1;
                    return (
                      <TouchableOpacity
                        key={i}
                        style={[styles.monthOption, isSelected && styles.monthOptionSelected]}
                        onPress={() => {
                          setBirthMonth(String(i + 1));
                          setShowMonthPicker(false);
                        }}
                      >
                        <Text style={[
                          styles.monthOptionText,
                          isSelected && { color: colors.primaryBlue },
                        ]}>
                          {m}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </>
          )}

          <Text style={styles.label}>{t.setupGenderQuestion}</Text>
          <View style={styles.chipRow}>
            <TouchableOpacity
              style={[styles.chip, gender === 'male' && styles.chipSelected]}
              onPress={() => setGender('male')}
            >
              <Text style={[styles.chipText, gender === 'male' && { color: colors.primaryBlue }]}>
                {t.genderMale}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, gender === 'female' && styles.chipSelected]}
              onPress={() => setGender('female')}
            >
              <Text style={[styles.chipText, gender === 'female' && { color: colors.primaryBlue }]}>
                {t.genderFemale}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>{t.setupAttractionQuestion}</Text>
          <View style={styles.chipRow}>
            <TouchableOpacity
              style={[styles.chip, attraction === 'men' && styles.chipSelected]}
              onPress={() => setAttraction('men')}
            >
              <Text style={[styles.chipText, attraction === 'men' && { color: colors.primaryBlue }]}>
                {t.setupAttractionMen}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, attraction === 'women' && styles.chipSelected]}
              onPress={() => setAttraction('women')}
            >
              <Text style={[styles.chipText, attraction === 'women' && { color: colors.primaryBlue }]}>
                {t.setupAttractionWomen}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, attraction === 'both' && styles.chipSelected]}
              onPress={() => setAttraction('both')}
            >
              <Text style={[styles.chipText, attraction === 'both' && { color: colors.primaryBlue }]}>
                {t.setupAttractionBoth}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setDatingOnly(!datingOnly)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, datingOnly && styles.checkboxChecked]}>
              {datingOnly && <Text style={{ color: colors.primaryBlue, fontSize: 14, fontWeight: '700' }}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>{t.setupDatingOnlyPre}<Text style={{ fontStyle: 'italic' }}>{t.setupDatingOnlyEmphasis}</Text>{t.setupDatingOnlyPost}</Text>
          </TouchableOpacity>

        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
          <Text style={styles.privacyNote}>{t.setupPrivacyNote}</Text>

          <TouchableOpacity
            style={[styles.button, loading && { opacity: 0.7 }]}
            onPress={handleCompleteProfile}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryBlue} />
            ) : (
              <Text style={[styles.buttonText, { color: colors.primaryBlue }]}>{t.setupComplete}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </GradientView>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 30,
    paddingBottom: 20,
    alignItems: 'center',
  },
  logo: {
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
    width: '100%',
  },
  chip: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  chipSelected: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  chipText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  footer: {
    paddingHorizontal: 30,
    alignItems: 'center',
  },
  privacyNote: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 10,
  },
  button: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '700',
  },
  birthdayRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
    width: '100%',
  },
  birthdayInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 15,
    borderRadius: 12,
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
  },
  monthPicker: {
    flex: 1.2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 15,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthPickerText: {
    fontSize: 16,
    color: '#fff',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 12,
    padding: 6,
    marginBottom: 24,
    gap: 4,
    width: '100%',
  },
  monthOption: {
    width: '23%',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  monthOptionSelected: {
    backgroundColor: '#fff',
  },
  monthOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  checkboxLabel: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
  },
});

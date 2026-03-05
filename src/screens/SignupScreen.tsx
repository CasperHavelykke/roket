import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Keyboard,
  Platform,
  Animated,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import LinearGradient from 'react-native-linear-gradient';
import GradientView from '../components/GradientView';
import auth from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import getFirebaseError from '../utils/getFirebaseError';
import RoketLogo from '../assets/roket-logo-2.svg';

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

function daysInMonth(month: number, year: number): number {
  if (!month || !year) return 31;
  return new Date(year, month, 0).getDate();
}

function getAge(day: number, month: number, year: number): number {
  const today = new Date();
  const birth = new Date(year, month - 1, day);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export default function SignupScreen({ navigation }: any) {
  const { colors, t, language } = useTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const monthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(monthAnim, {
      toValue: showMonthPicker ? 1 : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [showMonthPicker]);

  const monthGridHeight = monthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 180],
  });


  const months = monthsByLang[language] || monthsByLang.en;
  const ph = placeholders[language] || placeholders.en;

  const handleSignup = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert(t.error, t.signupErrorEmpty);
      return;
    }

    const day = parseInt(birthDay, 10);
    const month = parseInt(birthMonth, 10);
    const year = parseInt(birthYear, 10);

    if (!day || !month || !year || day < 1 || day > 31 || month < 1 || month > 12 || year < 1900) {
      Alert.alert(t.error, t.signupErrorNoBirthday);
      return;
    }

    const maxDay = daysInMonth(month, year);
    if (day > maxDay) {
      Alert.alert(t.error, t.signupErrorNoBirthday);
      return;
    }

    if (getAge(day, month, year) < 18) {
      Alert.alert(t.error, t.signupErrorTooYoung);
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(t.error, t.signupErrorMismatch);
      return;
    }

    if (password.length < 6) {
      Alert.alert(t.error, t.signupErrorShort);
      return;
    }

    if (!acceptedPrivacy) {
      Alert.alert(t.error, t.signupErrorNoPrivacy);
      return;
    }

    setLoading(true);
    try {
      await AsyncStorage.setItem('@roket_birthday', JSON.stringify({ day, month, year }));
      await auth().createUserWithEmailAndPassword(email, password);
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        Alert.alert(t.error, t.signupErrorInUse);
      } else if (error.code === 'auth/invalid-email') {
        Alert.alert(t.error, t.signupErrorInvalidEmail);
      } else {
        Alert.alert(t.signupError, getFirebaseError(error, t));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <GradientView
      colors={[colors.primaryRed, colors.darkBlue]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView ref={scrollRef} contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 + insets.bottom }]} keyboardShouldPersistTaps="handled">
        <View style={styles.logoContainer}>
          <RoketLogo width={100} height={100} fill="#fff" />
        </View>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t.signupTitle}</Text>

          <TextInput
            style={[styles.input, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, color: colors.textPrimary }]}
            placeholder={t.signupEmailPlaceholder}
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <TextInput
            style={[styles.input, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, color: colors.textPrimary }]}
            placeholder={t.signupPasswordPlaceholder}
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TextInput
            style={[styles.input, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, color: colors.textPrimary }]}
            placeholder={t.signupConfirmPlaceholder}
            placeholderTextColor={colors.textMuted}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />

          <Text style={[styles.birthdayLabel, { color: colors.textSecondary }]}>{t.signupBirthday}</Text>
          <View style={styles.birthdayRow}>
            <TextInput
              style={[styles.birthdayInput, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, color: colors.textPrimary }]}
              placeholder={ph.day}
              placeholderTextColor={colors.textMuted}
              value={birthDay}
              onChangeText={(v) => {
                const num = v.replace(/[^0-9]/g, '').slice(0, 2);
                setBirthDay(num);
              }}
              keyboardType="number-pad"
              maxLength={2}
            />
            <TouchableOpacity
              style={[styles.monthPicker, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]}
              onPress={() => { if (!showMonthPicker) Keyboard.dismiss(); setShowMonthPicker(!showMonthPicker); }}
            >
              <Text style={[styles.monthPickerText, birthMonth ? { color: colors.textPrimary } : { color: colors.textMuted }]}>
                {birthMonth ? months[parseInt(birthMonth, 10) - 1] : ph.month}
              </Text>
            </TouchableOpacity>
            <TextInput
              style={[styles.birthdayInput, styles.yearInput, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, color: colors.textPrimary }]}
              placeholder={ph.year}
              placeholderTextColor={colors.textMuted}
              value={birthYear}
              onChangeText={(v) => {
                const num = v.replace(/[^0-9]/g, '').slice(0, 4);
                setBirthYear(num);
              }}
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>

          <Animated.View style={{ height: monthGridHeight, overflow: 'hidden', opacity: monthAnim }}>
            <View style={[styles.monthGrid, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
              {months.map((m, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.monthOption,
                    parseInt(birthMonth, 10) === i + 1 && { backgroundColor: colors.primaryBlue },
                  ]}
                  onPress={() => {
                    setBirthMonth(String(i + 1));
                    setShowMonthPicker(false);
                  }}
                >
                  <Text style={[
                    styles.monthOptionText,
                    { color: colors.textPrimary },
                    parseInt(birthMonth, 10) === i + 1 && { color: '#fff' },
                  ]}>
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>

          <TouchableOpacity
            style={styles.privacyRow}
            onPress={() => setAcceptedPrivacy(!acceptedPrivacy)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, { borderColor: colors.inputBorder }, acceptedPrivacy && { backgroundColor: colors.primaryBlue, borderColor: colors.primaryBlue }]}>
              {acceptedPrivacy && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={[styles.privacyText, { color: colors.textSecondary }]}>
              {t.signupAcceptPrivacy}
              <Text
                style={{ color: colors.darkBlueText, textDecorationLine: 'underline' }}
                onPress={() => navigation.navigate('PrivacyPolicy')}
              >
                {t.signupPrivacyLink}
              </Text>
              {t.signupAnd}
              <Text
                style={{ color: colors.darkBlueText, textDecorationLine: 'underline' }}
                onPress={() => navigation.navigate('TermsConditions')}
              >
                {t.signupTermsLink}
              </Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primaryBlue }]}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.textWhite} />
            ) : (
              <Text style={styles.buttonText}>{t.signupButton}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={[styles.linkText, { color: colors.primaryRed }]}>
              {t.signupHasAccount}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </GradientView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  card: {
    borderRadius: 20,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    padding: 15,
    marginBottom: 15,
    borderRadius: 10,
    fontSize: 16,
  },
  birthdayLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  birthdayRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
  },
  birthdayInput: {
    flex: 1,
    borderWidth: 1,
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
    textAlign: 'center',
  },
  yearInput: {
    flex: 1.3,
  },
  monthPicker: {
    flex: 1.2,
    borderWidth: 1,
    padding: 15,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthPickerText: {
    fontSize: 16,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: 1,
    borderRadius: 10,
    padding: 6,
    marginBottom: 15,
    gap: 4,
  },
  monthOption: {
    width: '23%',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  monthOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  button: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    marginTop: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 5,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  privacyText: {
    fontSize: 14,
    flex: 1,
  },
  linkText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
});

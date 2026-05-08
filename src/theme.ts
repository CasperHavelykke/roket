import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useColorScheme, Platform, NativeModules, Settings } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import translations, { Language, Translations } from './translations';

// Shared colors (same in both modes)
const shared = {
  darkRed: '#C1121F',
  lightRed: '#FF6B7A',
  darkBlue: '#3A0CA3',
  darkBlueText: '#5717ed',
  lightBlue: '#7B8FF5',
  online: '#22C55E',
  textWhite: '#FFFFFF',
};

const lightColors = {
  ...shared,
  primaryRed: '#E63946',
  primaryBlue: '#4361EE',
  primaryBlueText: '#4361EE',
  white: '#FFFFFF',
  background: '#F5F5F5',
  backgroundLight: '#F9F9F9',
  backgroundBlueLight: '#F0F4FF',
  cardBackground: '#D1D1D1',
  cardBackgroundIcon: '#bababa',
  card: '#FFFFFF',
  border: '#EEEEEE',
  borderLight: '#F0F0F0',
  inputBorder: '#DDDDDD',
  inputBackground: '#F9F9F9',
  textPrimary: '#222222',
  textSecondary: '#666666',
  textMuted: '#999999',
  offline: '#999999',
  bubbleReceived: '#FFFFFF',
  bubbleReceivedText: '#222222',
  shadow: '#000000',
};

const darkColors = {
  ...shared,
  primaryRed: '#C1121F',
  primaryBlue: '#3A0CA3',
  primaryBlueText: '#5717ed',
  white: '#1A1A1A',
  background: '#121212',
  backgroundLight: '#1E1E1E',
  backgroundBlueLight: '#1A1A2E',
  cardBackground: '#222222',
  cardBackgroundIcon: '#353535',
  card: '#1E1E1E',
  border: '#2A2A2A',
  borderLight: '#252525',
  inputBorder: '#333333',
  inputBackground: '#2A2A2A',
  textPrimary: '#E0E0E0',
  textSecondary: '#AAAAAA',
  textMuted: '#777777',
  offline: '#666666',
  bubbleReceived: '#2A2A2A',
  bubbleReceivedText: '#E0E0E0',
  shadow: '#000000',
};

export type ThemeColors = typeof lightColors;
export type ThemeMode = 'light' | 'dark' | 'system';
export type TimeFormat = '12h' | '24h';
export type DistanceMode = 'exact' | 'fuzzy' | 'hidden';
export type DistanceUnit = 'km' | 'mi';
export type GridColumns = 1 | 2 | 3 | 4;
export type { Language, Translations };

const THEME_STORAGE_KEY = '@roket_theme_mode';
const TIME_FORMAT_STORAGE_KEY = '@roket_time_format';
const LANGUAGE_STORAGE_KEY = '@roket_language';
const DISTANCE_MODE_STORAGE_KEY = '@roket_distance_mode';
const DISTANCE_UNIT_STORAGE_KEY = '@roket_distance_unit';
const GRID_COLUMNS_STORAGE_KEY = '@roket_grid_columns';

interface ThemeContextType {
  colors: ThemeColors;
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  timeFormat: TimeFormat;
  setTimeFormat: (format: TimeFormat) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  distanceMode: DistanceMode;
  setDistanceMode: (mode: DistanceMode) => void;
  distanceUnit: DistanceUnit;
  setDistanceUnit: (unit: DistanceUnit) => void;
  gridColumns: GridColumns;
  setGridColumns: (cols: GridColumns) => void;
  showTestBadges: boolean;
  loginTestInfo: string;
  t: Translations;
}

export const ThemeContext = createContext<ThemeContextType>({
  colors: lightColors,
  mode: 'system',
  isDark: false,
  setMode: () => {},
  timeFormat: '24h',
  setTimeFormat: () => {},
  language: 'da',
  setLanguage: () => {},
  distanceMode: 'exact',
  setDistanceMode: () => {},
  distanceUnit: 'km',
  setDistanceUnit: () => {},
  gridColumns: 2,
  setGridColumns: () => {},
  showTestBadges: true,
  loginTestInfo: 'For testing use mail: test@test.com password: Test1234',
  t: translations.da,
});

export function useTheme() {
  return useContext(ThemeContext);
}

// Hjælper: gem alle indstillinger til AsyncStorage (lokal cache)
function cacheSettings(m: ThemeMode, tf: TimeFormat, lang: Language, dm: DistanceMode, du: DistanceUnit) {
  AsyncStorage.setItem(THEME_STORAGE_KEY, m);
  AsyncStorage.setItem(TIME_FORMAT_STORAGE_KEY, tf);
  AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  AsyncStorage.setItem(DISTANCE_MODE_STORAGE_KEY, dm);
  AsyncStorage.setItem(DISTANCE_UNIT_STORAGE_KEY, du);
}

// Hjælper: gem en indstilling til Firestore (konto-knyttet)
function saveToFirestore(key: string, value: string) {
  const uid = auth().currentUser?.uid;
  if (!uid) return;
  firestore().collection('users').doc(uid).set(
    { settings: { [key]: value } },
    { merge: true }
  ).catch(() => {});
}

function getDeviceLanguage(): Language {
  let locale = '';

  if (Platform.OS === 'ios') {
    // AppleLanguages = brugerens foretrukne sprog, AppleLocale = region/locale
    locale =
      Settings.get('AppleLanguages')?.[0] ??
      NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] ??
      Settings.get('AppleLocale') ??
      NativeModules.SettingsManager?.settings?.AppleLocale ??
      '';
  } else {
    locale = NativeModules.I18nManager?.localeIdentifier ?? '';
  }

  const lower = locale.toLowerCase();
  if (lower.startsWith('da')) return 'da';
  if (lower.startsWith('es')) return 'es';
  if (lower.startsWith('de')) return 'de';
  if (lower.startsWith('fr')) return 'fr';
  if (lower.startsWith('pt')) return 'pt';
  return 'en';
}

export function useThemeProvider() {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [timeFormat, setTimeFormatState] = useState<TimeFormat>('24h');
  const [language, setLanguageState] = useState<Language>(getDeviceLanguage);
  const [distanceMode, setDistanceModeState] = useState<DistanceMode>('exact');
  const [distanceUnit, setDistanceUnitState] = useState<DistanceUnit>('km');
  const [gridColumns, setGridColumnsState] = useState<GridColumns>(2);
  const [showTestBadges, setShowTestBadges] = useState(true);
  const [loginTestInfo, setLoginTestInfo] = useState('For testing use mail: test@test.com password: Test1234');
  const [loaded, setLoaded] = useState(false);
  const asyncDone = useRef(false);
  const firestoreDone = useRef(false);

  // Hent indstillinger: vent på BÅDE AsyncStorage OG Firestore før loaded=true
  // Dette forhindrer UI-flicker fra dobbelt state-opdatering
  useEffect(() => {
    const markLoaded = () => {
      if (asyncDone.current && firestoreDone.current) {
        setLoaded(true);
      }
    };

    // Trin 1: Indlæs lokal cache hurtigt
    Promise.all([
      AsyncStorage.getItem(THEME_STORAGE_KEY),
      AsyncStorage.getItem(TIME_FORMAT_STORAGE_KEY),
      AsyncStorage.getItem(LANGUAGE_STORAGE_KEY),
      AsyncStorage.getItem(DISTANCE_MODE_STORAGE_KEY),
      AsyncStorage.getItem(DISTANCE_UNIT_STORAGE_KEY),
      AsyncStorage.getItem(GRID_COLUMNS_STORAGE_KEY),
    ]).then(([storedMode, storedTime, storedLang, storedDistance, storedUnit, storedColumns]) => {
      if (storedMode === 'light' || storedMode === 'dark' || storedMode === 'system') {
        setModeState(storedMode);
      }
      if (storedTime === '12h' || storedTime === '24h') {
        setTimeFormatState(storedTime);
      }
      if (['da', 'en', 'es', 'de', 'fr', 'pt'].includes(storedLang || '')) {
        setLanguageState(storedLang as Language);
      }
      if (storedDistance === 'exact' || storedDistance === 'fuzzy' || storedDistance === 'hidden') {
        setDistanceModeState(storedDistance);
      }
      if (storedUnit === 'km' || storedUnit === 'mi') {
        setDistanceUnitState(storedUnit);
      }
      const cols = parseInt(storedColumns || '', 10);
      if (cols >= 1 && cols <= 4) setGridColumnsState(cols as GridColumns);
      asyncDone.current = true;
      markLoaded();
    });

    // Trin 2: Lyt til auth-ændringer og hent kontoens indstillinger fra Firestore
    const unsubscribe = auth().onAuthStateChanged(user => {
      if (!user) {
        firestoreDone.current = true;
        markLoaded();
        return;
      }
      firestore().collection('users').doc(user.uid).get().then(doc => {
        const data = doc.data();
        const s = data?.settings;
        if (!s) {
          // Migrér distanceMode fra gammelt felt hvis det findes
          if (data?.distanceMode) {
            const dm = data.distanceMode;
            if (dm === 'exact' || dm === 'fuzzy' || dm === 'hidden') {
              setDistanceModeState(dm);
            }
          }
          firestoreDone.current = true;
          markLoaded();
          return;
        }
        if (s.themeMode === 'light' || s.themeMode === 'dark' || s.themeMode === 'system') {
          setModeState(s.themeMode);
        }
        if (s.timeFormat === '12h' || s.timeFormat === '24h') {
          setTimeFormatState(s.timeFormat);
        }
        if (['da', 'en', 'es', 'de', 'fr', 'pt'].includes(s.language)) {
          setLanguageState(s.language);
        }
        if (s.distanceMode === 'exact' || s.distanceMode === 'fuzzy' || s.distanceMode === 'hidden') {
          setDistanceModeState(s.distanceMode);
        }
        if (s.distanceUnit === 'km' || s.distanceUnit === 'mi') {
          setDistanceUnitState(s.distanceUnit);
        }
        const cols = parseInt(s.gridColumns, 10);
        if (cols >= 1 && cols <= 4) {
          setGridColumnsState(cols as GridColumns);
          AsyncStorage.setItem(GRID_COLUMNS_STORAGE_KEY, String(cols));
        }
        // Opdater lokal cache med kontoens indstillinger
        cacheSettings(
          s.themeMode ?? 'system',
          s.timeFormat ?? '24h',
          s.language ?? 'da',
          s.distanceMode ?? 'exact',
          s.distanceUnit ?? 'km',
        );
        firestoreDone.current = true;
        markLoaded();
      }).catch(() => {
        firestoreDone.current = true;
        markLoaded();
      });
    });

    return () => unsubscribe();
  }, []);

  // Lyt til global app-config (showTestBadges)
  useEffect(() => {
    const unsub = firestore().collection('config').doc('app').onSnapshot(
      snap => {
        if (!snap.exists) {
          setShowTestBadges(true);
          return;
        }
        const data = snap.data();
        setShowTestBadges(data?.showTestBadges !== false);
        if (typeof data?.loginTestInfo === 'string') setLoginTestInfo(data.loginTestInfo);

      },
      () => setShowTestBadges(true), // on error, default to showing badges
    );
    return () => unsub();
  }, []);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
    saveToFirestore('themeMode', newMode);
  };

  const setTimeFormat = (format: TimeFormat) => {
    setTimeFormatState(format);
    AsyncStorage.setItem(TIME_FORMAT_STORAGE_KEY, format);
    saveToFirestore('timeFormat', format);
  };

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    saveToFirestore('language', lang);
  };

  const setDistanceMode = (dm: DistanceMode) => {
    setDistanceModeState(dm);
    AsyncStorage.setItem(DISTANCE_MODE_STORAGE_KEY, dm);
    saveToFirestore('distanceMode', dm);
    // Gem også som top-level felt så andre brugere kan læse det
    const uid = auth().currentUser?.uid;
    if (uid) {
      firestore().collection('users').doc(uid).update({ distanceMode: dm }).catch(() => {});
    }
  };

  const setDistanceUnit = (du: DistanceUnit) => {
    setDistanceUnitState(du);
    AsyncStorage.setItem(DISTANCE_UNIT_STORAGE_KEY, du);
    saveToFirestore('distanceUnit', du);
  };

  const setGridColumns = (cols: GridColumns) => {
    setGridColumnsState(cols);
    AsyncStorage.setItem(GRID_COLUMNS_STORAGE_KEY, String(cols));
    saveToFirestore('gridColumns', String(cols));
  };

  const isDark =
    mode === 'dark' || (mode === 'system' && systemScheme === 'dark');

  return {
    colors: isDark ? darkColors : lightColors,
    mode,
    isDark,
    setMode,
    timeFormat,
    setTimeFormat,
    language,
    setLanguage,
    distanceMode,
    setDistanceMode,
    distanceUnit,
    setDistanceUnit,
    gridColumns,
    setGridColumns,
    showTestBadges,
    loginTestInfo,
    t: translations[language],
    loaded,
  };
}

// Keep backward compat — default export for light colors
export const colors = lightColors;

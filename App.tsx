import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, StatusBar, Alert, AppState, TouchableOpacity, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
const KeyboardProvider = Platform.OS === 'android'
  ? require('react-native-keyboard-controller').KeyboardProvider
  : ({ children }: { children: React.ReactNode }) => <>{children}</>;
import { NavigationContainer, DefaultTheme, DarkTheme, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationService from './src/services/NotificationService';
import LocationService from './src/services/LocationService';
import NotificationBanner, { NotificationBannerRef, NotificationData } from './src/components/NotificationBanner';
import DisclosureModal from './src/components/DisclosureModal';
import { Bell as BellIcon } from 'lucide-react-native';
import { ThemeContext, useThemeProvider } from './src/theme';
import LoginScreen from './src/features/auth/LoginScreen';
import SignupScreen from './src/features/auth/SignupScreen';
import ProfileViewScreen from './src/features/profile/ProfileViewScreen';
import ChatScreen from './src/features/chat/ChatScreen';
import MainTabs from './src/navigation/MainTabs';
import FeedbackScreen from './src/features/settings/FeedbackScreen';
import BlockedUsersScreen from './src/features/settings/BlockedUsersScreen';
import EditProfileScreen from './src/features/profile/EditProfileScreen';
import DeleteAccountScreen from './src/features/settings/DeleteAccountScreen';
import PrivacyPolicyScreen from './src/features/legal/PrivacyPolicyScreen';
import TermsConditionsScreen from './src/features/legal/TermsConditionsScreen';
import CommunityGuidelinesScreen from './src/features/legal/CommunityGuidelinesScreen';
import ChildSafetyScreen from './src/features/legal/ChildSafetyScreen';
import mobileAds from 'react-native-google-mobile-ads';

mobileAds().initialize();

type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  // Fanerne (MapHome/ChatsList/MyProfile/Settings) bor i MainTabs
  Tabs: undefined;
  ProfileView: { userId: string };
  Chat: {
    otherUser: { id: string; displayName: string; testAccount?: boolean };
    eventChatId?: string;
    eventTitle?: string;
    fromProfile?: boolean;
  };
  Feedback: undefined;
  BlockedUsers: undefined;
  EditProfile: undefined;
  DeleteAccount: undefined;
  PrivacyPolicy: undefined;
  TermsConditions: undefined;
  CommunityGuidelines: undefined;
  ChildSafety: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

function App() {
  const [initializing, setInitializing] = useState(true);
  const [authState, setAuthState] = useState<null | false | true>(null);
  const [networkError, setNetworkError] = useState(false);
  const [showNotifDisclosure, setShowNotifDisclosure] = useState(false);
  const notifDisclosureResolve = useRef<(() => void) | null>(null);
  const theme = useThemeProvider();
  const bannerRef = useRef<NotificationBannerRef>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setNetworkError(prev => {
        // Kun vis fejl hvis vi stadig initialiserer
        if (initializing) return true;
        return prev;
      });
    }, 10000);
    return () => clearTimeout(timeout);
  }, [initializing]);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = auth().onAuthStateChanged(user => {
      setNetworkError(false);
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (user) {
        unsubscribeProfile = firestore()
          .collection('users')
          .doc(user.uid)
          .onSnapshot(doc => {
            if (doc.exists()) {
              const data = doc.data();
              const fromCache = doc.metadata.fromCache;
              const t = theme.t;

              // Kun håndhæv ban/suspension på server-bekræftet data
              // (Firestores offline cache kan have forældet suspendedUntil/banned)
              if (!fromCache) {
                // Tjek om brugeren er banned
                if (data?.banned) {
                  Alert.alert(
                    t.accountBannedTitle,
                    t.accountBannedMessage,
                    [{ text: t.ok, onPress: () => {
                      auth().signOut();
                      // Pivot 2.0: signOut giver gæstesession, intet stack-skifte —
                      // send brugeren hjem til kortet uanset hvor de stod
                      if (navigationRef.isReady()) {
                        navigationRef.resetRoot({ index: 0, routes: [{ name: 'Tabs' }] });
                      }
                    } }],
                    { cancelable: false },
                  );
                  return;
                }

                // Tjek om brugeren er suspenderet
                if (data?.suspendedUntil) {
                  const suspendedUntil = data.suspendedUntil.toDate?.() ?? new Date(data.suspendedUntil);
                  if (suspendedUntil > new Date()) {
                    const locale = theme.language === 'da' ? 'da-DK' : theme.language === 'de' ? 'de-DE' : theme.language === 'es' ? 'es-ES' : theme.language === 'fr' ? 'fr-FR' : theme.language === 'pt' ? 'pt-PT' : 'en-US';
                    const dateStr = suspendedUntil.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
                    Alert.alert(
                      t.accountSuspendedTitle,
                      t.accountSuspendedMessage(dateStr),
                      [{ text: t.ok, onPress: () => {
                        auth().signOut();
                        if (navigationRef.isReady()) {
                          navigationRef.resetRoot({ index: 0, routes: [{ name: 'Tabs' }] });
                        }
                      } }],
                      { cancelable: false },
                    );
                    return;
                  }
                }
              }

              // Tjek om brugeren har nye advarsler
              const warnings = data?.warnings || 0;
              const warningsSeen = data?.warningsSeen || 0;
              if (warnings > warningsSeen) {
                Alert.alert(
                  t.accountWarningTitle,
                  t.accountWarningMessage(warnings - warningsSeen),
                  [{
                    text: t.accountWarningOk,
                    onPress: () => {
                      firestore()
                        .collection('users')
                        .doc(user.uid)
                        .update({ warningsSeen: warnings })
                        .catch(console.error);
                    },
                  }],
                  { cancelable: false },
                );
              }

              setAuthState(true);

              // Vis disclosure-modal før notification-permission (kun første gang)
              const initNotifications = async () => {
                const disclosed = await AsyncStorage.getItem('@roket_notif_disclosure_shown');
                if (!disclosed) {
                  await new Promise<void>(resolve => {
                    notifDisclosureResolve.current = resolve;
                    setShowNotifDisclosure(true);
                  });
                  await AsyncStorage.setItem('@roket_notif_disclosure_shown', 'true');
                }
                await NotificationService.initialize();
              };
              initNotifications().catch(console.error);
            } else {
              // Profildokument eksisterer ikke endnu — vent til signup-flow opretter det
            }
            setInitializing(false);
          }, err => {
            // Ved logout afviser Firestore-reglerne denne listener (permission-denied).
            // Uden denne handler bliver det en unhandled exception → crash efter logout.
            console.warn('Profile snapshot error:', err);
            setInitializing(false);
          });
      } else {
        // Pivot 2.0: ingen bruger → log ind som anonym gæst, så kortet kan
        // browses uden konto. Gæstens profil-doc findes ikke → authState
        // forbliver null → app-stacken vises (MapHome). Fejler anonym
        // login (fx offline ved allerførste start), vis login som fallback.
        auth().signInAnonymously().catch(err => {
          console.warn('Anonymous sign-in failed:', err);
          setAuthState(false);
          setInitializing(false);
        });
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  // Notification listeners
  useEffect(() => {
    if (authState !== true) return;

    // Fælles routing for notifikations-taps: event-gruppechat hvis payload'en
    // har eventChatId, ellers 1:1/connection — og ingenting for payloads uden
    // navigations-mål (fx Hold kontakten-anmodninger, der bare åbner appen)
    const navigateFromNotification = (data: any) => {
      if (!navigationRef.isReady() || !data) return;
      if (data.eventChatId && data.eventTitle) {
        navigationRef.navigate('Chat', {
          otherUser: { id: data.eventChatId, displayName: data.eventTitle, testAccount: false },
          eventChatId: data.eventChatId,
          eventTitle: data.eventTitle,
        });
        return;
      }
      if (data.senderId && data.senderName) {
        navigationRef.navigate('Chat', {
          otherUser: { id: data.senderId as string, displayName: data.senderName as string },
        });
      }
    };

    // Foreground: show in-app banner
    const unsubForeground = NotificationService.onForegroundMessage(remoteMessage => {
      const data = remoteMessage.data;

      // Nærheds-push (ingen afsender-felter): vis banner med event-info.
      // Tap navigerer ingen steder — aktiviteten ligger allerede på kortet.
      if (data?.type === 'nearbyEvent') {
        bannerRef.current?.show({
          senderName: remoteMessage.notification?.title ?? '',
          senderId: '',
          message: remoteMessage.notification?.body ?? '',
          senderPhoto: null,
        });
        return;
      }

      if (!data?.senderId || !data?.senderName) return;

      // Ignorer notifikationer fra dig selv
      if (data.senderId === auth().currentUser?.uid) return;

      // Don't show banner if on messages screen or in the relevant chat.
      // getCurrentRoute() går ned i nested navigators, så navnet er stadig
      // 'ChatsList' selvom skærmen nu bor i MainTabs (deraf string-casten)
      if (navigationRef.isReady()) {
        const state = navigationRef.getCurrentRoute();
        if ((state?.name as string) === 'ChatsList') return;
        if (state?.name === 'Chat') {
          const params = state.params as any;
          if (data.eventChatId
            ? params?.eventChatId === data.eventChatId
            : params?.otherUser?.id === data.senderId) {
            return;
          }
        }
      }

      bannerRef.current?.show({
        // Gruppe-push: event-titlen er "afsenderen" i banneret — beskeden
        // hedder allerede "Jens: Hey", så senderName som titel gav navnet to gange
        senderName: (data.eventChatId ? (data.eventTitle as string) : (data.senderName as string)) || (data.senderName as string),
        senderId: data.senderId as string,
        message: remoteMessage.notification?.body ?? (data.message as string) ?? '',
        senderPhoto: (data.senderPhoto as string) || null,
        eventChatId: (data.eventChatId as string) || undefined,
        eventTitle: (data.eventTitle as string) || undefined,
      });
    });

    // Background: user tapped notification while app was in background
    NotificationService.onNotificationOpenedApp(remoteMessage => {
      navigateFromNotification(remoteMessage.data);
    });

    // Quit: app was opened via notification tap
    NotificationService.getInitialNotification().then(remoteMessage => {
      if (!remoteMessage) return;
      navigateFromNotification(remoteMessage.data);
    });

    return () => unsubForeground();
  }, [authState]);

  // Global location watch — opdaterer lokation uanset hvilken skærm brugeren er på
  useEffect(() => {
    if (authState !== true) return;
    let watchId: number | null = null;

    const startWatch = async () => {
      const precision = await LocationService.checkCurrentPrecision();
      if (precision === 'denied') {
        // Fjern gammel lokation fra Firestore
        const user = auth().currentUser;
        if (user) {
          firestore().collection('userLocations').doc(user.uid).delete().catch(() => {});
        }
        return;
      }
      const id = await LocationService.watchPosition(
        async (latitude, longitude) => {
          const user = auth().currentUser;
          if (!user) return;
          await firestore().collection('userLocations').doc(user.uid).set({
            location: new firestore.GeoPoint(latitude, longitude),
            updatedAt: firestore.FieldValue.serverTimestamp(),
          });
        },
      );
      watchId = id;
    };

    startWatch();

    // Stop watch når appen går i baggrunden (forhindrer crash hvis bruger ændrer permission)
    // Genstart når appen kommer i forgrunden
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        if (watchId !== null) {
          LocationService.clearWatch(watchId);
          watchId = null;
        }
      } else if (nextState === 'active') {
        startWatch();
      }
    });

    return () => {
      if (watchId !== null) LocationService.clearWatch(watchId);
      subscription.remove();
    };
  }, [authState]);

  const handleBannerPress = useCallback((data: NotificationData) => {
    if (!navigationRef.isReady()) return;
    // Bannere uden navigations-mål (fx nærheds-push) gør ingenting ved tap
    if (!data.eventChatId && !data.senderId) return;
    if (data.eventChatId && data.eventTitle) {
      navigationRef.navigate('Chat', {
        otherUser: { id: data.eventChatId, displayName: data.eventTitle, testAccount: false },
        eventChatId: data.eventChatId,
        eventTitle: data.eventTitle,
      });
      return;
    }
    navigationRef.navigate('Chat', {
      otherUser: { id: data.senderId, displayName: data.senderName },
    });
  }, []);

  if (initializing || !theme.loaded) {
    if (networkError) {
      return (
        <View style={[styles.loading, { backgroundColor: theme.colors.background }]}>
          <Text style={[styles.noConnectionText, { color: theme.colors.textPrimary }]}>
            {theme.t.noConnection}
          </Text>
          <Text style={[styles.noConnectionSubtext, { color: theme.colors.textMuted }]}>
            {theme.t.noConnectionSubtext}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.colors.primaryBlue }]}
            onPress={() => {
              setNetworkError(false);
              setInitializing(true);
              // Re-trigger auth check ved at logge ud og ind igen via listener
              auth().currentUser?.reload().catch(() => {});
            }}
          >
            <Text style={styles.retryButtonText}>{theme.t.retry}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={[styles.loading, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primaryRed} />
      </View>
    );
  }

  const navTheme = theme.isDark
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: theme.colors.background } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: theme.colors.background } };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <ThemeContext.Provider value={{ colors: theme.colors, mode: theme.mode, isDark: theme.isDark, setMode: theme.setMode, timeFormat: theme.timeFormat, setTimeFormat: theme.setTimeFormat, language: theme.language, setLanguage: theme.setLanguage, distanceMode: theme.distanceMode, setDistanceMode: theme.setDistanceMode, distanceUnit: theme.distanceUnit, setDistanceUnit: theme.setDistanceUnit, showTestBadges: theme.showTestBadges, loginTestInfo: theme.loginTestInfo, t: theme.t }}>
        <NavigationContainer ref={navigationRef} theme={navTheme}>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {authState === false ? (
              <>
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Signup" component={SignupScreen} />
                <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
                <Stack.Screen name="TermsConditions" component={TermsConditionsScreen} />
              </>
            ) : (
              <>
                <Stack.Screen name="Tabs" component={MainTabs} />
                <Stack.Screen name="ProfileView" component={ProfileViewScreen} />
                <Stack.Screen name="Chat" component={ChatScreen} />
                <Stack.Screen name="Feedback" component={FeedbackScreen} />
                <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
                <Stack.Screen name="EditProfile" component={EditProfileScreen} />
                <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
                <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
                <Stack.Screen name="TermsConditions" component={TermsConditionsScreen} />
                <Stack.Screen name="CommunityGuidelines" component={CommunityGuidelinesScreen} />
                <Stack.Screen name="ChildSafety" component={ChildSafetyScreen} />
                {/* Gæster (anonym auth) kan nå login/signup via gates på
                    kontokrævende handlinger */}
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Signup" component={SignupScreen} />
              </>
            )}
          </Stack.Navigator>
        </NavigationContainer>
        {authState === true && (
          <NotificationBanner ref={bannerRef} onPress={handleBannerPress} />
        )}
        <DisclosureModal
          visible={showNotifDisclosure}
          icon={<BellIcon size={64} color={theme.isDark ? '#fff' : theme.colors.textPrimary} />}
          title={theme.t.disclosureNotificationTitle}
          message={theme.t.disclosureNotificationMessage}
          acceptLabel={theme.t.disclosureNotificationAccept}
          onAccept={() => {
            setShowNotifDisclosure(false);
            notifDisclosureResolve.current?.();
          }}
        />
      </ThemeContext.Provider>
      </KeyboardProvider>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noConnectionText: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  noConnectionSubtext: {
    fontSize: 14,
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default App;

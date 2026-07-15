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
import { subscribeToNearbyCell, unsubscribeFromNearby } from './src/services/NearbyTopics';
import { enqueueModal } from './src/utils/modalQueue';
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
  // Nærved-opt-in fra brugerens profil-doc — styrer om lokations-watch'et
  // overhovedet kører (lokation uploades KUN ved aktivt tilvalg)
  const [nearbyOptIn, setNearbyOptIn] = useState(false);
  // Notifikations-init må kun køre én gang pr. konto-session (profil-
  // snapshottet fyrer ved hver doc-ændring)
  const notifInitForUid = useRef<string | null>(null);
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
              setNearbyOptIn(data?.notifyNearbyActivities === true);

              // Vis disclosure-modal før notification-permission (kun første
              // gang). HELE sekvensen ligger i modal-køen: på frisk iOS-
              // installation overlever login i keychain, så denne OG
              // lokations-disclosuren (MapHome) fyrer samtidig — to
              // samtidige modals fryser appen (usynlig touch-æder).
              const initNotifications = () => enqueueModal(async () => {
                const disclosed = await AsyncStorage.getItem('@roket_notif_disclosure_shown');
                if (!disclosed) {
                  await new Promise<void>(resolve => {
                    notifDisclosureResolve.current = resolve;
                    setShowNotifDisclosure(true);
                  });
                  await AsyncStorage.setItem('@roket_notif_disclosure_shown', 'true');
                }
                await NotificationService.initialize();
              });
              // Kun én gang pr. konto-session: snapshottet fyrer ved HVER
              // profil-ændring (toggle, avatar, warningsSeen …), og uden
              // vagten ville hver ændring re-køre permission/getToken/
              // token-write
              if (notifInitForUid.current !== user.uid) {
                notifInitForUid.current = user.uid;
                initNotifications().catch(console.error);
              }
            } else if (user.isAnonymous) {
              // GÆST (inkl. gæstesession efter logout): profil-doc findes
              // aldrig. authState SKAL nulstilles her — efter logout ville
              // den ellers stå tilbage som true fra den forrige konto, og
              // gæsten ville køre med fuld-bruger-listeners og forkert UI.
              setAuthState(null);
              // Næste login skal re-initialisere notifikationer (logout
              // blanker fcmToken)
              notifInitForUid.current = null;
            } else {
              // Rigtig konto uden profil-doc endnu — vent til signup-flowet
              // opretter det (authState røres ikke midt i oprettelsen)
            }
            setInitializing(false);
          }, err => {
            // Ved logout afviser Firestore-reglerne denne listener (permission-denied).
            // Uden denne handler bliver det en unhandled exception → crash efter logout.
            console.warn('Profile snapshot error:', err);
            setInitializing(false);
          });
      } else {
        setNearbyOptIn(false);
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
    // har eventChatId, ellers 1:1/connection
    const navigateFromNotification = (data: any) => {
      if (!navigationRef.isReady() || !data) return;
      // Hold kontakten-anmodning OG nærved-push: åbn aktivitetens detalje
      // på kortet (openEventId henter selv eventet, så viewporten er
      // ligegyldig)
      if ((data.type === 'contactRequest' || data.type === 'nearbyEvent') && data.eventId) {
        (navigationRef as any).navigate('Tabs', {
          screen: 'MapHome',
          params: { openEventId: data.eventId, openEventNonce: Date.now() },
        });
        return;
      }
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

      // Push uden afsender-felter (nærheds-events og Hold kontakten-
      // anmodninger): vis banner med notifikationens egen titel/tekst og
      // en type-specifik label. Tap åbner aktivitetens detalje for begge.
      if (data?.type === 'nearbyEvent' || data?.type === 'contactRequest') {
        const isContactRequest = data.type === 'contactRequest';
        // Topic-model: publicering pr. celle kan ikke ekskludere skaberen
        // server-side — men skaberen ER i forgrunden i oprettelsesøjeblikket,
        // så selv-pushen fanges og droppes her
        if (data.type === 'nearbyEvent' && data.creatorId === auth().currentUser?.uid) {
          return;
        }
        bannerRef.current?.show({
          senderName: remoteMessage.notification?.title ?? '',
          senderId: '',
          message: remoteMessage.notification?.body ?? '',
          senderPhoto: null,
          label: isContactRequest ? theme.t.bannerContactRequest : theme.t.bannerNearby,
          contactEventId: (data.eventId as string) || undefined,
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

  // Nærved-notifikationer via FCM geohash-topics (privacy-model 2026-07):
  // ved opt-in abonnerer ENHEDEN på topic'et for sin egen geohash-celle —
  // positionen bruges kun lokalt til at vælge cellen, intet uploades, og
  // Røkets database indeholder ingen brugerlokationer.
  useEffect(() => {
    // Defensiv oprydning fra den tidligere model, hvor opt-in skrev en
    // kvantiseret position til userLocations — INTET læser collectionen
    // længere, så et evt. gammelt doc er rent residu uanset opt-in-status
    if (authState === true) {
      const user = auth().currentUser;
      if (user) {
        firestore().collection('userLocations').doc(user.uid).delete().catch(() => {});
      }
    }

    if (authState !== true || !nearbyOptIn) {
      // Afmeld ved opt-out OG logout/gæst: topic-abonnementer følger
      // enheden (FCM-tokenet), ikke kontoen — uden dette ville enheden
      // blive ved med at få pushes for en udlogget brugers tilvalg.
      // (No-op hvis der aldrig var abonneret.)
      unsubscribeFromNearby().catch(() => {});
      return;
    }

    const refreshCell = async () => {
      const precision = await LocationService.checkCurrentPrecision();
      if (precision === 'denied') return;
      const pos = await LocationService.getCurrentPosition();
      if (pos) await subscribeToNearbyCell(pos.latitude, pos.longitude);
    };
    refreshCell().catch(() => {});

    // Cellen er 3-5 km bred — genberegn ved foreground i stedet for et
    // kontinuerligt GPS-watch (mindre batteri; flytter man sig, sker det
    // alligevel typisk med lukket app). Gen-abonnement på samme celle er
    // gratis, og kaldet self-healer efter geninstallation/token-rotation.
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') refreshCell().catch(() => {});
    });
    return () => subscription.remove();
  }, [authState, nearbyOptIn]);

  const handleBannerPress = useCallback((data: NotificationData) => {
    if (!navigationRef.isReady()) return;
    // Hold kontakten-anmodning: åbn aktivitetens detalje på kortet
    if (data.contactEventId) {
      (navigationRef as any).navigate('Tabs', {
        screen: 'MapHome',
        params: { openEventId: data.contactEventId, openEventNonce: Date.now() },
      });
      return;
    }
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
      <ThemeContext.Provider value={{ colors: theme.colors, mode: theme.mode, isDark: theme.isDark, setMode: theme.setMode, timeFormat: theme.timeFormat, setTimeFormat: theme.setTimeFormat, language: theme.language, setLanguage: theme.setLanguage, distanceUnit: theme.distanceUnit, setDistanceUnit: theme.setDistanceUnit, showTestBadges: theme.showTestBadges, loginTestInfo: theme.loginTestInfo, t: theme.t }}>
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

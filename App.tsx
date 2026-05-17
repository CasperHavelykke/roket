import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, StatusBar, Alert, AppState, TouchableOpacity, Platform } from 'react-native';
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
import HomeScreen from './src/features/home/HomeScreen';
import ProfileViewScreen from './src/features/profile/ProfileViewScreen';
import ChatScreen from './src/features/chat/ChatScreen';
import ChatsListScreen from './src/features/chat/ChatsListScreen';
import MyProfileScreen from './src/features/profile/MyProfileScreen';
import SettingsScreen from './src/features/settings/SettingsScreen';
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
  Home: undefined;
  ProfileView: { userId: string };
  Chat: { otherUser: { id: string; displayName: string } };
  ChatsList: undefined;
  MyProfile: undefined;
  Settings: undefined;
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
                    [{ text: t.ok, onPress: () => auth().signOut() }],
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
                      [{ text: t.ok, onPress: () => auth().signOut() }],
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
        setAuthState(false);
        setInitializing(false);
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

    // Foreground: show in-app banner
    const unsubForeground = NotificationService.onForegroundMessage(remoteMessage => {
      const data = remoteMessage.data;
      if (!data?.senderId || !data?.senderName) return;

      // Ignorer notifikationer fra dig selv
      if (data.senderId === auth().currentUser?.uid) return;

      // Don't show banner if on messages screen or in chat with this sender
      if (navigationRef.isReady()) {
        const state = navigationRef.getCurrentRoute();
        if (state?.name === 'ChatsList') return;
        if (
          state?.name === 'Chat' &&
          (state.params as any)?.otherUser?.id === data.senderId
        ) {
          return;
        }
      }

      bannerRef.current?.show({
        senderName: data.senderName as string,
        senderId: data.senderId as string,
        message: remoteMessage.notification?.body ?? (data.message as string) ?? '',
        senderPhoto: (data.senderPhoto as string) || null,
      });
    });

    // Background: user tapped notification while app was in background
    NotificationService.onNotificationOpenedApp(remoteMessage => {
      const data = remoteMessage.data;
      if (!data?.senderId || !data?.senderName) return;
      if (navigationRef.isReady()) {
        navigationRef.navigate('Chat', {
          otherUser: { id: data.senderId as string, displayName: data.senderName as string },
        });
      }
    });

    // Quit: app was opened via notification tap
    NotificationService.getInitialNotification().then(remoteMessage => {
      if (!remoteMessage) return;
      const data = remoteMessage.data;
      if (!data?.senderId || !data?.senderName) return;
      if (navigationRef.isReady()) {
        navigationRef.navigate('Chat', {
          otherUser: { id: data.senderId as string, displayName: data.senderName as string },
        });
      }
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
    if (navigationRef.isReady()) {
      navigationRef.navigate('Chat' as never, {
        otherUser: { id: data.senderId, displayName: data.senderName },
      } as never);
    }
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
    <SafeAreaProvider>
      <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <ThemeContext.Provider value={{ colors: theme.colors, mode: theme.mode, isDark: theme.isDark, setMode: theme.setMode, timeFormat: theme.timeFormat, setTimeFormat: theme.setTimeFormat, language: theme.language, setLanguage: theme.setLanguage, distanceMode: theme.distanceMode, setDistanceMode: theme.setDistanceMode, distanceUnit: theme.distanceUnit, setDistanceUnit: theme.setDistanceUnit, gridColumns: theme.gridColumns, setGridColumns: theme.setGridColumns, showTestBadges: theme.showTestBadges, loginTestInfo: theme.loginTestInfo, releaseTag: theme.releaseTag, t: theme.t }}>
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
                <Stack.Screen name="Home" component={HomeScreen} />
                <Stack.Screen name="ProfileView" component={ProfileViewScreen} />
                <Stack.Screen name="Chat" component={ChatScreen} />
                <Stack.Screen name="ChatsList" component={ChatsListScreen} />
                <Stack.Screen name="MyProfile" component={MyProfileScreen} />
                <Stack.Screen name="Settings" component={SettingsScreen} />
                <Stack.Screen name="Feedback" component={FeedbackScreen} />
                <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
                <Stack.Screen name="EditProfile" component={EditProfileScreen} />
                <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
                <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
                <Stack.Screen name="TermsConditions" component={TermsConditionsScreen} />
                <Stack.Screen name="CommunityGuidelines" component={CommunityGuidelinesScreen} />
                <Stack.Screen name="ChildSafety" component={ChildSafetyScreen} />
              </>
            )}
          </Stack.Navigator>
        </NavigationContainer>
        {authState === true && (
          <NotificationBanner ref={bannerRef} onPress={handleBannerPress} />
        )}
        <DisclosureModal
          visible={showNotifDisclosure}
          icon={<BellIcon size={64} />}
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

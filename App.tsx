import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import NotificationService from './src/services/NotificationService';
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import ProfileSetupScreen from './src/screens/ProfileSetupScreen';
import HomeScreen from './src/screens/HomeScreen';
import ProfileViewScreen from './src/screens/ProfileViewScreen';
import ChatScreen from './src/screens/ChatScreen';
import ChatsListScreen from './src/screens/ChatsListScreen';
import MyProfileScreen from './src/screens/MyProfileScreen';

const Stack = createNativeStackNavigator();

function App() {
  const [initializing, setInitializing] = useState(true);
  // null = ikke tjekket endnu, false = ikke logget ind, true = logget ind med profil, 'setup' = logget ind uden profil
  const [authState, setAuthState] = useState<null | false | true | 'setup'>(null);

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async user => {
      if (user) {
        const doc = await firestore().collection('users').doc(user.uid).get();
        if (doc.exists() && doc.data()?.displayName) {
          setAuthState(true);
          NotificationService.initialize().catch(console.error);
        } else {
          setAuthState('setup');
        }
      } else {
        setAuthState(false);
      }
      setInitializing(false);
    });

    return () => unsubscribe();
  }, []);

  if (initializing) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {authState === false ? (
          // Ikke logget ind
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </>
        ) : authState === 'setup' ? (
          // Logget ind men ingen profil
          <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
        ) : (
          // Logget ind med profil
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="ProfileView" component={ProfileViewScreen} />
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen name="ChatsList" component={ChatsListScreen} />
            <Stack.Screen name="MyProfile" component={MyProfileScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});

export default App;

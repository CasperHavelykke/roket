import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MapHomeScreen from '../features/map/MapHomeScreen';
import ChatsListScreen from '../features/chat/ChatsListScreen';
import MyProfileScreen from '../features/profile/MyProfileScreen';
import SettingsScreen from '../features/settings/SettingsScreen';
import BottomNavBar from '../features/map/BottomNavBar';

const Tab = createBottomTabNavigator();

/**
 * Fanerne bag den persistente bundnavigation (redesign 2026-07).
 * Rutenavnene matcher de gamle stack-navne så eksisterende navigate-kald
 * og resetRoot-mål stadig rammer. Pushede skærme (Chat, EditProfile, legal
 * osv.) bor i root-stacken og lægger sig OVER tab-baren.
 *
 * OBS: fane-skærme unmountes aldrig efter første besøg — datahentning skal
 * bindes med useFocusEffect, ikke mount (jf. F4-lektien om døde listeners).
 */
export default function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={props => <BottomNavBar {...props} />}
      screenOptions={{ headerShown: false, lazy: true }}
    >
      <Tab.Screen name="MapHome" component={MapHomeScreen} />
      <Tab.Screen name="ChatsList" component={ChatsListScreen} />
      <Tab.Screen name="MyProfile" component={MyProfileScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

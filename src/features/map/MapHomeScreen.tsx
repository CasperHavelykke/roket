import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
} from 'react-native';
import MapView, { Marker, Region, PROVIDER_GOOGLE } from 'react-native-maps';
import Geolocation from 'react-native-geolocation-service';
import { ArrowLeft, Plus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GradientView from '../../components/GradientView';
import { useTheme } from '../../theme';
import { EventDoc, overlapsWindow } from '../../events';
import ActivityMarker from './ActivityMarker';
import useNearbyActivities from './useNearbyActivities';
import TimeScrubber from './TimeScrubber';
import ActivityDrawer, { DRAWER_COLLAPSED_HEIGHT } from './ActivityDrawer';
import { TimeWindow } from './scrubberTime';
import EventDetailModal from '../events/EventDetailModal';
import CreateEventModal from '../events/CreateEventModal';
import MapPickerModal from '../events/MapPickerModal';

const DEFAULT_REGION: Region = {
  // København som fallback indtil brugerens position kendes
  latitude: 55.6761,
  longitude: 12.5683,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const FAB_SIZE = 61;
const FAB_RIGHT = 16;

export default function MapHomeScreen({ navigation }: any) {
  const { colors, t } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const mapRef = useRef<MapView>(null);
  const [selected, setSelected] = useState<EventDoc | null>(null);
  const [initialRegion, setInitialRegion] = useState<Region | null>(null);
  // Kun sat ved reelt geolocation-svar — afstande vises ikke fra fallback-regionen
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  // Opret-flow: pin på kortet FØRST (samme mentale model som browse), derefter formularen
  const [showPinPicker, setShowPinPicker] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  // Den aktuelle viewport — driver geo-queryen. Opdateres når brugeren
  // slipper en pan/zoom (onRegionChangeComplete), ikke under selve gesturen.
  const [region, setRegion] = useState<Region | null>(null);
  // Scrubberens tidsvindue — default NU (hvad sker der lige nu omkring mig)
  const [timeWindow, setTimeWindow] = useState<TimeWindow>({ mode: 'now' });

  const { activities, zoomedOut } = useNearbyActivities(region);

  // Tidsfiltrering sker i hukommelsen — at trække i scrubberen koster
  // nul netværkskald (geo-filtreringen skete allerede i Firestore).
  // Vinduet kigger 2 timer frem fra scrub-positionen (VISIBLE_WINDOW_MINUTES).
  const visibleActivities = useMemo(() => {
    const at = timeWindow.mode === 'at' ? timeWindow.at : new Date();
    return activities.filter(ev => overlapsWindow(ev, at));
  }, [activities, timeWindow]);

  // Centrér på brugerens position (permission er allerede givet via grid-flowet;
  // fejler den, falder vi bare tilbage til default-regionen)
  useEffect(() => {
    Geolocation.getCurrentPosition(
      pos => {
        const r = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        };
        setInitialRegion(r);
        setRegion(r);
        setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      },
      () => {
        setInitialRegion(DEFAULT_REGION);
        setRegion(DEFAULT_REGION);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }, []);

  if (!initialRegion) {
    return <View style={[styles.container, { backgroundColor: colors.background }]} />;
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion}
        onRegionChangeComplete={setRegion}
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}
      >
        {visibleActivities.map(event => (
          <Marker
            key={event.id}
            coordinate={event.location}
            onPress={() => setSelected(event)}
            tracksViewChanges={false}
            anchor={{ x: 0.5, y: 1 }}
          >
            <ActivityMarker tag={event.tag} />
          </Marker>
        ))}
      </MapView>

      {/* Midlertidig dev-tilbageknap — fjernes når MapHome bliver primær skærm */}
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={[styles.backBtn, { top: insets.top + 12, backgroundColor: colors.cardBackground }]}
        activeOpacity={0.8}
      >
        <ArrowLeft size={22} color={colors.textPrimary} />
      </TouchableOpacity>

      {/* Opret aktivitet — pin-først-flowet starter her.
          Skærmkant til skærmkant-gradient + hvid border: samme stil som grid'ets FABs */}
      <TouchableOpacity
        onPress={() => setShowPinPicker(true)}
        style={[styles.fab, { bottom: insets.bottom + DRAWER_COLLAPSED_HEIGHT + 108 }]}
        activeOpacity={0.85}
      >
        <GradientView
          colors={[colors.primaryBlue, colors.primaryRed]}
          start={{ x: -(screenWidth - FAB_RIGHT - FAB_SIZE) / FAB_SIZE, y: 0 }}
          end={{ x: (screenWidth - (screenWidth - FAB_RIGHT - FAB_SIZE)) / FAB_SIZE, y: 0 }}
          style={styles.fabInner}
        >
          <Plus size={30} color="#fff" strokeWidth={2.5} />
        </GradientView>
      </TouchableOpacity>

      {!zoomedOut && (
        <View style={[styles.scrubberWrap, { bottom: insets.bottom + DRAWER_COLLAPSED_HEIGHT + 10 }]}>
          <TimeScrubber
            activities={activities}
            value={timeWindow}
            onChange={setTimeWindow}
          />
        </View>
      )}

      <ActivityDrawer
        activities={visibleActivities}
        headerText={zoomedOut ? t.mapZoomIn : t.mapActivitiesCount(visibleActivities.length)}
        userLocation={userLocation}
        onSelect={setSelected}
      />

      <MapPickerModal
        visible={showPinPicker}
        initial={pendingLocation ?? (region ? { latitude: region.latitude, longitude: region.longitude } : userLocation)}
        onClose={() => setShowPinPicker(false)}
        onConfirm={loc => {
          setPendingLocation(loc);
          // Lille pause mellem to native modals — samtidigt skift glitcher på iOS
          setTimeout(() => setShowCreate(true), 250);
        }}
      />

      <CreateEventModal
        visible={showCreate}
        onClose={() => {
          setShowCreate(false);
          setPendingLocation(null);
        }}
        userLocation={userLocation}
        initialLocation={pendingLocation}
      />

      <EventDetailModal
        visible={!!selected}
        event={selected}
        onClose={() => setSelected(null)}
        onOpenChat={(chatId, eventTitle) => {
          setSelected(null);
          navigation.navigate('Chat', {
            otherUser: { id: chatId, displayName: eventTitle, testAccount: false },
            eventChatId: chatId,
            eventTitle,
          });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backBtn: {
    position: 'absolute',
    left: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  scrubberWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  // Matcher grid'ets fabShadow/fabButton (HomeScreen): hvid semi-border + skygge
  fab: {
    position: 'absolute',
    right: FAB_RIGHT,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  fabInner: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    ...Platform.select({ android: { overflow: 'hidden' as const } }),
    alignItems: 'center',
    justifyContent: 'center',
  },
});

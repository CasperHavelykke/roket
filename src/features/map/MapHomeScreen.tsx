import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import MapView, { Marker, Region, PROVIDER_GOOGLE } from 'react-native-maps';
import Geolocation from 'react-native-geolocation-service';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GradientView from '../../components/GradientView';
import RoketLogo from '../../assets/roket-logo-2.svg';
import { useTheme } from '../../theme';
import { EventDoc, overlapsWindow } from '../../events';
import ActivityMarker from './ActivityMarker';
import useNearbyActivities from './useNearbyActivities';
import ActivityDrawer, { DRAWER_COLLAPSED_HEIGHT } from './ActivityDrawer';
import { TimeWindow } from './scrubberTime';
import { DARK_MAP_STYLE } from './mapDarkStyle';
import { requireAccount } from '../../utils/guestGate';
import CreateEventModal from '../events/CreateEventModal';
import MapPickerModal from '../events/MapPickerModal';

const DEFAULT_REGION: Region = {
  // København som fallback indtil brugerens position kendes
  latitude: 55.6761,
  longitude: 12.5683,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

/**
 * Marker med tracksViewChanges-opvarmning: rasterizeren fryser view'et som
 * bitmap, og på Fabric sker snapshottet før gradient/SVG har tegnet →
 * skæve haler og tomme bobler. Vi holder tracking åben kort efter mount
 * og fryser først når alt er tegnet.
 */
function ActivityMapMarker({ event, onPress }: { event: EventDoc; onPress: () => void }) {
  const [track, setTrack] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setTrack(false), 600);
    return () => clearTimeout(id);
  }, []);
  return (
    <Marker
      coordinate={event.location}
      onPress={onPress}
      tracksViewChanges={track}
      anchor={{ x: 0.5, y: 1 }}
    >
      <ActivityMarker tag={event.tag} />
    </Marker>
  );
}


export default function MapHomeScreen({ navigation, route }: any) {
  const { colors, t, isDark } = useTheme();
  const insets = useSafeAreaInsets();
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
  // Vinduet kigger 3 timer frem fra scrub-positionen (VISIBLE_WINDOW_MINUTES).
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

  // Opret-signal fra tab-barens midterknap: + på en anden fane hopper til
  // Kort-fanen med et createRequest-param, som åbner pin-pickeren her
  useEffect(() => {
    if (route?.params?.createRequest) {
      setShowPinPicker(true);
    }
  }, [route?.params?.createRequest]);

  if (!initialRegion) {
    return <View style={[styles.container, { backgroundColor: colors.background }]} />;
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        // Google Maps på Android genanvender ikke customMapStyle ved prop-skift —
        // remount på temaskift (samme greb som preview-kortet i CreateEventModal).
        // region-state gør at vi genåbner på brugerens aktuelle viewport.
        key={isDark ? 'map-dark' : 'map-light'}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={region ?? initialRegion}
        onRegionChangeComplete={setRegion}
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}
        customMapStyle={isDark ? DARK_MAP_STYLE : undefined}
        userInterfaceStyle={isDark ? 'dark' : 'light'}
        // Google-attributionen skal være synlig (Maps ToS) — løft den over
        // den kollapsede drawer (tab-scenen slutter allerede ved nav-baren)
        mapPadding={{ top: 0, right: 0, left: 0, bottom: DRAWER_COLLAPSED_HEIGHT }}
      >
        {visibleActivities.map(event => (
          <ActivityMapMarker key={event.id} event={event} onPress={() => setSelected(event)} />
        ))}
      </MapView>

      {/* Logo-pille — kortet er ellers helt rent (redesign 2026-07) */}
      <View
        style={[
          styles.logoPill,
          {
            top: insets.top + 10,
            backgroundColor: isDark ? 'rgba(22,22,25,0.8)' : 'rgba(255,255,255,0.85)',
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.7)',
          },
        ]}
      >
        <GradientView
          colors={[colors.primaryBlue, colors.primaryRed]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.logoBox}
        >
          <RoketLogo width={16} height={16} fill="#fff" />
        </GradientView>
        <Text style={[styles.logoText, { color: colors.textPrimary }]}>Røket</Text>
      </View>

      <ActivityDrawer
        activities={visibleActivities}
        allActivities={activities}
        headerText={zoomedOut ? t.mapZoomIn : t.mapActivitiesCount(visibleActivities.length)}
        userLocation={userLocation}
        onSelect={setSelected}
        timeWindow={timeWindow}
        onChangeWindow={setTimeWindow}
        selected={selected}
        onCloseDetail={() => setSelected(null)}
        onOpenChat={(chatId, eventTitle) => {
          setSelected(null);
          navigation.navigate('Chat', {
            otherUser: { id: chatId, displayName: eventTitle, testAccount: false },
            eventChatId: chatId,
            eventTitle,
          });
        }}
        onRequireAccount={() => {
          setSelected(null);
          requireAccount(navigation, t);
        }}
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

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  logoPill: {
    position: 'absolute',
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 42,
    paddingLeft: 8,
    paddingRight: 14,
    borderRadius: 21,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 7,
    elevation: 4,
    zIndex: 6,
  },
  logoBox: {
    width: 28,
    height: 28,
    borderRadius: 9,
    ...Platform.select({ android: { overflow: 'hidden' as const } }),
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.15,
  },
});

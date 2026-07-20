import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  AppState,
  Linking,
} from 'react-native';
import MapView, { Marker, Region, PROVIDER_GOOGLE } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MapPin as MapPinIcon, MapPinOff } from 'lucide-react-native';
import { enqueueModal } from '../../utils/modalQueue';
import LocationService from '../../services/LocationService';
import DisclosureModal from '../../components/DisclosureModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GradientView from '../../components/GradientView';
import RoketLogo from '../../assets/roket-logo-2.svg';
import firestore from '@react-native-firebase/firestore';
import { useTheme } from '../../theme';
import { EventDoc, eventFromData, overlapsWindow } from '../../events';
import ActivityMarker, { MARKER_HEIGHT } from './ActivityMarker';
import useNearbyActivities from './useNearbyActivities';
import useNow from '../../hooks/useNow';
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
 *
 * Warm-up'en gentages ved HVER fokus (useFocusEffect): mounter markøren,
 * mens kortet ligger skjult bag en pushet skærm (fx chat åbnet fra en
 * push-notifikation), fryser snapshottet som TOMT, og react-native-maps
 * falder tilbage til standard-rød-pin. Re-warm ved retur healer den.
 */
function ActivityMapMarker({ event, onPress }: { event: EventDoc; onPress: () => void }) {
  const [track, setTrack] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setTrack(true);
      const id = setTimeout(() => setTrack(false), 600);
      return () => clearTimeout(id);
    }, []),
  );
  return (
    <Marker
      coordinate={event.location}
      onPress={onPress}
      tracksViewChanges={track}
      // anchor er Google/Android-only; iOS (Apple Maps) centrerer custom
      // views på koordinatet og skal have centerOffset i stedet. Begge sat
      // = halens spids står på punktet på begge platforme.
      anchor={{ x: 0.5, y: 1 }}
      centerOffset={{ x: 0, y: -MARKER_HEIGHT / 2 }}
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

  // Tikkende nu: uden det fryser filtret på render-tidspunktet — udløbne
  // aktiviteter blev stående på kortet og nye dukkede ikke op før næste
  // tilfældige re-render
  const now = useNow();

  // Tidsfiltrering sker i hukommelsen — at trække i scrubberen koster
  // nul netværkskald (geo-filtreringen skete allerede i Firestore).
  // Vinduet kigger 3 timer frem fra scrub-positionen (VISIBLE_WINDOW_MINUTES).
  const visibleActivities = useMemo(() => {
    const at = timeWindow.mode === 'at' ? timeWindow.at : now;
    return activities.filter(ev => overlapsWindow(ev, at));
  }, [activities, timeWindow, now]);

  // Det valgte event skal være LEVENDE, ikke et frossent snapshot fra
  // tap-øjeblikket — andres joins/ændringer skal ses i detaljen. Fallback
  // til snapshottet når eventet er uden for viewport (openEventId-flowet).
  const liveSelected = useMemo(
    () => (selected ? activities.find(e => e.id === selected.id) ?? selected : null),
    [selected, activities],
  );

  // Prominent disclosure-modal (Play-krav, samme mønster som notifikationer
  // i App.tsx) — vises FØR den native permission-prompt, kun første gang
  const [showLocDisclosure, setShowLocDisclosure] = useState(false);
  const locDisclosureResolve = useRef<(() => void) | null>(null);

  // Centrér på brugerens position. LocationService ANMODER selv om
  // permission — kortet er nu appens første skærm (grid-flowet, der før
  // stod for prompten, er slettet), så prompten skal ske her. Gælder også
  // gæster: deres position bruges kun on-device (centrering + afstande).
  // Afvises den, falder vi tilbage til default-regionen.
  useEffect(() => {
    const init = async () => {
      // Disclosure kun når permission ikke allerede er givet — eksisterende
      // brugere skal ikke se den efter en app-opdatering. Teksten er ens for
      // gæst og bruger ("kun på din enhed") — serverdeling sker først ved
      // aktivt tilvalg af nærved-notifikationer, med egen bekræft-modal dér.
      // Modal + native prompt ligger i modal-KØEN: notifikations-disclosuren
      // (App.tsx) kan fyre samtidig på frisk installation med keychain-login,
      // og to samtidige iOS-modals fryser appen.
      await enqueueModal(async () => {
        const precision = await LocationService.checkCurrentPrecision();
        if (precision !== 'denied') return;
        const disclosed = await AsyncStorage.getItem('@roket_loc_disclosure_shown');
        if (!disclosed) {
          await new Promise<void>(resolve => {
            locDisclosureResolve.current = resolve;
            setShowLocDisclosure(true);
          });
          await AsyncStorage.setItem('@roket_loc_disclosure_shown', 'true');
        }
        // Den native systemprompt hører også til i køen — GPS-hentningen
        // nedenfor gør ikke (den kan tage sekunder og skal ikke holde låsen)
        await LocationService.requestLocationPermission();
      });
      const pos = await LocationService.getCurrentPosition();
      if (pos) {
        const r = {
          latitude: pos.latitude,
          longitude: pos.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        };
        setInitialRegion(r);
        setRegion(r);
        setUserLocation({ latitude: pos.latitude, longitude: pos.longitude });
      } else {
        setInitialRegion(DEFAULT_REGION);
        setRegion(DEFAULT_REGION);
      }
    };
    init().catch(() => {
      setInitialRegion(DEFAULT_REGION);
      setRegion(DEFAULT_REGION);
    });
  }, []);

  // Sen aktivering af placering (fortrudt afvisning): flyv kortet hjem
  const applyLatePosition = (pos: { latitude: number; longitude: number }) => {
    const r = {
      latitude: pos.latitude,
      longitude: pos.longitude,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
    setUserLocation({ latitude: pos.latitude, longitude: pos.longitude });
    setRegion(r);
    mapRef.current?.animateToRegion(r, 600);
  };

  // "Aktivér placering"-pillen: prøv system-prompten igen — men Android
  // auto-afviser stille efter ét aktivt nej (Android 11+), og iOS
  // genviser aldrig prompten; i de tilfælde er systemindstillinger
  // eneste vej, så dér sender vi brugeren hen.
  const retryLocation = async () => {
    const precision = await LocationService.requestLocationPermission();
    if (precision === 'fine' || precision === 'coarse') {
      const pos = await LocationService.getCurrentPosition();
      if (pos) applyLatePosition(pos);
      return;
    }
    if (precision === 'denied' && Platform.OS === 'android') {
      // Dialogen blev faktisk vist og aktivt afvist lige nu — respektér det
      return;
    }
    Linking.openSettings();
  };

  // Kommer brugeren tilbage fra systemindstillinger med permission givet,
  // samler vi positionen op uden at kræve endnu et tryk
  useEffect(() => {
    if (userLocation) return;
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      LocationService.checkCurrentPrecision().then(p => {
        if (p === 'denied') return;
        LocationService.getCurrentPosition().then(pos => {
          if (pos) applyLatePosition(pos);
        });
      });
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation]);

  // Opret-signal fra tab-barens midterknap: + på en anden fane hopper til
  // Kort-fanen med et createRequest-param, som åbner pin-pickeren her
  useEffect(() => {
    if (route?.params?.createRequest) {
      setShowPinPicker(true);
    }
  }, [route?.params?.createRequest]);

  // Åbn en bestemt aktivitets detalje (Hold kontakten-push-tap). Hentes
  // direkte pr. id — eventet kan ligge uden for den aktuelle viewport-query.
  useEffect(() => {
    const id = route?.params?.openEventId;
    if (!id) return;
    firestore()
      .collection('events')
      .doc(id)
      .get()
      .then(doc => {
        if (!doc.exists()) return;
        const ev = eventFromData(doc.id, doc.data());
        if (ev.expiresAt.getTime() > Date.now()) setSelected(ev);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.params?.openEventNonce]);

  // Bliver det åbne event aflyst/slettet under åbning, lukker detaljen —
  // ellers viser liveSelected-fallbacken et frossent snapshot af et dødt
  // event (hvor "Vær med" så fejler). Direkte doc-lytter dækker BÅDE
  // viewport- og openEventId-åbnede events (sidstnævnte er ikke i
  // activities-listen). Stille luk — join-fejlen har sin egen alert.
  useEffect(() => {
    const id = selected?.id;
    if (!id) return;
    const unsub = firestore()
      .collection('events')
      .doc(id)
      .onSnapshot(
        doc => {
          if (!doc.exists()) setSelected(null);
        },
        () => {},
      );
    return () => unsub();
  }, [selected?.id]);

  // Modalen skal kunne vises i BEGGE returns — init-flowet venter på den,
  // før initialRegion sættes, så uden den her deadlocker venteskærmen
  const locDisclosureModal = (
    <DisclosureModal
      visible={showLocDisclosure}
      icon={<MapPinIcon size={64} color={isDark ? '#fff' : colors.textPrimary} />}
      title={t.disclosureLocationTitle}
      message={t.disclosureLocationMessage}
      acceptLabel={t.disclosureLocationAccept}
      onAccept={() => {
        setShowLocDisclosure(false);
        locDisclosureResolve.current?.();
      }}
    />
  );

  if (!initialRegion) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {locDisclosureModal}
      </View>
    );
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
            top: insets.top + 22,
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

      {/* Placering mangler (afvist eller GPS-fejl): synlig vej tilbage —
          uden den er brugeren strandet på fallback-regionen for altid */}
      {!userLocation && (
        <TouchableOpacity
          style={[
            styles.locationPill,
            {
              top: insets.top + 22,
              backgroundColor: isDark ? 'rgba(22,22,25,0.8)' : 'rgba(255,255,255,0.85)',
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.7)',
            },
          ]}
          onPress={retryLocation}
          activeOpacity={0.8}
        >
          <MapPinOff size={15} color={colors.textMuted} strokeWidth={2.2} />
          <Text style={[styles.locationPillText, { color: colors.textPrimary }]}>
            {t.mapEnableLocation}
          </Text>
        </TouchableOpacity>
      )}

      <ActivityDrawer
        activities={visibleActivities}
        allActivities={activities}
        headerText={zoomedOut ? t.mapZoomIn : t.mapActivitiesCount(visibleActivities.length)}
        userLocation={userLocation}
        // Demo-seeding sker ved VIEWPORTETS centrum — det er dét område
        // brugeren kigger på og synes er tomt (GPS-positionen kan være
        // 100 km væk, eller helt nægtet). Skjult ved zoomed-out: dér er
        // geo-queryen slået fra, så resultatet ville ikke kunne ses.
        seedCenter={
          zoomedOut
            ? null
            : region
              ? { latitude: region.latitude, longitude: region.longitude }
              : userLocation
        }
        onSelect={setSelected}
        timeWindow={timeWindow}
        onChangeWindow={setTimeWindow}
        selected={liveSelected}
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

      {locDisclosureModal}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  locationPill: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 42,
    paddingHorizontal: 13,
    borderRadius: 21,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
  },
  locationPillText: {
    fontSize: 13,
    fontWeight: '700',
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

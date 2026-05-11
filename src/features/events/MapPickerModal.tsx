import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import MapView, { Region, PROVIDER_GOOGLE } from 'react-native-maps';
import { MapPin } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';

interface MapPickerModalProps {
  visible: boolean;
  initial?: { latitude: number; longitude: number } | null;
  onClose: () => void;
  onConfirm: (location: { latitude: number; longitude: number }) => void;
}

const DEFAULT_DELTA = 0.01;

export default function MapPickerModal({ visible, initial, onClose, onConfirm }: MapPickerModalProps) {
  const { colors, t } = useTheme();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [center, setCenter] = useState<{ latitude: number; longitude: number } | null>(initial ?? null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (visible && initial) setCenter(initial);
  }, [visible, initial]);

  const handleRegionChange = (region: Region) => {
    setCenter({ latitude: region.latitude, longitude: region.longitude });
  };

  const handleConfirm = () => {
    if (!center) return;
    onConfirm(center);
    onClose();
  };

  const initialRegion = initial
    ? { ...initial, latitudeDelta: DEFAULT_DELTA, longitudeDelta: DEFAULT_DELTA }
    : { latitude: 55.6761, longitude: 12.5683, latitudeDelta: DEFAULT_DELTA, longitudeDelta: DEFAULT_DELTA };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Text style={[styles.headerCancel, { color: colors.textPrimary }]}>{t.cancel}</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            {(t as any).eventsPickLocationTitle ?? 'Vælg mødested'}
          </Text>
          <View style={styles.headerButton} />
        </View>

        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            initialRegion={initialRegion}
            onRegionChangeComplete={handleRegionChange}
            showsUserLocation
            showsMyLocationButton
            onMapReady={() => setReady(true)}
          />
          {/* Fixed centered pin */}
          <View style={styles.centerPin} pointerEvents="none">
            <MapPin size={44} color={colors.primaryRed} fill={colors.primaryRed} strokeWidth={1.5} />
            <View style={[styles.pinDot, { backgroundColor: colors.primaryRed }]} />
          </View>
          {!ready && (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color={colors.primaryBlue} />
            </View>
          )}
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
          <TouchableOpacity
            style={[styles.cta, { backgroundColor: colors.primaryBlue }, !center && { opacity: 0.5 }]}
            onPress={handleConfirm}
            disabled={!center}
          >
            <Text style={styles.ctaText}>
              {(t as any).eventsScheduleConfirm ?? 'Bekræft'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerButton: { minWidth: 60 },
  headerCancel: { fontSize: 16, fontWeight: '600' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  mapContainer: { flex: 1 },
  centerPin: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -22,
    marginTop: -44, // Pin spids skal pege på midten — halv højde over center
    alignItems: 'center',
  },
  pinDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: -2,
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hint: {
    position: 'absolute',
    left: 20,
    right: 20,
    padding: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  hintText: { textAlign: 'center', fontWeight: '600' },
  footer: { paddingHorizontal: 20, paddingTop: 12 },
  cta: { paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

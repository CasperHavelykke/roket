import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import GradientView from '../components/GradientView';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme';
import LocationService from '../services/LocationService';
import PhotoGalleryModal from '../components/PhotoGalleryModal';

export default function MyProfileScreen({ navigation }: any) {
  const { colors, isDark, t, distanceUnit, showTestBadges } = useTheme();
  const insets = useSafeAreaInsets();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [age, setAge] = useState<number | null>(null);
  const [gender, setGender] = useState<string | null>(null);
  const [sexuality, setSexuality] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [lastSeen, setLastSeen] = useState<number | null>(null);
  const [distanceModeValue, setDistanceModeValue] = useState<string | null>(null);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [locationGranted, setLocationGranted] = useState(true);
  const photoSize = Dimensions.get('window').width - 40;
  const [testAccount, setTestAccount] = useState(false);
  const currentUser = auth().currentUser;

  const pulseAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (photoURL) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [photoURL]);

  useEffect(() => {
    LocationService.checkCurrentPrecision().then(p => setLocationGranted(p !== 'denied'));
  }, []);

  const genderLabels: Record<string, string> = {
    male: t.genderMale, female: t.genderFemale, nonbinary: t.genderNonBinary,
    trans: t.genderTrans,
  };
  const sexualityLabels: Record<string, string> = {
    straight: t.sexualityStraight, gay: t.sexualityGay, bisexual: t.sexualityBisexual,
    pansexual: t.sexualityPansexual, other: t.sexualityOther,
  };

  const formatLastSeen = (lastSeenMs: number): string => {
    const diff = Date.now() - lastSeenMs;
    if (diff < 5 * 60 * 1000) return t.profileOnlineNow;
    if (diff < 60 * 60 * 1000) return t.profileLastSeenMinutes(Math.floor(diff / 60000));
    if (diff < 24 * 60 * 60 * 1000) return t.profileLastSeenHours(Math.floor(diff / 3600000));
    return t.profileLastSeenDays(Math.floor(diff / 86400000));
  };

  useFocusEffect(
    useCallback(() => {
      if (!currentUser) return;
      firestore()
        .collection('users')
        .doc(currentUser.uid)
        .get()
        .then(doc => {
          const data = doc.data();
          if (data) {
            setDisplayName(data.displayName ?? '');
            setBio(data.bio ?? '');
            setPhotoURL(data.photoURL ?? null);
            if (data.birthday && data.showAge !== false) {
              const today = new Date();
              const birth = new Date(data.birthday.year, data.birthday.month - 1, data.birthday.day);
              let a = today.getFullYear() - birth.getFullYear();
              const m = today.getMonth() - birth.getMonth();
              if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) a--;
              setAge(a);
            } else {
              setAge(null);
            }
            setGender(data.gender && data.showGender !== false ? data.gender : null);
            setSexuality(data.sexuality && data.showSexuality !== false ? data.sexuality : null);
            setPhotos(data.photos ?? []);
            setLastSeen(data.lastSeen?.toMillis?.() ?? null);
            setDistanceModeValue(data.distanceMode ?? null);
            setTestAccount(data.testAccount ?? false);
          }
        });
    }, [])
  );

  if (!currentUser) return null;

  const allPhotos = photoURL ? [photoURL, ...photos] : [];

  return (
    <SafeAreaView edges={[]} style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backButtonText, { color: isDark ? colors.textWhite : colors.primaryBlue }]}>{t.myProfileBack}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + insets.bottom }]}>
        <View style={styles.photoContainer}>
          {allPhotos.length > 1 ? (
            <View style={[styles.photoCarousel, { width: photoSize, height: photoSize }]}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                bounces={false}
                onMomentumScrollEnd={(e) => {
                  setCurrentPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / photoSize));
                }}
              >
                {allPhotos.map((uri, i) => (
                  <TouchableOpacity
                    key={i}
                    activeOpacity={0.9}
                    onPress={() => { setGalleryIndex(i); setShowGallery(true); }}
                  >
                    <Image source={{ uri }} style={{ width: photoSize, height: photoSize }} resizeMode="cover" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={styles.photoCountBadge} pointerEvents="none">
                <Text style={styles.photoCountText}>{currentPhotoIndex + 1}/{allPhotos.length}</Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => allPhotos.length > 0 && setShowGallery(true)}
              disabled={allPhotos.length === 0}
            >
              <Image
                source={photoURL ? { uri: photoURL } : isDark ? require('../assets/missing-profile-pic.png') : require('../assets/missing-profile-pic-light.png')}
                style={[styles.photo, { width: photoSize, height: photoSize }]}
              />
            </TouchableOpacity>
          )}
          {showTestBadges && testAccount && (
            <View style={styles.testBadge}>
              <Text style={styles.testBadgeText}>{t.testAccount}</Text>
            </View>
          )}
        </View>

        <View style={[styles.infoContainer, { backgroundColor: colors.white }]}>
          <Text style={[styles.name, { color: colors.textPrimary }]}>{displayName || ''}{displayName && age ? `, ${age}` : age ? `${age}` : ''}</Text>

          {lastSeen !== null && (
            <Text style={[
              styles.onlineStatus,
              Date.now() - lastSeen < 5 * 60 * 1000
                ? { color: colors.online }
                : { color: colors.offline },
            ]}>
              {Date.now() - lastSeen < 5 * 60 * 1000 ? '● ' : '○ '}
              {formatLastSeen(lastSeen)}
            </Text>
          )}

          {locationGranted && distanceModeValue && distanceModeValue !== 'hidden' && (
            <Text style={[styles.distance, { color: colors.primaryRed }]}>
              📍 {distanceModeValue === 'fuzzy' ? (distanceUnit === 'mi' ? t.distanceUnder100ft : t.distanceUnder30) : (distanceUnit === 'mi' ? t.distanceFeet(0) : t.distanceMeters(0))}
            </Text>
          )}

          {(gender || sexuality) && (
            <View style={styles.detailsRow}>
              {gender && (
                <View style={[styles.detailChip, { backgroundColor: colors.backgroundLight, borderColor: colors.inputBorder }]}>
                  <Text style={[styles.detailChipText, { color: colors.textSecondary }]}>{genderLabels[gender] ?? gender}</Text>
                </View>
              )}
              {sexuality && (
                <View style={[styles.detailChip, { backgroundColor: colors.backgroundLight, borderColor: colors.inputBorder }]}>
                  <Text style={[styles.detailChipText, { color: colors.textSecondary }]}>{sexualityLabels[sexuality] ?? sexuality}</Text>
                </View>
              )}
            </View>
          )}

          {bio ? (
            <View style={[styles.bioContainer, { borderTopColor: colors.borderLight }]}>
              <Text style={[styles.bioLabel, { color: colors.textMuted }]}>{t.myProfileAbout}</Text>
              <Text style={[styles.bio, { color: colors.textPrimary }]}>{bio}</Text>
            </View>
          ) : (
            <View style={[styles.bioContainer, { borderTopColor: colors.borderLight }]}>
              <Text style={[styles.bioEmpty, { color: colors.textMuted }]}>{t.myProfileNoBio}</Text>
            </View>
          )}
        </View>

        {showTestBadges && testAccount && (
          <View style={[styles.testDisclaimer, { borderColor: colors.inputBorder, backgroundColor: colors.white }]}>
            <Text style={[styles.testDisclaimerText, { color: colors.textSecondary }]}>{t.testAccountDisclaimer}</Text>
          </View>
        )}

        <TouchableOpacity onPress={() => navigation.navigate('EditProfile')} style={{ position: 'relative' }}>
          {!photoURL && (
            <Animated.View style={[styles.editPulseRing, { opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0.1] }), transform: [{ scaleX: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) }, { scaleY: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) }] }]}>
              <GradientView
                colors={[colors.primaryBlue, colors.primaryRed]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.editPulseGradient}
              />
            </Animated.View>
          )}
          <GradientView
            colors={[colors.primaryBlue, colors.primaryRed]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.editButton}
          >
            <Text style={[styles.editButtonText, { color: colors.textWhite }]}>{t.myProfileEdit}</Text>
          </GradientView>
        </TouchableOpacity>
      </ScrollView>

      <PhotoGalleryModal
        visible={showGallery}
        photos={allPhotos}
        initialIndex={galleryIndex}
        onClose={() => setShowGallery(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  photoContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 24,
  },
  photoCarousel: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  photo: {
    width: Dimensions.get('window').width - 40,
    height: Dimensions.get('window').width - 40,
    borderRadius: 16,
  },
  photoCountBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  photoCountText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  infoContainer: {
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  name: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  onlineStatus: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  distance: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  detailChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  detailChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  bioLabel: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  bioContainer: {
    borderTopWidth: 1,
    paddingTop: 16,
  },
  bio: {
    fontSize: 17,
    lineHeight: 26,
  },
  bioEmpty: {
    fontSize: 15,
    fontStyle: 'italic',
  },
  testBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  testBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  testDisclaimer: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  testDisclaimerText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  editPulseRing: {
    position: 'absolute',
    top: 20,
    left: 16,
    right: 16,
    bottom: -4,
    borderRadius: 18,
    overflow: 'hidden',
  },
  editPulseGradient: {
    flex: 1,
    borderRadius: 18,
  },
  editButton: {
    marginHorizontal: 20,
    marginTop: 24,
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
});

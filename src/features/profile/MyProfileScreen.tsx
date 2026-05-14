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
import GradientView from '../../components/GradientView';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme';
import LocationService from '../../services/LocationService';
import PhotoGalleryModal from './PhotoGalleryModal';
import { MapPin } from 'lucide-react-native';
import TagIcon from '../../components/TagIcon';
import { StatusTagId } from '../../statusTags';
import RoketLogo from '../../assets/roket-logo-2.svg';

export default function MyProfileScreen({ navigation }: any) {
  const { colors, isDark, t, distanceUnit, showTestBadges } = useTheme();
  const insets = useSafeAreaInsets();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [status, setStatus] = useState('');
  const [statusTag, setStatusTag] = useState<StatusTagId | null>(null);
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [age, setAge] = useState<number | null>(null);
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
        Animated.timing(pulseAnim, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.delay(200),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [photoURL]);

  useEffect(() => {
    LocationService.checkCurrentPrecision().then(p => setLocationGranted(p !== 'denied'));
  }, []);

  const formatLastSeen = (lastSeenMs: number): string => {
    const diff = Date.now() - lastSeenMs;
    if (diff < 24 * 60 * 60 * 1000) return '';
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
            setStatus(data.status ?? '');
            setStatusTag(data.statusTag ?? null);
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
        {(() => {
          const hasStatus = !!status?.trim();
          const hasTag = !!statusTag;
          const hasBio = !!bio?.trim();
          const hasPhotos = allPhotos.length > 0;
          const hasName = !!displayName;
          const hasAge = age != null;
          const lastSeenText = lastSeen !== null ? formatLastSeen(lastSeen) : '';
          const hasLastSeen = !!lastSeenText;
          const distanceVisible = locationGranted && distanceModeValue && distanceModeValue !== 'hidden';
          const distancePreview = distanceModeValue === 'fuzzy'
            ? (distanceUnit === 'mi' ? t.distanceUnder100ft : t.distanceUnder30)
            : (distanceUnit === 'mi' ? t.distanceFeet(0) : t.distanceMeters(0));
          const hasDistance = !!distanceVisible;
          const hasIdentityFooter = hasName || hasAge || hasDistance || hasLastSeen;
          const isEmpty = !hasStatus && !hasTag && !hasBio && !hasPhotos;
          const initials = (() => {
            if (!hasName) return '';
            const parts = displayName.trim().split(/\s+/).slice(0, 2);
            return parts.map(p => p.charAt(0).toUpperCase()).join('');
          })();

          if (isEmpty) {
            const logoSize = Dimensions.get('window').width * 0.66;
            return (
              <View style={styles.emptyProfileWrap}>
                <View style={{ opacity: 0.35 }}>
                  <RoketLogo width={logoSize} height={logoSize} fill={colors.cardBackgroundIcon} />
                </View>
                <Text style={[styles.emptyProfileText, { color: colors.textMuted }]}>
                  {((t as any).profileEmptyStateSelf ?? 'Færdiggør din profil')}
                </Text>
                {showTestBadges && testAccount && (
                  <View style={[styles.testDisclaimer, { backgroundColor: colors.card, borderColor: colors.borderLight, marginTop: 12 }]}>
                    <Text style={[styles.testDisclaimerText, { color: colors.textSecondary }]}>{t.testAccountDisclaimer}</Text>
                  </View>
                )}
              </View>
            );
          }

          return (
            <View style={styles.content}>
              {hasStatus && (
                <View style={styles.statusQuoteWrap}>
                  <View style={styles.statusAccent}>
                    <GradientView
                      colors={[colors.primaryBlue, colors.primaryRed]}
                      start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                      style={styles.statusAccentFill}
                    />
                  </View>
                  <Text style={[styles.statusQuote, { color: colors.textPrimary }]}>
                    {'“'}{status}{'”'}
                  </Text>
                </View>
              )}

              {hasTag && (
                <View style={[styles.tagPill, { backgroundColor: colors.primaryBlue }]}>
                  <TagIcon tag={statusTag!} size={14} color="#fff" />
                  <Text style={styles.tagPillText}>
                    {String((t as any)[`tag${statusTag!.charAt(0).toUpperCase() + statusTag!.slice(1)}`] ?? statusTag)}
                  </Text>
                </View>
              )}

              {hasPhotos && (
                <View style={styles.photoGrid}>
                  {allPhotos.map((uri, i) => (
                    <TouchableOpacity
                      key={i}
                      activeOpacity={0.9}
                      style={styles.photoSlot}
                      onPress={() => { setGalleryIndex(i); setShowGallery(true); }}
                    >
                      <Image source={{ uri }} style={styles.photoSlotImg} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {hasBio && (
                <View style={styles.aboutSection}>
                  <Text style={[styles.aboutLabel, { color: colors.textMuted }]}>{(t as any).descriptionLabel ?? 'OM'}</Text>
                  <Text style={[styles.bioText, { color: colors.textPrimary }]}>{bio}</Text>
                </View>
              )}

              {hasIdentityFooter && (
                <View style={[styles.identityFooter, { borderTopColor: colors.borderLight }]}>
                  <View style={styles.identityLeft}>
                    {initials ? (
                      <GradientView
                        colors={[colors.primaryBlue, colors.primaryRed]}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={styles.identityAvatar}
                      >
                        <Text style={styles.identityAvatarText}>{initials}</Text>
                      </GradientView>
                    ) : (
                      <View style={[styles.identityAvatar, { backgroundColor: colors.cardBackground }]}>
                        <RoketLogo width={14} height={14} fill={colors.cardBackgroundIcon} />
                      </View>
                    )}
                    <View style={styles.identityText}>
                      {(hasName || hasAge) && (
                        <Text style={[styles.identityName, { color: colors.textPrimary }]}>
                          {displayName || ''}{displayName && hasAge ? `, ${age}` : hasAge ? `${age}` : ''}
                        </Text>
                      )}
                      {hasLastSeen && (
                        <Text style={[styles.identityMeta, { color: colors.textMuted }]}>{lastSeenText}</Text>
                      )}
                    </View>
                  </View>
                  {hasDistance && (
                    <View style={styles.identityDistance}>
                      <MapPin size={13} color={colors.textMuted} />
                      <Text style={[styles.identityDistanceText, { color: colors.textMuted }]}>{distancePreview}</Text>
                    </View>
                  )}
                </View>
              )}

              {showTestBadges && testAccount && (
                <View style={[styles.testDisclaimer, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
                  <Text style={[styles.testDisclaimerText, { color: colors.textSecondary }]}>{t.testAccountDisclaimer}</Text>
                </View>
              )}
            </View>
          );
        })()}

        <TouchableOpacity onPress={() => navigation.navigate('EditProfile')} style={{ position: 'relative' }}>
          {!photoURL && (
            <Animated.View style={[styles.editPulseRing, { opacity: pulseAnim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.7, 0] }), transform: [{ scaleX: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1.06] }) }, { scaleY: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.90, 1.22] }) }] }]}>
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
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  emptyProfileWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 24,
    gap: 24,
  },
  emptyProfileText: {
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  statusQuoteWrap: {
    flexDirection: 'row',
    paddingTop: 8,
    paddingBottom: 18,
    paddingLeft: 8,
  },
  statusAccent: {
    width: 3,
    marginRight: 16,
    borderRadius: 100,
    overflow: 'hidden',
  },
  statusAccentFill: { flex: 1 },
  statusQuote: {
    flex: 1,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '400',
    fontStyle: 'italic',
    letterSpacing: -0.3,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 24,
  },
  photoSlot: {
    width: '31.5%',
    aspectRatio: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  photoSlotImg: { width: '100%', height: '100%' },
  aboutSection: {
    marginTop: 28,
  },
  aboutLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  bioText: {
    fontSize: 15,
    lineHeight: 22,
  },
  identityFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 32,
    paddingTop: 20,
    borderTopWidth: 1,
  },
  identityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  identityAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  identityAvatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  identityText: {
    flex: 1,
  },
  identityName: {
    fontSize: 14,
    fontWeight: '500',
  },
  identityMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  identityDistance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
    marginLeft: 12,
  },
  identityDistanceText: {
    fontSize: 13,
    fontWeight: '500',
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
  photoFallback: {
    justifyContent: 'center',
    alignItems: 'center',
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
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 10,
    gap: 5,
  },
  tagPillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
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

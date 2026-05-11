import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
  Modal,
  Pressable,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import KeyboardAvoidingView from '../../components/KeyboardAvoidingView';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import GradientView from '../../components/GradientView';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useTheme } from '../../theme';
import LocationService from '../../services/LocationService';
import PhotoGalleryModal from './PhotoGalleryModal';
import { MessageSquare as MessageIcon, MessagesSquare as MessagesIcon } from 'lucide-react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import RoketLogo from '../../assets/roket-logo-2.svg';

interface RouteParams {
  user: {
    id: string;
    displayName: string;
    bio: string;
    status?: string;
    photoURL: string | null;
    distance?: number;
    lastSeen?: number; // millisekunder siden epoch
    distanceMode?: string;
    age?: number;
    gender?: string;
    sexuality?: string;
    photos?: string[];
    testAccount?: boolean;
  };
}

export default function ProfileViewScreen({ route, navigation }: any) {
  const { colors, isDark, t, distanceMode, distanceUnit, showTestBadges } = useTheme();
  const insets = useSafeAreaInsets();
  const [locationGranted, setLocationGranted] = useState(true);

  useEffect(() => {
    LocationService.checkCurrentPrecision().then(p => setLocationGranted(p !== 'denied'));
  }, []);

  const formatLastSeen = (lastSeenMs?: number): string => {
    if (!lastSeenMs) return '';
    const diff = Date.now() - lastSeenMs;
    if (diff < 24 * 60 * 60 * 1000) return '';
    return t.profileLastSeenDays(Math.floor(diff / 86400000));
  };
  const genderLabels: Record<string, string> = {
    male: t.genderMale, female: t.genderFemale, nonbinary: t.genderNonBinary,
    trans: t.genderTrans,
  };
  const sexualityLabels: Record<string, string> = {
    straight: t.sexualityStraight, gay: t.sexualityGay, bisexual: t.sexualityBisexual,
    pansexual: t.sexualityPansexual, other: t.sexualityOther,
  };

  const { user, fromChat } = route.params as RouteParams & { fromChat?: boolean };
  const currentUser = auth().currentUser;
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportText, setReportText] = useState('');
  const [showGallery, setShowGallery] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [hasConversation, setHasConversation] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const photoSize = Dimensions.get('window').width - 40;

  useFocusEffect(
    useCallback(() => {
      if (!currentUser) return;
      const chatId = [currentUser.uid, user.id].sort().join('_');
      const unsub = firestore().collection('chats').doc(chatId).onSnapshot(snap => {
        if (!snap || !snap.exists) return;
        setHasConversation(true);
        const data = snap.data();
        if (!data) return;
        const count = data.unreadCount?.[currentUser.uid] ?? 0;
        setUnreadCount(count);
      });
      return () => unsub();
    }, [currentUser, user.id])
  );

  if (!currentUser) return null;

  const allPhotos = user.photoURL
    ? [user.photoURL, ...(user.photos ?? [])]
    : [];

  const handleBlockReport = () => setShowMenu(true);

  const handleBlock = () => {
    setShowMenu(false);
    Alert.alert(
      t.profileBlockConfirm(user.displayName),
      t.profileBlockDescription(user.displayName),
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.profileBlockButton,
          style: 'destructive',
          onPress: async () => {
            await Promise.all([
              firestore()
                .collection('users')
                .doc(currentUser.uid)
                .update({
                  blockedUsers: firestore.FieldValue.arrayUnion(user.id),
                }),
              firestore().collection('blocks').add({
                blockerId: currentUser.uid,
                blockedUserId: user.id,
                createdAt: firestore.FieldValue.serverTimestamp(),
                status: 'pending',
              }),
            ]);
            if (fromChat) {
              navigation.pop(2);
            } else {
              navigation.goBack();
            }
          },
        },
      ]
    );
  };

  const handleReport = () => {
    setShowMenu(false);
    setReportText('');
    setShowReportModal(true);
  };

  const handleSendReport = async () => {
    setShowReportModal(false);
    await firestore().collection('reports').add({
      reporterId: currentUser.uid,
      reportedUserId: user.id,
      message: reportText.trim() || null,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
    setReportText('');
    Alert.alert(t.profileReportThanks, t.profileReportReceived);
  };

  const formatDistance = (distance?: number): string => {
    if (distance == null) return '';
    if (distanceMode === 'hidden' || user.distanceMode === 'hidden') return '';
    if (distanceUnit === 'mi') {
      const miles = distance * 0.621371;
      if ((distanceMode === 'fuzzy' || user.distanceMode === 'fuzzy') && distance < 0.03) {
        return t.distanceUnder100ft;
      }
      if (miles < 1) {
        return t.distanceFeet(Math.round(miles * 5280));
      }
      return t.distanceMiles(miles.toFixed(1));
    }
    if ((distanceMode === 'fuzzy' || user.distanceMode === 'fuzzy') && distance < 0.03) {
      return t.distanceUnder30;
    }
    if (distance < 1) {
      return t.distanceMeters(Math.round(distance * 1000));
    }
    return t.distanceKm(distance.toFixed(1).replace('.', ','));
  };

  return (
    <SafeAreaView edges={[]} style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backButtonText, { color: isDark ? colors.textWhite : colors.primaryBlue }]}>{t.profileBack}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleBlockReport} style={styles.moreButton}>
          <Text style={[styles.moreButtonText, { color: colors.textMuted }]}>⋮</Text>
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
              {user.photoURL ? (
                <Image
                  source={{ uri: user.photoURL }}
                  style={[styles.photo, { width: photoSize, height: photoSize }]}
                />
              ) : (
                <View style={[styles.photo, styles.photoFallback, { width: photoSize, height: photoSize, backgroundColor: colors.cardBackground }]}>
                  <RoketLogo width={photoSize * 0.5} height={photoSize * 0.5} fill={colors.cardBackgroundIcon} />
                </View>
              )}
            </TouchableOpacity>
          )}
          {showTestBadges && user.testAccount && (
            <View style={styles.testBadge}>
              <Text style={styles.testBadgeText}>{t.testAccount}</Text>
            </View>
          )}
        </View>

        <View style={[styles.infoContainer, { backgroundColor: colors.white }]}>
          {user.status ? (
            <Text style={[styles.name, { color: colors.textPrimary }]}>{user.status}</Text>
          ) : null}

          {user.lastSeen !== undefined && formatLastSeen(user.lastSeen) !== '' && (
            <Text style={[styles.onlineStatus, { color: colors.offline }]}>
              {formatLastSeen(user.lastSeen)}
            </Text>
          )}

          {user.bio ? (
            <View style={[styles.bioContainer, (user.status || (user.lastSeen !== undefined && formatLastSeen(user.lastSeen) !== '')) && { borderTopColor: colors.borderLight, borderTopWidth: 1 }]}>
              <Text style={[styles.bio, { color: colors.textPrimary }]}>{user.bio}</Text>
            </View>
          ) : null}

          <View style={{ marginTop: 12 }}>
            <Text style={[{ fontSize: 15, color: colors.textMuted }]}>{user.displayName || ''}{user.displayName && user.age ? `, ${user.age}` : user.age ? `${user.age}` : ''}</Text>
            {locationGranted && user.distance !== undefined && formatDistance(user.distance) !== '' && (
              <Text style={[{ fontSize: 13, color: colors.textMuted, marginTop: 2 }]}>📍 {formatDistance(user.distance)}</Text>
            )}
          </View>
        </View>

        {showTestBadges && user.testAccount && (
          <View style={[styles.testDisclaimer, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
            <Text style={[styles.testDisclaimerText, { color: colors.textSecondary }]}>{t.testAccountDisclaimer}</Text>
          </View>
        )}

      </ScrollView>

      {!fromChat && (
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.fab, { bottom: insets.bottom + 24 }]}
          onPress={() =>
            navigation.navigate('Chat', {
              otherUser: { id: user.id, displayName: user.displayName, testAccount: user.testAccount },
              fromProfile: true,
            })
          }
        >
          {unreadCount > 0 ? (
            <View style={[styles.fabButton, { backgroundColor: '#fff' }]}>
              <MaskedView
                style={{ width: 30, height: 30 }}
                maskElement={hasConversation
                  ? <MessagesIcon size={30} color="#000" />
                  : <MessageIcon size={30} color="#000" />
                }
              >
                <GradientView
                  colors={[colors.primaryBlue, colors.primaryRed]}
                  start={{ x: -(Dimensions.get('window').width - 32 - 64) / 64, y: 0 }}
                  end={{ x: (32 + 64) / 64, y: 0 }}
                  style={{ width: 30, height: 30 }}
                />
              </MaskedView>
            </View>
          ) : (
            <GradientView
              colors={[colors.primaryBlue, colors.primaryRed]}
              start={{ x: -(Dimensions.get('window').width - 32 - 64) / 64, y: 0 }}
              end={{ x: (32 + 64) / 64, y: 0 }}
              style={styles.fabButton}
            >
              {hasConversation
                ? <MessagesIcon size={30} color="#fff" />
                : <MessageIcon size={30} color="#fff" />
              }
            </GradientView>
          )}
          {unreadCount > 0 && (
            <GradientView
              colors={[colors.primaryBlue, colors.primaryRed]}
              start={{ x: -(Dimensions.get('window').width - 32 - 64) / 20, y: 0 }}
              end={{ x: (32 + 64) / 20, y: 0 }}
              style={styles.fabUnreadBadge}
            >
              <Text style={styles.fabUnreadBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </GradientView>
          )}
        </TouchableOpacity>
      )}

      <Modal visible={showReportModal} transparent animationType="fade" onRequestClose={() => setShowReportModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior="padding">
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {t.profileReportConfirm(user.displayName)}
            </Text>
            <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
              {t.profileReportDescription}
            </Text>
            <TextInput
              style={[styles.modalInput, {
                borderColor: colors.inputBorder,
                backgroundColor: colors.inputBackground,
                color: colors.textPrimary,
              }]}
              placeholder={t.profileReportPlaceholder}
              placeholderTextColor={colors.textMuted}
              value={reportText}
              onChangeText={setReportText}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.backgroundLight }]}
                onPress={() => setShowReportModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: colors.textPrimary }]}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primaryRed }]}
                onPress={handleSendReport}
              >
                <Text style={[styles.modalButtonText, { color: '#FFF' }]}>{t.profileReportSend}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setShowMenu(false)}>
          <View style={[styles.menuCard, { backgroundColor: colors.card, top: insets.top + 50, right: 16 }]}>
            <TouchableOpacity style={styles.menuOption} onPress={handleBlock}>
              <Text style={[styles.menuOptionText, { color: colors.primaryRed }]}>{t.profileBlock(user.displayName)}</Text>
            </TouchableOpacity>
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity style={styles.menuOption} onPress={handleReport}>
              <Text style={[styles.menuOptionText, { color: colors.textPrimary }]}>{t.profileReport(user.displayName)}</Text>
            </TouchableOpacity>
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity style={styles.menuOption} onPress={() => setShowMenu(false)}>
              <Text style={[styles.menuOptionText, { color: colors.textMuted }]}>{t.cancel}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

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
  menuOverlay: {
    flex: 1,
  },
  menuCard: {
    position: 'absolute',
    minWidth: 200,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  menuOption: {
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  menuOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
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
  moreButton: {
    padding: 4,
  },
  moreButtonText: {
    fontSize: 26,
    lineHeight: 28,
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
  photoPlaceholder: {
    width: Dimensions.get('window').width - 40,
    height: Dimensions.get('window').width - 40,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    fontSize: 80,
    fontWeight: 'bold',
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
  fab: {
    position: 'absolute',
    right: 32,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  fabButton: {
    width: 61,
    height: 61,
    borderRadius: 31,
    ...Platform.select({ android: { overflow: 'hidden' as const } }),
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabUnreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 5,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  fabUnreadBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800' as const,
    elevation: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  modalCard: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  modalDesc: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    minHeight: 100,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  testBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  testBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  testDisclaimer: {
    marginHorizontal: 20,
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  testDisclaimerText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
});

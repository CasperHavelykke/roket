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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import GradientView from '../components/GradientView';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useTheme } from '../theme';
import LocationService from '../services/LocationService';
import PhotoGalleryModal from '../components/PhotoGalleryModal';
import MessageIcon from '../assets/message.svg';
import MessagesIcon from '../assets/messages.svg';

interface RouteParams {
  user: {
    id: string;
    displayName: string;
    bio: string;
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
    if (diff < 5 * 60 * 1000) return t.profileOnlineNow;
    if (diff < 60 * 60 * 1000) return t.profileLastSeenMinutes(Math.floor(diff / 60000));
    if (diff < 24 * 60 * 60 * 1000) return t.profileLastSeenHours(Math.floor(diff / 3600000));
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
  const [hasUnread, setHasUnread] = useState(false);
  const photoSize = Dimensions.get('window').width - 40;

  useFocusEffect(
    useCallback(() => {
      if (!currentUser) return;
      const chatId = [currentUser.uid, user.id].sort().join('_');
      firestore().collection('chats').doc(chatId).get().then(snap => {
        if (!snap.exists) return;
        setHasConversation(true);
        const data = snap.data();
        if (!data) return;
        const lastRead = data.lastRead?.[currentUser.uid];
        const isUnread =
          data.lastMessageSenderId !== currentUser.uid &&
          (!lastRead ||
            (data.lastMessageTime &&
              lastRead.toMillis() < data.lastMessageTime.toMillis()));
        setHasUnread(!!isUnread);
      }).catch(() => {});
    }, [currentUser, user.id])
  );

  if (!currentUser) return null;

  const allPhotos = [
    ...(user.photoURL ? [user.photoURL] : []),
    ...(user.photos ?? []),
  ];

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
            await firestore()
              .collection('users')
              .doc(currentUser.uid)
              .update({
                blockedUsers: firestore.FieldValue.arrayUnion(user.id),
              });
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
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backButtonText, { color: isDark ? colors.textWhite : colors.primaryBlue }]}>{t.profileBack}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleBlockReport} style={styles.moreButton}>
          <Text style={[styles.moreButtonText, { color: colors.textMuted }]}>⋮</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
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
                source={user.photoURL ? { uri: user.photoURL } : isDark ? require('../assets/missing-profile-pic.png') : require('../assets/missing-profile-pic-light.png')}
                style={[styles.photo, { width: photoSize, height: photoSize }]}
              />
            </TouchableOpacity>
          )}
          {showTestBadges && user.testAccount && (
            <View style={styles.testBadge}>
              <Text style={styles.testBadgeText}>{t.testAccount}</Text>
            </View>
          )}
        </View>

        <View style={[styles.infoContainer, { backgroundColor: colors.white }]}>
          <Text style={[styles.name, { color: colors.textPrimary }]}>{user.displayName || ''}{user.displayName && user.age ? `, ${user.age}` : user.age ? `${user.age}` : ''}</Text>

          {user.lastSeen !== undefined && (
            <Text style={[
              styles.onlineStatus,
              Date.now() - user.lastSeen < 5 * 60 * 1000
                ? { color: colors.online }
                : { color: colors.offline },
            ]}>
              {Date.now() - user.lastSeen < 5 * 60 * 1000 ? '● ' : '○ '}
              {formatLastSeen(user.lastSeen)}
            </Text>
          )}

          {locationGranted && user.distance !== undefined && formatDistance(user.distance) !== '' && (
            <Text style={[styles.distance, { color: colors.primaryRed }]}>📍 {formatDistance(user.distance)}</Text>
          )}

          {(user.gender || user.sexuality) && (
            <View style={styles.detailsRow}>
              {user.gender && (
                <View style={[styles.detailChip, { backgroundColor: colors.backgroundLight, borderColor: colors.inputBorder }]}>
                  <Text style={[styles.detailChipText, { color: colors.textSecondary }]}>{genderLabels[user.gender] ?? user.gender}</Text>
                </View>
              )}
              {user.sexuality && (
                <View style={[styles.detailChip, { backgroundColor: colors.backgroundLight, borderColor: colors.inputBorder }]}>
                  <Text style={[styles.detailChipText, { color: colors.textSecondary }]}>{sexualityLabels[user.sexuality] ?? user.sexuality}</Text>
                </View>
              )}
            </View>
          )}

          {user.bio ? (
            <View style={[styles.bioContainer, { borderTopColor: colors.borderLight }]}>
              <Text style={[styles.bioLabel, { color: colors.textMuted }]}>{t.profileAbout}</Text>
              <Text style={[styles.bio, { color: colors.textPrimary }]}>{user.bio}</Text>
            </View>
          ) : (
            <View style={[styles.bioContainer, { borderTopColor: colors.borderLight }]}>
              <Text style={[styles.bioEmpty, { color: colors.textMuted }]}>{t.profileNoBio}</Text>
            </View>
          )}
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
          <GradientView
            colors={[colors.primaryBlue, colors.primaryRed]}
            start={{ x: -(Dimensions.get('window').width - 32 - 64) / 64, y: 0 }}
            end={{ x: (32 + 64) / 64, y: 0 }}
            style={styles.fabButton}
          >
            {hasConversation
              ? <MessagesIcon width={30} height={30} stroke="#fff" />
              : <MessageIcon width={30} height={30} stroke="#fff" />
            }
          </GradientView>
          {hasUnread && <View style={styles.fabBadgeBlue} />}
        </TouchableOpacity>
      )}

      <Modal visible={showReportModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
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
        </View>
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
  fab: {
    position: 'absolute',
    right: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  fabButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  fabBadgeBlue: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#4A90FF',
    shadowColor: '#4A90FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
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

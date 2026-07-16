import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  ScrollView,
  Switch,
  Animated,
} from 'react-native';
import KeyboardAvoidingView from '../../components/KeyboardAvoidingView';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import GradientView from '../../components/GradientView';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import ImageCropPicker from 'react-native-image-crop-picker';
import getFirebaseError from '../../utils/getFirebaseError';
import { useTheme } from '../../theme';
import { STATUS_TAGS, StatusTagId } from '../../statusTags';
import RoketLogo from '../../assets/roket-logo-2.svg';
import TagIcon from '../../components/TagIcon';

export default function EditProfileScreen({ navigation }: any) {
  const { colors, isDark, t } = useTheme();
  const insets = useSafeAreaInsets();
  const [displayName, setDisplayName] = useState('');
  const [status, setStatus] = useState('');
  const [bio, setBio] = useState('');
  const [avatarURL, setAvatarURL] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAge, setShowAge] = useState(true);
  const [hasBirthday, setHasBirthday] = useState(false);
  const [statusTag, setStatusTag] = useState<StatusTagId | null>(null);
  const currentUser = auth().currentUser;

  // Pivot 2.0: galleriet er væk — profilens "fuldstændighed" måles på
  // avataren (det eneste billede), status, tag og bio
  const PROFILE_STEPS = 4;
  const profileCompletion = (avatarURL ? 1 : 0) + (status.trim() ? 1 : 0) + (statusTag ? 1 : 0) + (bio.trim() ? 1 : 0);
  const profilePercent = Math.round((profileCompletion / PROFILE_STEPS) * 100);

  const fieldPulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (displayName.trim() && bio.trim()) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(fieldPulse, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(fieldPulse, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [!!displayName.trim(), !!bio.trim()]);

  const nameHighlight = useRef(new Animated.Value(0)).current;
  const bioHighlight = useRef(new Animated.Value(0)).current;
  const dataLoaded = useRef(false);
  useEffect(() => {
    if (!dataLoaded.current) return;
    Animated.timing(nameHighlight, { toValue: status.trim() ? 0 : 1, duration: 400, useNativeDriver: true }).start();
  }, [!!status.trim()]);
  useEffect(() => {
    if (!dataLoaded.current) return;
    Animated.timing(bioHighlight, { toValue: bio.trim() ? 0 : 1, duration: 400, useNativeDriver: true }).start();
  }, [!!bio.trim()]);

  useEffect(() => {
    if (!currentUser) return;
    firestore()
      .collection('users')
      .doc(currentUser.uid)
      .get()
      .then(doc => {
        const data = doc.data();
        if (data) {
          setDisplayName(data.displayName ?? '');
          setStatus(data.status ?? '');
          setBio(data.bio ?? '');
          setAvatarURL(data.avatarURL ?? null);
          setShowAge(data.showAge !== false);
          setStatusTag(data.statusTag ?? null);
          // Birthday: legacy-felt (v1.1.9-konti) eller private-subcollection (v2)
          if (data.birthday) {
            setHasBirthday(true);
          } else {
            firestore()
              .collection('users')
              .doc(currentUser.uid)
              .collection('private')
              .doc('profile')
              .get()
              .then(priv => setHasBirthday(!!priv.data()?.birthday))
              .catch(() => setHasBirthday(false));
          }

          dataLoaded.current = true;
          nameHighlight.setValue((data.status ?? '').trim() ? 0 : 1);
          bioHighlight.setValue((data.bio ?? '').trim() ? 0 : 1);

          // Vis alert hvis et billede blev afvist af moderation
          if (data.photoRejected) {
            Alert.alert(
              t.error,
              'Dit billede blev fjernet fordi det overtræder vores retningslinjer. Upload venligst et passende billede.',
            );
            firestore()
              .collection('users')
              .doc(currentUser.uid)
              .update({ photoRejected: false })
              .catch(console.error);
          }
        }
      });
  }, []);

  if (!currentUser) return null;

  const uploadAvatar = async () => {
    let cropped: { path: string } | undefined;
    try {
      cropped = await ImageCropPicker.openPicker({
        width: 512,
        height: 512,
        cropping: true,
        cropperCircleOverlay: true,
        mediaType: 'photo',
        compressImageQuality: 0.8,
        forceJpg: true,
        // Android crop-UI tema (iOS bruger native look — ikke konfigurerbart)
        cropperToolbarTitle: t.cropperTitle,
        cropperToolbarColor: colors.white,
        cropperStatusBarColor: colors.white,
        cropperToolbarWidgetColor: colors.textPrimary,
        cropperActiveWidgetColor: colors.primaryBlueText,
      });
    } catch {
      // Bruger annullerede billedvælgeren — gør intet
      return;
    }
    if (!cropped?.path) return;
    setUploadingAvatar(true);
    try {
      const ref = storage().ref(`profileAvatars/${currentUser.uid}.jpg`);
      await ref.putFile(cropped.path);
      const url = await ref.getDownloadURL();
      await firestore().collection('users').doc(currentUser.uid).update({ avatarURL: url });
      setAvatarURL(url);
    } catch (error: any) {
      Alert.alert(t.error, getFirebaseError(error, t));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const removeAvatar = async () => {
    setUploadingAvatar(true);
    try {
      await firestore().collection('users').doc(currentUser.uid).update({ avatarURL: null });
      storage().ref(`profileAvatars/${currentUser.uid}.jpg`).delete().catch(() => {});
      setAvatarURL(null);
    } catch (error: any) {
      Alert.alert(t.error, getFirebaseError(error, t));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleAvatarPress = () => {
    if (avatarURL) {
      Alert.alert(t.editProfileTitle, undefined, [
        { text: t.editProfileChangePhoto, onPress: uploadAvatar },
        { text: t.editProfileRemovePhoto, style: 'destructive', onPress: removeAvatar },
        { text: t.cancel, style: 'cancel' },
      ]);
    } else {
      uploadAvatar();
    }
  };

  // Pivot 2.0: 6-slot-galleriet er fjernet — avataren er profilens
  // eneste billede. photos[]/photoURL-felterne ryddes i F7-backfillen.

  const handleSave = async () => {
    const trimmedName = displayName.trim();

    setSaving(true);
    try {
      await firestore().collection('users').doc(currentUser.uid).update({
        displayName: trimmedName,
        status: status.trim(),
        statusTag: statusTag,
        bio: bio.trim(),
        showAge,
      });
      navigation.goBack();
    } catch (error: any) {
      Alert.alert(t.error, getFirebaseError(error, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={[]} style={[styles.container, { backgroundColor: colors.background }]}>
      <GradientView
        colors={[colors.primaryBlue, colors.primaryRed]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: colors.textWhite }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textWhite }]}>{t.editProfileTitle}</Text>
      </GradientView>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
      >
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 20 + insets.bottom }]}>
          {/* Profil-komplethed progress bar */}
          <View style={styles.progressBarSection}>
            <View style={[styles.progressBarTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]}>
              <View style={[styles.progressBarFill, { width: `${profilePercent}%` }]}>
                <GradientView
                  colors={[colors.primaryBlue, colors.primaryRed]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{ flex: 1, borderRadius: 3 }}
                />
              </View>
            </View>
            <Text style={[styles.progressBarPercent, { color: colors.textMuted }]}>{profilePercent}%</Text>
          </View>

          <View style={styles.form}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t.tagPickerLabel}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tagScrollContent}
              style={styles.tagScroll}
            >
              {STATUS_TAGS.map(tag => {
                const isSelected = statusTag === tag.id;
                const labelKey = `tag${tag.id.charAt(0).toUpperCase() + tag.id.slice(1)}` as keyof typeof t;
                return (
                  <TouchableOpacity
                    key={tag.id}
                    style={[
                      styles.tag,
                      { backgroundColor: colors.white, borderColor: colors.inputBorder },
                      isSelected && { backgroundColor: colors.primaryBlue, borderColor: colors.primaryBlue },
                    ]}
                    onPress={() => setStatusTag(isSelected ? null : tag.id)}
                  >
                    <TagIcon tag={tag.id} size={14} color={isSelected ? '#fff' : colors.textPrimary} />
                    <Text style={[styles.tagText, { color: colors.textPrimary, marginLeft: 5 }, isSelected && { color: '#fff' }]}>
                      {String(t[labelKey] ?? tag.id)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={[styles.label, { color: colors.textSecondary }]}>{t.editProfileStatusLabel}</Text>
            <View style={styles.inputWrap}>
              <Animated.View style={[styles.inputHighlightBorder, { opacity: Animated.multiply(nameHighlight, fieldPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] })) }]} pointerEvents="none">
                <GradientView
                  colors={[colors.primaryBlue, colors.primaryRed]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.inputHighlightFill}
                />
              </Animated.View>
              <TextInput
                style={[styles.input, { marginBottom: 0, backgroundColor: colors.white, borderColor: status.trim() ? colors.inputBorder : 'transparent', color: colors.textPrimary }]}
                value={status}
                onChangeText={setStatus}
                placeholder={t.editProfileStatusPlaceholder}
                placeholderTextColor={colors.textMuted}
                maxLength={75}
                autoCorrect={false}
              />
            </View>
            <Text style={styles.charCount}>{status.length}/75</Text>

            <Text style={[styles.label, { color: colors.textSecondary }]}>{t.editProfileBioLabel}</Text>
            <View style={styles.inputWrap}>
              <Animated.View style={[styles.inputHighlightBorder, { opacity: Animated.multiply(bioHighlight, fieldPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] })) }]} pointerEvents="none">
                <GradientView
                  colors={[colors.primaryBlue, colors.primaryRed]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.inputHighlightFill}
                />
              </Animated.View>
              <TextInput
                style={[styles.input, styles.bioInput, { marginBottom: 0, backgroundColor: colors.white, borderColor: bio.trim() ? colors.inputBorder : 'transparent', color: colors.textPrimary }]}
                value={bio}
                onChangeText={setBio}
                placeholder={t.editProfileBioPlaceholder}
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={4}
                maxLength={200}
                textAlignVertical="top"
              />
            </View>
            <Text style={styles.charCount}>{bio.length}/200</Text>
            <View style={{ height: 1, backgroundColor: colors.inputBorder, marginBottom: 24 }} />

            <Text style={[styles.label, { color: colors.textSecondary }]}>{t.editProfileNameLabel}</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={[styles.input, { marginBottom: 0, backgroundColor: colors.white, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder={t.editProfileNamePlaceholder}
                placeholderTextColor={colors.textMuted}
                maxLength={50}
                autoCorrect={false}
              />
            </View>

            {/* Lille avatar — bruges i gruppechat, notifikationer etc. */}
            <View style={styles.avatarSection}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>{(t as any).editProfileAvatarLabel ?? 'Avatar'}</Text>
              <View style={styles.avatarRow}>
                <TouchableOpacity
                  onPress={handleAvatarPress}
                  disabled={uploadingAvatar}
                  style={[styles.avatarUpload, { borderColor: avatarURL ? colors.primaryBlue : colors.inputBorder, backgroundColor: colors.inputBackground }]}
                >
                  {uploadingAvatar ? (
                    <ActivityIndicator color={colors.primaryBlue} />
                  ) : avatarURL ? (
                    <Image source={{ uri: avatarURL }} style={styles.avatarImage} />
                  ) : (
                    <Text style={[styles.avatarPlusIcon, { color: colors.primaryBlueText }]}>+</Text>
                  )}
                </TouchableOpacity>
                <Text style={[styles.avatarHint, { color: colors.textMuted }]}>
                  {(t as any).editProfileAvatarHint ?? 'Lille profilbillede til gruppechats og notifikationer'}
                </Text>
              </View>
            </View>
          </View>

          {hasBirthday && (
            <View style={styles.toggleSection}>
              <View style={[styles.toggleRow, { borderTopWidth: 0, marginTop: 0, paddingTop: 0 }]}>
                <View style={styles.toggleInfo}>
                  <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 0 }]}>{t.editProfileShowAge}</Text>
                  <Text style={[styles.toggleDesc, { color: colors.textMuted }]}>{t.editProfileShowAgeDesc}</Text>
                </View>
                <Switch
                  value={showAge}
                  onValueChange={setShowAge}
                  trackColor={{ false: colors.inputBorder, true: colors.primaryBlue }}
                  thumbColor="#fff"
                />
              </View>
            </View>
          )}

          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
            style={[{ alignSelf: 'stretch', borderRadius: 12, overflow: 'hidden', marginTop: 8 }, saving && styles.saveButtonDisabled]}
          >
            <GradientView
              colors={[colors.primaryBlue, colors.primaryRed]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.saveButton}
            >
              {saving ? (
                <ActivityIndicator color={colors.textWhite} />
              ) : (
                <Text style={[styles.saveButtonText, { color: colors.textWhite }]}>{t.editProfileSave}</Text>
              )}
            </GradientView>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  backButton: {
    marginRight: 12,
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  content: {
    alignItems: 'center',
    padding: 20,
    paddingTop: 36,
  },
  photoContainer: {
    position: 'relative',
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRing: {
    position: 'absolute',
  },
  cameraPulseRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 21,
    borderWidth: 2.5,
    borderColor: '#fff',
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  photoFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  photoHint: {
    fontSize: 13,
    color: '#aaa',
    marginBottom: 8,
  },
  photoGuideline: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  inputWrap: {
    position: 'relative',
    marginBottom: 16,
  },
  inputHighlightBorder: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  inputHighlightFill: {
    flex: 1,
    borderRadius: 12,
  },
  bioInput: {
    height: 100,
    paddingTop: 12,
    marginBottom: 4,
  },
  charCount: {
    fontSize: 12,
    color: '#aaa',
    textAlign: 'right',
    marginBottom: 24,
  },
  tagScroll: {
    marginBottom: 28,
  },
  tagScrollContent: {
    gap: 8,
    paddingRight: 20,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
  },
  tagEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  tagText: {
    fontSize: 14,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  toggleSection: {
    width: '100%',
    paddingVertical: 8,
    marginBottom: 16,
  },
  toggleValueLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#aaa',
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '700',
  },
  extraPhotosSection: {
    width: '100%',
    marginBottom: 16,
  },
  progressBarSection: {
    alignSelf: 'stretch',
    marginTop: -16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    opacity: 0.7,
  },
  progressBarPercent: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 36,
    textAlign: 'right',
  },
  avatarSection: {
    alignSelf: 'stretch',
    marginBottom: 24,
    alignItems: 'flex-start',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  avatarUpload: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlusIcon: {
    fontSize: 26,
    fontWeight: '300',
  },
  avatarHint: {
    fontSize: 12,
    marginLeft: 12,
    flex: 1,
    lineHeight: 16,
  },
  addPhotoIcon: {
    fontSize: 24,
    fontWeight: '300',
    lineHeight: 28,
  },
  addPhotoLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
});

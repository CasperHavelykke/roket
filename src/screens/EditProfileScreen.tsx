import React, { useState, useEffect } from 'react';
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
  KeyboardAvoidingView,
  Platform,
  Switch,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import GradientView from '../components/GradientView';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import pickImage from '../utils/pickImage';
import getFirebaseError from '../utils/getFirebaseError';
import { useTheme } from '../theme';
import CameraIcon from '../assets/camera.svg';

type GenderKey = 'male' | 'female' | 'nonbinary' | 'trans' | '';
type SexualityKey = 'straight' | 'gay' | 'bisexual' | 'pansexual' | 'other' | '';

export default function EditProfileScreen({ navigation }: any) {
  const { colors, isDark, t } = useTheme();
  const insets = useSafeAreaInsets();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAge, setShowAge] = useState(true);
  const [hasBirthday, setHasBirthday] = useState(false);
  const [gender, setGender] = useState<GenderKey>('');
  const [showGender, setShowGender] = useState(true);
  const [sexuality, setSexuality] = useState<SexualityKey>('');
  const [showSexuality, setShowSexuality] = useState(true);
  const [photos, setPhotos] = useState<string[]>([]);
  const [pickerType, setPickerType] = useState<'gender' | 'sexuality' | null>(null);
  const currentUser = auth().currentUser;
  const MAX_EXTRA_PHOTOS = 5;

  const genderOptions: { key: GenderKey; label: string }[] = [
    { key: 'male', label: t.genderMale },
    { key: 'female', label: t.genderFemale },
    { key: 'nonbinary', label: t.genderNonBinary },
    { key: 'trans', label: t.genderTrans },
  ];

  const sexualityOptions: { key: SexualityKey; label: string }[] = [
    { key: 'straight', label: t.sexualityStraight },
    { key: 'gay', label: t.sexualityGay },
    { key: 'bisexual', label: t.sexualityBisexual },
    { key: 'pansexual', label: t.sexualityPansexual },
    { key: 'other', label: t.sexualityOther },
  ];

  const genderLabel = (key: GenderKey) => genderOptions.find(o => o.key === key)?.label ?? '';
  const sexualityLabel = (key: SexualityKey) => sexualityOptions.find(o => o.key === key)?.label ?? '';

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
          setBio(data.bio ?? '');
          setPhotoURL(data.photoURL ?? null);
          setShowAge(data.showAge !== false);
          setHasBirthday(!!data.birthday);
          setGender(data.gender ?? '');
          setShowGender(data.showGender !== false);
          setSexuality(data.sexuality ?? '');
          setShowSexuality(data.showSexuality !== false);
          setPhotos(data.photos ?? []);

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

  const pickAndUploadPhoto = async () => {
    const uri = await pickImage();
    if (!uri) return;

    setUploading(true);
    try {
      const ref = storage().ref(`profilePhotos/${currentUser.uid}.jpg`);
      await ref.putFile(uri);
      const url = await ref.getDownloadURL();

      await firestore().collection('users').doc(currentUser.uid).update({
        photoURL: url,
      });

      setPhotoURL(url);
    } catch (error: any) {
      Alert.alert(t.error, getFirebaseError(error, t));
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    setUploading(true);
    try {
      await firestore().collection('users').doc(currentUser.uid).update({
        photoURL: null,
      });
      setPhotoURL(null);
    } catch (error: any) {
      Alert.alert(t.error, getFirebaseError(error, t));
    } finally {
      setUploading(false);
    }
  };

  const handleChangePhoto = () => {
    if (photoURL) {
      Alert.alert(t.editProfileTitle, undefined, [
        { text: t.editProfileChangePhoto, onPress: pickAndUploadPhoto },
        { text: t.editProfileRemovePhoto, style: 'destructive', onPress: handleRemovePhoto },
        { text: t.cancel, style: 'cancel' },
      ]);
    } else {
      pickAndUploadPhoto();
    }
  };

  const handleAddExtraPhoto = async () => {
    if (photos.length >= MAX_EXTRA_PHOTOS) return;
    const uri = await pickImage();
    if (!uri) return;

    setUploading(true);
    try {
      const index = photos.length;
      const ref = storage().ref(`profilePhotos/${currentUser.uid}_extra_${index}.jpg`);
      await ref.putFile(uri);
      const url = await ref.getDownloadURL();

      const updated = [...photos, url];
      await firestore().collection('users').doc(currentUser.uid).update({
        photos: updated,
      });
      setPhotos(updated);
    } catch (error: any) {
      Alert.alert(t.error, getFirebaseError(error, t));
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveExtraPhoto = (index: number) => {
    Alert.alert(t.delete, undefined, [
      {
        text: t.remove,
        style: 'destructive',
        onPress: async () => {
          setUploading(true);
          try {
            const updated = photos.filter((_, i) => i !== index);
            await firestore().collection('users').doc(currentUser.uid).update({
              photos: updated,
            });
            setPhotos(updated);
          } catch (error: any) {
            Alert.alert(t.error, getFirebaseError(error, t));
          } finally {
            setUploading(false);
          }
        },
      },
      { text: t.cancel, style: 'cancel' },
    ]);
  };

  const handleSave = async () => {
    const trimmedName = displayName.trim();

    setSaving(true);
    try {
      await firestore().collection('users').doc(currentUser.uid).update({
        displayName: trimmedName,
        bio: bio.trim(),
        showAge,
        gender: gender || null,
        showGender,
        sexuality: sexuality || null,
        showSexuality,
      });
      navigation.goBack();
    } catch (error: any) {
      Alert.alert(t.error, getFirebaseError(error, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: colors.background }]}>
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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <TouchableOpacity onPress={handleChangePhoto} style={styles.photoContainer}>
            {uploading ? (
              <GradientView
                colors={[colors.primaryBlue, colors.primaryRed]}
                style={styles.photoPlaceholder}
              >
                <ActivityIndicator color={colors.textWhite} />
              </GradientView>
            ) : (
              <Image
                source={photoURL ? { uri: photoURL } : isDark ? require('../assets/missing-profile-pic.png') : require('../assets/missing-profile-pic-light.png')}
                style={styles.photo}
              />
            )}
            <View style={[styles.editBadge, { backgroundColor: colors.white }]}>
              <CameraIcon width={16} height={16} fill={colors.primaryBlueText} />
            </View>
          </TouchableOpacity>

          <Text style={styles.photoHint}>{t.editProfilePhotoHint}</Text>
          <Text style={[styles.photoGuideline, { color: colors.textMuted }]}>{t.photoGuideline}</Text>

          <View style={styles.extraPhotosSection}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {t.editProfilePhotos} <Text style={{ fontWeight: '400' }}>({t.editProfilePhotosDesc(photos.length, MAX_EXTRA_PHOTOS)})</Text>
            </Text>
            <View style={styles.extraPhotosGrid}>
              {photos.map((url, i) => (
                <TouchableOpacity key={i} onPress={() => handleRemoveExtraPhoto(i)} style={styles.extraPhotoSlot}>
                  <Image source={{ uri: url }} style={styles.extraPhotoImage} />
                  <View style={[styles.removePhotoOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                    <Text style={styles.removePhotoText}>✕</Text>
                  </View>
                </TouchableOpacity>
              ))}
              {photos.length < MAX_EXTRA_PHOTOS && (
                <TouchableOpacity
                  onPress={handleAddExtraPhoto}
                  style={[styles.extraPhotoSlot, styles.addPhotoSlot, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]}
                  disabled={uploading}
                >
                  <Text style={[styles.addPhotoIcon, { color: colors.textMuted }]}>+</Text>
                  <Text style={[styles.addPhotoLabel, { color: colors.textMuted }]}>{t.editProfileAddPhoto}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.form}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t.editProfileNameLabel}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.white, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder={t.editProfileNamePlaceholder}
              placeholderTextColor={colors.textMuted}
              maxLength={50}
              autoCorrect={false}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>{t.editProfileBioLabel}</Text>
            <TextInput
              style={[styles.input, styles.bioInput, { backgroundColor: colors.white, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              value={bio}
              onChangeText={setBio}
              placeholder={t.editProfileBioPlaceholder}
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
              maxLength={200}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{bio.length}/200</Text>

            {hasBirthday && (
              <View style={[styles.toggleRow, { borderTopColor: colors.inputBorder }]}>
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
            )}
          </View>

          <View style={[styles.pickerSection, { backgroundColor: colors.white, borderColor: colors.inputBorder }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t.editProfileGender}</Text>
            <TouchableOpacity
              style={[styles.pickerButton, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]}
              onPress={() => setPickerType('gender')}
            >
              <Text style={[styles.pickerButtonText, gender ? { color: colors.textPrimary } : { color: colors.textMuted }]}>
                {gender ? genderLabel(gender) : t.editProfileSelect}
              </Text>
              <Text style={{ color: colors.textMuted }}>▼</Text>
            </TouchableOpacity>

            {gender !== '' && (
              <View style={[styles.toggleRow, { borderTopColor: colors.inputBorder }]}>
                <View style={styles.toggleInfo}>
                  <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 0 }]}>{t.editProfileShowGender}</Text>
                  <Text style={[styles.toggleDesc, { color: colors.textMuted }]}>{t.editProfileShowGenderDesc}</Text>
                </View>
                <Switch
                  value={showGender}
                  onValueChange={setShowGender}
                  trackColor={{ false: colors.inputBorder, true: colors.primaryBlue }}
                  thumbColor="#fff"
                />
              </View>
            )}
          </View>

          <View style={[styles.pickerSection, { backgroundColor: colors.white, borderColor: colors.inputBorder }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t.editProfileSexuality}</Text>
            <TouchableOpacity
              style={[styles.pickerButton, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]}
              onPress={() => setPickerType('sexuality')}
            >
              <Text style={[styles.pickerButtonText, sexuality ? { color: colors.textPrimary } : { color: colors.textMuted }]}>
                {sexuality ? sexualityLabel(sexuality) : t.editProfileSelect}
              </Text>
              <Text style={{ color: colors.textMuted }}>▼</Text>
            </TouchableOpacity>

            {sexuality !== '' && (
              <View style={[styles.toggleRow, { borderTopColor: colors.inputBorder }]}>
                <View style={styles.toggleInfo}>
                  <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 0 }]}>{t.editProfileShowSexuality}</Text>
                  <Text style={[styles.toggleDesc, { color: colors.textMuted }]}>{t.editProfileShowSexualityDesc}</Text>
                </View>
                <Switch
                  value={showSexuality}
                  onValueChange={setShowSexuality}
                  trackColor={{ false: colors.inputBorder, true: colors.primaryBlue }}
                  thumbColor="#fff"
                />
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.primaryRed }, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.textWhite} />
            ) : (
              <Text style={[styles.saveButtonText, { color: colors.textWhite }]}>{t.editProfileSave}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={pickerType !== null} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPickerType(null)}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {pickerType === 'gender' ? t.editProfileGender : t.editProfileSexuality}
            </Text>
            {(pickerType === 'gender' ? gender !== '' : sexuality !== '') && (
              <TouchableOpacity
                style={[styles.modalOption, { borderBottomWidth: 1, borderBottomColor: colors.inputBorder, marginBottom: 8 }]}
                onPress={() => {
                  if (pickerType === 'gender') {
                    setGender('');
                  } else {
                    setSexuality('');
                  }
                  setPickerType(null);
                }}
              >
                <Text style={[styles.modalOptionText, { color: colors.primaryRed }]}>{t.remove}</Text>
              </TouchableOpacity>
            )}
            {(pickerType === 'gender' ? genderOptions : sexualityOptions).map(option => {
              const isActive = pickerType === 'gender' ? gender === option.key : sexuality === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.modalOption, isActive && { backgroundColor: colors.primaryBlue }]}
                  onPress={() => {
                    if (pickerType === 'gender') {
                      setGender(option.key as GenderKey);
                    } else {
                      setSexuality(option.key as SexualityKey);
                    }
                    setPickerType(null);
                  }}
                >
                  <Text style={[styles.modalOptionText, { color: colors.textPrimary }, isActive && { color: '#fff' }]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
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
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
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
  pickerSection: {
    width: '100%',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pickerButtonText: {
    fontSize: 16,
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
    marginBottom: 16,
  },
  modalOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 4,
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  saveButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
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
  extraPhotosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  extraPhotoSlot: {
    width: 80,
    height: 80,
    borderRadius: 10,
    overflow: 'hidden',
  },
  extraPhotoImage: {
    width: '100%',
    height: '100%',
  },
  removePhotoOverlay: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removePhotoText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  addPhotoSlot: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
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

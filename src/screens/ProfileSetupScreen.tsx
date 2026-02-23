import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  ScrollView,
  Switch,
  Modal,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import pickImage from '../utils/pickImage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LocationService from '../services/LocationService';
import { useTheme } from '../theme';
import getFirebaseError from '../utils/getFirebaseError';
import CameraIcon from '../assets/camera.svg';
import DisclosureModal from '../components/DisclosureModal';
import RoketLogo from '../assets/roket-logo-3.svg';

type GenderKey = 'male' | 'female' | 'nonbinary' | 'trans' | '';
type SexualityKey = 'straight' | 'gay' | 'bisexual' | 'pansexual' | 'other' | '';

export default function ProfileSetupScreen() {
  const { colors, t } = useTheme();
  const insets = useSafeAreaInsets();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAge, setShowAge] = useState(true);
  const [gender, setGender] = useState<GenderKey>('');
  const [showGender, setShowGender] = useState(true);
  const [sexuality, setSexuality] = useState<SexualityKey>('');
  const [showSexuality, setShowSexuality] = useState(true);
  const [extraPhotos, setExtraPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pickerType, setPickerType] = useState<'gender' | 'sexuality' | null>(null);
  const [showLocationDisclosure, setShowLocationDisclosure] = useState(false);
  const locationDisclosureResolve = React.useRef<((v: boolean) => void) | null>(null);
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

  const handlePickImage = async () => {
    const uri = await pickImage();
    if (uri) setPhotoUri(uri);
  };

  const uploadPhoto = async (userId: string): Promise<string | null> => {
    if (!photoUri) return null;
    const ref = storage().ref(`profilePhotos/${userId}.jpg`);
    await ref.putFile(photoUri);
    return await ref.getDownloadURL();
  };

  const handleAddExtraPhoto = async () => {
    if (extraPhotos.length >= MAX_EXTRA_PHOTOS) return;
    const uri = await pickImage();
    if (!uri) return;
    setUploading(true);
    try {
      const user = auth().currentUser;
      if (!user) return;
      const index = extraPhotos.length;
      const ref = storage().ref(`profilePhotos/${user.uid}_extra_${index}.jpg`);
      await ref.putFile(uri);
      const url = await ref.getDownloadURL();
      setExtraPhotos(prev => [...prev, url]);
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
        onPress: () => setExtraPhotos(prev => prev.filter((_, i) => i !== index)),
      },
      { text: t.cancel, style: 'cancel' },
    ]);
  };

  const requestLocationDisclosure = (): Promise<boolean> => {
    return new Promise(resolve => {
      locationDisclosureResolve.current = resolve;
      setShowLocationDisclosure(true);
    });
  };

  const handleCompleteProfile = async () => {
    setLoading(true);

    try {
      const user = auth().currentUser;
      if (!user) {
        Alert.alert(t.error, t.setupErrorNoUser);
        return;
      }

      const accepted = await requestLocationDisclosure();
      if (!accepted) {
        setLoading(false);
        return;
      }

      const position = await LocationService.getCurrentPosition();
      if (!position) {
        Alert.alert(
          t.setupLocationRequired,
          t.setupLocationMessage,
        );
        setLoading(false);
        return;
      }

      const photoURL = await uploadPhoto(user.uid);

      let birthday: { day: number; month: number; year: number } | null = null;
      try {
        const stored = await AsyncStorage.getItem('@roket_birthday');
        if (stored) {
          birthday = JSON.parse(stored);
          await AsyncStorage.removeItem('@roket_birthday');
        }
      } catch {}

      if (!birthday) {
        Alert.alert(t.error, t.signupErrorNoBirthday);
        setLoading(false);
        return;
      }

      await Promise.all([
        firestore().collection('users').doc(user.uid).set({
          displayName: displayName.trim(),
          bio: bio.trim(),
          email: user.email,
          createdAt: firestore.FieldValue.serverTimestamp(),
          photoURL,
          lastSeen: firestore.FieldValue.serverTimestamp(),
          distanceMode: position.precision === 'coarse' ? 'fuzzy' : 'exact',
          birthday,
          showAge,
          gender: gender || null,
          showGender,
          sexuality: sexuality || null,
          showSexuality,
          photos: extraPhotos,
        }),
        firestore().collection('userLocations').doc(user.uid).set({
          location: new firestore.GeoPoint(position.latitude, position.longitude),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        }),
      ]);
    } catch (error: any) {
      console.error('Profile setup error:', error);
      Alert.alert(t.error, getFirebaseError(error, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.white }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t.setupTitle}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t.setupSubtitle}</Text>

        <TouchableOpacity style={styles.photoContainer} onPress={handlePickImage}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photo} />
          ) : (
            <LinearGradient
              colors={[colors.primaryBlue, colors.primaryRed]}
              style={styles.photoPlaceholder}
            >
              <RoketLogo width={56} height={56} />
            </LinearGradient>
          )}
          <View style={[styles.cameraBadge, { backgroundColor: colors.white }]}>
            <CameraIcon width={16} height={16} fill={colors.primaryBlueText} />
          </View>
        </TouchableOpacity>

        <Text style={[styles.photoGuideline, { color: colors.textMuted }]}>{t.photoGuideline}</Text>

        <View style={styles.extraPhotosSection}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>
            {t.editProfilePhotos} <Text style={{ fontWeight: '400', color: colors.textMuted }}>({t.editProfilePhotosDesc(extraPhotos.length, MAX_EXTRA_PHOTOS)})</Text>
          </Text>
          <View style={styles.extraPhotosGrid}>
            {extraPhotos.map((url, i) => (
              <TouchableOpacity key={i} onPress={() => handleRemoveExtraPhoto(i)} style={styles.extraPhotoSlot}>
                <Image source={{ uri: url }} style={styles.extraPhotoImage} />
                <View style={[styles.removePhotoOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                  <Text style={styles.removePhotoText}>✕</Text>
                </View>
              </TouchableOpacity>
            ))}
            {extraPhotos.length < MAX_EXTRA_PHOTOS && (
              <TouchableOpacity
                onPress={handleAddExtraPhoto}
                style={[styles.extraPhotoSlot, styles.addPhotoSlot, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color={colors.textMuted} />
                ) : (
                  <>
                    <Text style={[styles.addPhotoIcon, { color: colors.textMuted }]}>+</Text>
                    <Text style={[styles.addPhotoLabel, { color: colors.textMuted }]}>{t.editProfileAddPhoto}</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.form}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>{t.setupNameLabel}</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, color: colors.textPrimary }]}
            placeholder={t.setupNamePlaceholder}
            placeholderTextColor={colors.textMuted}
            value={displayName}
            onChangeText={setDisplayName}
            maxLength={50}
          />

          <Text style={[styles.label, { color: colors.textPrimary }]}>{t.setupBioLabel}</Text>
          <TextInput
            style={[styles.input, styles.bioInput, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, color: colors.textPrimary }]}
            placeholder={t.setupBioPlaceholder}
            placeholderTextColor={colors.textMuted}
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={4}
            maxLength={200}
            textAlignVertical="top"
          />
          <Text style={[styles.characterCount, { color: colors.textMuted }]}>{bio.length}/200</Text>

          <View style={[styles.toggleRow, { borderTopColor: colors.inputBorder }]}>
            <View style={styles.toggleInfo}>
              <Text style={[styles.label, { color: colors.textPrimary, marginBottom: 0 }]}>{t.editProfileShowAge}</Text>
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

        <View style={[styles.pickerSection, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>{t.editProfileGender}</Text>
          <TouchableOpacity
            style={[styles.pickerButton, { borderColor: colors.inputBorder, backgroundColor: colors.white }]}
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
                <Text style={[styles.label, { color: colors.textPrimary, marginBottom: 0 }]}>{t.editProfileShowGender}</Text>
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

        <View style={[styles.pickerSection, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>{t.editProfileSexuality}</Text>
          <TouchableOpacity
            style={[styles.pickerButton, { borderColor: colors.inputBorder, backgroundColor: colors.white }]}
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
                <Text style={[styles.label, { color: colors.textPrimary, marginBottom: 0 }]}>{t.editProfileShowSexuality}</Text>
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

        <View style={[styles.guidelinesCard, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
          <Text style={[styles.guidelinesTitle, { color: colors.textPrimary }]}>{t.guidelinesTitle}</Text>
          <Text style={[styles.guidelinesIntro, { color: colors.textSecondary }]}>{t.guidelinesIntro}</Text>
          {[t.guideline1, t.guideline2, t.guideline3, t.guideline4, t.guideline5, t.guideline6].map((g, i) => (
            <Text key={i} style={[styles.guidelineItem, { color: colors.textSecondary }]}>• {g}</Text>
          ))}
          <Text style={[styles.guidelinesConsequence, { color: colors.textMuted }]}>{t.guidelinesConsequence}</Text>
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primaryRed }, loading && { backgroundColor: colors.textMuted }]}
          onPress={handleCompleteProfile}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.textWhite} />
          ) : (
            <Text style={[styles.buttonText, { color: colors.textWhite }]}>{t.setupComplete}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

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
                  if (pickerType === 'gender') setGender('');
                  else setSexuality('');
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
                    if (pickerType === 'gender') setGender(option.key as GenderKey);
                    else setSexuality(option.key as SexualityKey);
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

      <DisclosureModal
        visible={showLocationDisclosure}
        icon="📍"
        title={t.disclosureLocationTitle}
        message={t.disclosureLocationMessage}
        acceptLabel={t.disclosureLocationAccept}
        cancelLabel={t.cancel}
        onAccept={() => {
          setShowLocationDisclosure(false);
          locationDisclosureResolve.current?.(true);
        }}
        onCancel={() => {
          setShowLocationDisclosure(false);
          locationDisclosureResolve.current?.(false);
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  optionalHint: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  photoContainer: {
    alignSelf: 'center',
    marginBottom: 20,
    position: 'relative',
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
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 3,
  },
  photoGuideline: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
  },
  extraPhotosSection: {
    marginBottom: 20,
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
  form: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    padding: 15,
    marginBottom: 20,
    borderRadius: 10,
    fontSize: 16,
  },
  bioInput: {
    height: 100,
    paddingTop: 15,
  },
  characterCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: -15,
    marginBottom: 10,
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
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
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
  guidelinesCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  guidelinesTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  guidelinesIntro: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  guidelineItem: {
    fontSize: 13,
    lineHeight: 20,
    marginLeft: 4,
  },
  guidelinesConsequence: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 10,
  },
  button: {
    padding: 18,
    borderRadius: 10,
    marginTop: 10,
  },
  buttonText: {
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
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
});

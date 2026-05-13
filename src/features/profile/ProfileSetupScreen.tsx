import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Keyboard,
  ScrollView,
  TextInput,
  Animated,
  Image,
} from 'react-native';
import GradientView from '../../components/GradientView';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../theme';
import getFirebaseError from '../../utils/getFirebaseError';
import pickImage from '../../utils/pickImage';
import KeyboardAvoidingView from '../../components/KeyboardAvoidingView';
import RoketLogo from '../../assets/roket-logo-2.svg';
import { User as ProfileIcon } from 'lucide-react-native';
import { STATUS_TAGS, StatusTagId } from '../../statusTags';
import TagIcon from '../../components/TagIcon';

const AVATAR_GRADIENTS = [
  { colors: ['#4A90D9', '#357ABD'], label: 'blue' },
  { colors: ['#D94A4A', '#BD3535'], label: 'red' },
  { colors: ['#9B59B6', '#8E44AD'], label: 'purple' },
];

export default function ProfileSetupScreen() {
  const { colors, language, t } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [selectedStatusChip, setSelectedStatusChip] = useState<number | null>(null);
  const [statusTag, setStatusTag] = useState<StatusTagId | null>(null);

  const [needsBirthday, setNeedsBirthday] = useState(false);
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const monthAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(monthAnim, {
      toValue: showMonthPicker ? 1 : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [showMonthPicker]);
  const monthGridHeight = monthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 180],
  });
  const monthsByLang: Record<string, string[]> = {
    da: ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'],
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    es: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
    de: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
    fr: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'],
    pt: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
  };
  const placeholders: Record<string, { day: string; month: string; year: string }> = {
    da: { day: 'Dag', month: 'Måned', year: 'År' },
    en: { day: 'Day', month: 'Month', year: 'Year' },
    es: { day: 'Día', month: 'Mes', year: 'Año' },
    de: { day: 'Tag', month: 'Monat', year: 'Jahr' },
    fr: { day: 'Jour', month: 'Mois', year: 'Année' },
    pt: { day: 'Dia', month: 'Mês', year: 'Ano' },
  };
  const monthNames = monthsByLang[language] || monthsByLang.en;
  const ph = placeholders[language] || placeholders.en;

  const statusOptions = [t.setupStatusOption1, t.setupStatusOption2, t.setupStatusOption3];

  React.useEffect(() => {
    AsyncStorage.getItem('@roket_birthday').then(stored => {
      if (!stored) setNeedsBirthday(true);
    }).catch(() => setNeedsBirthday(true));
  }, []);

  const handlePickPhoto = async () => {
    const uri = await pickImage();
    if (!uri) return;
    setPhotoUri(uri);
    setSelectedAvatar(null);
  };

  const handleSelectAvatar = (label: string) => {
    setSelectedAvatar(label);
    setPhotoUri(null);
  };

  const handleSelectStatusChip = (index: number) => {
    if (selectedStatusChip === index) {
      setSelectedStatusChip(null);
      setStatus('');
    } else {
      setSelectedStatusChip(index);
      setStatus(statusOptions[index]);
    }
  };

  const handleCompleteProfile = async () => {
    let birthday: { day: number; month: number; year: number } | null = null;
    try {
      const stored = await AsyncStorage.getItem('@roket_birthday');
      if (stored) {
        birthday = JSON.parse(stored);
      }
    } catch {}

    if (!birthday && needsBirthday) {
      const d = parseInt(birthDay, 10);
      const m = parseInt(birthMonth, 10);
      const y = parseInt(birthYear, 10);
      if (!d || !m || !y || d < 1 || d > 31 || m < 1 || m > 12 || y < 1900) {
        Alert.alert(t.error, t.signupErrorNoBirthday);
        return;
      }
      birthday = { day: d, month: m, year: y };
    }

    if (!birthday) {
      Alert.alert(t.error, t.signupErrorNoBirthday);
      return;
    }

    setLoading(true);

    try {
      const user = auth().currentUser;
      if (!user) {
        Alert.alert(t.error, t.setupErrorNoUser);
        return;
      }

      await AsyncStorage.removeItem('@roket_birthday');

      let uploadedPhotoURL: string | null = null;

      if (photoUri) {
        setUploading(true);
        try {
          const ref = storage().ref(`profilePhotos/${user.uid}.jpg`);
          await ref.putFile(photoUri);
          uploadedPhotoURL = await ref.getDownloadURL();
        } catch (e) {
          console.warn('Photo upload failed, continuing without photo:', e);
        }
        setUploading(false);
      }

      await firestore().collection('users').doc(user.uid).set({
        displayName: '',
        bio: '',
        status: status.trim(),
        statusTag: statusTag,
        email: user.email,
        createdAt: firestore.FieldValue.serverTimestamp(),
        photoURL: uploadedPhotoURL,
        lastSeen: firestore.FieldValue.serverTimestamp(),
        distanceMode: 'exact',
        birthday,
        showAge: true,
        gender: '',
        showGender: false,
        sexuality: '',
        showSexuality: false,
        photos: [],
        matchTag: 'all',
        visibleTo: ['all'],
        datingOnly: false,
        setupComplete: true,
      });
    } catch (error: any) {
      console.error('Profile setup error:', error);
      Alert.alert(t.error, getFirebaseError(error, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <GradientView
      colors={[colors.primaryBlue, colors.primaryRed]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior="padding"
      >
        <ScrollView
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
        >
          <RoketLogo width={60} height={60} fill="#fff" fillRule="evenodd" style={styles.logo} />
          <Text style={styles.title}>{t.setupTitle}</Text>
          <Text style={styles.subtitle}>{t.setupSubtitle}</Text>

          {/* Profile Photo Section */}
          <View style={styles.photoSection}>
            <TouchableOpacity onPress={handlePickPhoto} style={styles.photoPreviewWrap}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photoPreview} />
              ) : selectedAvatar ? (
                <LinearGradient
                  colors={AVATAR_GRADIENTS.find(a => a.label === selectedAvatar)?.colors || ['#4A90D9', '#357ABD']}
                  style={styles.photoPreview}
                >
                  <ProfileIcon size={50} color="#fff" />
                </LinearGradient>
              ) : (
                <View style={styles.photoPlaceholder}>
                  <ProfileIcon size={50} color="rgba(255,255,255,0.5)" />
                </View>
              )}
              {uploading && (
                <View style={[styles.photoPreview, styles.photoUploading]}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.uploadButton} onPress={handlePickPhoto}>
              <Text style={styles.uploadButtonText}>{t.setupUploadPhoto}</Text>
            </TouchableOpacity>
          </View>

          {/* Status Section */}
          <Text style={styles.label}>{t.setupStatusLabel}</Text>
          <TextInput
            style={styles.statusInput}
            value={status}
            onChangeText={(v) => {
              setStatus(v);
              setSelectedStatusChip(null);
            }}
            placeholder={t.setupStatusLabel}
            placeholderTextColor="rgba(255,255,255,0.5)"
            maxLength={75}
          />
          <View style={styles.chipRow}>
            {statusOptions.map((opt, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.chip, selectedStatusChip === i && styles.chipSelected]}
                onPress={() => handleSelectStatusChip(i)}
              >
                <Text style={[styles.chipText, selectedStatusChip === i && { color: colors.primaryBlue }]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Tag Picker */}
          <Text style={styles.label}>{t.tagPickerLabel}</Text>
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
                  style={[styles.tag, isSelected && styles.tagSelected]}
                  onPress={() => setStatusTag(isSelected ? null : tag.id)}
                >
                  <TagIcon tag={tag.id} size={14} color={isSelected ? colors.primaryBlue : '#fff'} />
                  <Text style={[styles.tagText, { marginLeft: 5 }, isSelected && { color: colors.primaryBlue }]}>
                    {String(t[labelKey] ?? tag.id)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Birthday Section (conditional) */}
          {needsBirthday && (
            <>
              <Text style={styles.label}>{t.signupBirthday}</Text>
              <View style={styles.birthdayRow}>
                <TextInput
                  style={styles.birthdayInput}
                  placeholder={ph.day}
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  value={birthDay}
                  onChangeText={v => setBirthDay(v.replace(/[^0-9]/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <TouchableOpacity
                  style={styles.monthPicker}
                  onPress={() => { if (!showMonthPicker) Keyboard.dismiss(); setShowMonthPicker(!showMonthPicker); }}
                >
                  <Text style={[styles.monthPickerText, !birthMonth && { color: 'rgba(255,255,255,0.5)' }]}>
                    {birthMonth ? monthNames[parseInt(birthMonth, 10) - 1] : ph.month}
                  </Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.birthdayInput}
                  placeholder={ph.year}
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  value={birthYear}
                  onChangeText={v => setBirthYear(v.replace(/[^0-9]/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  maxLength={4}
                />
              </View>
              <Animated.View style={{ height: monthGridHeight, overflow: 'hidden', opacity: monthAnim }}>
                <View style={styles.monthGrid}>
                  {monthNames.map((m, i) => {
                    const isSelected = parseInt(birthMonth, 10) === i + 1;
                    return (
                      <TouchableOpacity
                        key={i}
                        style={[styles.monthOption, isSelected && styles.monthOptionSelected]}
                        onPress={() => {
                          setBirthMonth(String(i + 1));
                          setShowMonthPicker(false);
                        }}
                      >
                        <Text style={[
                          styles.monthOptionText,
                          isSelected && { color: colors.primaryBlue },
                        ]}>
                          {m}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Animated.View>
            </>
          )}

        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
          <TouchableOpacity
            style={[styles.button, loading && { opacity: 0.7 }]}
            onPress={handleCompleteProfile}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryBlue} />
            ) : (
              <Text style={[styles.buttonText, { color: colors.primaryBlue }]}>{t.setupComplete}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </GradientView>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 30,
    paddingBottom: 20,
    alignItems: 'center',
  },
  logo: {
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 28,
    width: '100%',
  },
  photoPreviewWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    marginBottom: 12,
  },
  photoPreview: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoUploading: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  uploadButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    marginBottom: 16,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  avatarLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    marginBottom: 10,
  },
  avatarRow: {
    flexDirection: 'row',
    gap: 16,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarCircleSelected: {
    borderColor: '#fff',
  },
  avatarGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  statusInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 15,
    borderRadius: 12,
    fontSize: 16,
    color: '#fff',
    marginBottom: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
    width: '100%',
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  chipSelected: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  tagScroll: {
    width: '100%',
    marginBottom: 24,
  },
  tagScrollContent: {
    gap: 8,
    paddingRight: 20,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  tagSelected: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  tagEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  tagText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  footer: {
    paddingHorizontal: 30,
    alignItems: 'center',
  },
  button: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '700',
  },
  birthdayRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
    width: '100%',
  },
  birthdayInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 15,
    borderRadius: 12,
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
  },
  monthPicker: {
    flex: 1.2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 15,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthPickerText: {
    fontSize: 16,
    color: '#fff',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 12,
    padding: 6,
    marginBottom: 24,
    gap: 4,
    width: '100%',
  },
  monthOption: {
    width: '23%',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  monthOptionSelected: {
    backgroundColor: '#fff',
  },
  monthOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});

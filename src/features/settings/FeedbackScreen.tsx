import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native';
import KeyboardAvoidingView from '../../components/KeyboardAvoidingView';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import GradientView from '../../components/GradientView';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import pickImage from '../../utils/pickImage';
import getFirebaseError from '../../utils/getFirebaseError';
import { useTheme } from '../../theme';
import { Camera as CameraIcon } from 'lucide-react-native';

type Category = 'bug' | 'feature' | 'feedback';

export default function FeedbackScreen({ route, navigation }: any) {
  const { colors, t } = useTheme();
  const insets = useSafeAreaInsets();

  const categories: { value: Category; label: string; emoji: string }[] = [
    { value: 'bug', label: t.feedbackCatBug, emoji: '!' },
    { value: 'feature', label: t.feedbackCatFeature, emoji: '+' },
    { value: 'feedback', label: t.feedbackCatFeedback, emoji: '?' },
  ];
  const currentUser = auth().currentUser;
  const initialCategory = route.params?.category as Category | undefined;
  const [category, setCategory] = useState<Category>(initialCategory ?? 'feedback');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);

  if (!currentUser) return null;

  const handlePickImage = async () => {
    const uri = await pickImage();
    if (uri) setImageUri(uri);
  };

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed) {
      Alert.alert(t.error, t.feedbackErrorEmpty);
      return;
    }

    setSending(true);
    try {
      // Opret Firestore-dokument med det samme (uden billede)
      const docRef = await firestore().collection('feedback').add({
        userId: currentUser.uid,
        email: currentUser.email,
        category,
        message: trimmed,
        platform: Platform.OS,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      // Vis bekræftelse med det samme — upload billedet i baggrunden
      Alert.alert(t.feedbackThanksTitle, t.feedbackThanksMessage, [
        { text: t.ok, onPress: () => navigation.goBack() },
      ]);

      if (imageUri) {
        const ref = storage().ref(`feedbackImages/${docRef.id}.jpg`);
        ref.putFile(imageUri).then(async () => {
          const imageURL = await ref.getDownloadURL();
          await docRef.update({ imageURL });
        }).catch(err => console.error('Feedback image upload error:', err));
      }
    } catch (error: any) {
      Alert.alert(t.error, getFirebaseError(error, t));
    } finally {
      setSending(false);
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
        <Text style={[styles.headerTitle, { color: colors.textWhite }]}>{t.feedbackTitle}</Text>
      </GradientView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t.feedbackCategory}</Text>
          <View style={styles.categories}>
            {categories.map(cat => {
              const isActive = category === cat.value;
              return (
                <TouchableOpacity
                  key={cat.value}
                  style={[
                    styles.categoryButton,
                    { borderColor: colors.inputBorder, backgroundColor: colors.card },
                    isActive && { backgroundColor: colors.primaryBlue, borderColor: colors.primaryBlue },
                  ]}
                  onPress={() => setCategory(cat.value)}
                >
                  <View style={[
                    styles.categoryEmoji,
                    { backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : colors.backgroundLight },
                  ]}>
                    <Text style={[
                      styles.categoryEmojiText,
                      { color: isActive ? colors.textWhite : colors.primaryBlue },
                    ]}>
                      {cat.emoji}
                    </Text>
                  </View>
                  <Text style={[
                    styles.categoryLabel,
                    { color: colors.textPrimary },
                    isActive && { color: colors.textWhite },
                  ]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t.feedbackMessage}</Text>
          <TextInput
            style={[
              styles.textArea,
              {
                borderColor: colors.inputBorder,
                backgroundColor: colors.inputBackground,
                color: colors.textPrimary,
              },
            ]}
            placeholder={
              category === 'bug'
                ? t.feedbackPlaceholderBug
                : category === 'feature'
                ? t.feedbackPlaceholderFeature
                : t.feedbackPlaceholderFeedback
            }
            placeholderTextColor={colors.textMuted}
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            maxLength={1000}
          />
          <Text style={[styles.charCount, { color: colors.textMuted }]}>{message.length}/1000</Text>

          <TouchableOpacity
            style={[styles.imagePickerButton, { borderColor: colors.inputBorder, backgroundColor: colors.card }]}
            onPress={handlePickImage}
          >
            {imageUri ? (
              <View style={styles.imagePreviewRow}>
                <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                <Text style={[styles.imagePickerText, { color: colors.textPrimary, flex: 1 }]}>{t.feedbackImageSelected}</Text>
                <TouchableOpacity onPress={() => setImageUri(null)}>
                  <Text style={[styles.removeImageText, { color: colors.primaryRed }]}>{t.feedbackImageRemove}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.imagePickerInner}>
                <CameraIcon size={18} color={colors.primaryBlueText} />
                <Text style={[styles.imagePickerText, { color: colors.textSecondary }]}>{t.feedbackImageAdd}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: colors.primaryBlue }]}
            onPress={handleSend}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator color={colors.textWhite} />
            ) : (
              <Text style={[styles.sendButtonText, { color: colors.textWhite }]}>{t.feedbackSend}</Text>
            )}
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
      <View style={[styles.emailLink, { paddingBottom: insets.bottom + 12 }]}>
        <Text style={[styles.emailOrText, { color: colors.textMuted }]}>{t.or}</Text>
        <TouchableOpacity onPress={() => Linking.openURL('mailto:support@roketapp.eu')}>
          <Text style={[styles.emailLinkText, { color: colors.primaryBlueText }]}>
            support@roketapp.eu
          </Text>
        </TouchableOpacity>
      </View>
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
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 8,
    marginLeft: 4,
  },
  categories: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  categoryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    gap: 6,
  },
  categoryEmoji: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryEmojiText: {
    fontSize: 18,
    fontWeight: '800',
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    minHeight: 140,
    lineHeight: 22,
  },
  charCount: {
    textAlign: 'right',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 20,
  },
  imagePickerButton: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  imagePickerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  imagePickerText: {
    fontSize: 15,
  },
  imagePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  imagePreview: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  removeImageText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sendButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  sendButtonText: {
    fontSize: 17,
    fontWeight: '700',
  },
  emailLink: {
    paddingTop: 12,
    alignItems: 'center',
    gap: 4,
  },
  emailOrText: {
    fontSize: 13,
  },
  emailLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

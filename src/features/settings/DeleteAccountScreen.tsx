import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import KeyboardAvoidingView from '../../components/KeyboardAvoidingView';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import GradientView from '../../components/GradientView';
import auth from '@react-native-firebase/auth';
import { useTheme } from '../../theme';
import getFirebaseError from '../../utils/getFirebaseError';

export default function DeleteAccountScreen({ navigation }: any) {
  const { colors, t } = useTheme();
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const currentUser = auth().currentUser;
  if (!currentUser) return null;

  const handleDelete = async () => {
    if (!password) {
      Alert.alert(t.error, t.settingsDeleteErrorEmpty);
      return;
    }

    setDeleting(true);
    try {
      const credential = auth.EmailAuthProvider.credential(currentUser.email || '', password);
      await currentUser.reauthenticateWithCredential(credential);

      // Slet auth-konto — Cloud Function (onUserDeleted) rydder op i Firestore + Storage
      await currentUser.delete();
    } catch (error: any) {
      setDeleting(false);
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        Alert.alert(t.error, t.settingsDeleteErrorWrongPassword);
      } else {
        Alert.alert(t.error, getFirebaseError(error, t));
      }
    }
  };

  const bullets = [
    t.deleteAccountBullet1,
    t.deleteAccountBullet2,
    t.deleteAccountBullet3,
    t.deleteAccountBullet4,
    t.deleteAccountBullet5,
  ];

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
        <Text style={[styles.headerTitle, { color: colors.textWhite }]}>{t.deleteAccountTitle}</Text>
      </GradientView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]} keyboardShouldPersistTaps="handled">
        <View style={[styles.warningCard, { backgroundColor: colors.white }]}>
          <Text style={[styles.warningTitle, { color: colors.darkRed }]}>
            {t.deleteAccountWhat}
          </Text>

          {bullets.map((text, i) => (
            <View key={i} style={styles.bulletRow}>
              <Text style={[styles.bulletDot, { color: colors.darkRed }]}>•</Text>
              <Text style={[styles.bulletText, { color: colors.textPrimary }]}>{text}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.confirmCard, { backgroundColor: colors.white }]}>
          <Text style={[styles.confirmLabel, { color: colors.textSecondary }]}>
            {t.deleteAccountConfirmLabel}
          </Text>
          <TextInput
            style={[styles.input, {
              borderColor: colors.inputBorder,
              backgroundColor: colors.inputBackground,
              color: colors.textPrimary,
            }]}
            placeholder={t.settingsDeletePasswordPlaceholder}
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            editable={!deleting}
          />
        </View>

        <TouchableOpacity
          style={[styles.deleteButton, { backgroundColor: colors.darkRed }, deleting && styles.deleteButtonDisabled]}
          onPress={handleDelete}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Text style={styles.deleteButtonText}>{t.deleteAccountButton}</Text>
          )}
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
    padding: 20,
    paddingBottom: 40,
  },
  warningCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 12,
    paddingRight: 8,
  },
  bulletDot: {
    fontSize: 18,
    lineHeight: 22,
    marginRight: 10,
  },
  bulletText: {
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  confirmCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  confirmLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
  },
  deleteButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  deleteButtonDisabled: {
    opacity: 0.6,
  },
  deleteButtonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
});

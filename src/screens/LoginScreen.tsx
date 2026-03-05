import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import KeyboardAvoidingView from '../components/KeyboardAvoidingView';
import LinearGradient from 'react-native-linear-gradient';
import GradientView from '../components/GradientView';
import auth from '@react-native-firebase/auth';
import { useTheme } from '../theme';
import getFirebaseError from '../utils/getFirebaseError';
import RoketLogo from '../assets/roket-logo-2.svg';

export default function LoginScreen({ navigation }: any) {
  const { colors, t, loginTestInfo } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(t.error, t.loginErrorEmpty);
      return;
    }

    setLoading(true);
    try {
      await auth().signInWithEmailAndPassword(email, password);
    } catch (error: any) {
      Alert.alert(t.loginError, getFirebaseError(error, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <GradientView
      colors={[colors.darkBlue, colors.primaryRed]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <View style={styles.logoContainer}>
        <RoketLogo width={100} height={100} fill="#fff" />
      </View>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t.loginWelcome}</Text>

        <TextInput
          style={[styles.input, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, color: colors.textPrimary }]}
          placeholder={t.loginEmailPlaceholder}
          placeholderTextColor={colors.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={[styles.input, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, color: colors.textPrimary }]}
          placeholder={t.loginPasswordPlaceholder}
          placeholderTextColor={colors.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primaryRed }]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.textWhite} />
          ) : (
            <Text style={styles.buttonText}>{t.loginButton}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
          <Text style={[styles.linkText, { color: colors.darkBlueText }]}>
            {t.loginNoAccount}
          </Text>
        </TouchableOpacity>

        {loginTestInfo ? <Text style={styles.testInfo}>{loginTestInfo}</Text> : null}
      </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </GradientView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  card: {
    borderRadius: 20,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    padding: 15,
    marginBottom: 15,
    borderRadius: 10,
    fontSize: 16,
  },
  button: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    marginTop: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },
  linkText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
  testInfo: {
    textAlign: 'center',
    marginTop: 16,
    fontSize: 12,
    color: '#999',
  },
});

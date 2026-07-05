import { Alert } from 'react-native';
import auth from '@react-native-firebase/auth';

// Er den aktuelle session en gæst (anonym auth eller helt uden bruger)?
export function isGuest(): boolean {
  const user = auth().currentUser;
  return !user || user.isAnonymous;
}

/**
 * Gate for konto-krævende handlinger (deltag, opret, profil, beskeder).
 *
 * Returnerer true hvis brugeren har en rigtig konto og handlingen kan
 * fortsætte. Er brugeren gæst, vises en kontekstuel prompt med vej til
 * signup/login, og der returneres false — kaldstedet skal så bare stoppe.
 */
export function requireAccount(navigation: any, t: any): boolean {
  if (!isGuest()) return true;

  Alert.alert(t.guestGateTitle, t.guestGateMessage, [
    { text: t.cancel, style: 'cancel' },
    { text: t.guestGateLogin, onPress: () => navigation.navigate('Login') },
    { text: t.guestGateSignup, onPress: () => navigation.navigate('Signup') },
  ]);
  return false;
}

import translations, { type Language } from '@shared/translations';

type Translations = (typeof translations)[Language];
type TranslationKey = keyof Translations;

const errorMap: Record<string, TranslationKey> = {
  'auth/network-request-failed': 'firebaseErrorNetwork',
  'auth/too-many-requests': 'firebaseErrorTooMany',
  'auth/user-not-found': 'firebaseErrorUserNotFound',
  'auth/wrong-password': 'firebaseErrorWrongPassword',
  'auth/invalid-credential': 'firebaseErrorInvalidCredential',
  'auth/user-disabled': 'firebaseErrorUserDisabled',
  'auth/weak-password': 'firebaseErrorWeakPassword',
  'firestore/permission-denied': 'firebaseErrorPermission',
  'firestore/unavailable': 'firebaseErrorUnavailable',
  'storage/unauthorized': 'firebaseErrorPermission',
  'storage/unknown': 'firebaseErrorStorage',
  'storage/canceled': 'firebaseErrorStorage',
};

export default function getFirebaseError(error: any, t: Translations): string {
  const code: string | undefined = error?.code;
  const key = code ? errorMap[code] : undefined;
  return key ? String(t[key]) : String(t.firebaseErrorGeneric);
}

import type { Translations } from '../translations';

const errorMap: Record<string, keyof Translations> = {
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
  const key = error?.code && errorMap[error.code];
  return key ? (t[key as keyof Translations] as string) : t.firebaseErrorGeneric;
}

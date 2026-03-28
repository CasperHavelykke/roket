import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyDMxb4MFwfswAOPvgyZaLb5p6TMwz6BdLE',
  authDomain: 'roket-ac4de.firebaseapp.com',
  projectId: 'roket-ac4de',
  storageBucket: 'roket-ac4de.firebasestorage.app',
  messagingSenderId: '1004023349474',
  appId: '1:1004023349474:web:ce6b478bed7d49fe385ebb',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

import { getApp, getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// These values match the public Firebase web-app config on the existing
// ZimMarket site. The API key is a client identifier, not an admin secret.
// Keep Firestore/Storage rules strict; never ship service-account credentials.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyAvkyCvTllZ0H28Dbw8n_cpzKcv8SIYSEQ",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "zimmarket-d4b35.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "zimmarket-d4b35",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "zimmarket-d4b35.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "599480453522",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:599480453522:web:b463f7d523f4fe0639d94b",
};

export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
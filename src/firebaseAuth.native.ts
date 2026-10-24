import AsyncStorage from "@react-native-async-storage/async-storage";
// Firebase 12.4 provides this export in its React Native runtime bundle, but
// its shared TypeScript declarations omit it. Metro selects the RN bundle.
// @ts-expect-error React Native-only Firebase auth export missing from shared declarations.
import { getAuth, getReactNativePersistence, initializeAuth } from "firebase/auth";
import { app } from "./firebaseApp";

function createNativeAuth() {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // Supports Fast Refresh when the Auth instance was already initialized.
    return getAuth(app);
  }
}

export const auth = createNativeAuth();
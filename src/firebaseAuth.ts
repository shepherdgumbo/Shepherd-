import { getAuth } from "firebase/auth";
import { app } from "./firebaseApp";

// Expo web uses browser auth. Native Expo uses firebaseAuth.native.ts
// so native sessions can persist through AsyncStorage.
export const auth = getAuth(app);
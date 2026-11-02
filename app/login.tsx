import { useState } from "react";
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, firebaseConfigured } from "../src/firebase";

function firebaseErrorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : "";
  }
  return "";
}

function accountErrorMessage(code: string, step: "authentication" | "profile"): string {
  if (step === "profile") {
    if (code === "permission-denied") {
      return "Firebase accepted your login, but Firestore refused to save your ZimMarket profile. The live database rules need to be checked; do not change or loosen them blindly.";
    }
    if (code === "unavailable" || code === "auth/network-request-failed") {
      return "Your login may have been created, but the profile could not be saved because the database or network was unavailable. Try signing in with the same details to resume setup.";
    }
    return "Firebase accepted your login, but ZimMarket could not finish saving your profile. Try signing in with the same details to resume setup.";
  }

  const messages: Record<string, string> = {
    "auth/invalid-email": "Enter a valid email address.",
    "auth/weak-password": "Choose a password with at least 6 characters.",
    "auth/operation-not-allowed": "Email/password sign-in is disabled in this Firebase project. Check the Authentication sign-in provider.",
    "auth/unauthorized-domain": "Firebase rejected this website's domain. The exact website hostname must be authorised in Firebase Authentication.",
    "auth/network-request-failed": "The connection to Firebase failed. Check your internet connection and try again.",
    "auth/invalid-credential": "The email or password is incorrect. If you already registered, switch to Sign in or reset your password.",
    "auth/user-disabled": "This account has been disabled. Contact the project administrator.",
    "auth/too-many-requests": "Firebase temporarily blocked requests from this device. Wait before trying again."
  };
  return messages[code] || "Firebase could not complete the account request. Check the error code below.";
}

export default function LoginScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"customer" | "seller">("customer");
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!firebaseConfigured) {
      Alert.alert("Setup required", "Firebase configuration has not been added yet.");
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || password.length < 6) {
      Alert.alert("Check details", "Enter a valid email and a password of at least 6 characters.");
      return;
    }
    if (register && !name.trim()) {
      Alert.alert("Name required", "Enter your name to create an account.");
      return;
    }

    setBusy(true);
    let step: "authentication" | "profile" = "authentication";
    let accountCreated = false;
    try {
      let credential;

      if (register) {
        try {
          credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
          accountCreated = true;
        } catch (error) {
          // A previous attempt may have created the Auth account before its
          // Firestore profile was saved. Sign in and safely resume that setup.
          if (firebaseErrorCode(error) !== "auth/email-already-in-use") {
            throw error;
          }
          credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
        }

        step = "profile";
        if (accountCreated) {
          await updateProfile(credential.user, { displayName: name.trim() });
        }
      } else {
        credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      }

      step = "profile";
      const profileRef = doc(db, "users", credential.user.uid);
      const profileSnapshot = await getDoc(profileRef);

      // Recover accounts left half-created by an interrupted previous signup.
      // Never overwrite an existing role or review status.
      if (!profileSnapshot.exists()) {
        const profileRole = register ? role : "customer";
        const profileName = (accountCreated ? name.trim() : credential.user.displayName?.trim())
          || normalizedEmail.split("@")[0];

        await setDoc(profileRef, {
          uid: credential.user.uid,
          name: profileName,
          email: credential.user.email || normalizedEmail,
          role: profileRole,
          ...(profileRole === "seller" ? { sellerStatus: "pending" } : {}),
          createdAt: serverTimestamp()
        });
      }

      router.replace("/");
    } catch (error) {
      const code = firebaseErrorCode(error);
      const title = step === "profile"
        ? accountCreated ? "Account created; profile setup incomplete" : "Signed in; profile setup incomplete"
        : "Account problem";
      const detail = accountErrorMessage(code, step);
      const suffix = code ? `\\n\\nError code: ${code}` : "";
      Alert.alert(title, detail + suffix);
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      Alert.alert("Email required", "Enter your email address first.");
      return;
    }
    if (!firebaseConfigured) {
      Alert.alert("Setup required", "Firebase configuration has not been added yet.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
      Alert.alert("Check your email", "If an account exists for this address, Firebase will send password-reset instructions.");
    } catch (error) {
      const code = firebaseErrorCode(error);
      Alert.alert("Could not send email", accountErrorMessage(code, "authentication") + (code ? `\\n\\nError code: ${code}` : ""));
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.card}>
        <Text style={styles.heading}>{register ? "Join ZimMarket" : "Welcome back"}</Text>
        <Text style={styles.sub}>{register ? "Create a customer or seller account." : "Sign in to your marketplace account."}</Text>
        {register && <TextInput accessibilityLabel="Your name" style={styles.input} placeholder="Full name" value={name} onChangeText={setName} />}
        <TextInput accessibilityLabel="Email address" style={styles.input} placeholder="Email address" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <TextInput accessibilityLabel="Password" style={styles.input} placeholder="Password (at least 6 characters)" secureTextEntry value={password} onChangeText={setPassword} />
        {register && <View style={styles.roles}>
          <Pressable onPress={() => setRole("customer")} style={[styles.role, role === "customer" && styles.selected]}><Text style={role === "customer" ? styles.selectedText : styles.roleText}>Customer</Text></Pressable>
          <Pressable onPress={() => setRole("seller")} style={[styles.role, role === "seller" && styles.selected]}><Text style={role === "seller" ? styles.selectedText : styles.roleText}>Seller</Text></Pressable>
        </View>}
        <Pressable disabled={busy} onPress={() => void submit()} style={[styles.button, busy && { opacity: 0.6 }]}><Text style={styles.buttonText}>{busy ? "Please wait…" : register ? "Create account" : "Sign in"}</Text></Pressable>
        {!register && <Pressable onPress={() => void resetPassword()} style={styles.switch}><Text style={styles.switchText}>Forgot password?</Text></Pressable>}
        <Pressable onPress={() => setRegister(!register)} style={styles.switch}><Text style={styles.switchText}>{register ? "Already registered? Sign in" : "New to ZimMarket? Create an account"}</Text></Pressable>
        <Text style={styles.note}>Seller listings remain pending until approved by an administrator. Never share your password or payment PIN.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F7FB", padding: 16, justifyContent: "center" },
  card: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 22, borderColor: "#E4EAF2", borderWidth: 1 },
  heading: { color: "#0B1F3A", fontSize: 25, fontWeight: "800" },
  sub: { color: "#607086", marginTop: 8, marginBottom: 20, lineHeight: 20 },
  input: { borderWidth: 1, borderColor: "#D7E0EC", borderRadius: 12, padding: 13, marginBottom: 12, color: "#0B1F3A", backgroundColor: "#FFFFFF" },
  roles: { flexDirection: "row", gap: 10, marginBottom: 14 },
  role: { borderRadius: 10, borderWidth: 1, borderColor: "#D7E0EC", padding: 12, flex: 1, alignItems: "center" },
  selected: { backgroundColor: "#0B1F3A", borderColor: "#0B1F3A" },
  roleText: { color: "#0B1F3A", fontWeight: "700" },
  selectedText: { color: "#FFFFFF", fontWeight: "700" },
  button: { backgroundColor: "#1769E0", padding: 15, borderRadius: 12, alignItems: "center", marginTop: 4 },
  buttonText: { color: "#FFFFFF", fontWeight: "800" },
  switch: { padding: 12, alignItems: "center" },
  switchText: { color: "#1769E0", fontWeight: "700", textAlign: "center" },
  note: { color: "#607086", fontSize: 12, lineHeight: 18, marginTop: 8 }
});

import { useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, updateProfile, type UserCredential } from "firebase/auth";
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
      return "Firebase signed you in, but Firestore refused to save your ZimMarket profile. Your live database rules need to be checked; do not loosen them blindly.";
    }
    if (code === "unavailable" || code === "auth/network-request-failed") {
      return "Your login may already exist, but the profile could not be saved because the database or network was unavailable. Sign in again with the same details to resume setup.";
    }
    return "Firebase signed you in, but ZimMarket could not finish saving your profile. The diagnostic code below will help identify the cause.";
  }

  const messages: Record<string, string> = {
    "auth/invalid-email": "Enter a valid email address.",
    "auth/weak-password": "Choose a password with at least 6 characters.",
    "auth/operation-not-allowed": "Email/password registration is disabled in this Firebase project. The provider must be enabled.",
    "auth/unauthorized-domain": "Firebase rejected this website's hostname. The exact hostname must be added to Firebase Authentication's authorised domains.",
    "auth/network-request-failed": "The connection to Firebase failed. Check your internet connection and try again.",
    "auth/invalid-credential": "The email or password is incorrect. If you already registered, use Sign in or reset your password.",
    "auth/email-already-in-use": "This email already has an account. Switch to Sign in and use the same password.",
    "auth/user-disabled": "This account has been disabled. Contact the project administrator.",
    "auth/too-many-requests": "Firebase temporarily blocked requests from this device. Wait before trying again.",
    "auth/invalid-api-key": "The Firebase web API key is invalid. The app configuration must be checked against the ZimMarket Live web app.",
    "auth/app-not-authorized": "Firebase rejected this app's configuration or website origin. The Firebase app settings need to be checked.",
    "auth/web-storage-unsupported": "This browser is blocking the storage Firebase needs to keep you signed in. Try opening the site in Chrome with cookies and site storage enabled."
  };
  return messages[code] || "Firebase could not complete the account request. The diagnostic code below identifies the next thing to check.";
}

type Feedback = { title: string; message: string; code?: string };

export default function LoginScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"customer" | "seller">("customer");
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function submit() {
    setFeedback(null);
    if (!firebaseConfigured) {
      setFeedback({ title: "Firebase setup required", message: "The Firebase client configuration is incomplete in this build." });
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || password.length < 6) {
      setFeedback({ title: "Check your details", message: "Enter a valid email address and a password of at least 6 characters." });
      return;
    }
    if (register && !name.trim()) {
      setFeedback({ title: "Name required", message: "Enter your name to create an account." });
      return;
    }

    setBusy(true);
    let step: "authentication" | "profile" = "authentication";
    let accountCreated = false;
    try {
      let credential: UserCredential;

      if (register) {
        try {
          credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
          accountCreated = true;
        } catch (error) {
          // Recover a prior attempt that created the Auth account but did not
          // finish writing its Firestore profile. Never create a second user.
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

      // Recover half-created accounts without overwriting any existing role
      // or review status. Public registration can never create an admin.
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
      setFeedback({
        title,
        message: accountErrorMessage(code, step),
        ...(code ? { code } : {})
      });
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    setFeedback(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setFeedback({ title: "Email required", message: "Enter your email address first." });
      return;
    }
    if (!firebaseConfigured) {
      setFeedback({ title: "Firebase setup required", message: "The Firebase client configuration is incomplete in this build." });
      return;
    }
    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
      setFeedback({ title: "Check your email", message: "If an account exists for this address, Firebase will send password-reset instructions." });
    } catch (error) {
      const code = firebaseErrorCode(error);
      setFeedback({
        title: "Could not send reset email",
        message: accountErrorMessage(code, "authentication"),
        ...(code ? { code } : {})
      });
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
        <Pressable onPress={() => { setRegister(!register); setFeedback(null); }} style={styles.switch}><Text style={styles.switchText}>{register ? "Already registered? Sign in" : "New to ZimMarket? Create an account"}</Text></Pressable>
        {feedback && (
          <View accessibilityRole="alert" style={styles.feedback}>
            <Text style={styles.feedbackTitle}>{feedback.title}</Text>
            <Text style={styles.feedbackText}>{feedback.message}</Text>
            {feedback.code ? <Text selectable style={styles.feedbackCode}>Firebase error code: {feedback.code}</Text> : null}
          </View>
        )}
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
  feedback: { backgroundColor: "#FFF3E8", borderColor: "#E6A15B", borderWidth: 1, borderRadius: 12, padding: 13, marginTop: 12 },
  feedbackTitle: { color: "#7A3D0B", fontWeight: "800", marginBottom: 5 },
  feedbackText: { color: "#55351B", lineHeight: 20 },
  feedbackCode: { color: "#55351B", fontWeight: "700", marginTop: 8 },
  note: { color: "#607086", fontSize: 12, lineHeight: 18, marginTop: 8 }
});

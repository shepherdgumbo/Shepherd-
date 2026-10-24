import { useState } from "react";
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, firebaseConfigured } from "../src/firebase";

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
    if (!email.trim() || password.length < 6) {
      Alert.alert("Check details", "Enter a valid email and a password of at least 6 characters.");
      return;
    }
    if (register && !name.trim()) {
      Alert.alert("Name required", "Enter your name to create an account.");
      return;
    }
    setBusy(true);
    try {
      if (register) {
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(credential.user, { displayName: name.trim() });
        await setDoc(doc(db, "users", credential.user.uid), {
          uid: credential.user.uid,
          name: name.trim(),
          email: email.trim(),
          role,
          ...(role === "seller" ? { sellerStatus: "pending" } : {}),
          createdAt: serverTimestamp()
        });
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      router.replace("/");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please try again.";
      Alert.alert("Account problem", message.replace("Firebase: ", ""));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!email.trim()) {
      Alert.alert("Email required", "Enter your email address first.");
      return;
    }
    if (!firebaseConfigured) {
      Alert.alert("Setup required", "Firebase configuration has not been added yet.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert("Check your email", "If an account exists for this address, Firebase will send password-reset instructions.");
    } catch {
      Alert.alert("Could not send email", "Check the address and Firebase email/password settings, then try again.");
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
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, firebaseConfigured } from "../src/firebase";

type Profile = { name?: string; email?: string; role?: string; sellerStatus?: string };

export default function AccountScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, async (current) => {
    setUser(current);
    setProfile(null);
    if (current && firebaseConfigured) {
      try {
        const snapshot = await getDoc(doc(db, "users", current.uid));
        if (snapshot.exists()) setProfile(snapshot.data() as Profile);
      } catch {
        // Keep account access usable even if profile lookup fails.
      }
    }
    setLoading(false);
  }), []);

  async function logout() {
    try {
      await signOut(auth);
      router.replace("/");
    } catch {
      Alert.alert("Sign out failed", "Please check your connection and try again.");
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <Text style={styles.kicker}>YOUR ZIMMARKET</Text>
        <Text style={styles.heading}>Account</Text>
        {loading && <ActivityIndicator style={{ marginTop: 26 }} size="large" color="#1769E0" />}
        {!loading && !user && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome to ZimMarket</Text>
            <Text style={styles.body}>Sign in to manage your account or create an account to start buying and selling.</Text>
            <Pressable accessibilityRole="button" style={styles.primary} onPress={() => router.push("/login")}><Text style={styles.primaryText}>Sign in / Create account</Text></Pressable>
          </View>
        )}
        {!loading && !!user && (
          <View style={styles.card}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{(profile?.name || user.displayName || user.email || "Z").slice(0, 1).toUpperCase()}</Text></View>
            <Text style={styles.cardTitle}>{profile?.name || user.displayName || "ZimMarket member"}</Text>
            <Text style={styles.body}>{user.email || "Email not available"}</Text>
            <View style={styles.rolePill}><Text style={styles.roleText}>{profile?.role ? profile.role.toUpperCase() : "ACCOUNT"}</Text></View>
            {profile?.role === "seller" && <Text style={styles.sellerStatus}>
              {profile.sellerStatus === "approved" ? "Seller status: approved" : profile.sellerStatus === "rejected" ? "Seller status: not approved. Contact support if you think this is a mistake." : "Seller status: waiting for administrator approval. Product publishing is unavailable until approved."}
            </Text>}
            {(profile?.role === "seller") && <Pressable accessibilityRole="button" style={styles.secondary} onPress={() => router.push("/my-listings")}><Text style={styles.secondaryText}>View my listings</Text></Pressable>}
            {(profile?.role === "admin") && <Pressable accessibilityRole="button" style={styles.secondary} onPress={() => router.push("/admin")}><Text style={styles.secondaryText}>Review pending listings</Text></Pressable>}
            <Pressable accessibilityRole="button" style={styles.primary} onPress={() => router.push("/sell")}><Text style={styles.primaryText}>Submit a product</Text></Pressable>
            <Pressable accessibilityRole="button" style={styles.logout} onPress={() => void logout()}><Text style={styles.logoutText}>Sign out</Text></Pressable>
          </View>
        )}
        <Text style={styles.footnote}>Keep your password and payment PIN private. Seller listings remain pending until they are approved.</Text>
        <Pressable accessibilityRole="button" style={styles.back} onPress={() => router.replace("/")}><Text style={styles.backText}>← Back to marketplace</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F7FB" },
  content: { padding: 20, paddingTop: 28 },
  kicker: { color: "#1769E0", fontSize: 11, fontWeight: "900", letterSpacing: 1.3 },
  heading: { color: "#0B1F3A", fontSize: 30, fontWeight: "900", marginTop: 5, marginBottom: 20 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 1, borderColor: "#E1E8F1", padding: 20 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#E3EEFF", alignItems: "center", justifyContent: "center", marginBottom: 15 },
  avatarText: { color: "#1769E0", fontSize: 24, fontWeight: "900" },
  cardTitle: { color: "#0B1F3A", fontSize: 20, fontWeight: "900", marginBottom: 7 },
  body: { color: "#526277", lineHeight: 21 },
  rolePill: { alignSelf: "flex-start", backgroundColor: "#EAF2FF", borderRadius: 99, paddingVertical: 6, paddingHorizontal: 10, marginTop: 13, marginBottom: 10 },
  roleText: { color: "#1769E0", fontSize: 11, fontWeight: "900" },
  sellerStatus: { color: "#526277", fontSize: 12, lineHeight: 18, marginTop: 4 },
  primary: { marginTop: 12, backgroundColor: "#1769E0", alignItems: "center", padding: 14, borderRadius: 12 },
  primaryText: { color: "#FFFFFF", fontWeight: "900" },
  secondary: { backgroundColor: "#EAF2FF", alignItems: "center", padding: 13, borderRadius: 12, marginTop: 8 },
  secondaryText: { color: "#0B1F3A", fontWeight: "800" },
  logout: { alignItems: "center", padding: 12, marginTop: 8 },
  logoutText: { color: "#B42318", fontWeight: "800" },
  footnote: { color: "#69788B", fontSize: 12, lineHeight: 18, marginTop: 18 },
  back: { marginTop: 22, paddingVertical: 10 },
  backText: { color: "#1769E0", fontWeight: "800" }
});
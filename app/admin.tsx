import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { auth, db, firebaseConfigured } from "../src/firebase";

type PendingListing = {
  id: string;
  title?: string;
  name?: string;
  n?: string;
  price?: number | string;
  p?: number | string;
  currency?: string;
  category?: string;
  c?: string;
  sellerId?: string;
  status?: string;
};

export default function AdminScreen() {
  const router = useRouter();
  const [access, setAccess] = useState<"checking" | "admin" | "denied" | "guest">("checking");
  const [listings, setListings] = useState<PendingListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const loadPending = useCallback(async () => {
    if (!firebaseConfigured) {
      setError("Firebase configuration is unavailable.");
      setLoading(false);
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      setAccess("guest");
      setLoading(false);
      return;
    }
    try {
      const profile = await getDoc(doc(db, "users", user.uid));
      if (!profile.exists() || profile.data().role !== "admin") {
        setAccess("denied");
        setListings([]);
        setLoading(false);
        return;
      }
      setAccess("admin");
      const snapshot = await getDocs(query(collection(db, "products"), where("status", "==", "pending")));
      setListings(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as PendingListing)));
      setError("");
    } catch {
      setError("Could not load pending listings. Confirm that Firestore rules allow approved administrators to review products.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setAccess("guest");
        setLoading(false);
        setListings([]);
        return;
      }
      setLoading(true);
      void loadPending();
    });
    return unsubscribe;
  }, [loadPending]);

  async function setStatus(item: PendingListing, status: "approved" | "rejected") {
    const user = auth.currentUser;
    if (!user || access !== "admin") {
      Alert.alert("Administrator access required", "Only an administrator can review product listings.");
      return;
    }
    setBusyId(item.id);
    try {
      await updateDoc(doc(db, "products", item.id), {
        status,
        updatedAt: serverTimestamp(),
        reviewedAt: serverTimestamp(),
        reviewedBy: user.uid
      });
      setListings((current) => current.filter((listing) => listing.id !== item.id));
      Alert.alert(status === "approved" ? "Listing approved" : "Listing rejected", status === "approved" ? "The product can now appear in the marketplace, subject to Firestore read rules." : "The product remains hidden from public approved listings.");
    } catch {
      Alert.alert("Review failed", "The update was rejected. Check that your account is an administrator and the Firestore rules enforce admin-only review.");
    } finally {
      setBusyId("");
    }
  }

  function confirmReview(item: PendingListing, status: "approved" | "rejected") {
    const label = item.title || item.name || item.n || "this listing";
    Alert.alert(status === "approved" ? "Approve listing?" : "Reject listing?", label, [
      { text: "Cancel", style: "cancel" },
      { text: status === "approved" ? "Approve" : "Reject", style: status === "rejected" ? "destructive" : "default", onPress: () => void setStatus(item, status) }
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>← Account</Text></Pressable>
        <Text style={styles.kicker}>ZIMMARKET OPERATIONS</Text>
        <Text style={styles.heading}>Listing review</Text>
        <Text style={styles.sub}>Review new seller listings before they are made public.</Text>
        {loading && <ActivityIndicator style={{ marginTop: 24 }} size="large" color="#1769E0" />}
        {!loading && access === "guest" && <View style={styles.empty}><Text style={styles.title}>Sign in required</Text><Text style={styles.body}>Sign in with your administrator account to review listings.</Text><Pressable style={styles.primary} onPress={() => router.push("/login")}><Text style={styles.primaryText}>Sign in</Text></Pressable></View>}
        {!loading && access === "denied" && <View style={styles.empty}><Text style={styles.title}>Administrator access only</Text><Text style={styles.body}>This account is not marked as an administrator in the users collection.</Text></View>}
        {!!error && <View style={styles.empty}><Text style={styles.body}>{error}</Text><Pressable style={styles.secondary} onPress={() => { setLoading(true); void loadPending(); }}><Text style={styles.secondaryText}>Try again</Text></Pressable></View>}
        {!loading && access === "admin" && !error && listings.length === 0 && <View style={styles.empty}><Text style={styles.title}>Nothing waiting for review</Text><Text style={styles.body}>When sellers submit new listings, they will appear here as pending.</Text></View>}
        {access === "admin" && listings.map((item) => (
          <View key={item.id} style={styles.listing}>
            <Text style={styles.title}>{item.title || item.name || item.n || "Untitled listing"}</Text>
            <Text style={styles.meta}>{item.category || item.c || "Uncategorised"} · {item.price === undefined && item.p === undefined ? "Price not provided" : `${item.currency || "USD"} ${item.price ?? item.p}`}</Text>
            <Text style={styles.pending}>PENDING REVIEW</Text>
            <View style={styles.actions}>
              <Pressable accessibilityRole="button" disabled={busyId === item.id} style={[styles.approve, busyId === item.id && styles.disabled]} onPress={() => confirmReview(item, "approved")}><Text style={styles.actionText}>Approve</Text></Pressable>
              <Pressable accessibilityRole="button" disabled={busyId === item.id} style={[styles.reject, busyId === item.id && styles.disabled]} onPress={() => confirmReview(item, "rejected")}><Text style={styles.rejectText}>Reject</Text></Pressable>
            </View>
          </View>
        ))}
        <Text style={styles.footnote}>Security note: this screen checks the account role for usability. Firestore rules must independently enforce that only administrators can approve or reject listings.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F7FB" },
  content: { padding: 18, paddingBottom: 36 },
  back: { paddingVertical: 10, alignSelf: "flex-start" },
  backText: { color: "#1769E0", fontWeight: "800" },
  kicker: { color: "#1769E0", fontSize: 11, fontWeight: "900", letterSpacing: 1.2, marginTop: 10 },
  heading: { fontSize: 29, color: "#0B1F3A", fontWeight: "900", marginTop: 4 },
  sub: { color: "#526277", lineHeight: 21, marginTop: 8, marginBottom: 16 },
  listing: { backgroundColor: "#FFFFFF", borderRadius: 16, borderColor: "#E1E8F1", borderWidth: 1, padding: 15, marginBottom: 12 },
  title: { color: "#0B1F3A", fontSize: 16, fontWeight: "900" },
  meta: { color: "#526277", fontSize: 12, marginTop: 7 },
  pending: { color: "#755000", fontWeight: "900", fontSize: 10, marginTop: 12 },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  approve: { backgroundColor: "#1769E0", flex: 1, alignItems: "center", padding: 12, borderRadius: 10 },
  actionText: { color: "#FFFFFF", fontWeight: "900" },
  reject: { backgroundColor: "#FDE8E7", flex: 1, alignItems: "center", padding: 12, borderRadius: 10 },
  rejectText: { color: "#B42318", fontWeight: "900" },
  disabled: { opacity: 0.5 },
  empty: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 18, marginTop: 14 },
  body: { color: "#526277", lineHeight: 21, marginTop: 5 },
  primary: { backgroundColor: "#1769E0", alignSelf: "flex-start", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20, marginTop: 14 },
  primaryText: { color: "#FFFFFF", fontWeight: "800" },
  secondary: { backgroundColor: "#EAF2FF", alignSelf: "flex-start", borderRadius: 10, padding: 12, marginTop: 12 },
  secondaryText: { color: "#1769E0", fontWeight: "800" },
  footnote: { color: "#69788B", fontSize: 12, lineHeight: 18, marginTop: 20 }
});
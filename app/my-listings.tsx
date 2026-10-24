import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db, firebaseConfigured } from "../src/firebase";

type Listing = {
  id: string;
  title?: string;
  name?: string;
  status?: string;
  price?: string | number;
  currency?: string;
  category?: string;
};

export default function MyListingsScreen() {
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!active) return;
      if (!user) {
        setListings([]);
        setError("Sign in to see your listings.");
        setLoading(false);
        return;
      }
      if (!firebaseConfigured) {
        setError("Firebase app configuration is required.");
        setLoading(false);
        return;
      }
      try {
        setError("");
        const snapshot = await getDocs(query(collection(db, "products"), where("sellerId", "==", user.uid)));
        if (!active) return;
        setListings(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Listing)));
      } catch {
        if (active) setError("We couldn't load your listings. Check your connection and Firestore rules.");
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  const statusLabel = (status?: string) => {
    const normalized = (status || "pending").toLowerCase();
    if (normalized === "approved") return "APPROVED";
    if (normalized === "rejected") return "REJECTED";
    if (normalized === "pending") return "PENDING REVIEW";
    return normalized.replace(/[_-]/g, " ").toUpperCase();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable style={styles.back} onPress={() => router.back()}><Text style={styles.backText}>← Account</Text></Pressable>
        <Text style={styles.kicker}>SELLER WORKSPACE</Text>
        <Text style={styles.heading}>My listings</Text>
        <Text style={styles.sub}>Track each product’s review status. Only approved listings appear in the public marketplace.</Text>
        <Pressable style={styles.primary} onPress={() => router.push("/sell")}><Text style={styles.primaryText}>＋ Submit a product</Text></Pressable>
        {loading && <ActivityIndicator style={{ marginTop: 24 }} size="large" color="#1769E0" />}
        {!!error && <View style={styles.empty}><Text style={styles.emptyTitle}>{error}</Text>{error.includes("Sign in") && <Pressable onPress={() => router.push("/login")} style={styles.secondary}><Text style={styles.secondaryText}>Sign in</Text></Pressable>}</View>}
        {!loading && !error && listings.length === 0 && <View style={styles.empty}><Text style={styles.emptyTitle}>No listings yet</Text><Text style={styles.body}>Your submitted products will appear here, including those waiting for administrator review.</Text></View>}
        {listings.map((item) => (
          <View key={item.id} style={styles.listing}>
            <View style={styles.listingTop}>
              <Text style={styles.title}>{item.title || item.name || "Untitled listing"}</Text>
              <View style={[styles.status, item.status === "approved" ? styles.approved : item.status === "rejected" ? styles.rejected : styles.pending]}><Text style={styles.statusText}>{statusLabel(item.status)}</Text></View>
            </View>
            <Text style={styles.meta}>{item.category || "Uncategorised"} · {item.price === undefined || item.price === null || item.price === "" ? "Price not provided" : `${item.currency || "USD"} ${item.price}`}</Text>
            {item.status === "pending" && <Text style={styles.hint}>Awaiting administrator approval.</Text>}
          </View>
        ))}
        <Text style={styles.footnote}>Review status shown here is read from the database. The app does not let sellers approve their own listings.</Text>
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
  primary: { alignSelf: "flex-start", backgroundColor: "#1769E0", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, marginBottom: 18 },
  primaryText: { color: "#FFFFFF", fontWeight: "900" },
  listing: { backgroundColor: "#FFFFFF", borderRadius: 16, borderColor: "#E1E8F1", borderWidth: 1, padding: 15, marginBottom: 11 },
  listingTop: { gap: 9 },
  title: { color: "#0B1F3A", fontSize: 16, fontWeight: "900" },
  status: { alignSelf: "flex-start", paddingVertical: 5, paddingHorizontal: 9, borderRadius: 99 },
  statusText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.4 },
  approved: { backgroundColor: "#DDF8E8" },
  rejected: { backgroundColor: "#FDE8E7" },
  pending: { backgroundColor: "#FFF0C2" },
  meta: { color: "#526277", fontSize: 12, marginTop: 10 },
  hint: { color: "#755000", fontSize: 12, marginTop: 8 },
  empty: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 18, marginTop: 14 },
  emptyTitle: { color: "#0B1F3A", fontWeight: "800", marginBottom: 6, lineHeight: 21 },
  body: { color: "#526277", lineHeight: 21 },
  secondary: { alignSelf: "flex-start", marginTop: 12, backgroundColor: "#EAF2FF", borderRadius: 10, padding: 12 },
  secondaryText: { color: "#0B1F3A", fontWeight: "800" },
  footnote: { color: "#69788B", fontSize: 12, lineHeight: 18, marginTop: 18 }
});
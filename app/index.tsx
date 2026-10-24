import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db, firebaseConfigured } from "../src/firebase";

type Product = {
  id: string;
  title?: string;
  description?: string;
  price?: number | string;
  currency?: string;
  category?: string;
  imageUrl?: string;
  status?: string;
};

const navy = "#0B1F3A";
const blue = "#1769E0";

export default function HomeScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadProducts = useCallback(async () => {
    if (!firebaseConfigured) {
      setError("Marketplace setup is incomplete. Firebase app configuration must be added before listings can load.");
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      setError("");
      const listingQuery = query(collection(db, "products"), where("status", "==", "approved"));
      const snapshot = await getDocs(listingQuery);
      const rows = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(rows);
    } catch {
      setError("We couldn't load listings. Check your connection or try again later.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void loadProducts(); }, [loadProducts]);

  const money = (item: Product) => {
    if (item.price === undefined || item.price === null || item.price === "") return "Price not provided";
    return `${item.currency || "USD"} ${item.price}`;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.columns}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadProducts(); }} />}
        ListHeaderComponent={
          <View>
            <View style={styles.hero}>
              <Text style={styles.brand}>ZimMarket</Text>
              <Text style={styles.tagline}>Buy and sell in Zimbabwe.</Text>
              <Text style={styles.copy}>Discover local products from sellers whose listings have been approved.</Text>
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" style={styles.primary} onPress={() => router.push("/sell")}><Text style={styles.primaryText}>Start selling</Text></Pressable>
                <Pressable accessibilityRole="button" style={styles.secondary} onPress={() => router.push("/login")}><Text style={styles.secondaryText}>Sign in</Text></Pressable>
              </View>
            </View>
            <Text style={styles.section}>Explore marketplace</Text>
            {!firebaseConfigured && <Text style={styles.notice}>Firebase configuration is required to connect the live marketplace.</Text>}
            {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
            {loading && <ActivityIndicator style={{ marginVertical: 24 }} size="large" color={blue} />}
            {!loading && !error && firebaseConfigured && products.length === 0 && (
              <View style={styles.empty}><Text style={styles.emptyTitle}>No approved listings yet</Text><Text style={styles.muted}>New products appear here after an administrator approves them.</Text></View>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.product}>
            <View style={styles.productPlaceholder}><Text style={styles.productEmoji}>🛍️</Text></View>
            <Text numberOfLines={2} style={styles.productTitle}>{item.title || "Untitled listing"}</Text>
            <Text style={styles.price}>{money(item)}</Text>
            {!!item.category && <Text style={styles.category}>{item.category}</Text>}
          </View>
        )}
        ListFooterComponent={<Text style={styles.footer}>ZimMarket is an independent marketplace. Verify products and sellers before paying. Payment methods are subject to availability and seller confirmation.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F7FB" },
  content: { padding: 16, paddingBottom: 32 },
  hero: { backgroundColor: navy, borderRadius: 22, padding: 22, marginBottom: 24 },
  brand: { color: "#FFFFFF", fontSize: 29, fontWeight: "800", letterSpacing: -0.5 },
  tagline: { color: "#D9E8FF", fontSize: 18, fontWeight: "700", marginTop: 12 },
  copy: { color: "#D9E2EF", fontSize: 14, lineHeight: 21, marginTop: 8 },
  actions: { flexDirection: "row", gap: 10, marginTop: 20, flexWrap: "wrap" },
  primary: { backgroundColor: "#4F9BFF", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 },
  primaryText: { color: "#07172D", fontWeight: "800" },
  secondary: { borderColor: "#8EACD4", borderWidth: 1, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 },
  secondaryText: { color: "#FFFFFF", fontWeight: "700" },
  section: { color: navy, fontSize: 20, fontWeight: "800", marginBottom: 12 },
  columns: { gap: 12, marginBottom: 12 },
  product: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 12, flex: 1, borderWidth: 1, borderColor: "#E4EAF2" },
  productPlaceholder: { height: 100, backgroundColor: "#EAF2FF", borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  productEmoji: { fontSize: 34 },
  productTitle: { color: navy, fontWeight: "700", minHeight: 38 },
  price: { color: blue, fontWeight: "800", marginTop: 8 },
  category: { color: "#607086", fontSize: 12, marginTop: 5 },
  notice: { backgroundColor: "#FFF4D7", color: "#754B00", padding: 12, borderRadius: 10, marginBottom: 12, lineHeight: 19 },
  error: { color: "#A32626", backgroundColor: "#FDECEC", padding: 12, borderRadius: 10, marginBottom: 12 },
  empty: { padding: 18, backgroundColor: "#FFFFFF", borderRadius: 14, marginBottom: 16 },
  emptyTitle: { color: navy, fontWeight: "800", fontSize: 16, marginBottom: 6 },
  muted: { color: "#607086", lineHeight: 20 },
  footer: { color: "#607086", fontSize: 12, lineHeight: 18, marginTop: 20, paddingHorizontal: 2 },
});
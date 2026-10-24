import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, Pressable, RefreshControl, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { db, firebaseConfigured } from "../src/firebase";
import { getSavedProductIds, toggleSavedProduct, writeSavedProductIds } from "../src/saved";

type SavedProduct = {
  id: string;
  title: string;
  price: string;
  category: string;
  imageUrl: string;
  sellerName: string;
  city: string;
};

export default function SavedProductsScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<SavedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadSaved = useCallback(async () => {
    setError("");
    if (!firebaseConfigured) {
      setProducts([]);
      setError("Firebase configuration is required to load current product details.");
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const ids = await getSavedProductIds();
      if (!ids.length) {
        setProducts([]);
        return;
      }

      // Read only items the customer saved, and still require public approval.
      const snapshots = await Promise.all(ids.map(async (id) => {
        try {
          const snapshot = await getDoc(doc(db, "products", id));
          if (!snapshot.exists()) return { type: "unavailable" as const, id };
          const data = snapshot.data();
          if (data.status !== "approved") return { type: "unavailable" as const, id };
          const rawPrice = data.price ?? data.p;
          const hasPrice = rawPrice !== undefined && rawPrice !== null && rawPrice !== "";
          const product = {
            id,
            title: String(data.title ?? data.n ?? data.name ?? "Untitled listing"),
            price: hasPrice ? `${String(data.currency ?? data.currencyCode ?? "USD")} ${String(rawPrice)}` : "Price not provided",
            category: String(data.category ?? data.c ?? ""),
            imageUrl: String(data.imageUrl ?? data.imageURL ?? data.image ?? data.i ?? data.images?.[0] ?? ""),
            sellerName: String(data.sellerName ?? data.s ?? ""),
            city: String(data.city ?? "")
          } as SavedProduct;
          return { type: "ok" as const, product };
        } catch {
          // Keep the saved ID if a transient network/rules error prevents a read.
          return { type: "failed" as const, id };
        }
      }));
      const available = snapshots.flatMap((item) => item.type === "ok" ? [item.product] : []);
      const availableIds = available.map((item) => item.id);
      const failedIds = snapshots.filter((item) => item.type === "failed").map((item) => item.id);
      setProducts(available);
      if (failedIds.length > 0) {
        const retainedIds = ids.filter((id) => availableIds.includes(id) || failedIds.includes(id));
        await writeSavedProductIds(retainedIds);
        setError("Some saved item details could not be refreshed. Your saved items were kept; pull down to retry.");
      } else if (availableIds.length !== ids.length) {
        await writeSavedProductIds(availableIds);
        setError("Unavailable or no-longer-approved listings were removed from your saved items.");
      }
    } catch {
      setError("We couldn't load your saved items. Please try again.");
      setProducts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void loadSaved(); }, [loadSaved]);

  async function removeSaved(id: string) {
    try {
      await toggleSavedProduct(id);
      setProducts((current) => current.filter((item) => item.id !== id));
    } catch {
      Alert.alert("Could not update saved items", "Please try again.");
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadSaved(); }} />}
        ListHeaderComponent={
          <View>
            <Pressable accessibilityRole="button" style={styles.back} onPress={() => router.replace("/")}><Text style={styles.backText}>← Marketplace</Text></Pressable>
            <Text style={styles.kicker}>YOUR SHORTLIST</Text>
            <Text style={styles.heading}>Saved items</Text>
            <Text style={styles.subtitle}>Keep products you want to compare or come back to. Saved items are stored on this device and are not synced to other devices.</Text>
            {!!error && <Text accessibilityRole="alert" style={styles.notice}>{error}</Text>}
            {!loading && products.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>♡</Text>
                <Text style={styles.emptyTitle}>Nothing saved yet</Text>
                <Text style={styles.body}>Open an approved product and select “Save for later” to keep it here.</Text>
                <Pressable accessibilityRole="button" style={styles.primary} onPress={() => router.replace("/")}><Text style={styles.primaryText}>Browse marketplace</Text></Pressable>
              </View>
            )}
            {loading && <ActivityIndicator style={{ marginVertical: 28 }} size="large" color="#1769E0" />}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Pressable accessibilityRole="button" accessibilityLabel={`View ${item.title}`} style={styles.productMain} onPress={() => router.push(`/product/${item.id}`)}>
              {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" /> : <View style={[styles.image, styles.imageFallback]}><Text style={styles.bag}>🛍️</Text></View>}
              <View style={styles.productInfo}>
                <Text numberOfLines={2} style={styles.productTitle}>{item.title}</Text>
                <Text style={styles.price}>{item.price}</Text>
                {!!item.category && <Text numberOfLines={1} style={styles.meta}>{item.category}</Text>}
                {!!(item.sellerName || item.city) && <Text numberOfLines={1} style={styles.meta}>{[item.sellerName, item.city].filter(Boolean).join(" · ")}</Text>}
                <Text style={styles.open}>View product →</Text>
              </View>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.title} from saved items`} style={styles.removeButton} onPress={() => void removeSaved(item.id)}><Text style={styles.removeText}>Remove from saved</Text></Pressable>
          </View>
        )}
        ListFooterComponent={<Text style={styles.footnote}>Only listings approved for public display can appear here. Product availability and price may change; confirm details with the seller before paying.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F7FB" },
  content: { padding: 18, paddingBottom: 36 },
  back: { alignSelf: "flex-start", paddingVertical: 8, marginBottom: 14 },
  backText: { color: "#1769E0", fontWeight: "800" },
  kicker: { color: "#1769E0", fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  heading: { color: "#0B1F3A", fontSize: 29, fontWeight: "900", marginTop: 4 },
  subtitle: { color: "#526277", lineHeight: 21, marginTop: 8, marginBottom: 15 },
  notice: { backgroundColor: "#FFF4D7", color: "#754B00", padding: 12, borderRadius: 12, lineHeight: 19, marginBottom: 12 },
  empty: { padding: 22, borderRadius: 18, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E1E8F1", marginTop: 8 },
  emptyIcon: { fontSize: 38, color: "#1769E0", marginBottom: 8 },
  emptyTitle: { color: "#0B1F3A", fontSize: 18, fontWeight: "900", marginBottom: 8 },
  body: { color: "#526277", lineHeight: 21 },
  primary: { backgroundColor: "#1769E0", padding: 14, borderRadius: 12, alignItems: "center", marginTop: 16 },
  primaryText: { color: "#FFFFFF", fontWeight: "900" },
  card: { backgroundColor: "#FFFFFF", borderColor: "#E1E8F1", borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 12 },
  productMain: { flexDirection: "row", gap: 12, alignItems: "center" },
  image: { width: 100, height: 104, borderRadius: 12, backgroundColor: "#EAF2FF" },
  imageFallback: { alignItems: "center", justifyContent: "center" },
  bag: { fontSize: 31 },
  productInfo: { flex: 1 },
  productTitle: { color: "#0B1F3A", fontWeight: "900", lineHeight: 19 },
  price: { color: "#1769E0", fontWeight: "900", marginTop: 6 },
  meta: { color: "#69788B", fontSize: 11, marginTop: 4 },
  open: { color: "#1769E0", fontSize: 12, fontWeight: "800", marginTop: 7 },
  removeButton: { borderTopWidth: 1, borderTopColor: "#E7EDF5", paddingTop: 10, marginTop: 10, alignSelf: "flex-end" },
  removeText: { color: "#B42318", fontSize: 12, fontWeight: "800" },
  footnote: { color: "#69788B", fontSize: 12, lineHeight: 18, marginTop: 12 }
});

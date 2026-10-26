import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db, firebaseConfigured } from "../../src/firebase";

type StoreProduct = {
  id: string;
  title: string;
  description: string;
  price: number | string | undefined;
  currency: string;
  category: string;
  imageUrl: string;
  sellerName: string;
  city: string;
};

function isAutomatedTestListing(item: Pick<StoreProduct, "title" | "description" | "sellerName">) {
  const title = (item.title || "").toLowerCase();
  const description = (item.description || "").toLowerCase();
  const sellerName = (item.sellerName || "").toLowerCase();
  return description.includes("automated zimmarket test listing")
    || (title.includes("robot test") && sellerName.includes("test shop"));
}

export default function SellerStoreScreen() {
  const params = useLocalSearchParams<{ sellerId: string }>();
  const sellerId = Array.isArray(params.sellerId) ? params.sellerId[0] : params.sellerId;
  const router = useRouter();
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      if (!firebaseConfigured) {
        setError("Firebase configuration is required to load this seller's live products.");
        setLoading(false);
        return;
      }
      if (!sellerId) {
        setError("This store link is not valid.");
        setLoading(false);
        return;
      }
      try {
        const result = await getDocs(query(
          collection(db, "products"),
          where("sellerId", "==", sellerId),
          where("status", "==", "approved")
        ));
        if (!active) return;
        const mappedProducts = result.docs.map((item) => {
          const data = item.data();
          return {
            id: item.id,
            title: String(data.title ?? data.n ?? data.name ?? "Untitled listing"),
            description: String(data.description ?? data.d ?? ""),
            price: data.price ?? data.p,
            currency: String(data.currency ?? data.currencyCode ?? "USD"),
            category: String(data.category ?? data.c ?? ""),
            imageUrl: String(data.imageUrl ?? data.imageURL ?? data.image ?? data.i ?? data.images?.[0] ?? ""),
            sellerName: String(data.sellerName ?? data.s ?? ""),
            city: String(data.city ?? "")
          };
        });
        setProducts(mappedProducts.filter((item) => !isAutomatedTestListing(item)));
      } catch {
        if (active) setError("We couldn't load this seller's approved listings. Check your connection and Firestore rules.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [sellerId]);

  const sellerName = products.find((item) => item.sellerName)?.sellerName || "ZimMarket seller";
  const city = products.find((item) => item.city)?.city || "";

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityRole="button" style={styles.back} onPress={() => router.back()}><Text style={styles.backText}>← Back</Text></Pressable>
        <View style={styles.hero}>
          <Text style={styles.kicker}>SELLER STORE</Text>
          <Text style={styles.heading}>{sellerName}</Text>
          {!!city && <Text style={styles.location}>📍 {city}</Text>}
          <Text style={styles.subtitle}>Browse this seller's products approved for public display. Availability, delivery and final pricing should be confirmed directly with the seller.</Text>
          <View style={styles.storeMeta}><Text style={styles.metaStrong}>{loading ? "Loading…" : products.length} approved listing{products.length === 1 ? "" : "s"}</Text><Text style={styles.meta}>No unverified ratings shown</Text></View>
        </View>
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        {loading && <ActivityIndicator style={{ marginTop: 26 }} size="large" color="#1769E0" />}
        {!loading && !error && products.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No approved products available</Text>
            <Text style={styles.body}>This seller currently has no listings approved for public display.</Text>
          </View>
        )}
        <View style={styles.grid}>
          {products.map((item) => (
            <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`View ${item.title}`} style={styles.product} onPress={() => router.push(`/product/${item.id}`)}>
              {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" /> : <View style={[styles.image, styles.placeholder]}><Text style={styles.emoji}>🛍️</Text></View>}
              <Text numberOfLines={2} style={styles.productTitle}>{item.title}</Text>
              <Text style={styles.price}>{item.price === undefined || item.price === null || item.price === "" ? "Price not provided" : `${item.currency} ${item.price}`}</Text>
              {!!item.category && <Text numberOfLines={1} style={styles.meta}>{item.category}</Text>}
              <Text style={styles.link}>View product →</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.safety}><Text style={styles.safetyTitle}>Shop safely</Text><Text style={styles.body}>ZimMarket does not claim that these products are in stock or that delivery is guaranteed. Confirm condition, price, collection or delivery, and payment details before paying.</Text></View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F7FB" },
  content: { padding: 18, paddingBottom: 36 },
  back: { alignSelf: "flex-start", paddingVertical: 9, marginBottom: 10 },
  backText: { color: "#1769E0", fontWeight: "800" },
  hero: { backgroundColor: "#0B1F3A", borderRadius: 20, padding: 20, marginBottom: 18 },
  kicker: { color: "#83B7FF", fontSize: 10, fontWeight: "900", letterSpacing: 1.3 },
  heading: { color: "#FFFFFF", fontSize: 26, lineHeight: 32, fontWeight: "900", marginTop: 8 },
  location: { color: "#D9E2EF", fontSize: 12, marginTop: 8 },
  subtitle: { color: "#D9E2EF", fontSize: 12, lineHeight: 19, marginTop: 12 },
  storeMeta: { borderTopWidth: 1, borderTopColor: "#314862", marginTop: 15, paddingTop: 12, gap: 4 },
  metaStrong: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  meta: { color: "#69788B", fontSize: 11, marginTop: 5 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  product: { width: "48%", backgroundColor: "#FFFFFF", borderRadius: 15, borderWidth: 1, borderColor: "#E1E8F1", padding: 9 },
  image: { height: 120, borderRadius: 11, backgroundColor: "#EAF2FF", marginBottom: 9, width: "100%" },
  placeholder: { alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 32 },
  productTitle: { color: "#0B1F3A", fontSize: 13, lineHeight: 18, fontWeight: "900", minHeight: 36 },
  price: { color: "#1769E0", fontWeight: "900", fontSize: 13, marginTop: 8 },
  link: { color: "#1769E0", fontSize: 11, fontWeight: "900", marginTop: 8 },
  error: { color: "#A32626", backgroundColor: "#FDECEC", borderRadius: 12, padding: 12, lineHeight: 19 },
  empty: { padding: 18, backgroundColor: "#FFFFFF", borderRadius: 15, marginBottom: 16 },
  emptyTitle: { color: "#0B1F3A", fontWeight: "900", fontSize: 16, marginBottom: 6 },
  body: { color: "#526277", lineHeight: 20, fontSize: 12 },
  safety: { backgroundColor: "#FFF4D7", borderRadius: 14, padding: 15, marginTop: 20 },
  safetyTitle: { color: "#754B00", fontWeight: "900", marginBottom: 7 }
});

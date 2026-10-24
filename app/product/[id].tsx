import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { db, firebaseConfigured } from "../../src/firebase";

type Product = {
  title?: string;
  name?: string;
  description?: string;
  price?: number | string;
  currency?: string;
  category?: string;
  imageUrl?: string;
  imageURL?: string;
  image?: string;
  images?: string[];
  sellerName?: string;
  city?: string;
  status?: string;
};

export default function ProductDetailsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      if (!firebaseConfigured) {
        setMessage("Firebase configuration is required to view live product details.");
        setLoading(false);
        return;
      }
      if (!id) {
        setMessage("This product link is not valid.");
        setLoading(false);
        return;
      }
      try {
        const result = await getDoc(doc(db, "products", id));
        if (!active) return;
        if (!result.exists() || result.data().status !== "approved") {
          setMessage("This listing is not available. Listings are displayed after administrator approval.");
        } else {
          const data = result.data();
          setProduct({
            ...data,
            title: data.title ?? data.n ?? data.name,
            description: data.description ?? data.d,
            price: data.price ?? data.p,
            currency: data.currency ?? data.currencyCode ?? "USD",
            category: data.category ?? data.c,
            imageUrl: data.imageUrl ?? data.imageURL ?? data.image ?? data.i,
            sellerName: data.sellerName ?? data.s,
            city: data.city,
          } as Product);
        }
      } catch {
        if (active) setMessage("We couldn't load this product. Check your connection and try again.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [id]);

  const uri = product?.imageUrl || product?.imageURL || product?.image || product?.images?.[0];
  const price = product?.price === undefined || product?.price === null || product?.price === ""
    ? "Price not provided"
    : `${product?.currency || "USD"} ${product.price}`;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>← Back to marketplace</Text></Pressable>
        {loading && <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#1769E0" />}
        {!!message && !loading && <View style={styles.empty}><Text style={styles.title}>Listing unavailable</Text><Text style={styles.body}>{message}</Text><Pressable onPress={() => router.replace("/")} style={styles.button}><Text style={styles.buttonText}>Browse listings</Text></Pressable></View>}
        {!!product && !loading && (
          <>
            {uri ? <Image source={{ uri }} resizeMode="cover" style={styles.image} /> : <View style={styles.imagePlaceholder}><Text style={styles.emoji}>🛍️</Text></View>}
            {!!product.category && <Text style={styles.category}>{product.category}</Text>}
            <Text style={styles.title}>{product.title || product.name || "Untitled listing"}</Text>
            <Text style={styles.price}>{price}</Text>
            {!!(product.sellerName || product.city) && <Text style={styles.seller}>{[product.sellerName, product.city].filter(Boolean).join(" · ")}</Text>}
            <View style={styles.divider} />
            <Text style={styles.section}>Product description</Text>
            <Text style={styles.body}>{product.description?.trim() || "The seller has not provided a description."}</Text>
            <View style={styles.safety}>
              <Text style={styles.safetyTitle}>Shop safely</Text>
              <Text style={styles.body}>Verify the product and seller before paying. Never share your password, PIN, or one-time codes. Payment arrangements must be confirmed directly with the seller; this screen does not process payments.</Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F7FB" },
  content: { padding: 18, paddingBottom: 36 },
  back: { alignSelf: "flex-start", paddingVertical: 10, marginBottom: 10 },
  backText: { color: "#1769E0", fontWeight: "800" },
  image: { width: "100%", height: 280, borderRadius: 18, backgroundColor: "#EAF2FF", marginBottom: 18 },
  imagePlaceholder: { height: 240, borderRadius: 18, backgroundColor: "#EAF2FF", justifyContent: "center", alignItems: "center", marginBottom: 18 },
  emoji: { fontSize: 58 },
  category: { alignSelf: "flex-start", color: "#1769E0", fontWeight: "800", fontSize: 12, backgroundColor: "#E5F0FF", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99, marginBottom: 10 },
  title: { fontSize: 25, lineHeight: 32, fontWeight: "900", color: "#0B1F3A" },
  price: { color: "#1769E0", fontSize: 22, fontWeight: "900", marginTop: 10 },
  seller: { color: "#69788B", fontSize: 13, marginTop: 8 },
  divider: { height: 1, backgroundColor: "#DCE5F0", marginVertical: 22 },
  section: { fontSize: 17, fontWeight: "900", color: "#0B1F3A", marginBottom: 9 },
  body: { fontSize: 14, color: "#526277", lineHeight: 22 },
  safety: { backgroundColor: "#FFF4D7", borderRadius: 14, padding: 15, marginTop: 26 },
  safetyTitle: { color: "#754B00", fontSize: 15, fontWeight: "900", marginBottom: 7 },
  empty: { backgroundColor: "#FFFFFF", padding: 20, borderRadius: 16, marginTop: 20 },
  button: { marginTop: 18, borderRadius: 12, backgroundColor: "#1769E0", alignItems: "center", padding: 13 },
  buttonText: { color: "#FFFFFF", fontWeight: "800" }
});
import { useEffect, useState } from "react";
import { addProductToCart } from "../../src/cart";
import { ActivityIndicator, Alert, Image, Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { getSavedProductIds, toggleSavedProduct } from "../../src/saved";
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
  sellerWhatsApp?: string;
  sellerEmail?: string;
  sellerId?: string;
  status?: string;
};

export default function ProductDetailsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    let active = true;
    void getSavedProductIds().then((ids) => { if (active) setIsSaved(!!id && ids.includes(id)); });
    return () => { active = false; };
  }, [id]);

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
            sellerWhatsApp: data.sellerWhatsApp ?? data.whatsapp ?? data.sellerPhone,
            sellerEmail: data.sellerEmail,
            sellerId: data.sellerId,
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

  async function contactSeller() {
    if (!product) return;
    const phone = (product.sellerWhatsApp || "").replace(/[^0-9]/g, "");
    const title = product.title || product.name || "your product";
    const messageText = `Hi, I'm interested in ${title} on ZimMarket. Is it still available? Please confirm the final price and delivery details.`;
    const email = product.sellerEmail;
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(messageText)}`
      : email
        ? `mailto:${email}?subject=${encodeURIComponent("ZimMarket enquiry: " + title)}&body=${encodeURIComponent(messageText)}`
        : "";
    if (!url) {
      Alert.alert("Contact not provided", "This seller has not provided a public WhatsApp number or email address. Verify details before arranging payment.");
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Could not open contact", "Check that WhatsApp or an email app is available on your device.");
    }
  }

  async function toggleSaved() {
    if (!id) return;
    try {
      const result = await toggleSavedProduct(id);
      setIsSaved(result.saved);
      Alert.alert(result.saved ? "Saved for later" : "Removed from saved items", result.saved ? "You can find this product in your Saved items list on this device." : "This product is no longer in your saved items.");
    } catch {
      Alert.alert("Could not update saved items", "Please try again.");
    }
  }

  async function addToCart() {
    if (!id || !product) return;
    try {
      const count = await addProductToCart(id);
      Alert.alert(
        "Added to cart",
        `This item has been saved to your cart. Your cart now has ${count} item${count === 1 ? "" : "s"}.`,
        [
          { text: "Keep browsing", style: "cancel" },
          { text: "View cart", onPress: () => router.push("/cart") }
        ]
      );
    } catch {
      Alert.alert("Could not update cart", "Please try again.");
    }
  }

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
            <Pressable accessibilityRole="button" style={styles.addButton} onPress={() => void addToCart()}><Text style={styles.addButtonText}>Add to cart</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityState={{ selected: isSaved }} style={styles.savedButton} onPress={() => void toggleSaved()}><Text style={styles.savedButtonText}>{isSaved ? "♥ Saved — remove" : "♡ Save for later"}</Text></Pressable>
            <Pressable accessibilityRole="button" style={styles.contactButton} onPress={() => void contactSeller()}><Text style={styles.contactButtonText}>Contact seller</Text></Pressable>
            {!!(product.sellerName || product.city) && <Text style={styles.seller}>{[product.sellerName, product.city].filter(Boolean).join(" · ")}</Text>}
            {!!product.sellerId && <Pressable accessibilityRole="button" style={styles.storeButton} onPress={() => router.push(`/store/${product.sellerId}`)}><Text style={styles.storeButtonText}>Browse this seller’s store →</Text></Pressable>}
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
  addButton: { backgroundColor: "#1769E0", borderRadius: 12, padding: 15, alignItems: "center", marginTop: 18 },
  addButtonText: { color: "#FFFFFF", fontWeight: "900" },
  savedButton: { borderRadius: 12, borderColor: "#D5E0EF", borderWidth: 1, padding: 13, alignItems: "center", marginTop: 9, backgroundColor: "#FFFFFF" },
  savedButtonText: { color: "#0B1F3A", fontWeight: "800" },
  contactButton: { borderRadius: 12, borderColor: "#1769E0", borderWidth: 1, padding: 14, alignItems: "center", marginTop: 9, backgroundColor: "#FFFFFF" },
  contactButtonText: { color: "#1769E0", fontWeight: "900" },
  storeButton: { alignSelf: "flex-start", paddingVertical: 11, paddingHorizontal: 2 },
  storeButtonText: { color: "#1769E0", fontWeight: "800", fontSize: 12 },
  divider: { height: 1, backgroundColor: "#DCE5F0", marginVertical: 22 },
  section: { fontSize: 17, fontWeight: "900", color: "#0B1F3A", marginBottom: 9 },
  body: { fontSize: 14, color: "#526277", lineHeight: 22 },
  safety: { backgroundColor: "#FFF4D7", borderRadius: 14, padding: 15, marginTop: 26 },
  safetyTitle: { color: "#754B00", fontSize: 15, fontWeight: "900", marginBottom: 7 },
  empty: { backgroundColor: "#FFFFFF", padding: 20, borderRadius: 16, marginTop: 20 },
  button: { marginTop: 18, borderRadius: 12, backgroundColor: "#1769E0", alignItems: "center", padding: 13 },
  buttonText: { color: "#FFFFFF", fontWeight: "800" }
});
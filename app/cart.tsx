import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { db, firebaseConfigured } from "../src/firebase";

const CART_KEY = "zimmarket_cart_v1";
type CartEntry = { productId: string; quantity: number };
type CartItem = {
  productId: string;
  quantity: number;
  title: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  sellerName: string;
  city: string;
  imageUrl: string;
};

const paymentOptions = ["Cash on delivery", "EcoCash", "OneMoney", "Bank transfer", "Discuss with seller"];

export default function CartScreen() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentPreference, setPaymentPreference] = useState(paymentOptions[0]);
  const [busy, setBusy] = useState(false);

  const loadCart = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const raw = await AsyncStorage.getItem(CART_KEY);
      const entries = raw ? JSON.parse(raw) as CartEntry[] : [];
      if (!Array.isArray(entries)) throw new Error("Invalid cart");
      if (!firebaseConfigured && entries.length) {
        setError("Firebase configuration is required to refresh current product details.");
        setItems([]);
        return;
      }
      const liveItems = await Promise.all(entries.map(async (entry) => {
        try {
          const snapshot = await getDoc(doc(db, "products", entry.productId));
          if (!snapshot.exists()) return null;
          const data = snapshot.data();
          if (data.status !== "approved") return null;
          const rawPrice = data.price ?? data.p;
          const price = Number(rawPrice);
          return {
            productId: entry.productId,
            quantity: Math.min(Math.max(Math.trunc(Number(entry.quantity) || 1), 1), 99),
            title: String(data.title ?? data.n ?? data.name ?? "Untitled listing"),
            description: String(data.description ?? data.d ?? ""),
            price: Number.isFinite(price) && price >= 0 ? price : 0,
            currency: String(data.currency ?? data.currencyCode ?? "USD"),
            category: String(data.category ?? data.c ?? ""),
            sellerName: String(data.sellerName ?? data.s ?? ""),
            city: String(data.city ?? ""),
            imageUrl: String(data.imageUrl ?? data.imageURL ?? data.image ?? data.i ?? "")
          } as CartItem;
        } catch {
          return null;
        }
      }));
      const clean = liveItems.filter((item): item is CartItem => item !== null);
      setItems(clean);
      await AsyncStorage.setItem(CART_KEY, JSON.stringify(clean.map((item) => ({ productId: item.productId, quantity: item.quantity }))));
      if (clean.length < entries.length) setError("Some items were removed because their listings are unavailable or no longer approved.");
    } catch {
      setError("Could not load your saved cart. Try again.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadCart(); }, [loadCart]);

  async function saveItems(next: CartItem[]) {
    setItems(next);
    try {
      await AsyncStorage.setItem(CART_KEY, JSON.stringify(next.map((item) => ({ productId: item.productId, quantity: item.quantity }))));
    } catch {
      Alert.alert("Cart storage error", "Your cart may not be saved between sessions.");
    }
  }

  function changeQuantity(productId: string, delta: number) {
    const next: CartItem[] = [];
    for (const item of items) {
      if (item.productId !== productId) {
        next.push(item);
        continue;
      }
      const quantity = item.quantity + delta;
      if (quantity > 0 && quantity <= 99) next.push({ ...item, quantity });
    }
    void saveItems(next);
  }

  function removeItem(productId: string) {
    void saveItems(items.filter((item) => item.productId !== productId));
  }

  function totalsByCurrency() {
    const totals: Record<string, number> = {};
    for (const item of items) totals[item.currency] = (totals[item.currency] || 0) + item.price * item.quantity;
    return Object.entries(totals).map(([currency, total]) => `${currency} ${total.toFixed(2)}`).join(" + ");
  }

  async function shareEnquiry() {
    if (!items.length) return;
    setBusy(true);
    const lines = items.map((item) => `• ${item.quantity} × ${item.title} — ${item.currency} ${(item.price * item.quantity).toFixed(2)}${item.sellerName ? ` (seller: ${item.sellerName}${item.city ? `, ${item.city}` : ""})` : ""}`);
    const message = [
      "ZimMarket purchase enquiry",
      "",
      ...lines,
      "",
      `Current listing total (not a final quotation): ${totalsByCurrency()}`,
      `Preferred payment arrangement: ${paymentPreference}`,
      "",
      "Please confirm availability, condition, delivery and the final amount with each seller. This is an enquiry only: no order has been submitted and no payment has been collected by ZimMarket."
    ].join("\n");
    try {
      await Share.share({ message, title: "ZimMarket purchase enquiry" });
    } catch {
      Alert.alert("Could not open sharing", "Please try again or contact sellers directly.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>← Continue shopping</Text></Pressable>
        <Text style={styles.kicker}>YOUR BASKET</Text>
        <Text style={styles.heading}>Shopping cart</Text>
        <Text style={styles.sub}>Prices are refreshed from current approved listings. This cart does not reserve stock or process payment.</Text>
        {!!error && <View style={styles.warning}><Text style={styles.warningText}>{error}</Text><Pressable onPress={() => void loadCart()}><Text style={styles.retry}>Refresh cart</Text></Pressable></View>}
        {loading && <ActivityIndicator style={{ marginTop: 28 }} size="large" color="#1769E0" />}
        {!loading && items.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🛒</Text>
            <Text style={styles.emptyTitle}>Your cart is empty</Text>
            <Text style={styles.body}>Browse approved listings and add products you want to ask sellers about.</Text>
            <Pressable style={styles.primary} onPress={() => router.replace("/")}><Text style={styles.primaryText}>Browse marketplace</Text></Pressable>
          </View>
        )}
        {!loading && items.map((item) => (
          <View key={item.productId} style={styles.card}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            {!!(item.sellerName || item.city) && <Text style={styles.meta}>{[item.sellerName, item.city].filter(Boolean).join(" · ")}</Text>}
            <Text style={styles.price}>{item.currency} {item.price.toFixed(2)}</Text>
            <View style={styles.quantityRow}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Decrease quantity for ${item.title}`} onPress={() => changeQuantity(item.productId, -1)} style={styles.qtyButton}><Text style={styles.qtyText}>−</Text></Pressable>
              <Text style={styles.quantity}>{item.quantity}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`Increase quantity for ${item.title}`} onPress={() => changeQuantity(item.productId, 1)} style={styles.qtyButton}><Text style={styles.qtyText}>＋</Text></Pressable>
              <View style={{ flex: 1 }} />
              <Pressable accessibilityRole="button" onPress={() => removeItem(item.productId)}><Text style={styles.remove}>Remove</Text></Pressable>
            </View>
            <Text style={styles.lineTotal}>Line total: {item.currency} {(item.price * item.quantity).toFixed(2)}</Text>
          </View>
        ))}
        {!loading && items.length > 0 && (
          <>
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Current listing total</Text>
              <Text style={styles.total}>{totalsByCurrency()}</Text>
              <Text style={styles.small}>Different currencies are shown separately. Delivery and seller-negotiated prices are not included.</Text>
            </View>
            <Text style={styles.section}>Preferred payment arrangement</Text>
            <Text style={styles.body}>Choose what you would prefer to discuss with the seller. This does not initiate a payment.</Text>
            <View style={styles.options}>
              {paymentOptions.map((option) => (
                <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: paymentPreference === option }} onPress={() => setPaymentPreference(option)} style={[styles.option, paymentPreference === option && styles.optionSelected]}>
                  <Text style={[styles.optionText, paymentPreference === option && styles.optionTextSelected]}>{option}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable accessibilityRole="button" disabled={busy} style={[styles.primary, busy && styles.disabled]} onPress={() => void shareEnquiry()}><Text style={styles.primaryText}>{busy ? "Opening sharing…" : "Share purchase enquiry"}</Text></Pressable>
            <Pressable accessibilityRole="button" style={styles.clear} onPress={() => Alert.alert("Clear cart?", "Remove all items from your saved cart?", [{ text: "Cancel", style: "cancel" }, { text: "Clear cart", style: "destructive", onPress: () => void saveItems([]) }])}><Text style={styles.remove}>Clear cart</Text></Pressable>
            <View style={styles.warning}><Text style={styles.warningText}>Safety reminder: verify the seller and product before paying. Never share your PIN, password or one-time code. ZimMarket has not processed an order or payment at this stage.</Text></View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F7FB" },
  content: { padding: 18, paddingBottom: 36 },
  back: { alignSelf: "flex-start", paddingVertical: 10, marginBottom: 8 },
  backText: { color: "#1769E0", fontWeight: "800" },
  kicker: { color: "#1769E0", fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  heading: { color: "#0B1F3A", fontSize: 29, fontWeight: "900", marginTop: 4 },
  sub: { color: "#526277", lineHeight: 21, marginTop: 8, marginBottom: 16 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 16, borderColor: "#E1E8F1", borderWidth: 1, padding: 15, marginBottom: 12 },
  itemTitle: { color: "#0B1F3A", fontWeight: "900", fontSize: 16 },
  meta: { color: "#69788B", fontSize: 12, marginTop: 6 },
  price: { color: "#1769E0", fontWeight: "900", fontSize: 15, marginTop: 10 },
  quantityRow: { flexDirection: "row", gap: 10, alignItems: "center", marginTop: 13 },
  qtyButton: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: "#D7E0EC", alignItems: "center", justifyContent: "center", backgroundColor: "#F8FAFD" },
  qtyText: { color: "#0B1F3A", fontWeight: "900", fontSize: 18 },
  quantity: { color: "#0B1F3A", fontWeight: "900", minWidth: 18, textAlign: "center" },
  remove: { color: "#B42318", fontWeight: "800" },
  lineTotal: { color: "#526277", fontSize: 12, marginTop: 12 },
  totalCard: { borderRadius: 16, padding: 17, backgroundColor: "#0B1F3A", marginTop: 8 },
  totalLabel: { color: "#C5D6EC", fontSize: 12, fontWeight: "700" },
  total: { color: "#FFFFFF", fontSize: 22, fontWeight: "900", marginTop: 8 },
  small: { color: "#C5D6EC", fontSize: 12, lineHeight: 17, marginTop: 8 },
  section: { color: "#0B1F3A", fontSize: 17, fontWeight: "900", marginTop: 22, marginBottom: 7 },
  body: { color: "#526277", lineHeight: 21, marginTop: 5 },
  options: { gap: 8, marginTop: 12 },
  option: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DCE5F0", padding: 13, borderRadius: 11 },
  optionSelected: { borderColor: "#1769E0", backgroundColor: "#EAF2FF" },
  optionText: { color: "#0B1F3A", fontWeight: "700" },
  optionTextSelected: { color: "#1769E0", fontWeight: "900" },
  primary: { backgroundColor: "#1769E0", borderRadius: 12, padding: 15, marginTop: 18, alignItems: "center" },
  primaryText: { color: "#FFFFFF", fontWeight: "900" },
  disabled: { opacity: 0.5 },
  clear: { alignSelf: "center", padding: 14 },
  empty: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 20, marginTop: 12 },
  emptyEmoji: { fontSize: 38, marginBottom: 8 },
  emptyTitle: { color: "#0B1F3A", fontSize: 19, fontWeight: "900", marginBottom: 6 },
  warning: { backgroundColor: "#FFF4D7", borderRadius: 13, padding: 14, marginTop: 14 },
  warningText: { color: "#754B00", lineHeight: 20, fontSize: 12 },
  retry: { color: "#1769E0", fontWeight: "900", marginTop: 10 }
});
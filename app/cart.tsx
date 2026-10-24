import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { collection, doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { auth, db, firebaseConfigured } from "../src/firebase";

const CART_KEY = "zimmarket_cart_v1";
type CartEntry = { productId: string; quantity: number };
type CartItem = {
  productId: string;
  sellerId: string;
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
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [deliveryArea, setDeliveryArea] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [buyerConsent, setBuyerConsent] = useState(false);
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
        const snapshot = await getDoc(doc(db, "products", entry.productId));
        if (!snapshot.exists()) return null;
        const data = snapshot.data();
        if (data.status !== "approved") return null;
        const rawPrice = data.price ?? data.p;
        const price = Number(rawPrice);
        return {
          productId: entry.productId,
          sellerId: String(data.sellerId ?? ""),
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

  useEffect(() => onAuthStateChanged(auth, async (user) => {
    if (!user) {
      setBuyerName("");
      return;
    }
    setBuyerName((current) => current || user.displayName || "");
    try {
      const profile = await getDoc(doc(db, "users", user.uid));
      if (profile.exists()) {
        const name = String(profile.data().name || user.displayName || "");
        setBuyerName((current) => current || name);
      }
    } catch {
      // The buyer may still enter their name manually if profile lookup fails.
    }
  }), []);

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

  async function placeOrderRequests() {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Sign in required", "Sign in or create an account before submitting an order request.", [
        { text: "Cancel", style: "cancel" },
        { text: "Sign in", onPress: () => router.push("/login") }
      ]);
      return;
    }
    if (!firebaseConfigured) {
      Alert.alert("Setup required", "The marketplace backend is not configured. No order has been submitted.");
      return;
    }
    if (!items.length) return;
    if (!buyerName.trim() || !buyerPhone.trim() || !deliveryArea.trim()) {
      Alert.alert("Delivery details needed", "Enter your name, phone number, and city or area so the seller can respond.");
      return;
    }
    if (!buyerConsent) {
      Alert.alert("Please confirm", "Confirm that your contact details may be shared with the sellers in these orders.");
      return;
    }
    if (items.some((item) => !item.sellerId)) {
      Alert.alert("Seller information missing", "At least one listing has no linked seller account. Remove that item and contact the seller directly.");
      return;
    }
    if (items.length > 10) {
      Alert.alert("Cart is too large", "Submit no more than 10 different products in one order batch.");
      return;
    }

    setBusy(true);
    try {
      const batch = writeBatch(db);
      for (const item of items) {
        const orderRef = doc(collection(db, "orders"));
        batch.set(orderRef, {
          buyerId: user.uid,
          buyerEmail: user.email || "",
          buyerName: buyerName.trim(),
          buyerPhone: buyerPhone.trim(),
          deliveryArea: deliveryArea.trim(),
          deliveryNote: deliveryNote.trim(),
          buyerConsent: true,
          sellerId: item.sellerId,
          sellerName: item.sellerName,
          sellerCity: item.city,
          productId: item.productId,
          productTitle: item.title,
          productImageUrl: item.imageUrl,
          quantity: item.quantity,
          unitPrice: item.price,
          total: item.price * item.quantity,
          currency: item.currency,
          paymentPreference,
          paymentStatus: "unpaid",
          status: "pending",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      await batch.commit();
      await AsyncStorage.removeItem(CART_KEY);
      setItems([]);
      Alert.alert(
        "Order request submitted",
        "Your request has been saved. The seller must confirm availability and delivery. No payment has been collected.",
        [{ text: "View requests", onPress: () => router.push("/orders") }, { text: "Done", style: "cancel" }]
      );
    } catch {
      Alert.alert(
        "Order not submitted",
        "The database rejected this request. No order was created by this attempt and no payment was collected. Ask the project administrator to review the Firestore orders rules, or contact the seller directly."
      );
    } finally {
      setBusy(false);
    }
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
            <Text style={styles.section}>Contact and delivery details</Text>
            <Text style={styles.body}>Share only the details needed for the seller to respond and arrange delivery.</Text>
            <TextInput accessibilityLabel="Your name" style={styles.input} placeholder="Your name" value={buyerName} onChangeText={setBuyerName} maxLength={100} />
            <TextInput accessibilityLabel="Phone number" style={styles.input} placeholder="Phone number (e.g. +263 77 123 4567)" value={buyerPhone} onChangeText={setBuyerPhone} keyboardType="phone-pad" maxLength={25} />
            <TextInput accessibilityLabel="City or area" style={styles.input} placeholder="City / area (e.g. Harare)" value={deliveryArea} onChangeText={setDeliveryArea} maxLength={100} />
            <TextInput accessibilityLabel="Delivery note" style={[styles.input, styles.noteInput]} placeholder="Delivery note (optional, no PINs or passwords)" value={deliveryNote} onChangeText={setDeliveryNote} multiline maxLength={400} />
            <Pressable accessibilityRole="button" accessibilityState={{ checked: buyerConsent }} onPress={() => setBuyerConsent((value) => !value)} style={styles.consentRow}>
              <View style={[styles.consentBox, buyerConsent && styles.consentBoxChecked]}><Text style={styles.consentTick}>{buyerConsent ? "✓" : ""}</Text></View>
              <Text style={styles.consentText}>I agree to share my name, phone, email and delivery area with each seller in these order requests.</Text>
            </Pressable>
            <Text style={styles.section}>Preferred payment arrangement</Text>
            <Text style={styles.body}>This records your preference only. EcoCash, OneMoney and bank transfers are not processed by ZimMarket.</Text>
            <View style={styles.options}>
              {paymentOptions.map((option) => (
                <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: paymentPreference === option }} onPress={() => setPaymentPreference(option)} style={[styles.option, paymentPreference === option && styles.optionSelected]}>
                  <Text style={[styles.optionText, paymentPreference === option && styles.optionTextSelected]}>{option}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable accessibilityRole="button" disabled={busy} style={[styles.primary, busy && styles.disabled]} onPress={() => void placeOrderRequests()}><Text style={styles.primaryText}>{busy ? "Submitting…" : "Submit order requests"}</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={busy} style={[styles.secondary, busy && styles.disabled]} onPress={() => void shareEnquiry()}><Text style={styles.secondaryText}>Share enquiry instead</Text></Pressable>
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
  input: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DCE5F0", borderRadius: 12, padding: 13, color: "#0B1F3A", marginTop: 10 },
  noteInput: { minHeight: 75, textAlignVertical: "top" },
  consentRow: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginTop: 14 },
  consentBox: { width: 23, height: 23, borderRadius: 6, borderWidth: 1, borderColor: "#9BB2CE", backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  consentBoxChecked: { backgroundColor: "#1769E0", borderColor: "#1769E0" },
  consentTick: { color: "#FFFFFF", fontWeight: "900" },
  consentText: { color: "#526277", fontSize: 12, lineHeight: 18, flex: 1 },
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
  secondary: { backgroundColor: "#EAF2FF", borderRadius: 12, padding: 14, marginTop: 9, alignItems: "center" },
  secondaryText: { color: "#1769E0", fontWeight: "900" },
  disabled: { opacity: 0.5 },
  clear: { alignSelf: "center", padding: 14 },
  empty: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 20, marginTop: 12 },
  emptyEmoji: { fontSize: 38, marginBottom: 8 },
  emptyTitle: { color: "#0B1F3A", fontSize: 19, fontWeight: "900", marginBottom: 6 },
  warning: { backgroundColor: "#FFF4D7", borderRadius: 13, padding: 14, marginTop: 14 },
  warningText: { color: "#754B00", lineHeight: 20, fontSize: 12 },
  retry: { color: "#1769E0", fontWeight: "900", marginTop: 10 }
});
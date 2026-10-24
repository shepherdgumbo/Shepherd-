import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, serverTimestamp, updateDoc, where, doc } from "firebase/firestore";
import { auth, db, firebaseConfigured } from "../src/firebase";

type Order = {
  id: string;
  buyerId?: string;
  buyerEmail?: string;
  buyerName?: string;
  buyerPhone?: string;
  deliveryArea?: string;
  deliveryNote?: string;
  buyerConsent?: boolean;
  sellerId?: string;
  sellerName?: string;
  sellerCity?: string;
  productId?: string;
  productTitle?: string;
  quantity?: number;
  unitPrice?: number;
  total?: number;
  currency?: string;
  paymentPreference?: string;
  paymentStatus?: string;
  status?: string;
};

const navy = "#0B1F3A";
const blue = "#1769E0";

export default function OrdersScreen() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [purchases, setPurchases] = useState<Order[]>([]);
  const [sales, setSales] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function loadOrders(uid: string) {
    if (!firebaseConfigured) {
      setError("Firebase configuration is not available.");
      setLoading(false);
      return;
    }
    try {
      setError("");
      const [purchaseSnapshot, saleSnapshot] = await Promise.all([
        getDocs(query(collection(db, "orders"), where("buyerId", "==", uid))),
        getDocs(query(collection(db, "orders"), where("sellerId", "==", uid)))
      ]);
      setPurchases(purchaseSnapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Order)));
      setSales(saleSnapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Order)));
    } catch {
      setError("Could not load order requests. Check that the reviewed Firestore orders rules have been deployed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => onAuthStateChanged(auth, (user) => {
    if (!user) {
      setUserId("");
      setPurchases([]);
      setSales([]);
      setLoading(false);
      return;
    }
    setUserId(user.uid);
    setLoading(true);
    void loadOrders(user.uid);
  }), []);

  async function changeStatus(order: Order, nextStatus: "accepted" | "rejected" | "completed" | "cancelled") {
    const user = auth.currentUser;
    if (!user || !userId) {
      Alert.alert("Sign in required", "Sign in to manage order requests.");
      return;
    }
    setBusyId(order.id);
    try {
      await updateDoc(doc(db, "orders", order.id), {
        status: nextStatus,
        updatedAt: serverTimestamp()
      });
      await loadOrders(user.uid);
      const labels: Record<typeof nextStatus, string> = {
        accepted: "Order request accepted.",
        rejected: "Order request rejected.",
        completed: "Order marked complete.",
        cancelled: "Order request cancelled."
      };
      Alert.alert("Status updated", labels[nextStatus]);
    } catch {
      Alert.alert(
        "Could not update order",
        "The database rejected this change. Confirm that the production Firestore rules match firebase/firestore.rules.example and only allow the documented status transitions."
      );
    } finally {
      setBusyId("");
    }
  }

  function confirmChange(order: Order, nextStatus: "accepted" | "rejected" | "completed" | "cancelled") {
    const label = order.productTitle || "this order request";
    const action: Record<typeof nextStatus, string> = {
      accepted: "Accept request",
      rejected: "Reject request",
      completed: "Mark complete",
      cancelled: "Cancel request"
    };
    Alert.alert(action[nextStatus] + "?", label, [
      { text: "Keep", style: "cancel" },
      { text: action[nextStatus], style: nextStatus === "rejected" || nextStatus === "cancelled" ? "destructive" : "default", onPress: () => void changeStatus(order, nextStatus) }
    ]);
  }

  function formatMoney(order: Order) {
    const total = Number(order.total ?? 0);
    return `${order.currency || "USD"} ${Number.isFinite(total) ? total.toFixed(2) : "0.00"}`;
  }

  function statusColor(status?: string) {
    if (status === "accepted") return styles.statusAccepted;
    if (status === "completed") return styles.statusCompleted;
    if (status === "rejected" || status === "cancelled") return styles.statusClosed;
    return styles.statusPending;
  }

  function statusLabel(status?: string) {
    return (status || "pending").replace(/[_-]/g, " ").toUpperCase();
  }

  function renderActions(order: Order, side: "buyer" | "seller") {
    if (side === "buyer" && order.status === "pending") {
      return <Pressable accessibilityRole="button" disabled={busyId === order.id} style={styles.cancelButton} onPress={() => confirmChange(order, "cancelled")}><Text style={styles.cancelText}>Cancel request</Text></Pressable>;
    }
    if (side === "seller" && order.status === "pending") {
      return (
        <View style={styles.actionRow}>
          <Pressable accessibilityRole="button" disabled={busyId === order.id} style={[styles.acceptButton, busyId === order.id && styles.disabled]} onPress={() => confirmChange(order, "accepted")}><Text style={styles.acceptText}>Accept</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={busyId === order.id} style={[styles.rejectButton, busyId === order.id && styles.disabled]} onPress={() => confirmChange(order, "rejected")}><Text style={styles.rejectText}>Reject</Text></Pressable>
        </View>
      );
    }
    if (side === "seller" && order.status === "accepted") {
      return <Pressable accessibilityRole="button" disabled={busyId === order.id} style={[styles.acceptButton, busyId === order.id && styles.disabled]} onPress={() => confirmChange(order, "completed")}><Text style={styles.acceptText}>Mark complete</Text></Pressable>;
    }
    return null;
  }

  function renderOrder(order: Order, side: "buyer" | "seller") {
    return (
      <View key={order.id} style={styles.orderCard}>
        <View style={styles.orderTop}>
          <Text style={styles.productTitle}>{order.productTitle || "Marketplace product"}</Text>
          <View style={[styles.statusPill, statusColor(order.status)]}><Text style={styles.statusText}>{statusLabel(order.status)}</Text></View>
        </View>
        <Text style={styles.amount}>{formatMoney(order)}</Text>
        <Text style={styles.detail}>Quantity: {order.quantity || 1} · Payment: {order.paymentPreference || "Discuss with seller"}</Text>
        <Text style={styles.unpaid}>PAYMENT NOT COLLECTED · {String(order.paymentStatus || "unpaid").toUpperCase()}</Text>
        {side === "buyer" && !!(order.sellerName || order.sellerCity) && <Text style={styles.detail}>Seller: {[order.sellerName, order.sellerCity].filter(Boolean).join(" · ")}</Text>}
        {side === "seller" && (
          <View style={styles.buyerBox}>
            <Text style={styles.buyerHeading}>Buyer contact (private)</Text>
            <Text style={styles.detail}>{order.buyerName || "Buyer"}</Text>
            {!!order.buyerEmail && <Text style={styles.detail}>{order.buyerEmail}</Text>}
            {!!order.buyerPhone && <Text style={styles.detail}>Phone: {order.buyerPhone}</Text>}
            {!!order.deliveryArea && <Text style={styles.detail}>Area: {order.deliveryArea}</Text>}
            {!!order.deliveryNote && <Text style={styles.detail}>Delivery note: {order.deliveryNote}</Text>}
          </View>
        )}
        {renderActions(order, side)}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityRole="button" style={styles.back} onPress={() => router.back()}><Text style={styles.backText}>← Back</Text></Pressable>
        <Text style={styles.kicker}>ZIMMARKET ORDERS</Text>
        <Text style={styles.heading}>Order requests</Text>
        <Text style={styles.sub}>These are requests for seller confirmation. They do not charge a payment method or confirm that money has been paid.</Text>
        {!!error && <View style={styles.warning}><Text style={styles.warningText}>{error}</Text><Pressable onPress={() => userId && void loadOrders(userId)}><Text style={styles.retry}>Try again</Text></Pressable></View>}
        {loading && <ActivityIndicator style={{ marginTop: 26 }} size="large" color={blue} />}
        {!loading && !userId && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Sign in to view order requests</Text>
            <Text style={styles.sub}>You need an account to view purchases or respond to seller requests.</Text>
            <Pressable style={styles.primary} onPress={() => router.push("/login")}><Text style={styles.primaryText}>Sign in</Text></Pressable>
          </View>
        )}
        {!loading && !!userId && !error && (
          <>
            <Text style={styles.section}>My purchases</Text>
            {purchases.length ? purchases.map((item) => renderOrder(item, "buyer")) : <View style={styles.empty}><Text style={styles.emptyTitle}>No purchases yet</Text><Text style={styles.detail}>Order requests you submit will appear here.</Text></View>}
            <Text style={styles.section}>Orders received</Text>
            {sales.length ? sales.map((item) => renderOrder(item, "seller")) : <View style={styles.empty}><Text style={styles.emptyTitle}>No orders received</Text><Text style={styles.detail}>Requests for your approved listings will appear here.</Text></View>}
          </>
        )}
        <View style={styles.warning}><Text style={styles.warningText}>EcoCash, OneMoney, bank transfer and cash on delivery are handled by direct arrangement for now. Verify the order and payment independently; ZimMarket does not process payments in this app.</Text></View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F7FB" },
  content: { padding: 18, paddingBottom: 36 },
  back: { alignSelf: "flex-start", paddingVertical: 10, marginBottom: 8 },
  backText: { color: blue, fontWeight: "800" },
  kicker: { color: blue, fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  heading: { color: navy, fontSize: 29, fontWeight: "900", marginTop: 4 },
  sub: { color: "#526277", lineHeight: 21, marginTop: 8, marginBottom: 15 },
  section: { color: navy, fontSize: 19, fontWeight: "900", marginTop: 18, marginBottom: 11 },
  orderCard: { backgroundColor: "#FFFFFF", borderRadius: 16, borderColor: "#E1E8F1", borderWidth: 1, padding: 15, marginBottom: 12 },
  orderTop: { gap: 8 },
  productTitle: { color: navy, fontSize: 16, lineHeight: 22, fontWeight: "900", flex: 1 },
  amount: { color: blue, fontSize: 19, fontWeight: "900", marginTop: 9 },
  detail: { color: "#526277", fontSize: 12, lineHeight: 18, marginTop: 6 },
  unpaid: { color: "#805400", backgroundColor: "#FFF4D7", overflow: "hidden", alignSelf: "flex-start", fontSize: 10, letterSpacing: 0.4, fontWeight: "900", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7, marginTop: 10 },
  statusPill: { alignSelf: "flex-start", borderRadius: 99, paddingVertical: 5, paddingHorizontal: 9 },
  statusText: { fontSize: 10, color: navy, fontWeight: "900" },
  statusPending: { backgroundColor: "#FFF0C2" },
  statusAccepted: { backgroundColor: "#DCEBFF" },
  statusCompleted: { backgroundColor: "#DDF8E8" },
  statusClosed: { backgroundColor: "#FDE8E7" },
  buyerBox: { backgroundColor: "#F4F7FB", borderRadius: 11, padding: 12, marginTop: 14 },
  buyerHeading: { color: navy, fontSize: 12, fontWeight: "900" },
  actionRow: { flexDirection: "row", gap: 9, marginTop: 14 },
  acceptButton: { backgroundColor: blue, borderRadius: 10, padding: 12, alignItems: "center", marginTop: 14 },
  acceptText: { color: "#FFFFFF", fontWeight: "900" },
  rejectButton: { flex: 1, backgroundColor: "#FDE8E7", borderRadius: 10, padding: 12, alignItems: "center", marginTop: 14 },
  rejectText: { color: "#B42318", fontWeight: "900" },
  cancelButton: { alignSelf: "flex-start", borderRadius: 10, borderWidth: 1, borderColor: "#B42318", padding: 11, marginTop: 14 },
  cancelText: { color: "#B42318", fontWeight: "800" },
  disabled: { opacity: 0.5 },
  empty: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 18, marginBottom: 12 },
  emptyTitle: { color: navy, fontWeight: "900", fontSize: 16, lineHeight: 22 },
  primary: { backgroundColor: blue, borderRadius: 12, padding: 14, alignItems: "center", marginTop: 12 },
  primaryText: { color: "#FFFFFF", fontWeight: "900" },
  warning: { backgroundColor: "#FFF4D7", borderRadius: 13, padding: 14, marginTop: 14 },
  warningText: { color: "#754B00", fontSize: 12, lineHeight: 19 },
  retry: { color: blue, fontWeight: "900", marginTop: 10 }
});
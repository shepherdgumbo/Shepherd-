import { useState } from "react";
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, firebaseConfigured } from "../src/firebase";

export default function SellScreen() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<"USD" | "ZWL">("USD");
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const user = auth.currentUser;
    if (!firebaseConfigured) { Alert.alert("Setup required", "Firebase configuration has not been added yet."); return; }
    if (!user) { Alert.alert("Sign in required", "Sign in with your seller account before submitting a listing.", [{ text: "Cancel" }, { text: "Sign in", onPress: () => router.push("/login") }]); return; }
    if (!title.trim() || !description.trim() || !category.trim() || !price.trim() || !Number.isFinite(Number(price)) || Number(price) < 0) {
      Alert.alert("Check your listing", "Enter a title, description, category, and valid non-negative price."); return;
    }
    setBusy(true);
    try {
      const profile = await getDoc(doc(db, "users", user.uid));
      if (!profile.exists() || profile.data().role !== "seller") {
        Alert.alert("Seller account required", "Create or sign in to an account registered as a seller before listing products.");
        return;
      }
      await addDoc(collection(db, "products"), {
        title: title.trim(),
        description: description.trim(),
        price: Number(price),
        currency,
        category: category.trim(),
        sellerId: user.uid,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      Alert.alert("Listing submitted", "Your product is pending administrator approval and will not appear publicly until approved.");
      setTitle(""); setDescription(""); setPrice(""); setCategory("");
      router.replace("/");
    } catch {
      Alert.alert("Could not submit", "The listing could not be saved. Check Firebase configuration and Firestore security rules.");
    } finally { setBusy(false); }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Sell on ZimMarket</Text>
        <Text style={styles.sub}>Tell buyers about your product. Every new listing is reviewed before it becomes public.</Text>
        <TextInput accessibilityLabel="Product title" style={styles.input} placeholder="Product title" value={title} onChangeText={setTitle} maxLength={100} />
        <TextInput accessibilityLabel="Category" style={styles.input} placeholder="Category (e.g. Phones)" value={category} onChangeText={setCategory} maxLength={60} />
        <TextInput accessibilityLabel="Price" style={styles.input} placeholder="Price" keyboardType="decimal-pad" value={price} onChangeText={setPrice} />
        <Text style={styles.label}>Currency</Text>
        <ViewCurrency value={currency} setValue={setCurrency} />
        <TextInput accessibilityLabel="Product description" style={[styles.input, styles.multiline]} placeholder="Describe the condition and details of your product" value={description} onChangeText={setDescription} multiline maxLength={2000} />
        <Pressable disabled={busy} style={[styles.button, busy && { opacity: 0.6 }]} onPress={() => void submit()}><Text style={styles.buttonText}>{busy ? "Submitting…" : "Submit for approval"}</Text></Pressable>
        <Text style={styles.note}>Do not include passwords, PINs, or sensitive personal information. Never claim a listing is approved before an administrator reviews it.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ViewCurrency({ value, setValue }: { value: "USD" | "ZWL"; setValue: (v: "USD" | "ZWL") => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
      {(["USD", "ZWL"] as const).map((item) => <Pressable key={item} onPress={() => setValue(item)} style={[styles.currency, value === item && styles.currencySelected]}><Text style={value === item ? styles.currencySelectedText : styles.currencyText}>{item}</Text></Pressable>)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F7FB" },
  content: { padding: 18, paddingBottom: 32 },
  heading: { color: "#0B1F3A", fontSize: 26, fontWeight: "800" },
  sub: { color: "#607086", lineHeight: 21, marginTop: 8, marginBottom: 22 },
  input: { borderWidth: 1, borderColor: "#D7E0EC", backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, marginBottom: 12, color: "#0B1F3A" },
  multiline: { minHeight: 110, textAlignVertical: "top" },
  label: { color: "#0B1F3A", fontWeight: "700", marginBottom: 8 },
  currency: { borderWidth: 1, borderColor: "#D7E0EC", paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10, marginRight: 8 },
  currencySelected: { backgroundColor: "#0B1F3A", borderColor: "#0B1F3A" },
  currencyText: { color: "#0B1F3A", fontWeight: "700" },
  currencySelectedText: { color: "#FFFFFF", fontWeight: "700" },
  button: { backgroundColor: "#1769E0", borderRadius: 12, padding: 15, alignItems: "center", marginTop: 6 },
  buttonText: { color: "#FFFFFF", fontWeight: "800" },
  note: { color: "#607086", fontSize: 12, lineHeight: 18, marginTop: 16 }
});
import { useState } from "react";
import { Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useRouter } from "expo-router";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, firebaseConfigured, storage } from "../src/firebase";

export default function SellScreen() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<"USD" | "ZWL">("USD");
  const [category, setCategory] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [sellerWhatsApp, setSellerWhatsApp] = useState("");
  const [city, setCity] = useState("");
  const [imageUri, setImageUri] = useState("");
  const [busy, setBusy] = useState(false);

  async function choosePhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo access to attach a product image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8
    });
    if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
  }

  async function submit() {
    const user = auth.currentUser;
    if (!firebaseConfigured) {
      Alert.alert("Setup required", "Firebase configuration has not been added yet.");
      return;
    }
    if (!user) {
      Alert.alert("Sign in required", "Sign in with your seller account before submitting a listing.", [
        { text: "Cancel" },
        { text: "Sign in", onPress: () => router.push("/login") }
      ]);
      return;
    }
    if (!title.trim() || !description.trim() || !category.trim() || !price.trim() || !Number.isFinite(Number(price)) || Number(price) < 0) {
      Alert.alert("Check your listing", "Enter a title, description, category, and valid non-negative price.");
      return;
    }
    setBusy(true);
    try {
      const profile = await getDoc(doc(db, "users", user.uid));
      if (!profile.exists() || profile.data().role !== "seller") {
        Alert.alert("Seller account required", "Create or sign in to an account registered as a seller before listing products.");
        return;
      }
      if (profile.data().sellerStatus !== "approved") {
        Alert.alert(
          "Seller approval pending",
          profile.data().sellerStatus === "rejected"
            ? "Your seller application was not approved. Contact ZimMarket support for assistance."
            : "Your seller account must be approved by a ZimMarket administrator before you can publish product listings."
        );
        return;
      }

      let imageUrl: string | null = null;
      if (imageUri) {
        const response = await fetch(imageUri);
        const imageBlob = await response.blob();
        const imageRef = ref(storage, "products/" + user.uid + "/" + Date.now() + ".jpg");
        const uploaded = await uploadBytes(imageRef, imageBlob, { contentType: imageBlob.type || "image/jpeg" });
        imageUrl = await getDownloadURL(uploaded.ref);
      }

      await addDoc(collection(db, "products"), {
        title: title.trim(),
        description: description.trim(),
        price: Number(price),
        currency,
        category: category.trim(),
        sellerName: sellerName.trim() || profile.data().name || user.displayName || "Seller",
        sellerWhatsApp: sellerWhatsApp.trim(),
        city: city.trim() || "Zimbabwe",
        imageUrl,
        sellerId: user.uid,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      Alert.alert("Listing submitted", "Your product is pending administrator approval and will not appear publicly until approved.");
      setTitle("");
      setDescription("");
      setPrice("");
      setCategory("");
      setSellerName("");
      setSellerWhatsApp("");
      setCity("");
      setImageUri("");
      router.replace("/");
    } catch {
      Alert.alert("Could not submit", "The listing could not be saved. Check Firestore and Storage rules, then try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Sell on ZimMarket</Text>
        <Text style={styles.sub}>Tell buyers about your product. Every new listing is reviewed before it becomes public.</Text>
        <TextInput accessibilityLabel="Product title" style={styles.input} placeholder="Product title" value={title} onChangeText={setTitle} maxLength={100} />
        <TextInput accessibilityLabel="Category" style={styles.input} placeholder="Category (e.g. Phones)" value={category} onChangeText={setCategory} maxLength={60} />
        <TextInput accessibilityLabel="Seller or business name" style={styles.input} placeholder="Seller or business name (optional)" value={sellerName} onChangeText={setSellerName} maxLength={100} />
        <TextInput accessibilityLabel="Business WhatsApp contact" style={styles.input} placeholder="Business WhatsApp e.g. +263771234567 (optional)" value={sellerWhatsApp} onChangeText={setSellerWhatsApp} keyboardType="phone-pad" maxLength={24} />
        <Text style={styles.privacyNote}>Only enter a number you are happy to display publicly after this listing is approved.</Text>
        <TextInput accessibilityLabel="City or area" style={styles.input} placeholder="City / area (e.g. Harare)" value={city} onChangeText={setCity} maxLength={80} />
        <TextInput accessibilityLabel="Price" style={styles.input} placeholder="Price" keyboardType="decimal-pad" value={price} onChangeText={setPrice} />
        <Text style={styles.label}>Currency</Text>
        <ViewCurrency value={currency} setValue={setCurrency} />
        <Pressable accessibilityRole="button" onPress={() => void choosePhoto()} style={styles.photoButton}>
          <Text style={styles.photoButtonText}>{imageUri ? "Change product photo" : "＋ Add product photo (optional)"}</Text>
        </Pressable>
        {imageUri ? <Image source={{ uri: imageUri }} style={styles.photoPreview} resizeMode="cover" /> : null}
        <TextInput accessibilityLabel="Product description" style={[styles.input, styles.multiline]} placeholder="Describe the condition and details of your product" value={description} onChangeText={setDescription} multiline maxLength={2000} />
        <Pressable disabled={busy} style={[styles.button, busy && { opacity: 0.6 }]} onPress={() => void submit()}>
          <Text style={styles.buttonText}>{busy ? "Submitting…" : "Submit for approval"}</Text>
        </Pressable>
        <Text style={styles.note}>Do not include passwords, PINs, or sensitive personal information. Never claim a listing is approved before an administrator reviews it.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ViewCurrency({ value, setValue }: { value: "USD" | "ZWL"; setValue: (v: "USD" | "ZWL") => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
      {(["USD", "ZWL"] as const).map((item) => (
        <Pressable key={item} onPress={() => setValue(item)} style={[styles.currency, value === item && styles.currencySelected]}>
          <Text style={value === item ? styles.currencySelectedText : styles.currencyText}>{item}</Text>
        </Pressable>
      ))}
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
  privacyNote: { color: "#69788B", fontSize: 11, lineHeight: 16, marginTop: -5, marginBottom: 12 },
  photoButton: { borderWidth: 1, borderStyle: "dashed", borderColor: "#9BB2CE", backgroundColor: "#EDF4FF", borderRadius: 12, padding: 15, alignItems: "center", marginBottom: 12 },
  photoButtonText: { color: "#1769E0", fontWeight: "800" },
  photoPreview: { height: 180, width: "100%", borderRadius: 12, marginBottom: 12, backgroundColor: "#EAF2FF" },
  label: { color: "#0B1F3A", fontWeight: "700", marginBottom: 8 },
  currency: { borderWidth: 1, borderColor: "#D7E0EC", paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10, marginRight: 8 },
  currencySelected: { backgroundColor: "#0B1F3A", borderColor: "#0B1F3A" },
  currencyText: { color: "#0B1F3A", fontWeight: "700" },
  currencySelectedText: { color: "#FFFFFF", fontWeight: "700" },
  button: { backgroundColor: "#1769E0", borderRadius: 12, padding: 15, alignItems: "center", marginTop: 6 },
  buttonText: { color: "#FFFFFF", fontWeight: "800" },
  note: { color: "#607086", fontSize: 12, lineHeight: 18, marginTop: 16 }
});
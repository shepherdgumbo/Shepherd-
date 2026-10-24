import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db, firebaseConfigured } from "../src/firebase";

type Product = {
  id: string;
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

const navy = "#0B1F3A";
const blue = "#1769E0";
const categories = ["All", "Phones", "Computers", "Home & Garden", "Fashion", "Vehicles", "Services", "Other"];

export default function HomeScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

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
      const rows = snapshot.docs.map((document) => {
        const data = document.data();
        return {
          ...data,
          id: document.id,
          title: data.title ?? data.n ?? data.name,
          description: data.description ?? data.d,
          price: data.price ?? data.p,
          currency: data.currency ?? data.currencyCode ?? "USD",
          category: data.category ?? data.c,
          imageUrl: data.imageUrl ?? data.imageURL ?? data.image ?? data.i,
          sellerName: data.sellerName ?? data.s,
          city: data.city,
        } as Product;
      });
      setProducts(rows);
    } catch {
      setError("We couldn't load listings. Check your connection or try again later.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void loadProducts(); }, [loadProducts]);

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((item) => {
      const title = (item.title || item.name || "").toLowerCase();
      const description = (item.description || "").toLowerCase();
      const itemCategory = (item.category || "").toLowerCase();
      const matchesSearch = !term || title.includes(term) || description.includes(term) || itemCategory.includes(term);
      const matchesCategory = category === "All" || itemCategory === category.toLowerCase();
      return matchesSearch && matchesCategory;
    });
  }, [products, search, category]);

  const money = (item: Product) => {
    if (item.price === undefined || item.price === null || item.price === "") return "Price not provided";
    return `${item.currency || "USD"} ${item.price}`;
  };
  const imageSource = (item: Product) => item.imageUrl || item.imageURL || item.image || item.images?.[0] || "";

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={visibleProducts}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.columns}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadProducts(); }} />}
        ListHeaderComponent={
          <View>
            <View style={styles.topbar}>
              <View>
                <Text style={styles.brandMini}>ZimMarket</Text>
                <Text style={styles.location}>Zimbabwe marketplace</Text>
              </View>
              <View style={styles.topActions}><Pressable accessibilityRole="button" style={styles.accountButton} onPress={() => router.push("/cart")}><Text style={styles.accountButtonText}>Cart</Text></Pressable><Pressable accessibilityRole="button" style={styles.accountButton} onPress={() => router.push("/account")}><Text style={styles.accountButtonText}>Account</Text></Pressable></View>
            </View>
            <View style={styles.hero}>
              <Text style={styles.eyebrow}>BUY LOCAL. SELL LOCAL.</Text>
              <Text style={styles.brand}>Find it on ZimMarket.</Text>
              <Text style={styles.copy}>Discover products from local sellers. Browse approved listings and compare prices in USD or ZWL.</Text>
              <Pressable accessibilityRole="button" style={styles.primary} onPress={() => router.push("/sell")}><Text style={styles.primaryText}>＋ Start selling</Text></Pressable>
            </View>
            <Text style={styles.section}>Find your next deal</Text>
            <TextInput accessibilityLabel="Search marketplace" style={styles.search} placeholder="Search products, categories…" placeholderTextColor="#78879A" value={search} onChangeText={setSearch} returnKeyType="search" />
            <FlatList
              horizontal
              data={categories}
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryList}
              renderItem={({ item }) => (
                <Pressable accessibilityRole="button" accessibilityState={{ selected: category === item }} onPress={() => setCategory(item)} style={[styles.categoryChip, category === item && styles.categoryChipSelected]}>
                  <Text style={[styles.categoryText, category === item && styles.categoryTextSelected]}>{item}</Text>
                </Pressable>
              )}
            />
            <View style={styles.listHeading}>
              <Text style={styles.section}>Approved listings</Text>
              {!loading && <Text style={styles.count}>{visibleProducts.length} found</Text>}
            </View>
            {!firebaseConfigured && <Text style={styles.notice}>Firebase configuration is required to connect the live marketplace.</Text>}
            {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
            {loading && <ActivityIndicator style={{ marginVertical: 24 }} size="large" color={blue} />}
            {!loading && !error && firebaseConfigured && products.length === 0 && (
              <View style={styles.empty}><Text style={styles.emptyTitle}>No approved listings yet</Text><Text style={styles.muted}>Products will appear here after sellers submit them and an administrator approves them.</Text></View>
            )}
            {!loading && products.length > 0 && visibleProducts.length === 0 && (
              <View style={styles.empty}><Text style={styles.emptyTitle}>No matches found</Text><Text style={styles.muted}>Try another search or select “All” categories.</Text></View>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const uri = imageSource(item);
          return (
            <Pressable accessibilityRole="button" accessibilityLabel={`View ${item.title || item.name || "product"}`} style={styles.product} onPress={() => router.push(`/product/${item.id}`)}>
              {uri ? <Image source={{ uri }} style={styles.productImage} resizeMode="cover" /> : <View style={styles.productPlaceholder}><Text style={styles.productEmoji}>🛍️</Text></View>}
              <Text numberOfLines={2} style={styles.productTitle}>{item.title || item.name || "Untitled listing"}</Text>
              <Text style={styles.price}>{money(item)}</Text>
              {!!item.category && <Text numberOfLines={1} style={styles.productCategory}>{item.category}</Text>}
              {!!(item.city || item.sellerName) && <Text numberOfLines={1} style={styles.productLocation}>{[item.sellerName, item.city].filter(Boolean).join(" · ")}</Text>}
              <Text style={styles.viewDetails}>View details →</Text>
            </Pressable>
          );
        }}
        ListFooterComponent={<Text style={styles.footer}>Buy safely: check product details and verify the seller before paying. EcoCash, OneMoney, bank transfer, and cash on delivery are not represented as integrated payment services unless explicitly offered and confirmed for a transaction.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F7FB" },
  content: { padding: 16, paddingBottom: 32 },
  topbar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  brandMini: { color: navy, fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  location: { color: "#69788B", fontSize: 12, marginTop: 2 },
  topActions: { flexDirection: "row", gap: 7 },
  accountButton: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DCE5F0" },
  accountButtonText: { color: navy, fontWeight: "700" },
  hero: { backgroundColor: navy, borderRadius: 22, padding: 22, marginBottom: 24 },
  eyebrow: { color: "#83B7FF", fontSize: 11, fontWeight: "900", letterSpacing: 1.3 },
  brand: { color: "#FFFFFF", fontSize: 30, lineHeight: 36, fontWeight: "900", letterSpacing: -0.7, marginTop: 10 },
  copy: { color: "#D9E2EF", fontSize: 14, lineHeight: 21, marginTop: 10 },
  primary: { backgroundColor: "#4F9BFF", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, alignSelf: "flex-start", marginTop: 18 },
  primaryText: { color: "#07172D", fontWeight: "900" },
  section: { color: navy, fontSize: 19, fontWeight: "900", marginBottom: 12 },
  search: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DCE5F0", borderRadius: 13, paddingVertical: 13, paddingHorizontal: 15, marginBottom: 12, color: navy },
  categoryList: { gap: 8, paddingBottom: 20 },
  categoryChip: { paddingVertical: 9, paddingHorizontal: 13, borderRadius: 100, borderWidth: 1, borderColor: "#DCE5F0", backgroundColor: "#FFFFFF" },
  categoryChipSelected: { borderColor: navy, backgroundColor: navy },
  categoryText: { color: "#44546A", fontSize: 12, fontWeight: "700" },
  categoryTextSelected: { color: "#FFFFFF" },
  listHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  count: { color: "#69788B", fontSize: 12, marginBottom: 12 },
  columns: { gap: 12, marginBottom: 12 },
  product: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 10, flex: 1, borderWidth: 1, borderColor: "#E4EAF2" },
  productImage: { height: 110, backgroundColor: "#EAF2FF", borderRadius: 12, marginBottom: 10 },
  productPlaceholder: { height: 110, backgroundColor: "#EAF2FF", borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  productEmoji: { fontSize: 34 },
  productTitle: { color: navy, fontWeight: "800", minHeight: 38, fontSize: 13, lineHeight: 18 },
  price: { color: blue, fontWeight: "900", marginTop: 8 },
  productCategory: { color: "#69788B", fontSize: 11, marginTop: 5 },
  productLocation: { color: "#69788B", fontSize: 10, marginTop: 4 },
  viewDetails: { color: blue, fontSize: 11, fontWeight: "800", marginTop: 9 },
  notice: { backgroundColor: "#FFF4D7", color: "#754B00", padding: 12, borderRadius: 10, marginBottom: 12, lineHeight: 19 },
  error: { color: "#A32626", backgroundColor: "#FDECEC", padding: 12, borderRadius: 10, marginBottom: 12 },
  empty: { padding: 18, backgroundColor: "#FFFFFF", borderRadius: 14, marginBottom: 16 },
  emptyTitle: { color: navy, fontWeight: "800", fontSize: 16, marginBottom: 6 },
  muted: { color: "#607086", lineHeight: 20 },
  footer: { color: "#607086", fontSize: 12, lineHeight: 18, marginTop: 20, paddingHorizontal: 2 }
});
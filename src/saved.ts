import AsyncStorage from "@react-native-async-storage/async-storage";

export const SAVED_PRODUCTS_KEY = "zimmarket_saved_products_v1";
const MAX_SAVED_PRODUCTS = 250;

/** Saved products are kept on this device only; this does not change Firebase data. */
export async function getSavedProductIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_PRODUCTS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((id): id is string => typeof id === "string" && id.trim().length > 0))]
      .slice(0, MAX_SAVED_PRODUCTS);
  } catch {
    return [];
  }
}

export async function writeSavedProductIds(ids: string[]): Promise<string[]> {
  const cleaned = [...new Set(ids.filter((id) => typeof id === "string" && id.trim().length > 0))]
    .slice(0, MAX_SAVED_PRODUCTS);
  await AsyncStorage.setItem(SAVED_PRODUCTS_KEY, JSON.stringify(cleaned));
  return cleaned;
}

export async function toggleSavedProduct(productId: string): Promise<{ saved: boolean; ids: string[] }> {
  if (!productId.trim()) throw new Error("A product ID is required.");
  const current = await getSavedProductIds();
  const saved = !current.includes(productId);
  const ids = saved
    ? [productId, ...current].slice(0, MAX_SAVED_PRODUCTS)
    : current.filter((id) => id !== productId);
  return { saved, ids: await writeSavedProductIds(ids) };
}

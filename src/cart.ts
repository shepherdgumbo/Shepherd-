import AsyncStorage from "@react-native-async-storage/async-storage";

const CART_KEY = "zimmarket_cart_v1";

export type CartEntry = { productId: string; quantity: number };

function normalizeEntries(value: unknown): CartEntry[] {
  if (!Array.isArray(value)) throw new Error("Saved cart data is invalid.");

  const entries: CartEntry[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as { productId?: unknown; quantity?: unknown };
    if (typeof candidate.productId !== "string" || !candidate.productId.trim()) continue;

    const parsedQuantity = Number(candidate.quantity);
    const quantity = Math.min(
      Math.max(Math.trunc(Number.isFinite(parsedQuantity) ? parsedQuantity : 1), 1),
      99
    );
    const existing = entries.find((entry) => entry.productId === candidate.productId);
    if (existing) existing.quantity = Math.min(existing.quantity + quantity, 99);
    else entries.push({ productId: candidate.productId, quantity });
  }
  return entries;
}

async function readEntries(): Promise<CartEntry[]> {
  const raw = await AsyncStorage.getItem(CART_KEY);
  return raw ? normalizeEntries(JSON.parse(raw) as unknown) : [];
}

/** Return the total quantity in the locally saved cart, without failing the home screen. */
export async function getCartItemCount(): Promise<number> {
  try {
    const entries = await readEntries();
    return entries.reduce((total, entry) => total + entry.quantity, 0);
  } catch {
    return 0;
  }
}

/** Add one item to the local cart using the same shape consumed by the cart screen. */
export async function addProductToCart(productId: string): Promise<number> {
  const cleanId = productId.trim();
  if (!cleanId) throw new Error("A product ID is required.");

  const entries = await readEntries();
  const existing = entries.find((entry) => entry.productId === cleanId);
  if (existing) existing.quantity = Math.min(existing.quantity + 1, 99);
  else entries.push({ productId: cleanId, quantity: 1 });

  await AsyncStorage.setItem(CART_KEY, JSON.stringify(entries));
  return entries.reduce((total, entry) => total + entry.quantity, 0);
}

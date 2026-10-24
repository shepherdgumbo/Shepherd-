import fs from "node:fs";
import { strict as assert } from "node:assert";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";

const projectId = "demo-zimmarket";
const env = await initializeTestEnvironment({
  projectId,
  firestore: {
    host: "127.0.0.1",
    port: 8080,
    rules: fs.readFileSync("firestore.rules", "utf8"),
  },
  storage: {
    host: "127.0.0.1",
    port: 9199,
    rules: fs.readFileSync("storage.rules", "utf8"),
  },
});

const stamp = new Date("2026-01-01T00:00:00.000Z");
const product = (status = "approved", sellerId = "seller-1") => ({
  title: "Solar lantern",
  description: "A test product for rules checks",
  price: 25,
  currency: "USD",
  category: "Solar",
  sellerName: "Test seller",
  sellerWhatsApp: "+263771234567",
  city: "Harare",
  imageUrl: null,
  sellerId,
  status,
  createdAt: stamp,
  updatedAt: stamp,
});

async function seed() {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, "users/admin-1"), {
        uid: "admin-1", name: "Admin", email: "admin@example.com",
        role: "admin", createdAt: stamp,
      }),
      setDoc(doc(db, "users/seller-1"), {
        uid: "seller-1", name: "Approved seller", email: "seller@example.com",
        role: "seller", sellerStatus: "approved", createdAt: stamp,
      }),
      setDoc(doc(db, "users/pending-seller"), {
        uid: "pending-seller", name: "Pending seller", email: "pending@example.com",
        role: "seller", sellerStatus: "pending", createdAt: stamp,
      }),
      setDoc(doc(db, "users/buyer-1"), {
        uid: "buyer-1", name: "Buyer", email: "buyer@example.com",
        role: "customer", createdAt: stamp,
      }),
      setDoc(doc(db, "users/other-buyer"), {
        uid: "other-buyer", name: "Other buyer", email: "other@example.com",
        role: "customer", createdAt: stamp,
      }),
      setDoc(doc(db, "products/prod-approved"), product("approved")),
      setDoc(doc(db, "products/prod-pending"), product("pending")),
      setDoc(doc(db, "orders/order-1"), {
        buyerId: "buyer-1", buyerEmail: "buyer@example.com",
        buyerName: "Buyer", buyerPhone: "+263771234567",
        deliveryArea: "Harare", deliveryNote: "", buyerConsent: true,
        sellerId: "seller-1", sellerName: "Test seller", sellerCity: "Harare",
        productId: "prod-approved", productTitle: "Solar lantern",
        productImageUrl: "", quantity: 1, unitPrice: 25, total: 25,
        currency: "USD", paymentPreference: "Cash on delivery",
        paymentStatus: "unpaid", status: "pending",
        createdAt: stamp, updatedAt: stamp,
      }),
    ]);
  });
}

async function reset() {
  await env.clearFirestore();
  await env.clearStorage();
  await seed();
}

const cases = [
  ["public users can list only approved product queries", async () => {
    const db = env.unauthenticatedContext().firestore();
    const result = await assertSucceeds(
      getDocs(query(collection(db, "products"), where("status", "==", "approved")))
    );
    assert.equal(result.size, 1);
    assert.equal(result.docs[0].id, "prod-approved");
  }],
  ["public users cannot read an unapproved product directly", async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "products/prod-pending")));
  }],
  ["customers cannot create product listings", async () => {
    const db = env.authenticatedContext("buyer-1", { email: "buyer@example.com" }).firestore();
    await assertFails(setDoc(doc(db, "products/customer-product"), {
      ...product("pending", "buyer-1"), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }));
  }],
  ["pending sellers cannot submit listings", async () => {
    const db = env.authenticatedContext("pending-seller", { email: "pending@example.com" }).firestore();
    await assertFails(setDoc(doc(db, "products/pending-seller-product"), {
      ...product("pending", "pending-seller"), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }));
  }],
  ["approved sellers can submit pending listings", async () => {
    const db = env.authenticatedContext("seller-1", { email: "seller@example.com" }).firestore();
    await assertSucceeds(setDoc(doc(db, "products/new-product"), {
      ...product("pending", "seller-1"), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }));
  }],
  ["approved sellers cannot publish their own listing", async () => {
    const db = env.authenticatedContext("seller-1", { email: "seller@example.com" }).firestore();
    await assertFails(updateDoc(doc(db, "products/prod-pending"), {
      status: "approved", updatedAt: serverTimestamp(),
    }));
  }],
  ["administrator can approve a pending listing", async () => {
    const db = env.authenticatedContext("admin-1", { email: "admin@example.com" }).firestore();
    await assertSucceeds(updateDoc(doc(db, "products/prod-pending"), {
      status: "approved", updatedAt: serverTimestamp(),
      reviewedAt: serverTimestamp(), reviewedBy: "admin-1",
    }));
    const readBack = await assertSucceeds(getDoc(doc(db, "products/prod-pending")));
    assert.equal(readBack.data().status, "approved");
  }],
  ["buyers cannot read another buyer's order", async () => {
    const db = env.authenticatedContext("other-buyer", { email: "other@example.com" }).firestore();
    await assertFails(getDoc(doc(db, "orders/order-1")));
  }],
  ["buyers cannot create orders using stale or altered prices", async () => {
    const db = env.authenticatedContext("buyer-1", { email: "buyer@example.com" }).firestore();
    await assertFails(setDoc(doc(db, "orders/invalid-price"), {
      buyerId: "buyer-1", buyerEmail: "buyer@example.com", buyerName: "Buyer",
      buyerPhone: "+263771234567", deliveryArea: "Harare", deliveryNote: "",
      buyerConsent: true, sellerId: "seller-1", sellerName: "Test seller", sellerCity: "Harare",
      productId: "prod-approved", productTitle: "Solar lantern", productImageUrl: "",
      quantity: 2, unitPrice: 999, total: 1998, currency: "USD",
      paymentPreference: "Cash on delivery", paymentStatus: "unpaid", status: "pending",
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }));
  }],
  ["customers cannot promote their own account to administrator", async () => {
    const db = env.authenticatedContext("buyer-1", { email: "buyer@example.com" }).firestore();
    await assertFails(updateDoc(doc(db, "users/buyer-1"), {
      role: "admin", updatedAt: serverTimestamp(),
    }));
  }],
  ["seller can accept a pending order and complete it only after acceptance", async () => {
    const db = env.authenticatedContext("seller-1", { email: "seller@example.com" }).firestore();
    await assertSucceeds(updateDoc(doc(db, "orders/order-1"), {
      status: "accepted", updatedAt: serverTimestamp(),
    }));
    await assertSucceeds(updateDoc(doc(db, "orders/order-1"), {
      status: "completed", updatedAt: serverTimestamp(),
    }));
  }],
  ["buyer can cancel their own pending order", async () => {
    const db = env.authenticatedContext("buyer-1", { email: "buyer@example.com" }).firestore();
    await assertSucceeds(updateDoc(doc(db, "orders/order-1"), {
      status: "cancelled", updatedAt: serverTimestamp(),
    }));
  }],
  ["seller cannot change an unpaid request to paid", async () => {
    const db = env.authenticatedContext("seller-1", { email: "seller@example.com" }).firestore();
    await assertFails(updateDoc(doc(db, "orders/order-1"), {
      paymentStatus: "paid", updatedAt: serverTimestamp(),
    }));
  }],
  ["buyers can create a valid unpaid order request", async () => {
    const db = env.authenticatedContext("buyer-1", { email: "buyer@example.com" }).firestore();
    await assertSucceeds(setDoc(doc(db, "orders/valid-order"), {
      buyerId: "buyer-1", buyerEmail: "buyer@example.com", buyerName: "Buyer",
      buyerPhone: "+263771234567", deliveryArea: "Harare", deliveryNote: "",
      buyerConsent: true, sellerId: "seller-1", sellerName: "Test seller", sellerCity: "Harare",
      productId: "prod-approved", productTitle: "Solar lantern", productImageUrl: "",
      quantity: 2, unitPrice: 25, total: 50, currency: "USD",
      paymentPreference: "Cash on delivery", paymentStatus: "unpaid", status: "pending",
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }));
  }],
  ["approved seller can upload a small product image", async () => {
    const context = env.authenticatedContext("seller-1", { email: "seller@example.com" });
    const image = new Blob([new Uint8Array([255, 216, 255, 217])], { type: "image/jpeg" });
    await assertSucceeds(uploadBytes(ref(context.storage(), "products/seller-1/rules-test.jpg"), image, {
      contentType: "image/jpeg",
    }));
  }],
  ["pending seller cannot upload product images", async () => {
    const context = env.authenticatedContext("pending-seller", { email: "pending@example.com" });
    const image = new Blob([new Uint8Array([255, 216, 255, 217])], { type: "image/jpeg" });
    await assertFails(uploadBytes(ref(context.storage(), "products/pending-seller/rules-test.jpg"), image, {
      contentType: "image/jpeg",
    }));
  }],
];

let failures = 0;
try {
  for (const [name, execute] of cases) {
    await reset();
    try {
      await execute();
      console.log("PASS " + name);
    } catch (error) {
      failures += 1;
      console.error("FAIL " + name + ": " + (error instanceof Error ? error.message : String(error)));
    }
  }
} finally {
  await env.cleanup();
}
console.log("Firebase security rules tests: " + (cases.length - failures) + "/" + cases.length + " passed.");
if (failures) process.exitCode = 1;

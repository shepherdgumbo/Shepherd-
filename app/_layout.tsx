import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#0B1F3A" },
          headerTintColor: "#FFFFFF",
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: "#F4F7FB" },
        }}
      >
        <Stack.Screen name="index" options={{ title: "ZimMarket", headerShown: false }} />
        <Stack.Screen name="login" options={{ title: "Your account" }} />
        <Stack.Screen name="sell" options={{ title: "Sell on ZimMarket" }} />
        <Stack.Screen name="cart" options={{ title: "Shopping cart" }} />
        <Stack.Screen name="orders" options={{ title: "Order requests" }} />
        <Stack.Screen name="account" options={{ title: "Your account" }} />
        <Stack.Screen name="my-listings" options={{ title: "My listings" }} />
        <Stack.Screen name="admin" options={{ title: "Admin review" }} />
        <Stack.Screen name="product/[id]" options={{ title: "Product details" }} />
      </Stack>
    </>
  );
}
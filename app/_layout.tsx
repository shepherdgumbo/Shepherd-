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
      </Stack>
    </>
  );
}
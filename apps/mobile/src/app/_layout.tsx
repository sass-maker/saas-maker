import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { ConnectionProvider } from "../lib/connection";
import { colors } from "../lib/theme";

export default function RootLayout() {
  return (
    <ConnectionProvider>
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.canvas },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="project/[id]" />
        </Stack>
      </SafeAreaView>
    </ConnectionProvider>
  );
}

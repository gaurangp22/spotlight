import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from '../store/AppContext';
import { C } from '../ui/theme';

export default function RootLayout() {
  return <SafeAreaProvider>
    <AppProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.paper }, animation: 'slide_from_right' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="ranking/[id]" />
        <Stack.Screen name="builder" />
        <Stack.Screen name="battle" />
        <Stack.Screen name="compare" />
        <Stack.Screen name="share/[id]" />
      </Stack>
    </AppProvider>
  </SafeAreaProvider>;
}

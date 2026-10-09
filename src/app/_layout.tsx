import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, useFonts } from '@expo-google-fonts/inter';
import { DarkTheme, DefaultTheme, ErrorBoundaryProps, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from '../store/AppContext';
import { usePushNotifications } from '../lib/push';
import { Toast } from '../ui/components';
import { PreviewProvider } from '../ui/preview';
import { Button, Ionicons, T } from '../ui/primitives';
import { space, useTheme } from '../ui/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 250, fade: true });
function PushNavigation() { usePushNotifications(); return null; }

export default function RootLayout() {
  const { c, dark } = useTheme();
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });
  const ready = fontsLoaded || !!fontError;
  useEffect(() => { SystemUI.setBackgroundColorAsync(c.bg).catch(() => {}); }, [c.bg]);
  // AppProvider hides the splash once the session and drafts are restored.
  if (!ready) return null;

  const base = dark ? DarkTheme : DefaultTheme;
  const navTheme = { ...base, colors: { ...base.colors, background: c.bg, card: c.bg, text: c.text, border: c.hairline, primary: c.accent } };
  return <SafeAreaProvider>
    <ThemeProvider value={navTheme}>
      <AppProvider>
        <PushNavigation />
        <PreviewProvider>
        <StatusBar style={dark ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: 'slide_from_right', gestureEnabled: true }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="auth" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="share/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="battle" options={{ presentation: 'fullScreenModal', animation: 'fade_from_bottom', gestureEnabled: false }} />
          <Stack.Screen name="rate" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="share/top" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="video" options={{ presentation: 'fullScreenModal', animation: 'fade_from_bottom', gestureEnabled: false }} />
        </Stack>
        <Toast />
        </PreviewProvider>
      </AppProvider>
    </ThemeProvider>
  </SafeAreaProvider>;
}

/** Last-resort recovery screen: a render error never leaves the user on a blank page. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { c } = useTheme();
  return <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: space.xxl, gap: space.md }}>
    <Ionicons name="musical-note" size={40} color={c.accent} />
    <T v="title2" center>Something skipped a beat.</T>
    <T v="subhead" tone="secondary" center>Riffs hit an unexpected problem. Your drafts are saved on this device.</T>
    {__DEV__ && <T v="footnote" tone="tertiary" center>{error.message}</T>}
    <Button label="Try again" onPress={() => void retry()} inline style={{ marginTop: space.md }} />
  </View>;
}

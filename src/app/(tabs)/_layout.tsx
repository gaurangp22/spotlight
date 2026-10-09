import { Tabs } from 'expo-router';
import { ColorValue, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptic } from '../../ui/haptics';
import { MiniPlayer } from '../../ui/preview';
import { IconName, Ionicons } from '../../ui/primitives';
import { FloatingTabBar, useTabBarSpace } from '../../ui/tabbar';
import { useTheme } from '../../ui/theme';

const icon = (outline: IconName, filled: IconName) => function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
  return <Ionicons name={focused ? filled : outline} size={24} color={color as string} />;
};

export default function TabsLayout() {
  const { c } = useTheme();
  const expanded = useWindowDimensions().width >= 768;
  const insets = useSafeAreaInsets();
  const barSpace = useTabBarSpace();
  return <View style={{ flex: 1 }}><Tabs screenListeners={{ tabPress: () => haptic.select() }}
    // Phones get the floating capsule; tablets and desktop web keep a side rail.
    tabBar={expanded ? undefined : (props) => <FloatingTabBar {...props} />}
    screenOptions={{
      headerShown: false,
      tabBarPosition: expanded ? 'left' : 'bottom',
      tabBarVariant: expanded ? 'material' : 'uikit',
      tabBarShowLabel: expanded,
      tabBarActiveTintColor: c.accent,
      tabBarInactiveTintColor: c.secondary,
      tabBarStyle: expanded ? { backgroundColor: c.bg, width: 96, paddingTop: 24, borderRightColor: c.hairline, borderRightWidth: StyleSheet.hairlineWidth } : { position: 'absolute' },
      tabBarItemStyle: expanded ? { minHeight: 72, marginBottom: 8 } : undefined,
      sceneStyle: { backgroundColor: c.bg },
    }}>
    <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home-outline', 'home') }} />
    <Tabs.Screen name="discover" options={{ title: 'Discover', tabBarIcon: icon('compass-outline', 'compass') }} />
    <Tabs.Screen name="create" options={{ title: 'Create', tabBarIcon: icon('add-circle-outline', 'add-circle') }} />
    <Tabs.Screen name="inbox" options={{ title: 'Messages', tabBarIcon: icon('chatbubbles-outline', 'chatbubbles') }} />
    <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person-circle-outline', 'person-circle') }} />
  </Tabs><MiniPlayer bottom={expanded ? insets.bottom + 8 : barSpace + 8} /></View>;
}

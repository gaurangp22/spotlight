import { Tabs } from 'expo-router';
import { ColorValue, StyleSheet, useWindowDimensions } from 'react-native';
import { haptic } from '../../ui/haptics';
import { IconName, Ionicons } from '../../ui/primitives';
import { font, useTheme } from '../../ui/theme';

const icon = (outline: IconName, filled: IconName) => function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
  return <Ionicons name={focused ? filled : outline} size={24} color={color as string} />;
};

export default function TabsLayout() {
  const { c } = useTheme();
  const expanded = useWindowDimensions().width >= 768;
  return <Tabs screenListeners={{ tabPress: () => haptic.select() }} screenOptions={{
    headerShown: false,
    tabBarPosition: expanded ? 'left' : 'bottom',
    tabBarVariant: expanded ? 'material' : 'uikit',
    tabBarLabelPosition: 'below-icon',
    tabBarActiveTintColor: c.accent,
    tabBarInactiveTintColor: c.tertiary,
    tabBarStyle: { backgroundColor: c.tabBar, borderTopColor: c.hairline, borderTopWidth: StyleSheet.hairlineWidth, elevation: 0, ...(expanded ? { width: 92, paddingTop: 24, borderRightColor: c.hairline, borderRightWidth: StyleSheet.hairlineWidth } : {}) },
    tabBarItemStyle: expanded ? { minHeight: 72, marginBottom: 8 } : undefined,
    tabBarLabelStyle: { fontFamily: font.medium, fontSize: 10.5, letterSpacing: 0.1 },
    sceneStyle: { backgroundColor: c.bg },
  }}>
    <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home-outline', 'home') }} />
    <Tabs.Screen name="discover" options={{ title: 'Discover', tabBarIcon: icon('compass-outline', 'compass') }} />
    <Tabs.Screen name="create" options={{ title: 'Create', tabBarIcon: icon('add-circle-outline', 'add-circle') }} />
    <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person-circle-outline', 'person-circle') }} />
  </Tabs>;
}

import { BlurView } from 'expo-blur';
import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../store/AppContext';
import { haptic } from './haptics';
import { Avatar, IconName, Ionicons, Tap } from './primitives';
import { curve, font, shadow, space, useTheme } from './theme';

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/** Height the floating bar occupies above the safe area, so tab screens can pad their content. */
export const TAB_BAR_HEIGHT = 62;
export const TAB_BAR_OFFSET = 8;
export function useTabBarSpace() {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + TAB_BAR_OFFSET + Math.max(insets.bottom - 6, 0);
}

const icons: Record<string, [IconName, IconName]> = {
  index: ['home-outline', 'home'],
  discover: ['search-outline', 'search'],
  inbox: ['chatbubbles-outline', 'chatbubbles'],
  profile: ['person-circle-outline', 'person-circle'],
};

/** Frosted glass: a real blur where the platform supports it, a translucent fill elsewhere. */
function Glass({ style, children }: { style: object; children: React.ReactNode }) {
  const { c } = useTheme();
  return <View style={[style, { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }, shadow(c, 3)]}>
    <BlurView intensity={Platform.OS === 'android' ? 0 : 60} tint={c.material === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'} style={StyleSheet.absoluteFill} />
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.tabBar }]} />
    {children}
  </View>;
}

/** iOS-style floating tab bar: a glass capsule of destinations, and a separate glass button to create. */
export function FloatingTabBar({ state, navigation, descriptors }: BottomTabBarProps) {
  const { c } = useTheme();
  const { user, unread } = useApp();
  const insets = useSafeAreaInsets();
  const go = (index: number) => {
    const route = state.routes[index];
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (state.index !== index && !event.defaultPrevented) { haptic.select(); navigation.navigate(route.name, route.params); }
  };
  const create = state.routes.findIndex((r) => r.name === 'create');
  return <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: Math.max(insets.bottom - 6, 0) + TAB_BAR_OFFSET, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg }}>
    <Glass style={styles.capsule}>
      <View accessibilityRole="tablist" style={styles.row}>
        {state.routes.map((route, index) => {
          if (route.name === 'create') return null;
          const focused = state.index === index;
          const label = descriptors[route.key].options.title ?? route.name;
          const [outline, filled] = icons[route.name] ?? ['ellipse-outline', 'ellipse'];
          const color = focused ? c.accent : c.text;
          return <Tap key={route.key} onPress={() => go(index)} feedback={false} scaleTo={0.9} accessibilityRole="tab" accessibilityLabel={route.name === 'index' && unread ? `${label}, ${unread} new` : label} accessibilityState={{ selected: focused }}
            style={[styles.item, focused && { backgroundColor: c.material === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
            {route.name === 'profile' && user?.avatar
              ? <View style={{ borderRadius: 14, borderWidth: 1.5, borderColor: focused ? c.accent : 'transparent' }}><Avatar name={user.name} seed={user.handle} uri={user.avatar} size={24} /></View>
              : <Ionicons name={focused ? filled : outline} size={23} color={color} />}
            <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: focused ? font.semibold : font.medium, fontSize: 10.5, letterSpacing: 0, color, marginTop: 2 }}>{label}</Text>
            {route.name === 'index' && unread > 0 && <View style={[styles.badge, { backgroundColor: c.accentFill, borderColor: c.surface }]} />}
          </Tap>;
        })}
      </View>
    </Glass>
    {create >= 0 && <Tap onPress={() => go(create)} feedback="press" scaleTo={0.88} accessibilityRole="tab" accessibilityLabel="Create" accessibilityState={{ selected: state.index === create }}>
      <Glass style={styles.plus}>
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}><Ionicons name="add" size={30} color={c.accent} /></View>
      </Glass>
    </Tap>}
  </View>;
}

const styles = StyleSheet.create({
  capsule: { flex: 1, maxWidth: 380, height: TAB_BAR_HEIGHT, borderRadius: TAB_BAR_HEIGHT / 2, ...curve },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 5 },
  item: { flex: 1, height: TAB_BAR_HEIGHT - 10, borderRadius: (TAB_BAR_HEIGHT - 10) / 2, alignItems: 'center', justifyContent: 'center' },
  plus: { width: TAB_BAR_HEIGHT, height: TAB_BAR_HEIGHT, borderRadius: TAB_BAR_HEIGHT / 2 },
  badge: { position: 'absolute', top: 8, right: '30%', width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
});

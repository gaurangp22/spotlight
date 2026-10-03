import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import { C } from '../../ui/theme';

export default function TabsLayout() {
  return <Tabs screenOptions={{
    headerShown: false,
    tabBarStyle: { backgroundColor: C.ink, borderTopWidth: 0, minHeight: 66, paddingTop: 6 },
    tabBarActiveTintColor: C.white, tabBarInactiveTintColor: '#A5A39C',
    tabBarLabelStyle: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: 5 },
  }}>
    <Tabs.Screen name="index" options={{ title: 'Following', tabBarIcon: ({ color }) => <MaterialCommunityIcons name="home-outline" size={23} color={color} /> }} />
    <Tabs.Screen name="discover" options={{ title: 'Discover', tabBarIcon: ({ color }) => <MaterialCommunityIcons name="compass-outline" size={23} color={color} /> }} />
    <Tabs.Screen name="create" options={{ title: 'Create', tabBarIcon: ({ color }) => <MaterialCommunityIcons name="plus-box-outline" size={24} color={color} /> }} />
    <Tabs.Screen name="profile" options={{ title: 'You', tabBarIcon: ({ color }) => <MaterialCommunityIcons name="account-outline" size={23} color={color} /> }} />
  </Tabs>;
}

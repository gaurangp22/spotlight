import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { api, apiSessionEpoch } from './api';
import { useApp } from '../store/AppContext';

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
export async function registerPush(expectedEpoch = apiSessionEpoch()) {
  const checkSession = () => { if (apiSessionEpoch() !== expectedEpoch) throw new Error('Your account changed. Enable notifications again from the current account.'); };
  checkSession();
  if (!Device.isDevice) throw new Error('Push alerts need an installed app on a physical phone.');
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('default', { name: 'Riffs activity', importance: Notifications.AndroidImportance.DEFAULT });
  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') throw new Error('Notifications are disabled. Allow them in your device settings.');
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) throw new Error('This build needs its EAS project configured.');
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  checkSession();
  await api('/push/token', { method: 'PUT', body: { token } });
  checkSession();
  await api('/me/preferences', { method: 'PATCH', body: { push: true } });
}
export function usePushNotifications() {
  const { user, config } = useApp(); const userId = user?.id;
  useEffect(() => {
    if (!userId || !config?.push || !Device.isDevice) return;
    let active = true; const epoch = apiSessionEpoch();
    api<{ push: boolean }>('/me/preferences').then(async (prefs) => {
      if (!active || !prefs.push || apiSessionEpoch() !== epoch) return;
      const permission = await Notifications.getPermissionsAsync();
      if (active && apiSessionEpoch() === epoch && permission.status === 'granted') await registerPush(epoch);
    }).catch(() => {});
    return () => { active = false; };
  }, [userId, config?.push]);
  useEffect(() => {
    if (!userId) return;
    const receive = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data || {};
      if (typeof data.conversationId === 'string' && /^[a-zA-Z0-9-]+$/.test(data.conversationId)) router.push(`/messages/${data.conversationId}`);
      else if (typeof data.postId === 'string' && /^[a-zA-Z0-9-]+$/.test(data.postId)) router.push(`/ranking/${data.postId}`);
      else router.push('/notifications');
      Notifications.clearLastNotificationResponse();
    };
    const response = Notifications.getLastNotificationResponse(); if (response) receive(response);
    const listener = Notifications.addNotificationResponseReceivedListener(receive);
    return () => listener.remove();
  }, [userId]);
}

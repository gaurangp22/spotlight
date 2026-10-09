import AsyncStorage from '@react-native-async-storage/async-storage';

// The invite someone arrived with, kept until they finish signing up (they may browse first).
const KEY = 'margin-invite-v1';
const HANDLE = /^[a-z0-9_]{3,24}$/;

export async function rememberInvite(handle: string) {
  const clean = handle.trim().toLowerCase().replace(/^@/, '');
  if (HANDLE.test(clean)) await AsyncStorage.setItem(KEY, clean).catch(() => {});
}
export async function pendingInvite() {
  const value = await AsyncStorage.getItem(KEY).catch(() => null);
  return value && HANDLE.test(value) ? value : null;
}
export async function clearInvite() {
  await AsyncStorage.removeItem(KEY).catch(() => {});
}

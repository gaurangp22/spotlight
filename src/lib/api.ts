import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

function apiBase() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  if (!__DEV__) return '';
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `http://${window.location.hostname}:8787`;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host || '10.0.2.2'}:8787`;
}
export const API_URL = apiBase();
const TOKEN_KEY = 'margin-session-v1';
let token: string | null = null;
export function setApiToken(value: string | null) { token = value; }
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function api<T>(path: string, options: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  if (!API_URL) throw new ApiError('The app server has not been configured. Set EXPO_PUBLIC_API_URL before building.', 503);
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api${path}`, {
      method: options.method || 'GET',
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal || AbortSignal.timeout(20000),
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError('Cannot reach the server. Check your connection and try again. Your draft is saved.', 0);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data.error || 'The request failed. Try again.', response.status);
  return data as T;
}
export async function readToken(): Promise<string | null> {
  if (Platform.OS === 'web') return typeof window === 'undefined' ? null : window.localStorage.getItem(TOKEN_KEY);
  return SecureStore.getItemAsync(TOKEN_KEY);
}
export async function storeToken(value: string | null) {
  if (Platform.OS === 'web') { if (value) window.localStorage.setItem(TOKEN_KEY, value); else window.localStorage.removeItem(TOKEN_KEY); }
  else if (value) await SecureStore.setItemAsync(TOKEN_KEY, value);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
  setApiToken(value);
}
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Try again.';

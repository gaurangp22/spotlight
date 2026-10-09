import { Platform, Share } from 'react-native';
import { API_URL } from './api';

const web = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, '');
// The API serves public preview pages, so links still work for people who don't have the app.
const publicBase = web || (/^https?:\/\//.test(API_URL) ? API_URL : '');

export function postLink(id: string) {
  if (web) return `${web}/ranking/${id}`;
  return publicBase ? `${publicBase}/p/${id}` : `marginmusic://ranking/${id}`;
}

/** A personal invite: opens a landing page for new people, and the join screen in the app. */
export function inviteLink(handle: string) {
  const name = handle.replace(/^@/, '');
  return publicBase ? `${publicBase}/join/${name}` : `marginmusic://join/${name}`;
}

/**
 * Shares a link through the system share sheet. Browsers without one get the link copied instead.
 * Resolves to what happened, so the caller can say "Link copied".
 */
export async function shareLink(message: string, url: string): Promise<'shared' | 'copied' | 'dismissed'> {
  if (Platform.OS === 'web') {
    const nav = typeof navigator === 'undefined' ? undefined : navigator;
    if (nav?.share) {
      try { await nav.share({ text: message, url }); return 'shared'; }
      catch (error) { if ((error as Error)?.name === 'AbortError') return 'dismissed'; }
    }
    try {
      if (nav?.clipboard) { await nav.clipboard.writeText(`${message} ${url}`); return 'copied'; }
    } catch { /* Clipboard blocked (insecure page or browser setting): let them copy it by hand. */ }
    if (typeof window !== 'undefined' && typeof window.prompt === 'function') { window.prompt('Copy this link and send it to a friend:', url); return 'dismissed'; }
    throw new Error(`Copy this link: ${url}`);
  }
  const result = await Share.share(Platform.OS === 'ios' ? { message, url } : { message: `${message} ${url}` });
  return result.action === Share.dismissedAction ? 'dismissed' : 'shared';
}

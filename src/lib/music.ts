import { MusicItem, MusicKind } from './types';
import { api } from './api';

/** The device's storefront, so regional music (e.g. Indian releases) ranks well. Falls back to US. */
export function storefront() {
  try {
    const region = new Intl.Locale(Intl.DateTimeFormat().resolvedOptions().locale).maximize().region;
    return region && /^[A-Z]{2}$/.test(region) ? region : 'US';
  } catch { return 'US'; }
}

/**
 * Searches the catalog for one category through our server, which caches results and falls back to a
 * second provider when one is rate-limited. Music switches to Spotify when the person or server has it.
 */
export async function searchCatalog(query: string, kind: MusicKind, sources: { spotifyConnected?: boolean; spotifyCatalog?: boolean } = {}, signal?: AbortSignal): Promise<MusicItem[]> {
  const term = query.trim();
  if (!term) return [];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort);
  try {
    const musical = kind === 'song' || kind === 'album' || kind === 'artist';
    if (musical && sources.spotifyConnected) return (await api<{ items: MusicItem[] }>(`/spotify/search?${new URLSearchParams({ q: term, kind })}`, { signal: controller.signal })).items;
    return (await api<{ items: MusicItem[] }>(`/catalog?${new URLSearchParams({ q: term, kind, country: storefront() })}`, { signal: controller.signal })).items;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

/** Kept for existing callers: music-only search. */
export const searchMusic = (query: string, kind: MusicKind, spotifyConnected = false, signal?: AbortSignal) => searchCatalog(query, kind, { spotifyConnected }, signal);

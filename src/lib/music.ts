import { MusicItem, MusicKind } from './types';
import { api } from './api';

type ItunesResult = {
  trackId?: number; collectionId?: number; trackName?: string; collectionName?: string;
  artistName: string; artworkUrl100?: string; artworkUrl600?: string; trackViewUrl?: string; collectionViewUrl?: string;
  previewUrl?: string;
};

/** The device's storefront, so regional music (e.g. Indian releases) ranks well. Falls back to US. */
function storefront() {
  try {
    const region = new Intl.Locale(Intl.DateTimeFormat().resolvedOptions().locale).maximize().region;
    return region && /^[A-Z]{2}$/.test(region) ? region : 'US';
  } catch { return 'US'; }
}

async function itunes(term: string, kind: 'song' | 'album' | 'podcast', signal: AbortSignal): Promise<MusicItem[]> {
  const entity = { song: 'song', album: 'album', podcast: 'podcast' }[kind];
  const media = kind === 'podcast' ? 'podcast' : 'music';
  const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=${entity}&media=${media}&limit=35&country=${storefront()}`, { signal });
  if (!response.ok) throw new Error('Search is unavailable. Try again.');
  const payload = await response.json() as { results: ItunesResult[] };
  const seen = new Set<string>();
  return payload.results.flatMap((item) => {
    const id = String(kind === 'song' ? item.trackId : item.collectionId);
    const title = kind === 'song' ? item.trackName : item.collectionName;
    if (!id || id === 'undefined' || !title || seen.has(id)) return [];
    seen.add(id);
    return [{
      id: `${kind}-${id}`, title, artist: item.artistName || 'Unknown', kind,
      album: kind === 'song' ? item.collectionName : undefined,
      artwork: (item.artworkUrl600 || item.artworkUrl100?.replace('100x100bb', '600x600bb')),
      externalUrl: kind === 'song' ? item.trackViewUrl : item.collectionViewUrl,
      previewUrl: kind === 'song' ? item.previewUrl : undefined,
    }];
  });
}

/**
 * Searches the catalog for one category. Songs, albums, and podcasts come straight from Apple's
 * public search; artists, shows, books, and movies go through our server, which also switches music
 * search to Spotify when the server or the person has Spotify connected.
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
    if ((kind === 'song' || kind === 'album') && !sources.spotifyCatalog) return await itunes(term, kind, controller.signal);
    if (kind === 'podcast') return await itunes(term, 'podcast', controller.signal);
    return (await api<{ items: MusicItem[] }>(`/catalog?${new URLSearchParams({ q: term, kind })}`, { signal: controller.signal })).items;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

/** Kept for existing callers: music-only search. */
export const searchMusic = (query: string, kind: MusicKind, spotifyConnected = false, signal?: AbortSignal) => searchCatalog(query, kind, { spotifyConnected }, signal);

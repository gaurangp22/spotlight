import { MusicItem, MusicKind } from './types';

type ItunesResult = {
  trackId?: number; collectionId?: number; trackName?: string; collectionName?: string;
  artistName: string; artworkUrl100?: string;
};

export async function searchMusic(query: string, kind: MusicKind): Promise<MusicItem[]> {
  const term = query.trim();
  if (!term) return [];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const entity = kind === 'song' ? 'song' : 'album';
    const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=${entity}&media=music&limit=35`, { signal: controller.signal });
    if (!response.ok) throw new Error('Music search is unavailable. Try again.');
    const payload = await response.json() as { results: ItunesResult[] };
    const seen = new Set<string>();
    return payload.results.flatMap((item) => {
      const id = String(kind === 'song' ? item.trackId : item.collectionId);
      const title = kind === 'song' ? item.trackName : item.collectionName;
      if (!id || id === 'undefined' || !title || seen.has(id)) return [];
      seen.add(id);
      return [{
        id: `${kind}-${id}`, title, artist: item.artistName,
        album: kind === 'song' ? item.collectionName : undefined, kind,
        artwork: item.artworkUrl100?.replace('100x100bb', '600x600bb'),
      }];
    });
  } finally {
    clearTimeout(timeout);
  }
}

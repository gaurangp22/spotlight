import { fail } from './security.mjs';

// Keyless public catalogs (Apple's search with Deezer as a fallback, TVmaze, Open Library) plus TMDB when TMDB_API_KEY is set.
// Results are cached briefly so repeated searches don't hit the upstream rate limits.
const TTL = 10 * 60 * 1000, MAX_ENTRIES = 500;
const year = (date) => (typeof date === 'string' && /^\d{4}/.test(date) ? date.slice(0, 4) : '');
const https = (url) => (typeof url === 'string' && url.startsWith('https://') ? url : undefined);
// Deezer's top-level genre ids; album search results carry one, track results don't.
const DEEZER_GENRES = { 132: 'Pop', 116: 'Hip-Hop/Rap', 152: 'Rock', 113: 'Dance', 165: 'R&B/Soul', 85: 'Alternative', 106: 'Electronic', 466: 'Folk', 144: 'Reggae',
  129: 'Jazz', 98: 'Classical', 173: 'Soundtrack', 464: 'Metal', 169: 'Soul', 2: 'African', 16: 'Asian', 153: 'Blues', 75: 'Brazilian', 81: 'Indian', 197: 'Latin', 84: 'Country' };
const genre = (name) => (typeof name === 'string' && name.trim() && name.length <= 60 ? { genre: name.trim() } : {});

export function catalogService(fetcher = fetch) {
  const cache = new Map();
  const tmdbKey = process.env.TMDB_API_KEY || '';
  async function json(url, headers = {}) {
    const response = await fetcher(url, { headers: { Accept: 'application/json', ...headers }, signal: AbortSignal.timeout(10000) });
    if (response.status === 429) fail(429, 'Search is busy right now. Try again in a moment.');
    if (!response.ok) fail(502, 'Search is unavailable right now. Try again.');
    return response.json();
  }
  /** Apple's public search. Asked from the server so browsers aren't blocked and results are cached. */
  async function itunes(q, kind, country) {
    const entity = { song: 'song', album: 'album', podcast: 'podcast' }[kind];
    const data = await json(`https://itunes.apple.com/search?${new URLSearchParams({ term: q, entity, media: kind === 'podcast' ? 'podcast' : 'music', limit: '35', country })}`);
    const seen = new Set();
    return (data.results || []).flatMap((r) => {
      const id = kind === 'song' ? r.trackId : r.collectionId, title = kind === 'song' ? r.trackName : r.collectionName;
      if (!id || !title || seen.has(id)) return [];
      seen.add(id);
      const art = https(r.artworkUrl600 || r.artworkUrl100?.replace('100x100bb', '600x600bb'));
      return [{ id: `${kind}-${id}`, kind, title, artist: r.artistName || 'Unknown', ...(kind === 'song' && r.collectionName ? { album: r.collectionName } : {}),
        ...(art ? { artwork: art } : {}), ...(https(kind === 'song' ? r.trackViewUrl : r.collectionViewUrl) ? { externalUrl: kind === 'song' ? r.trackViewUrl : r.collectionViewUrl } : {}),
        ...(kind === 'song' && https(r.previewUrl) ? { previewUrl: r.previewUrl } : {}), ...(kind !== 'podcast' ? { ...genre(r.primaryGenreName), ...(year(r.releaseDate) ? { year: year(r.releaseDate) } : {}) } : {}) }];
    });
  }
  /** Used when Apple is rate-limiting this server, so search keeps working. */
  async function deezer(q, kind) {
    const data = await json(`https://api.deezer.com/search/${kind === 'song' ? 'track' : 'album'}?${new URLSearchParams({ q, limit: '30' })}`);
    return (data.data || []).filter((x) => x?.id && x.title && x.artist?.name).map((x) => ({
      id: `deezer-${kind}-${x.id}`, kind, title: x.title, artist: x.artist.name, ...(kind === 'song' && x.album?.title ? { album: x.album.title } : {}),
      ...(https(kind === 'song' ? x.album?.cover_xl : x.cover_xl) ? { artwork: kind === 'song' ? x.album.cover_xl : x.cover_xl } : {}), ...(https(x.link) ? { externalUrl: x.link } : {}),
      ...genre(DEEZER_GENRES[x.genre_id ?? x.album?.genre_id]), ...(year(x.release_date || x.album?.release_date) ? { year: year(x.release_date || x.album?.release_date) } : {}),
    }));
  }
  const music = (kind) => async (q, country) => {
    try { return await itunes(q, kind, country); } catch (error) { if (kind === 'podcast') throw error; return deezer(q, kind); }
  };
  const sources = {
    song: music('song'), album: music('album'), podcast: music('podcast'),
    async artist(q) {
      const data = await json(`https://api.deezer.com/search/artist?${new URLSearchParams({ q, limit: '30' })}`);
      return (data.data || []).filter((a) => a?.id && a.name).map((a) => ({
        id: `artist-dz${a.id}`, kind: 'artist', title: a.name,
        artist: a.nb_fan ? `${Intl.NumberFormat('en', { notation: 'compact' }).format(a.nb_fan)} fans` : 'Artist',
        artwork: https(a.picture_xl || a.picture_big), externalUrl: https(a.link),
      }));
    },
    async movie(q) {
      if (!tmdbKey) fail(503, 'Movie search has not been set up on this server yet.');
      // A v4 read-access token is long; a v3 key is 32 hex characters.
      const bearer = tmdbKey.length > 40;
      const params = new URLSearchParams({ query: q, include_adult: 'false', ...(bearer ? {} : { api_key: tmdbKey }) });
      const data = await json(`https://api.themoviedb.org/3/search/movie?${params}`, bearer ? { Authorization: `Bearer ${tmdbKey}` } : {});
      return (data.results || []).filter((m) => m?.id && m.title).slice(0, 30).map((m) => ({
        id: `movie-tmdb${m.id}`, kind: 'movie', title: m.title, artist: year(m.release_date) ? `Film · ${year(m.release_date)}` : 'Film',
        artwork: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : undefined, externalUrl: `https://www.themoviedb.org/movie/${m.id}`,
      }));
    },
    async show(q) {
      const data = await json(`https://api.tvmaze.com/search/shows?${new URLSearchParams({ q })}`);
      return (data || []).map((r) => r?.show).filter((s) => s?.id && s.name).map((s) => ({
        id: `show-tvm${s.id}`, kind: 'show', title: s.name,
        artist: [s.network?.name || s.webChannel?.name, year(s.premiered)].filter(Boolean).join(' · ') || 'Series',
        artwork: https(s.image?.original || s.image?.medium), externalUrl: https(s.url),
      }));
    },
    async book(q) {
      const data = await json(`https://openlibrary.org/search.json?${new URLSearchParams({ q, limit: '30', fields: 'key,title,author_name,cover_i,first_publish_year' })}`);
      return (data.docs || []).filter((b) => b?.key && b.title).map((b) => ({
        id: `book-ol${b.key.split('/').pop()}`, kind: 'book', title: b.title,
        artist: b.author_name?.slice(0, 2).join(', ') || (b.first_publish_year ? `Book · ${b.first_publish_year}` : 'Book'),
        artwork: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-L.jpg` : undefined, externalUrl: `https://openlibrary.org${b.key}`,
      }));
    },
  };
  return {
    kinds: { song: true, album: true, podcast: true, artist: true, movie: !!tmdbKey, show: true, book: true },
    async search(kind, q, country = 'US') {
      if (!Object.hasOwn(sources, kind)) fail(400, 'Choose a valid category.');
      if (!/^[A-Z]{2}$/.test(country)) country = 'US';
      const key = `${kind}:${country}:${q.toLowerCase()}`;
      const hit = cache.get(key);
      if (hit && hit.until > Date.now()) return hit.items;
      const items = await sources[kind](q, country);
      if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value);
      cache.set(key, { items, until: Date.now() + TTL });
      return items;
    },
  };
}

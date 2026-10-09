import { fail } from './security.mjs';

// Keyless public catalogs (Deezer, TVmaze, Open Library) plus TMDB when TMDB_API_KEY is set.
// Results are cached briefly so repeated searches don't hit the upstream rate limits.
const TTL = 10 * 60 * 1000, MAX_ENTRIES = 500;
const year = (date) => (typeof date === 'string' && /^\d{4}/.test(date) ? date.slice(0, 4) : '');
const https = (url) => (typeof url === 'string' && url.startsWith('https://') ? url : undefined);

export function catalogService(fetcher = fetch) {
  const cache = new Map();
  const tmdbKey = process.env.TMDB_API_KEY || '';
  async function json(url, headers = {}) {
    const response = await fetcher(url, { headers: { Accept: 'application/json', ...headers }, signal: AbortSignal.timeout(10000) });
    if (response.status === 429) fail(429, 'Search is busy right now. Try again in a moment.');
    if (!response.ok) fail(502, 'Search is unavailable right now. Try again.');
    return response.json();
  }
  const sources = {
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
    kinds: { artist: true, movie: !!tmdbKey, show: true, book: true },
    async search(kind, q) {
      if (!Object.hasOwn(sources, kind)) fail(400, 'Choose a valid category.');
      const key = `${kind}:${q.toLowerCase()}`;
      const hit = cache.get(key);
      if (hit && hit.until > Date.now()) return hit.items;
      const items = await sources[kind](q);
      if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value);
      cache.set(key, { items, until: Date.now() + TTL });
      return items;
    },
  };
}

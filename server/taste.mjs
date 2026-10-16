// Per-person taste: the songs, albums, artists, genres, and eras someone keeps coming back to, learned from
// what they rate, log, save, share, post, like, and open, plus what their taste twins love. Riffs doesn't play
// music, so these social signals stand in for listening data.

const DAY = 86400000;
/** A signal loses half its pull every 90 days; favourite artists never fade. */
export const HALF_LIFE_DAYS = 90;
export const decay = (at, now = Date.now()) => {
  const time = at ? Date.parse(at) : NaN;
  return Number.isFinite(time) ? 0.5 ** (Math.max(0, now - time) / (HALF_LIFE_DAYS * DAY)) : 1;
};
const CREDIT_SPLIT = /,|&| x |\bfeat\.?|\bft\.|\bwith\b/i;
/** First credited artist ("Kendrick Lamar & SZA" -> "Kendrick Lamar"). */
export const leadArtist = (name) => String(name || '').split(CREDIT_SPLIT)[0].trim();
const artistName = (item) => leadArtist(item.kind === 'artist' ? item.title : item.artist).slice(0, 150);
const artistKey = (item) => artistName(item).toLowerCase();
/** Title and lead artist without versions ("(2015 Remaster)", "- Live"), to spot one song under several IDs. */
const sameSong = (item) => `${String(item.title || '').toLowerCase().replace(/\s*[([].*?[)\]]|\s+-\s+.*$/g, '').replace(/[^a-z0-9]+/g, ' ').trim()}|${artistKey(item)}`;
export const genreKey = (genre) => (typeof genre === 'string' ? genre.trim().toLowerCase().slice(0, 60) : '');
export const decadeOf = (year) => (/^\d{4}$/.test(String(year ?? '')) ? `${Math.floor(Number(year) / 10) * 10}s` : '');

// Coarse families let a metal fan also see rock, and a trap fan also see hip-hop.
const FAMILIES = [
  ['rock', /metal|rock|punk|grunge|emo|hardcore|alternative|indie|shoegaze/],
  ['hiphop', /hip.?hop|rap|trap|drill|grime/],
  ['rnb', /r&b|soul|funk/],
  ['electronic', /electro|dance|house|techno|edm|trance|dubstep|drum|ambient/],
  ['jazz', /jazz|blues/],
  ['classical', /classical|opera|soundtrack|score/],
  ['country', /country|americana|bluegrass/],
  ['latin', /latin|reggaeton|salsa|urbano|mexicano|bachata/],
  ['indian', /bollywood|indian|punjabi|tamil|telugu|desi|filmi|hindi/],
  ['kpop', /k-pop|korean/],
  ['jpop', /j-pop|anime|japanese/],
  ['world', /reggae|dancehall|afro|african|world/],
  ['folk', /folk|singer.?songwriter|acoustic/],
  ['pop', /pop/],
];
export const familyOf = (genre) => FAMILIES.find(([, pattern]) => pattern.test(genre))?.[0] || genre;
/** Storefronts whose catalogs carry a family's music best (an Indian listener's Bollywood lives in IN). */
const REGIONS = { indian: 'IN', kpop: 'KR', jpop: 'JP', latin: 'MX' };
// Common Apple Music genre names, so a family's weight reaches posts tagged with a sibling genre.
const VOCABULARY = ['rock', 'hard rock', 'metal', 'heavy metal', 'alternative', 'indie rock', 'punk', 'prog-rock/art rock', 'hip-hop/rap', 'rap', 'hip-hop',
  'r&b/soul', 'soul', 'funk', 'electronic', 'dance', 'house', 'techno', 'jazz', 'blues', 'classical', 'soundtrack', 'country', 'latin', 'urbano latino',
  'bollywood', 'indian pop', 'punjabi', 'tamil', 'telugu', 'k-pop', 'j-pop', 'reggae', 'afrobeats', 'african', 'folk', 'singer/songwriter', 'pop', 'indie pop'];

// How each source reads on a recommendation: "Because you rated Metallica".
const REASONS = { rated: 'rated', logged: 'listen to', saved: 'saved', favourite: 'love', shared: 'shared', posted: 'posted', liked: 'liked posts about', opened: 'checked out' };
export const because = (via, name) => `Because you ${REASONS[via] || 'like'} ${name}`;

function ranked(map, limit) {
  const top = Math.max(0, ...[...map.values()].map((e) => e.w));
  const scale = top || 1;
  return [...map].map(([name, e]) => ({ ...e.extra, name, weight: Math.round(Math.max(-1, Math.min(1, e.w / scale)) * 1000) / 1000 }))
    .filter((e) => Math.abs(e.weight) >= 0.02).sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name)).slice(0, limit);
}

/**
 * Turns weighted signals ({ item, weight, at, via }) into ranked affinities between -1 and 1 for specific items,
 * artists, genres, genre families, and decades. Untagged items borrow genres the same artist carries elsewhere.
 * Each artist and item remembers its strongest source and how often it came up, for "because you…" reasons.
 */
export function buildProfile(signals, now = Date.now()) {
  const items = new Map(), artists = new Map(), genres = new Map(), families = new Map(), decades = new Map(), learned = new Map(), deezerIds = {};
  const add = (map, key, w, extra) => {
    if (!key) return;
    const entry = map.get(key) || { w: 0, top: 0, extra: {} };
    entry.w += w;
    if (extra) {
      entry.extra.count = (entry.extra.count || 0) + 1;
      if (Math.abs(w) > entry.top) { entry.top = Math.abs(w); Object.assign(entry.extra, extra, { count: entry.extra.count }); }
    }
    map.set(key, entry);
  };
  for (const { item } of signals) {
    const a = artistKey(item), g = genreKey(item.genre);
    if (a && g) { const known = learned.get(a) || new Map(); known.set(g, (known.get(g) || 0) + 1); learned.set(a, known); }
  }
  for (const { item, weight, at, via = 'rated' } of signals) {
    const w = weight * decay(at, now);
    if (!w) continue;
    const a = artistKey(item), g = genreKey(item.genre);
    add(artists, a, w, { label: artistName(item), via });
    if (item.kind !== 'artist' && typeof item.id === 'string') {
      add(items, item.id, w, { item: { id: item.id, kind: item.kind, title: item.title, artist: item.artist, ...(item.album ? { album: item.album } : {}) }, via });
    }
    if (item.kind === 'artist' && /^artist-dz\d+$/.test(item.id)) deezerIds[a] = item.id.slice(9);
    add(decades, decadeOf(item.year), w);
    const known = [...(learned.get(a) || [])], total = known.reduce((s, [, n]) => s + n, 0);
    const tags = g ? [[g, w]] : known.map(([name, n]) => [name, (0.5 * w * n) / total]);
    for (const [name, value] of tags) { add(genres, name, value); add(families, familyOf(name), value); }
  }
  const familyList = ranked(families, 8);
  return {
    items: ranked(items, 40), artists: ranked(artists, 40), genres: ranked(genres, 20), families: familyList, decades: ranked(decades, 6),
    regions: familyList.filter((f) => f.weight > 0.25 && REGIONS[f.name]).map((f) => REGIONS[f.name]),
    deezerIds, signals: signals.length,
  };
}

/**
 * id/name -> weight maps for the feed query: items (yours and your twins' favourites), artists plus related
 * artists, genres expanded through their families at half strength, and decades. Small enough for a page cursor.
 */
export function feedWeights(profile) {
  const items = {}, artists = {}, genres = {}, decades = {};
  for (const { item, weight } of profile.twins || []) { items[item.id] = Math.round(weight * 600) / 1000; artists[artistKey(item)] ??= Math.round(weight * 400) / 1000; }
  for (const { name, weight } of profile.related || []) artists[name] = weight;
  for (const { name, weight } of profile.artists) artists[name] = weight;
  for (const { name, weight } of profile.items) items[name] = weight;
  for (const { name, weight } of profile.families) {
    if (weight <= 0) continue;
    for (const genre of VOCABULARY) if (familyOf(genre) === name) genres[genre] = Math.max(genres[genre] ?? -1, Math.round(weight * 500) / 1000);
    if (!VOCABULARY.includes(name)) genres[name] = Math.max(genres[name] ?? -1, Math.round(weight * 500) / 1000);
  }
  for (const { name, weight } of profile.genres) genres[name] = weight;
  for (const { name, weight } of profile.decades || []) decades[name] = weight;
  const trim = (map, n) => Object.fromEntries(Object.entries(map).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, n));
  return { items: trim(items, 30), artists: trim(artists, 48), genres: trim(genres, 40), decades: trim(decades, 6) };
}

const parse = (value) => { try { return JSON.parse(value); } catch { return null; } };
/** Items carried by a post, each with an equal share of the post's weight. */
const share = (row, weight, via) => {
  const items = (parse(row.items) || []).filter((i) => i && typeof i === 'object').slice(0, 12);
  return items.map((item) => ({ item, weight: weight / Math.sqrt(items.length), at: row.at, via }));
};

/**
 * @param match tasteMatch from api.mjs, so twins here agree with the twins people see on Discover.
 * @param visibleSQL/viewerArgs the post visibility rule, so a twin's private ratings never leak into picks.
 */
export function tasteService({ db, catalog, fetcher = fetch, match, visibleSQL, viewerArgs, ttl = 10 * 60000 }) {
  const profiles = new Map(), related = new Map(), picks = new Map();
  const remember = (map, key, value, max) => { if (map.size >= max) map.delete(map.keys().next().value); map.set(key, value); };

  async function signals(userId) {
    const me = await db.get('SELECT handle, favorite_artists FROM users WHERE id=?', userId);
    const [ratings, likes, opens, savedItems, savedPosts, history, shared, posted, contributed] = await Promise.all([
      db.all('SELECT item, score, updated_at AS at FROM ratings WHERE user_id=? ORDER BY updated_at DESC LIMIT 300', userId),
      db.all(`SELECT p.items, coalesce(e.created_at, p.created_at) AS at FROM reactions r JOIN posts p ON p.id=r.post_id
        LEFT JOIN post_engagements e ON e.user_id=r.user_id AND e.post_id=r.post_id AND e.kind='like' WHERE r.user_id=? AND p.user_id<>? ORDER BY at DESC LIMIT 150`, userId, userId),
      db.all(`SELECT p.items, e.created_at AS at FROM post_engagements e JOIN posts p ON p.id=e.post_id WHERE e.user_id=? AND e.kind='open' AND p.user_id<>? ORDER BY e.created_at DESC LIMIT 150`, userId, userId),
      db.all('SELECT item, created_at AS at FROM saved_items WHERE user_id=? ORDER BY created_at DESC LIMIT 150', userId),
      db.all('SELECT p.items, s.created_at AS at FROM saved_posts s JOIN posts p ON p.id=s.post_id WHERE s.user_id=? ORDER BY s.created_at DESC LIMIT 100', userId),
      db.all('SELECT item, played_at AS at FROM listening_history WHERE user_id=? ORDER BY played_at DESC LIMIT 200', userId),
      db.all('SELECT item, created_at AS at FROM messages WHERE sender_id=? AND item IS NOT NULL AND deleted=0 ORDER BY created_at DESC LIMIT 100', userId),
      // Your own rankings, mood boards, pods, and takes; reviews are already counted through ratings.
      db.all("SELECT items, updated_at AS at FROM posts WHERE user_id=? AND kind<>'review' ORDER BY updated_at DESC LIMIT 60", userId),
      db.all("SELECT items, updated_at AS at FROM posts WHERE kind='pod' AND user_id<>? AND items LIKE ? ORDER BY updated_at DESC LIMIT 30", userId, `%"addedBy":"@${me?.handle || '-'}"%`),
    ]);
    const one = (rows, weight, via) => rows.flatMap((r) => { const item = parse(r.item); return item ? [{ item, weight: typeof weight === 'function' ? weight(r) : weight, at: r.at, via }] : []; });
    const mine = `@${me?.handle}`;
    return [
      ...(parse(me?.favorite_artists) || []).map((item) => ({ item, weight: 1, via: 'favourite' })),
      // A 10 pulls fully toward the item and its artist; a 0 pushes away just as hard.
      ...one(ratings, (r) => (r.score - 5) / 5, 'rated'),
      // Every diary entry counts, so songs someone keeps logging rise on repeat plays.
      ...one(savedItems, 0.7, 'saved'), ...one(history, 0.3, 'logged'), ...one(shared, 0.6, 'shared'),
      ...posted.flatMap((r) => share(r, 0.8, 'posted')),
      ...contributed.flatMap((r) => (parse(r.items) || []).filter((i) => i?.addedBy === mine).map((item) => ({ item, weight: 0.5, at: r.at, via: 'posted' }))),
      ...likes.flatMap((r) => share(r, 0.5, 'liked')), ...savedPosts.flatMap((r) => share(r, 0.5, 'saved')), ...opens.flatMap((r) => share(r, 0.15, 'opened')),
    ].filter((s) => s.item && typeof s.item === 'object' && (s.item.title || s.item.artist));
  }

  /** Deezer's related artists for one name, cached for a day. Failures cache briefly as empty. */
  async function relatedTo(name, deezerId) {
    const hit = related.get(name);
    if (hit && hit.until > Date.now()) return hit.names;
    const get = async (url) => { const r = await fetcher(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(2500) }); if (!r.ok) throw new Error('related'); return r.json(); };
    let names = [];
    try {
      const id = deezerId || (await get(`https://api.deezer.com/search/artist?${new URLSearchParams({ q: name, limit: '1' })}`)).data?.[0]?.id;
      if (id && /^\d+$/.test(String(id))) names = ((await get(`https://api.deezer.com/artist/${id}/related?limit=12`)).data || []).map((a) => String(a?.name || '').toLowerCase().slice(0, 150)).filter(Boolean);
      remember(related, name, { names, until: Date.now() + DAY }, 1000);
    } catch { remember(related, name, { names, until: Date.now() + 10 * 60000 }, 1000); }
    return names;
  }

  /**
   * The five closest taste twins (same match as Discover, from ratings this person may see, bots excluded)
   * and the things they loved that this person hasn't rated, weighted by how close the twin is.
   */
  async function twinsOf(userId) {
    if (!match || !visibleSQL) return [];
    const mine = await db.all('SELECT item_id, score, item FROM ratings WHERE user_id=?', userId);
    if (mine.length < 3) return [];
    const candidates = (await db.all(`SELECT DISTINCT r2.user_id AS id FROM ratings r1 JOIN ratings r2 ON r2.item_id=r1.item_id AND r2.user_id<>r1.user_id
      JOIN users u ON u.id=r2.user_id WHERE r1.user_id=? AND u.is_bot=0 LIMIT 60`, userId)).map((r) => r.id);
    if (!candidates.length) return [];
    const rows = await db.all(`SELECT r.user_id, r.item_id, r.score, r.item, u.handle FROM ratings r JOIN posts p ON p.id=r.post_id JOIN users u ON u.id=r.user_id
      WHERE r.user_id IN (${candidates.map(() => '?').join(',')}) AND ${visibleSQL} LIMIT 20000`, ...candidates, ...viewerArgs(userId));
    const byUser = new Map();
    for (const r of rows) byUser.set(r.user_id, [...(byUser.get(r.user_id) || []), r]);
    const rated = new Set(mine.map((r) => r.item_id));
    const twins = [...byUser.values()].map((theirs) => ({ theirs, percent: match(mine, theirs).percent }))
      .filter((t) => t.percent !== null && t.percent >= 40).sort((a, b) => b.percent - a.percent).slice(0, 5);
    const found = new Map();
    for (const { theirs, percent } of twins) for (const r of theirs) {
      const weight = Math.round((percent / 100) * ((r.score - 5) / 5) * 1000) / 1000, item = parse(r.item);
      if (item && weight > 0.15 && !rated.has(r.item_id) && weight > (found.get(r.item_id)?.weight || 0)) found.set(r.item_id, { item, weight, by: `@${r.handle}` });
    }
    return [...found.values()].sort((a, b) => b.weight - a.weight).slice(0, 30);
  }

  async function build(userId) {
    const profile = buildProfile(await signals(userId));
    const follows = (await db.all('SELECT followed_id FROM follows WHERE follower_id=? ORDER BY followed_id LIMIT 50', userId)).map((r) => r.followed_id);
    // Liking Metallica should also lift Megadeth and Slayer: expand the five strongest artists.
    const seeds = profile.artists.filter((a) => a.weight > 0.15).slice(0, 5);
    const known = new Set(profile.artists.map((a) => a.name)), found = new Map();
    const [lists, twins] = await Promise.all([
      Promise.race([Promise.all(seeds.map((a) => relatedTo(a.name, profile.deezerIds[a.name]))), new Promise((r) => setTimeout(() => r([]), 3000).unref?.())]),
      twinsOf(userId),
    ]);
    lists.forEach((names, s) => names.forEach((name, i) => {
      const weight = Math.round(seeds[s].weight * 0.6 * (1 - i / 15) * 1000) / 1000;
      if (!known.has(name) && weight > (found.get(name)?.weight || 0)) found.set(name, { name, weight, seed: seeds[s].label });
    }));
    const relatedArtists = [...found.values()].sort((a, b) => b.weight - a.weight).slice(0, 24);
    return { ...profile, related: relatedArtists, twins, follows };
  }

  async function profile(userId) {
    const hit = profiles.get(userId);
    if (hit && hit.until > Date.now()) return hit.promise;
    const promise = build(userId);
    remember(profiles, userId, { promise, until: Date.now() + ttl }, 2000);
    promise.catch(() => profiles.delete(userId));
    return promise;
  }

  function invalidate(userId) {
    profiles.delete(userId);
    for (const key of picks.keys()) if (key.startsWith(`${userId}:`)) picks.delete(key);
  }

  /**
   * Starter picks, each with the reason it was chosen: twins' favourites, more from the artists and records
   * someone keeps returning to, related artists, and their top genres (searched in the storefront that genre
   * lives in). Lists favour the person's favourite decades. Empty (personalized: false) without positive signals.
   */
  async function recommendations(userId, kind, country = 'US') {
    const key = `${userId}:${kind}:${country}`, hit = picks.get(key);
    if (hit && hit.until > Date.now()) return hit.value;
    const p = await profile(userId);
    const artists = p.artists.filter((a) => a.weight > 0.1), genres = p.genres.filter((g) => g.weight > 0.1);
    let value = { items: [], personalized: false, basis: [] };
    if (artists.length || genres.length || p.twins.length) {
      const disliked = new Set(p.artists.filter((a) => a.weight < 0).map((a) => a.name));
      // Catalogs list the same song under several IDs (remasters, deluxe editions), so rated songs also match by title and artist.
      const ratedRows = await db.all('SELECT item_id, item FROM ratings WHERE user_id=?', userId);
      const rated = new Set(ratedRows.map((r) => r.item_id));
      const ratedNames = new Set(ratedRows.map((r) => { try { return sameSong(JSON.parse(r.item)); } catch { return ''; } }));
      const decades = new Map(p.decades.map((d) => [d.name, d.weight]));
      // Something played, saved, or rated again and again gets its own search: more from that record.
      const favourite = p.items.find((i) => i.count >= 2 && i.weight > 0.2);
      const queries = [
        ...artists.slice(0, 3).map((a) => ({ term: a.label || a.name, take: 5, reason: because(a.via, a.label || a.name) })),
        ...(favourite ? [{ term: `${leadArtist(favourite.item.artist)} ${favourite.item.album || favourite.item.title}`, take: 4, reason: `Because you keep coming back to ${favourite.item.title}` }] : []),
        ...p.related.slice(0, 2).map((a) => ({ term: a.name, take: 4, reason: `Because you like ${a.seed}` })),
        ...genres.slice(0, 2).map((g) => ({ term: g.name, take: 6, family: familyOf(g.name), reason: `More ${g.name.replace(/(^|[\s/-])\S/g, (m) => m.toUpperCase())}` })),
      ];
      const usable = (item) => !rated.has(item.id) && !ratedNames.has(sameSong(item)) && !disliked.has(artistKey(item));
      const results = await Promise.allSettled(queries.map((q) => catalog.search(kind, q.term, (q.family && REGIONS[q.family]) || country)));
      const lists = [
        p.twins.filter((t) => t.item.kind === kind && usable(t.item)).slice(0, 6).map((t) => ({ ...t.item, reason: `Loved by ${t.by}, your taste twin` })),
        ...results.map((r, i) => {
          if (r.status !== 'fulfilled') return [];
          const q = queries[i];
          return r.value.filter((item) => usable(item) && (!q.family || !item.genre || familyOf(genreKey(item.genre)) === q.family))
            .map((item, n) => ({ item, rank: n - 6 * (decades.get(decadeOf(item.year)) || 0) })).sort((a, b) => a.rank - b.rank)
            .slice(0, q.take).map(({ item }) => ({ ...item, reason: q.reason }));
        }),
      ];
      const seen = new Set(), items = [];
      for (let round = 0; items.length < 30 && lists.some((l) => l.length > round); round++) {
        for (const list of lists) { const item = list[round]; if (item && !seen.has(item.id)) { seen.add(item.id); items.push(item); } }
      }
      if (items.length) value = { items: items.slice(0, 30), personalized: true, basis: [...genres.slice(0, 2).map((e) => e.name), ...artists.slice(0, 2).map((e) => e.label || e.name)] };
    }
    remember(picks, key, { value, until: Date.now() + ttl }, 2000);
    return value;
  }

  return { profile, invalidate, recommendations };
}

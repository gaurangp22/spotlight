import { fail, text } from './security.mjs';

// Pods hold up to 500 songs. Spotify's public player only lists the first 100, so longer playlists need the
// server's Spotify app credentials (SPOTIFY_CLIENT_ID/SECRET), which read every track without anyone logging in.
const LIMIT = 500, EMBED_LIMIT = 100;
const BROWSER = { 'user-agent': 'Mozilla/5.0 (compatible; RiffsBot/1.0; +https://riffs.app)', 'accept-language': 'en' };

/** Reads the JSON a public page embeds in a <script> tag, or fails with a message the person can act on. */
function embeddedJson(html, pattern, message) {
  const match = html.match(pattern);
  if (!match) fail(422, message);
  try { return JSON.parse(match[1]); } catch { fail(422, message); }
}

async function page(fetcher, url, message) {
  let response;
  try { response = await fetcher(url, { headers: BROWSER, signal: AbortSignal.timeout(15000) }); } catch { fail(502, message); }
  if (!response.ok) fail(response.status === 404 ? 404 : 422, message);
  return response.text();
}

/** Runs `work` over `list` with at most `size` in flight. */
async function pool(list, size, work) {
  const out = new Array(list.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, list.length) }, async () => { while (next < list.length) { const i = next++; out[i] = await work(list[i]).catch(() => undefined); } }));
  return out;
}

/** Spotify's oEmbed gives each track's cover; the 300px thumbnail is swapped for the 640px image. */
async function spotifyCovers(items, fetcher) {
  const covers = await pool(items, 10, async (item) => {
    const response = await fetcher(`https://open.spotify.com/oembed?url=${encodeURIComponent(item.externalUrl)}`, { signal: AbortSignal.timeout(8000) });
    const url = response.ok ? (await response.json()).thumbnail_url : undefined;
    return typeof url === 'string' && url.startsWith('https://') ? url.replace('ab67616d00001e02', 'ab67616d0000b273') : undefined;
  });
  return items.map((item, i) => (covers[i] ? { ...item, artwork: covers[i] } : item));
}

/**
 * Spotify's public embed player carries the first 100 tracks of a playlist, so public playlists import without
 * anyone connecting an account; covers come from oEmbed. With app credentials, the Web API reads every track.
 */
async function spotifyPlaylist(id, sourceUrl, fetcher, spotify) {
  if (spotify?.catalog) {
    try {
      const full = await spotify.playlistTracks(id, LIMIT);
      if (full.items.length) return { title: String(full.title || 'My playlist').slice(0, 100), sourceUrl, items: full.items, note: full.more ? `Imported the first ${LIMIT} songs.` : '' };
    } catch { /* Spotify's own mixes are hidden from apps; the public player still lists them. */ }
  }
  const message = 'This Spotify playlist couldn’t be read. Make sure it’s public, or paste the track list instead.';
  const html = await page(fetcher, `https://open.spotify.com/embed/playlist/${id}`, message);
  const data = embeddedJson(html, /<script id="__NEXT_DATA__" type="application\/json">([\s\S]+?)<\/script>/, message);
  const entity = data?.props?.pageProps?.state?.data?.entity;
  if (!entity || !Array.isArray(entity.trackList)) fail(422, message);
  const items = entity.trackList.flatMap((track) => {
    const trackId = /^spotify:track:([A-Za-z0-9]{22})$/.exec(track?.uri || '')?.[1];
    if (!trackId || !track.title || !track.subtitle) return [];
    return [{ id: `spotify-song-${trackId}`, kind: 'song', title: String(track.title).slice(0, 300), artist: String(track.subtitle).replace(/ /g, ' ').slice(0, 300), externalUrl: `https://open.spotify.com/track/${trackId}`, spotifyId: trackId }];
  });
  const capped = entity.trackList.length >= EMBED_LIMIT;
  return { title: String(entity.name || entity.title || 'My playlist').slice(0, 100), sourceUrl, items: await spotifyCovers(items.slice(0, EMBED_LIMIT), fetcher),
    note: capped ? `Imported the first ${EMBED_LIMIT} songs — that’s all Spotify shares publicly. Add more with search.` : '' };
}

/** Apple Music playlist pages include their track list (with artwork) as server data. */
async function applePlaylist(sourceUrl, fetcher) {
  const message = 'This Apple Music playlist couldn’t be read. Make sure it’s public, or paste the track list instead.';
  const html = await page(fetcher, sourceUrl, message);
  const data = embeddedJson(html, /<script type="application\/json" id="serialized-server-data">([\s\S]+?)<\/script>/, message);
  const sections = (Array.isArray(data) ? data : data?.data)?.[0]?.data?.sections;
  if (!Array.isArray(sections)) fail(422, message);
  const header = sections.find((s) => s.itemKind === 'containerDetailHeaderLockup')?.items?.[0];
  const tracks = sections.filter((s) => s.itemKind === 'trackLockup').flatMap((s) => s.items || []);
  const items = tracks.flatMap((track) => {
    const id = track?.contentDescriptor?.identifiers?.storeAdamID;
    const artist = (track?.subtitleLinks || []).map((l) => l.title).filter(Boolean).join(', ');
    if (!id || !/^\d+$/.test(String(id)) || !track.title || !artist) return [];
    const art = track.artwork?.dictionary?.url;
    const url = track.contentDescriptor.url;
    return [{ id: `song-${id}`, kind: 'song', title: String(track.title).slice(0, 300), artist: artist.slice(0, 300),
      ...(track.tertiaryLinks?.[0]?.title ? { album: String(track.tertiaryLinks[0].title).slice(0, 300) } : {}),
      ...(typeof art === 'string' && art.startsWith('https://') ? { artwork: art.replace('{w}x{h}bb.{f}', '600x600bb.jpg') } : {}),
      ...(typeof url === 'string' && url.startsWith('https://music.apple.com/') ? { externalUrl: url } : {}) }];
  });
  return { title: String(header?.title || 'My playlist').slice(0, 100), sourceUrl, items: items.slice(0, LIMIT), note: items.length > LIMIT ? `Imported the first ${LIMIT} tracks.` : '' };
}

async function deezerPlaylist(id, sourceUrl, fetcher) {
  const response = await fetcher(`https://api.deezer.com/playlist/${id}`, { signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  if (!response.ok || data.error || !data.title) fail(422, 'This playlist is unavailable. Try a public link or paste the track list.');
  let tracks = data.tracks?.data || [];
  if (tracks.length < Math.min(Number(data.nb_tracks) || 0, LIMIT)) { const r = await fetcher(`https://api.deezer.com/playlist/${id}/tracks?limit=${LIMIT}`, { signal: AbortSignal.timeout(15000) }); const more = await r.json(); if (r.ok && !more.error) tracks = more.data || tracks; }
  return { title: data.title.slice(0, 100), sourceUrl, items: tracks.slice(0, LIMIT).filter((t) => t.id && t.title && t.artist?.name).map((t) => ({ id: `deezer-song-${t.id}`, kind: 'song', title: t.title, artist: t.artist.name, artwork: t.album?.cover_medium, externalUrl: `https://www.deezer.com/track/${t.id}` })), note: Number(data.nb_tracks) > LIMIT ? `Imported the first ${LIMIT} tracks.` : '' };
}

/** Reads a public playlist link from a fixed set of provider hosts. Nothing else is ever fetched. */
export async function playlistLink(input, fetcher = fetch, spotify = null) {
  let url; try { url = new URL(text(input, 'Playlist link', 10, 1000).trim()); } catch { fail(400, 'Paste a full playlist link, like open.spotify.com/playlist/…'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) fail(400, 'Use an HTTPS playlist link.');
  const sourceUrl = url.origin + url.pathname.replace(/\/$/, '');
  const spotifyMatch = url.hostname === 'open.spotify.com' && url.pathname.match(/^\/(?:intl-[a-z-]+\/)?(?:embed\/)?playlist\/([A-Za-z0-9]{22})\/?$/);
  if (spotifyMatch) return spotifyPlaylist(spotifyMatch[1], `https://open.spotify.com/playlist/${spotifyMatch[1]}`, fetcher, spotify);
  if (url.hostname === 'music.apple.com' && /^\/[a-z]{2}\/playlist\/[^/]+\/pl\.[A-Za-z0-9.-]+\/?$/.test(url.pathname)) return applePlaylist(sourceUrl, fetcher);
  const deezer = (url.hostname === 'www.deezer.com' || url.hostname === 'deezer.com') && url.pathname.match(/^\/(?:[a-z]{2}\/)?playlist\/(\d+)\/?$/);
  if (deezer) return deezerPlaylist(deezer[1], sourceUrl, fetcher);
  fail(400, 'That doesn’t look like a playlist link. Copy it from Share → Copy link in your music app.');
}

export function playlistSource(value) {
  if (!value) return undefined;
  let u; try { u = new URL(value); } catch { fail(400, 'Invalid playlist source.'); }
  if (value.length > 1000 || u.protocol !== 'https:' || !['open.spotify.com','music.apple.com','www.deezer.com','deezer.com'].includes(u.hostname) || u.username || u.password || u.port) fail(400, 'Invalid playlist source.');
  return u.origin + u.pathname;
}

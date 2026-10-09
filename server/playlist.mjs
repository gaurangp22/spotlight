import { fail, text } from './security.mjs';

/** Fixed provider hosts only. A Spotify link supplies metadata, not permission to read tracks. */
export async function playlistLink(input, fetcher = fetch) {
  let url; try { url = new URL(text(input, 'Playlist link', 10, 1000)); } catch { fail(400, 'Paste a playlist link from Spotify, Apple Music, or Deezer.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) fail(400, 'Use an HTTPS playlist link.');
  const sourceUrl = url.origin + url.pathname;
  if (url.hostname === 'open.spotify.com' && /^\/(?:intl-[a-z-]+\/)?playlist\/[A-Za-z0-9]{22}\/?$/.test(url.pathname)) {
    let title = 'My playlist';
    try { const response = await fetcher(`https://open.spotify.com/oembed?url=${encodeURIComponent(sourceUrl)}`, { signal: AbortSignal.timeout(10000) }); if (response.ok) title = (await response.json()).title?.slice(0, 100) || title; } catch {}
    return { title, sourceUrl, items: [], note: 'Source link saved. Spotify does not provide playlist tracks through this metadata endpoint. Paste your track list below or add picks manually.' };
  }
  if (url.hostname === 'music.apple.com' && /\/playlist\/[^/]+\/(pl\.[A-Za-z0-9.-]+)\/?$/.test(url.pathname)) return { title: 'My playlist', sourceUrl, items: [], note: 'Source link saved. Paste the track list below or add picks manually; automatic Apple Music playlist import needs a provider integration.' };
  const deezer = url.hostname === 'www.deezer.com' || url.hostname === 'deezer.com';
  const match = deezer && url.pathname.match(/^\/(?:[a-z]{2}\/)?playlist\/(\d+)\/?$/);
  if (match) {
    const response = await fetcher(`https://api.deezer.com/playlist/${match[1]}`, { signal: AbortSignal.timeout(15000) });
    const data = await response.json();
    if (!response.ok || data.error || !data.title) fail(422, 'This Deezer playlist is unavailable. Try a public link or paste the track list.');
    let tracks = data.tracks?.data || [];
    if (tracks.length < Math.min(Number(data.nb_tracks) || 0, 100)) { const r = await fetcher(`https://api.deezer.com/playlist/${match[1]}/tracks?limit=100`, { signal: AbortSignal.timeout(15000) }); const page = await r.json(); if (r.ok && !page.error) tracks = page.data || tracks; }
    return { title: data.title.slice(0, 100), sourceUrl, items: tracks.slice(0, 100).filter((t) => t.id && t.title && t.artist?.name).map((t) => ({ id: `deezer-song-${t.id}`, kind: 'song', title: t.title, artist: t.artist.name, artwork: t.album?.cover_medium, externalUrl: `https://www.deezer.com/track/${t.id}` })), note: Number(data.nb_tracks) > 100 ? 'Imported the first 100 tracks. Review them before publishing.' : 'Review the imported picks before publishing.' };
  }
  fail(400, 'Use a full Spotify, Apple Music, or Deezer playlist link.');
}

export function playlistSource(value) {
  if (!value) return undefined;
  let u; try { u = new URL(value); } catch { fail(400, 'Invalid playlist source.'); }
  if (value.length > 1000 || u.protocol !== 'https:' || !['open.spotify.com','music.apple.com','www.deezer.com','deezer.com'].includes(u.hostname) || u.username || u.password || u.port) fail(400, 'Invalid playlist source.');
  return u.origin + u.pathname;
}

import { createHash } from 'node:crypto';
import { decrypt, encrypt, digest, randomToken, fail } from './security.mjs';

export function spotifyService(db, key, fetcher = fetch) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
  // With a client secret, the server searches Spotify's catalog for everyone using its own app
  // token (client credentials), so people don't need to connect an account just to search.
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  let app = null;
  const tokenUrl = 'https://accounts.spotify.com/api/token';
  const locks = new Map();
  async function exchange(params) {
    const response = await fetcher(tokenUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, ...params }), signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    if (!response.ok) fail(response.status === 429 ? 429 : 400, 'Spotify authorization expired or was refused. Reconnect Spotify.');
    return data;
  }
  async function accessToken(userId) {
    const row = await db.get('SELECT credentials FROM spotify WHERE user_id = ?', userId);
    if (!row) fail(409, 'Connect Spotify in Settings first.');
    const data = decrypt(row.credentials, key);
    if (data.expiresAt > Date.now() + 60000) return data.access_token;
    if (!locks.has(userId)) locks.set(userId, (async () => {
      const refreshed = await exchange({ grant_type: 'refresh_token', refresh_token: data.refresh_token });
      const next = { ...data, ...refreshed, expiresAt: Date.now() + refreshed.expires_in * 1000 };
      await db.run('UPDATE spotify SET credentials = ? WHERE user_id = ?', encrypt(next, key), userId);
      return next.access_token;
    })().finally(() => locks.delete(userId)));
    return locks.get(userId);
  }
  async function appToken() {
    if (app && app.expiresAt > Date.now() + 60000) return app.token;
    app = (async () => {
      const response = await fetcher(tokenUrl, {
        method: 'POST', body: new URLSearchParams({ grant_type: 'client_credentials' }), signal: AbortSignal.timeout(15000),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.access_token) fail(502, 'Spotify search is unavailable right now. Try again.');
      return { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    })();
    try { app = await app; return app.token; } catch (error) { app = null; throw error; }
  }
  async function call(userId, path) {
    const token = userId ? await accessToken(userId) : await appToken();
    const response = await fetcher(`https://api.spotify.com/v1${path}`, {
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000),
    });
    if (response.status === 429) fail(429, `Spotify is busy. Try again in ${response.headers.get('retry-after') || 'a few'} seconds.`);
    if (response.status === 403) fail(403, 'Spotify denied access. Check that your account is allowed in the Spotify developer app.');
    if (!response.ok) fail(502, 'Spotify could not complete this request. Try reconnecting.');
    return response.json();
  }
  function item(track, kind = 'song') {
    if (kind === 'artist') return {
      id: `spotify-artist-${track.id}`, spotifyId: track.id, kind, title: track.name,
      artist: track.genres?.[0] ? track.genres[0].replace(/(^|\s)\S/g, (l) => l.toUpperCase()) : 'Artist',
      artwork: track.images?.[0]?.url, externalUrl: track.external_urls?.spotify,
    };
    return {
      id: `spotify-${kind}-${track.id}`, spotifyId: track.id, kind, title: track.name,
      artist: (track.artists || []).map((a) => a.name).join(', '), album: track.album?.name,
      artwork: (track.album?.images || track.images || [])[0]?.url,
      externalUrl: track.external_urls?.spotify,
    };
  }
  return {
    configured: !!(clientId && redirectUri),
    catalog: !!(clientId && clientSecret),
    async start(userId, returnUri) {
      if (!clientId || !redirectUri) fail(503, 'Spotify has not been configured on this server yet.');
      const allowed = ['marginmusic://spotify-callback', `${(process.env.WEB_APP_URL || 'http://localhost:8081').replace(/\/$/, '')}/spotify-callback`];
      if (!allowed.includes(returnUri)) fail(400, 'Unsupported Spotify return address.');
      const state = randomToken(), verifier = randomToken() + randomToken();
      await db.run('DELETE FROM oauth_states WHERE expires_at < ?', Date.now());
      await db.run('INSERT INTO oauth_states VALUES (?, ?, ?, ?, ?)', digest(state), userId, verifier, returnUri, Date.now() + 600000);
      const url = new URL('https://accounts.spotify.com/authorize');
      url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri,
        response_type: 'code', state, scope: 'playlist-read-private playlist-read-collaborative user-top-read',
        code_challenge_method: 'S256', code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      }).toString();
      return { url: url.toString() };
    },
    async callback(params) {
      const row = await db.get('SELECT * FROM oauth_states WHERE state_hash = ? AND expires_at > ?', digest(params.get('state') || ''), Date.now());
      if (!row) fail(400, 'Spotify connection expired. Return to the app and try again.');
      const consumed = await db.run('DELETE FROM oauth_states WHERE state_hash = ?', row.state_hash);
      if (!consumed.rowsAffected) fail(400, 'This Spotify connection has already been used.');
      let status = 'connected';
      try {
        if (params.get('error') || !params.get('code')) fail(400, 'Spotify connection canceled.');
        const data = await exchange({ grant_type: 'authorization_code', code: params.get('code'), code_verifier: row.verifier, redirect_uri: redirectUri });
        await db.run('INSERT INTO spotify VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET credentials = excluded.credentials', row.user_id, encrypt({ ...data, expiresAt: Date.now() + data.expires_in * 1000 }, key));
      } catch { status = 'failed'; }
      return `${row.return_uri}?status=${status}`;
    },
    /** Searches as the connected user, or with the app token when userId is null. */
    async search(userId, query, kind) {
      const type = { album: 'album', artist: 'artist' }[kind] || 'track';
      const data = await call(userId, `/search?${new URLSearchParams({ q: query, type, limit: '10' })}`);
      return (data[`${type}s`]?.items || []).filter((t) => t?.id).map((t) => item(t, type === 'track' ? 'song' : kind));
    },
    async top(userId, type, range) {
      try {
        const data = await call(userId, `/me/top/${type}?${new URLSearchParams({ limit: '50', time_range: range })}`);
        return { items: (data.items || []).filter((t) => t?.id).map((t) => item(t, type === 'artists' ? 'artist' : 'song')) };
      } catch (error) {
        // Accounts connected before top-music import was added haven't granted that permission.
        if (error.status === 403) fail(403, 'Reconnect Spotify in Settings to import your top music.');
        throw error;
      }
    },
    /**
     * Imports a pasted Spotify link with the app token, so it works for everyone without
     * connecting an account (and outside development mode's 25-user limit).
     */
    async fromLink(input) {
      if (!clientId || !clientSecret) fail(503, 'Spotify links have not been set up on this server yet.');
      let link = String(input || '').trim();
      // Short share links (spotify.link/…) redirect to the full open.spotify.com address.
      if (/^https:\/\/spotify\.link\/[A-Za-z0-9]+$/.test(link)) {
        const response = await fetcher(link, { redirect: 'follow', signal: AbortSignal.timeout(10000) }).catch(() => null);
        link = response?.url || '';
      }
      const match = link.match(/^https:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(track|album|playlist|artist)\/([A-Za-z0-9]{22})/) || link.match(/^spotify:(track|album|playlist|artist):([A-Za-z0-9]{22})$/);
      if (!match) fail(400, 'Paste a Spotify link to a song, album, playlist, or artist.');
      const [, type, id] = match;
      try {
        if (type === 'track') { const t = await call(null, `/tracks/${id}`); return { title: t.name, items: [item(t)] }; }
        if (type === 'artist') {
          const a = await call(null, `/artists/${id}`);
          const top = await call(null, `/artists/${id}/top-tracks?market=US`).catch(() => ({ tracks: [] }));
          return { title: a.name, items: [item(a, 'artist'), ...(top.tracks || []).filter((t) => t?.id).map((t) => item(t))] };
        }
        if (type === 'album') {
          const a = await call(null, `/albums/${id}`);
          const album = { ...item(a, 'album'), artwork: a.images?.[0]?.url };
          const tracks = (a.tracks?.items || []).filter((t) => t?.id).map((t) => item({ ...t, album: { name: a.name, images: a.images } }));
          return { title: a.name, items: [album, ...tracks].slice(0, 100) };
        }
        const p = await call(null, `/playlists/${id}?fields=name`);
        const items = [];
        for (let offset = 0; items.length < 100 && offset < 300; offset += 50) {
          const page = await call(null, `/playlists/${id}/items?limit=50&offset=${offset}`);
          items.push(...(page.items || []).map((i) => i.item ?? i.track).filter((t) => t?.id && t.type === 'track' && !t.is_local).map((t) => item(t)));
          if (!page.next) break;
        }
        return { title: p.name, items: items.slice(0, 100) };
      } catch (error) {
        // Spotify hides its own editorial and algorithmic playlists (and private ones) from third-party apps.
        if (error.status === 403 || error.status === 502) fail(404, 'Spotify didn’t share that link. Private playlists and Spotify’s own mixes can’t be imported — try a public playlist someone made.');
        throw error;
      }
    },
    async playlists(userId, offset) {
      const data = await call(userId, `/me/playlists?limit=50&offset=${offset}`);
      return { items: (data.items || []).filter(Boolean).map((p) => ({ id: p.id, name: p.name, artwork: p.images?.[0]?.url, count: p.items?.total ?? p.tracks?.total ?? 0 })), nextOffset: data.next ? offset + data.items.length : null };
    },
    async tracks(userId, playlistId, offset) {
      const data = await call(userId, `/playlists/${playlistId}/items?limit=50&offset=${offset}`);
      return { items: (data.items || []).map((i) => i.item ?? i.track).filter((t) => t?.id && t.type === 'track' && !t.is_local).map((t) => item(t)), nextOffset: data.next ? offset + data.items.length : null };
    },
  };
}

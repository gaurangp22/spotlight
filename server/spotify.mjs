import { createHash } from 'node:crypto';
import { decrypt, encrypt, digest, randomToken, fail } from './security.mjs';

export function spotifyService(db, key, fetcher = fetch) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
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
  async function call(userId, path) {
    const token = await accessToken(userId);
    const response = await fetcher(`https://api.spotify.com/v1${path}`, {
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000),
    });
    if (response.status === 429) fail(429, `Spotify is busy. Try again in ${response.headers.get('retry-after') || 'a few'} seconds.`);
    if (response.status === 403) fail(403, 'Spotify denied access. Check that your account is allowed in the Spotify developer app.');
    if (!response.ok) fail(502, 'Spotify could not complete this request. Try reconnecting.');
    return response.json();
  }
  function item(track, kind = 'song') {
    return {
      id: `spotify-${kind}-${track.id}`, spotifyId: track.id, kind, title: track.name,
      artist: (track.artists || []).map((a) => a.name).join(', '), album: track.album?.name,
      artwork: (track.album?.images || track.images || [])[0]?.url,
      externalUrl: track.external_urls?.spotify,
    };
  }
  return {
    configured: !!(clientId && redirectUri),
    async start(userId, returnUri) {
      if (!clientId || !redirectUri) fail(503, 'Spotify has not been configured on this server yet.');
      const allowed = ['marginmusic://spotify-callback', `${(process.env.WEB_APP_URL || 'http://localhost:8081').replace(/\/$/, '')}/spotify-callback`];
      if (!allowed.includes(returnUri)) fail(400, 'Unsupported Spotify return address.');
      const state = randomToken(), verifier = randomToken() + randomToken();
      await db.run('DELETE FROM oauth_states WHERE expires_at < ?', Date.now());
      await db.run('INSERT INTO oauth_states VALUES (?, ?, ?, ?, ?)', digest(state), userId, verifier, returnUri, Date.now() + 600000);
      const url = new URL('https://accounts.spotify.com/authorize');
      url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri,
        response_type: 'code', state, scope: 'playlist-read-private playlist-read-collaborative',
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
    async search(userId, query, kind) {
      const type = kind === 'album' ? 'album' : 'track';
      const data = await call(userId, `/search?${new URLSearchParams({ q: query, type, limit: '10' })}`);
      return (data[`${type}s`]?.items || []).filter((t) => t?.id).map((t) => item(t, kind));
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

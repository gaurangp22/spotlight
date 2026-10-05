import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { openDatabase } from '../db.mjs';
import { createApi, validatePost } from '../api.mjs';
import { digest, decrypt, encrypt } from '../security.mjs';

async function fixture(t, fetcher) {
  const db = await openDatabase({ url: '', file: ':memory:' }), key = randomBytes(32);
  const server = createApi({ db, key, fetcher });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(async () => { await new Promise((r) => server.close(r)); db.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(path, { token, method = 'GET', body } = {}) {
    const response = await fetch(`${base}/api${path}`, { method, redirect: 'manual', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, data: await response.json().catch(() => ({})), headers: response.headers };
  }
  async function account(name) {
    const r = await request('/auth/register', { method: 'POST', body: { email: `${name}@example.com`, name, handle: name, password: 'a-long-password-123' } });
    assert.equal(r.status, 201, JSON.stringify(r.data)); return r.data;
  }
  return { db, key, request, account, base };
}
const picks = [{ id: 'song-a', title: 'Everything in Its Right Place', artist: 'Radiohead', kind: 'song' }, { id: 'song-b', title: 'Reckoner', artist: 'Radiohead', kind: 'song' }];
const postBody = (visibility = 'public') => ({ kind: 'ranking', title: 'Radiohead, ranked', subtitle: 'My favourites', items: picks, visibility });

test('accounts: hashed passwords, private sessions, login, logout, password change', async (t) => {
  const { request, account, db } = await fixture(t);
  const alice = await account('alice');
  const row = await db.get('SELECT * FROM users WHERE id=?', alice.user.id);
  assert.notEqual(row.password, 'a-long-password-123');
  assert.ok(await db.get('SELECT * FROM sessions WHERE token_hash=?', digest(alice.token)));
  assert.equal((await request('/me')).status, 401);
  assert.equal((await request('/me', { token: alice.token })).data.user.handle, '@alice');
  const duplicate = await request('/auth/register', { method: 'POST', body: { email: 'ALICE@example.com', handle: 'other', name: 'other', password: 'a-long-password-123' } });
  assert.equal(duplicate.status, 409);
  assert.equal((await request('/auth/login', { method: 'POST', body: { email: 'alice@example.com', password: 'wrong' } })).status, 401);
  const second = await request('/auth/login', { method: 'POST', body: { email: 'alice@example.com', password: 'a-long-password-123' } });
  assert.equal(second.status, 200);
  assert.equal((await request('/me/password', { token: alice.token, method: 'PUT', body: { currentPassword: 'a-long-password-123', password: 'a-new-password-123' } })).status, 200);
  assert.equal((await request('/me', { token: second.data.token })).status, 401);
  assert.equal((await request('/me', { token: alice.token })).status, 200);
  assert.equal((await request('/auth/logout', { token: alice.token, method: 'POST' })).status, 200);
  assert.equal((await request('/me', { token: alice.token })).status, 401);
  const publicPeople = await request('/people');
  assert.equal(publicPeople.data.people[0].email, undefined);
  assert.equal(publicPeople.data.people[0].password, undefined);
});

test('visibility is enforced on direct reads, profiles, feeds, writes, and after blocking', async (t) => {
  const { request, account } = await fixture(t);
  const alice = await account('alice'), bob = await account('bobby');
  const pub = (await request('/posts', { token: alice.token, method: 'POST', body: postBody() })).data.post;
  const followers = (await request('/posts', { token: alice.token, method: 'POST', body: postBody('followers') })).data.post;
  const privatePost = (await request('/posts', { token: alice.token, method: 'POST', body: postBody('private') })).data.post;
  assert.ok(pub.id);
  assert.equal((await request(`/posts/${pub.id}`)).status, 200);
  assert.equal((await request(`/posts/${followers.id}`, { token: bob.token })).status, 404);
  assert.equal((await request(`/posts/${privatePost.id}`, { token: bob.token })).status, 404);
  assert.equal((await request(`/posts/${privatePost.id}/comments`, { token: bob.token, method: 'POST', body: { text: 'hello' } })).status, 404);
  assert.equal((await request(`/posts/${pub.id}`, { token: bob.token, method: 'PUT', body: postBody() })).status, 403);
  assert.equal((await request(`/posts/${pub.id}`, { token: bob.token, method: 'DELETE' })).status, 403);
  assert.equal((await request('/people/alice/follow', { token: bob.token, method: 'PUT' })).status, 200);
  assert.equal((await request(`/posts/${followers.id}`, { token: bob.token })).status, 200);
  assert.equal((await request('/people/alice', { token: bob.token })).data.posts.length, 2);
  assert.equal((await request('/sync', { token: bob.token })).data.posts.length, 2);
  assert.equal((await request('/sync', { token: alice.token })).data.posts.length, 3);
  await request('/people/alice/block', { token: bob.token, method: 'PUT' });
  assert.equal((await request('/sync', { token: bob.token })).data.posts.length, 0);
  assert.equal((await request(`/posts/${pub.id}`, { token: bob.token })).status, 404);
  assert.equal((await request('/people/bobby', { token: alice.token })).status, 404);
  assert.equal((await request('/sync', { token: bob.token })).data.following.length, 0);
  await request('/people/alice/block', { token: bob.token, method: 'DELETE' });
  assert.equal((await request(`/posts/${pub.id}`, { token: bob.token })).status, 200);
  assert.equal((await request(`/posts/${followers.id}`, { token: bob.token })).status, 404);
});

test('reactions are idempotent; comments, moderation, and notifications persist', async (t) => {
  const { request, account, db } = await fixture(t);
  const alice = await account('alice'), bob = await account('bobby'), other = await account('other');
  const { data: { post } } = await request('/posts', { token: alice.token, method: 'POST', body: postBody() });
  const reaction = () => request(`/posts/${post.id}/reaction`, { token: bob.token, method: 'PUT' });
  assert.equal((await reaction()).data.post.reactionCount, 1);
  assert.equal((await reaction()).data.post.reactionCount, 1);
  const comment = await request(`/posts/${post.id}/comments`, { token: bob.token, method: 'POST', body: { text: 'Reckoner should be first!', itemId: 'song-b' } });
  assert.equal(comment.status, 201);
  assert.equal(comment.data.post.comments[0].itemId, 'song-b');
  assert.equal((await request(`/posts/${post.id}/comments`, { token: bob.token, method: 'POST', body: { text: 'Invalid reference', itemId: 'song-other' } })).status, 400);
  assert.equal((await request(`/comments/${comment.data.post.comments[0].id}`, { token: other.token, method: 'DELETE' })).status, 403);
  assert.equal((await request('/notifications', { token: alice.token })).data.notifications.length, 2);
  await request('/notifications/read', { token: alice.token, method: 'POST' });
  assert.ok((await request('/notifications', { token: alice.token })).data.notifications.every((n) => n.seen));
  assert.equal((await request(`/posts/${post.id}/report`, { token: bob.token, method: 'POST', body: { reason: 'Spam content' } })).status, 201);
  assert.equal((await db.get('SELECT COUNT(*) AS n FROM reports')).n, 1);
  await request(`/comments/${comment.data.post.comments[0].id}`, { token: alice.token, method: 'DELETE' });
  assert.equal((await request(`/posts/${post.id}`)).data.post.comments.length, 0);
  await request(`/posts/${post.id}/reaction`, { token: bob.token, method: 'DELETE' });
  assert.equal((await request(`/posts/${post.id}`)).data.post.reactionCount, 0);
});

test('mood boards, editing, invalid payloads, and cascading account deletion', async (t) => {
  const { request, account, db } = await fixture(t);
  const alice = await account('alice');
  const body = { kind: 'moodboard', title: 'Rainy nights', subtitle: 'A world in music', visibility: 'private', items: [picks[0]], tiles: [{ id: 'note-1', type: 'note', text: 'Headphones on. World off.' }, { id: 'photo-1', type: 'photo', uri: 'data:image/jpeg;base64,/9j/AA==', text: 'Night sky' }], theme: 'forest' };
  const published = await request('/posts', { token: alice.token, method: 'POST', body });
  assert.equal(published.status, 201, JSON.stringify(published.data));
  assert.equal(published.data.post.tiles.length, 2);
  assert.equal(published.data.post.theme, 'forest');
  const id = published.data.post.id;
  assert.equal((await request(`/posts/${id}`)).status, 404);
  assert.equal((await request(`/posts/${id}`, { token: alice.token, method: 'PUT', body: { ...body, title: 'Sunrise', visibility: 'public' } })).data.post.title, 'Sunrise');
  assert.equal((await request(`/posts/${id}`)).status, 200);
  assert.throws(() => validatePost({ ...postBody(), items: [picks[0], picks[0]] }));
  assert.equal((await request('/posts', { token: alice.token, method: 'POST', body: { ...postBody(), items: [null, picks[0]] } })).status, 400);
  assert.throws(() => validatePost({ ...body, tiles: [body.tiles[0], body.tiles[0]] }));
  assert.throws(() => validatePost({ ...postBody(), items: [{ ...picks[0], artwork: 'javascript:alert(1)' }, picks[1]] }));
  assert.throws(() => validatePost({ ...body, tiles: [{ id: 'x', type: 'photo', uri: 'file:///private.jpg' }] }));
  assert.equal((await request('/me', { token: alice.token, method: 'DELETE', body: { password: 'wrong' } })).status, 401);
  assert.equal((await request('/me', { token: alice.token, method: 'DELETE', body: { password: 'a-long-password-123' } })).status, 200);
  assert.equal((await db.get('SELECT COUNT(*) AS n FROM posts')).n, 0);
  assert.equal((await request('/me', { token: alice.token })).status, 401);
});

test('password recovery is delivered privately, expires, is single-use, and revokes sessions', async (t) => {
  const previous = { key: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM };
  process.env.RESEND_API_KEY = 'test-only'; process.env.EMAIL_FROM = 'MARGIN <test@example.com>';
  t.after(() => { for (const [name, value] of [['RESEND_API_KEY', previous.key], ['EMAIL_FROM', previous.from]]) { if (value === undefined) delete process.env[name]; else process.env[name] = value; } });
  const sent = [];
  const { request, account } = await fixture(t, async (url, opts) => { assert.equal(url, 'https://api.resend.com/emails'); sent.push(JSON.parse(opts.body)); return new Response('{}', { status: 200 }); });
  const alice = await account('alice');
  const recovery = await request('/auth/forgot', { method: 'POST', body: { email: 'alice@example.com' } });
  assert.equal(recovery.status, 200); assert.equal(recovery.data.token, undefined);
  assert.equal(sent.length, 1);
  const token = sent[0].text.match(/token=([A-Za-z0-9_-]+)/)[1];
  const resets = await Promise.all([1, 2].map(() => request('/auth/reset', { method: 'POST', body: { token, password: 'recovered-password-123' } })));
  assert.deepEqual(resets.map((r) => r.status).sort(), [200, 400]);
  assert.equal((await request('/me', { token: alice.token })).status, 401);
  assert.equal((await request('/auth/login', { method: 'POST', body: { email: 'alice@example.com', password: 'recovered-password-123' } })).status, 200);
});

test('SQLite persists after closing and reopening the server database', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'margin-db-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, 'test.db');
  let db = await openDatabase({ url: '', file });
  await db.run('INSERT INTO users (id,email,handle,name,password,created_at) VALUES (?,?,?,?,?,?)', 'persist', 'persist@example.com', 'persist', 'Persist', 'hash', new Date().toISOString());
  db.close(); db = await openDatabase({ url: '', file });
  assert.equal((await db.get('SELECT name FROM users WHERE id=?', 'persist')).name, 'Persist'); db.close();
});

test('Spotify PKCE, encrypted tokens, playlist paging, refresh, denial, and one-use state', async (t) => {
  const previous = { client: process.env.SPOTIFY_CLIENT_ID, uri: process.env.SPOTIFY_REDIRECT_URI };
  process.env.SPOTIFY_CLIENT_ID = 'spotify-test-client'; process.env.SPOTIFY_REDIRECT_URI = 'https://api.example.com/api/spotify/callback';
  t.after(() => { for (const [name, value] of [['SPOTIFY_CLIENT_ID', previous.client], ['SPOTIFY_REDIRECT_URI', previous.uri]]) { if (value === undefined) delete process.env[name]; else process.env[name] = value; } });
  let exchanged = 0;
  const { request, account, db, key } = await fixture(t, async (url, opts) => {
    if (url.includes('/api/token')) { exchanged++; const params = new URLSearchParams(opts.body); if (params.get('grant_type') === 'authorization_code') assert.ok(params.get('code_verifier').length >= 43); return Response.json({ access_token: 'secret-access-token', refresh_token: 'secret-refresh-token', expires_in: 3600 }); }
    assert.equal(opts.headers.Authorization, 'Bearer secret-access-token');
    if (url.includes('/items')) return Response.json({ items: [{ item: { id: 'x', type: 'track', name: 'Reckoner', artists: [{ name: 'Radiohead' }], album: { images: [], name: 'In Rainbows' }, external_urls: { spotify: 'https://open.spotify.com/track/x' } } }, { item: null }], next: null });
    if (url.includes('/me/playlists')) return Response.json({ items: [{ id: '1234567890123456789012', name: 'Radiohead', items: { total: 1 } }], next: null });
    return Response.json({ tracks: { items: [] } });
  });
  const alice = await account('alice');
  assert.equal((await request('/spotify/start', { token: alice.token, method: 'POST', body: { returnUri: 'https://evil.example' } })).status, 400);
  const start = await request('/spotify/start', { token: alice.token, method: 'POST', body: { returnUri: 'marginmusic://spotify-callback' } });
  const authUrl = new URL(start.data.url), state = authUrl.searchParams.get('state');
  assert.equal(authUrl.searchParams.get('code_challenge_method'), 'S256');
  assert.equal((await request(`/spotify/callback?state=wrong&code=x`)).status, 400);
  const callback = await request(`/spotify/callback?state=${state}&code=test-code`);
  assert.equal(callback.status, 302); assert.equal(callback.headers.get('location'), 'marginmusic://spotify-callback?status=connected');
  assert.equal((await request(`/spotify/callback?state=${state}&code=test-code`)).status, 400);
  const stored = await db.get('SELECT credentials FROM spotify WHERE user_id=?', alice.user.id);
  assert.ok(!stored.credentials.includes('secret-access-token'));
  assert.equal(decrypt(stored.credentials, key).refresh_token, 'secret-refresh-token');
  assert.equal((await request('/me', { token: alice.token })).data.spotifyConnected, true);
  assert.equal((await request('/spotify/playlists', { token: alice.token })).data.items[0].count, 1);
  const tracks = await request('/spotify/playlists/1234567890123456789012', { token: alice.token });
  assert.equal(tracks.data.items[0].title, 'Reckoner'); assert.equal(tracks.data.items.length, 1);
  assert.equal(exchanged, 1);
  await db.run('UPDATE spotify SET credentials=? WHERE user_id=?', encrypt({ ...decrypt(stored.credentials, key), expiresAt: 0 }, key), alice.user.id);
  const refreshed = await Promise.all([request('/spotify/playlists', { token: alice.token }), request('/spotify/playlists', { token: alice.token })]);
  assert.ok(refreshed.every((r) => r.status === 200));
  assert.equal(exchanged, 2, 'Concurrent requests share one token refresh');
  await request('/spotify', { token: alice.token, method: 'DELETE' });
  assert.equal((await request('/me', { token: alice.token })).data.spotifyConnected, false);
});

test('moderation is admin-only and can resolve a report by removing the post', async (t) => {
  const previous = process.env.ADMIN_TOKEN;
  process.env.ADMIN_TOKEN = 'test-admin-only-token-at-least-32-characters';
  t.after(() => { if (previous === undefined) delete process.env.ADMIN_TOKEN; else process.env.ADMIN_TOKEN = previous; });
  const { request, account } = await fixture(t);
  const alice = await account('alice'), bob = await account('bobby');
  const post = (await request('/posts', { token: alice.token, method: 'POST', body: postBody() })).data.post;
  await request(`/posts/${post.id}/report`, { token: bob.token, method: 'POST', body: { reason: 'Spam content' } });
  assert.equal((await request('/admin/reports', { token: alice.token })).status, 403);
  const reports = await request('/admin/reports', { token: process.env.ADMIN_TOKEN });
  assert.equal(reports.status, 200); assert.equal(reports.data.reports.length, 1);
  assert.equal((await request(`/admin/reports/${reports.data.reports[0].id}`, { token: process.env.ADMIN_TOKEN, method: 'PATCH', body: { removePost: true } })).status, 200);
  assert.equal((await request(`/posts/${post.id}`)).status, 404);
});

test('profile counts and public store pages', async (t) => {
  const { request, account, base } = await fixture(t);
  const alice = await account('alice'), bob = await account('bob');
  assert.equal((await request('/people/alice/follow', { token: bob.token, method: 'PUT' })).status, 200);
  const me = (await request('/me', { token: alice.token })).data.user;
  assert.deepEqual([me.followers, me.following], [1, 0]);
  assert.equal((await request('/me', { token: bob.token })).data.user.following, 1);
  for (const [path, heading] of [['/privacy', 'Privacy Policy'], ['/terms', 'Terms of Service'], ['/delete-account', 'Delete your MARGIN account']]) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.match(response.headers.get('content-security-policy'), /default-src 'none'/);
    assert.match(await response.text(), new RegExp(`<h1>${heading}</h1>`));
  }
  assert.equal((await fetch(`${base}/privacy`, { method: 'POST' })).status, 404);
});

test('behind a trusted platform proxy, rate limits apply per client, not per proxy', async (t) => {
  const previous = process.env.TRUSTED_PROXY_IPS;
  process.env.TRUSTED_PROXY_IPS = '*';
  t.after(() => { if (previous === undefined) delete process.env.TRUSTED_PROXY_IPS; else process.env.TRUSTED_PROXY_IPS = previous; });
  const { base } = await fixture(t);
  const login = (ip) => fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip }, body: JSON.stringify({ email: 'nobody@example.com', password: 'wrong-password' }) });
  for (let i = 0; i < 25; i++) assert.equal((await login(`203.0.113.${i + 1}`)).status, 401);
  for (let i = 0; i < 20; i++) await login('198.51.100.7');
  assert.equal((await login('198.51.100.7')).status, 429);
});

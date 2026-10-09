import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { openDatabase } from '../db.mjs';
import { createApi } from '../api.mjs';
import { pushService } from '../push.mjs';
import { playlistLink } from '../playlist.mjs';

async function fixture(t, fetcher) {
  const db = await openDatabase({ url: '', file: ':memory:' }), key = randomBytes(32), server = createApi({ db, key, fetcher });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(async () => { await new Promise((r) => server.close(r)); db.close(); });
  const request = async (path, token, method = 'GET', body) => { const r = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, data: await r.json() }; };
  const account = async (handle) => { const r = await request('/auth/register', null, 'POST', { email: `${handle}@example.test`, handle, name: handle, password: 'good-password-123' }); assert.equal(r.status, 201, JSON.stringify(r.data)); return r.data; };
  return { db, key, request, account };
}
const song = { id: 'itunes-song-123', title: 'A song', artist: 'Radiohead', kind: 'song' };

test('playlist links import public Deezer picks and preserve Spotify sources without pretending to read tracks', async () => {
  let calls = [];
  const fetcher = async (url) => { calls.push(url); return { ok: true, json: async () => url.includes('oembed') ? { title: 'My Spotify list' } : { title: 'My Deezer list', nb_tracks: 1, tracks: { data: [{ id: 42, title: 'A song', artist: { name: 'Radiohead' }, album: {} }] } } }; };
  const deezer = await playlistLink('https://www.deezer.com/playlist/123?utm_source=test', fetcher); assert.equal(deezer.items[0].id, 'deezer-song-42'); assert.equal(deezer.sourceUrl, 'https://www.deezer.com/playlist/123');
  const spotify = await playlistLink('https://open.spotify.com/playlist/1234567890123456789012', fetcher); assert.equal(spotify.items.length, 0); assert.match(spotify.note, /does not provide playlist tracks/); assert.equal(spotify.title, 'My Spotify list');
  assert.ok(calls.every((url) => url.startsWith('https://api.deezer.com/') || url.startsWith('https://open.spotify.com/oembed?')));
  await assert.rejects(() => playlistLink('http://127.0.0.1/playlist/123', fetcher), /HTTPS/);
  await assert.rejects(() => playlistLink('https://evil.test/playlist/123', fetcher), /full Spotify/);
});

test('messages are member-only, idempotent, ordered, removable, and respect blocking and opt-outs', async (t) => {
  const { db, request, account } = await fixture(t); const a = await account('alice'), b = await account('bobby'), c = await account('carol');
  assert.equal((await request('/conversations')).status, 401);
  const chat = await request('/conversations', a.token, 'POST', { handles: ['@bobby'] }); assert.equal(chat.status, 201);
  const id = chat.data.conversation.id;
  assert.equal((await request('/conversations', b.token, 'POST', { handles: ['alice'] })).data.conversation.id, id);
  assert.equal((await request(`/conversations/${id}`, c.token)).status, 404);
  const payload = { text: 'Listen to this', item: song, clientId: 'retry-message-123' };
  const sends = await Promise.all([request(`/conversations/${id}/messages`, a.token, 'POST', payload), request(`/conversations/${id}/messages`, a.token, 'POST', payload)]);
  assert.deepEqual(sends.map((r) => r.status), [201, 201]);
  const rows = (await request(`/conversations/${id}/messages`, b.token)).data.messages;
  assert.equal(rows.length, 1); assert.equal(rows[0].sender.id, a.user.id); assert.notEqual(rows[0].id, a.user.id); assert.equal(rows[0].item.id, song.id);
  assert.equal((await request(`/conversations/${id}/messages/${rows[0].id}/report`, c.token, 'POST', { reason: 'Spam content' })).status, 404);
  assert.equal((await request(`/conversations/${id}/messages/${rows[0].id}/report`, b.token, 'POST', { reason: 'Spam content' })).status, 201);
  assert.equal((await request('/admin/message-reports', b.token)).status, 403);
  const privatePost = await request('/posts', a.token, 'POST', { kind: 'take', title: 'Private thought', visibility: 'private', items: [] });
  assert.equal((await request(`/conversations/${id}/messages`, a.token, 'POST', { postId: privatePost.data.post.id, clientId: 'private-share-123' })).status, 201);
  const shared = (await request(`/conversations/${id}/messages`, b.token)).data.messages.at(-1);
  assert.equal(shared.post, null); assert.equal(shared.text, 'Shared a post');
  assert.equal((await request('/conversations', b.token)).data.conversations[0].unread, 2);
  await request(`/conversations/${id}/read`, b.token, 'POST', { sequence: 999999 });
  assert.equal((await request('/conversations', b.token)).data.conversations[0].unread, 0);
  await request(`/conversations/${id}/messages/${rows[0].id}`, b.token, 'DELETE');
  assert.equal((await db.get('SELECT deleted FROM messages')).deleted, 0);
  await request(`/conversations/${id}/messages/${rows[0].id}`, a.token, 'DELETE');
  const removed = (await request(`/conversations/${id}/messages`, b.token)).data.messages[0]; assert.equal(removed.deleted, true); assert.equal(removed.item, null);
  await request('/me/preferences', b.token, 'PATCH', { messages: false });
  assert.equal((await request(`/conversations/${id}/messages`, a.token, 'POST', { ...payload, clientId: 'different-123' })).status, 403);
  await request('/people/alice/block', b.token, 'PUT');
  assert.equal((await request(`/conversations/${id}/messages`, a.token)).status, 404);
  assert.equal((await request('/conversations', a.token)).data.conversations.length, 0);
});

test('groups enforce membership and ownership; leaving transfers ownership and revokes access', async (t) => {
  const { request, account } = await fixture(t); const a = await account('alice'), b = await account('bobby'), c = await account('carol');
  const r = await request('/conversations', a.token, 'POST', { kind: 'group', name: 'Album friends', handles: ['bobby', 'carol'] }); assert.equal(r.status, 201);
  const id = r.data.conversation.id;
  assert.equal((await request(`/conversations/${id}/members/${c.user.id}`, b.token, 'DELETE')).status, 403);
  await request(`/conversations/${id}/messages`, c.token, 'POST', { text: 'Before leaving', clientId: 'member-message-123' });
  await request(`/conversations/${id}/members/${c.user.id}`, a.token, 'DELETE');
  await request('/people/carol/block', a.token, 'PUT');
  assert.equal((await request(`/conversations/${id}/messages`, a.token)).data.messages.length, 0);
  assert.equal((await request(`/conversations/${id}`, a.token)).data.conversation.unread, 0);
  assert.equal((await request(`/conversations/${id}`, a.token)).data.conversation.lastMessage, null);
  assert.equal((await request(`/conversations/${id}/leave`, a.token, 'POST')).status, 200);
  assert.equal((await request(`/conversations/${id}`, a.token)).status, 404);
  assert.notEqual((await request(`/conversations/${id}`, b.token)).data.conversation.ownerId, a.user.id);
  await request('/people/carol/block', b.token, 'PUT');
  assert.equal((await request(`/conversations/${id}/leave`, b.token, 'POST')).status, 200);
});

test('cursor feeds pass 200 posts, personalize from Riffs artists, and never bypass visibility or blocks', async (t) => {
  const { db, request, account } = await fixture(t); const a = await account('alice'), b = await account('bobby');
  const now = new Date().toISOString();
  await db.batch(Array.from({ length: 225 }, (_, i) => ({ sql: 'INSERT INTO posts (id,user_id,kind,title,items,visibility,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)', args: [`feed-${String(i).padStart(3, '0')}`, b.user.id, 'take', `Take ${i}`, JSON.stringify([i === 0 ? song : { ...song, artist: 'Other artist' }]), i === 224 ? 'private' : 'public', now, now] })));
  await request('/me/onboarding', a.token, 'PUT', { artists: [{ ...song, kind: 'artist', title: 'Radiohead' }] });
  const first = await request('/feed', a.token); assert.equal(first.status, 200, JSON.stringify(first.data)); assert.equal(first.data.posts[0].id, 'feed-000');
  let next = first.data.nextCursor, ids = first.data.posts.map((p) => p.id);
  while (next) { const r = await request(`/feed?cursor=${encodeURIComponent(next)}`, a.token); assert.equal(r.status, 200); ids.push(...r.data.posts.map((p) => p.id)); next = r.data.nextCursor; }
  assert.equal(ids.length, 224); assert.equal(new Set(ids).size, 224); assert.equal(ids.includes('feed-224'), false);
  assert.equal((await request(`/feed?cursor=${encodeURIComponent(first.data.nextCursor)}`, b.token)).status, 400);
  assert.equal((await request('/feed?mode=following', a.token)).data.posts.length, 0);
  await request('/people/bobby/follow', a.token, 'PUT'); assert.equal((await request('/feed?mode=following', a.token)).data.posts.length, 30);
  await request('/people/bobby/block', a.token, 'PUT'); assert.equal((await request('/feed', a.token)).data.posts.length, 0);
});

test('private listening diary logs actual user choices, paginates and clears without changing ratings', async (t) => {
  const { db, request, account } = await fixture(t); const a = await account('alice'), b = await account('bobby');
  assert.equal((await request('/history', null, 'POST', { item: song })).status, 401);
  assert.equal((await request('/history', a.token, 'POST', { item: song })).status, 201);
  assert.equal((await request('/history', b.token)).data.plays.length, 0);
  assert.equal((await request('/history', a.token)).data.plays[0].item.id, song.id);
  assert.equal((await db.get('SELECT COUNT(*) AS n FROM ratings')).n, 0);
  assert.equal((await request('/history', a.token, 'POST', { item: { ...song, kind: 'movie' } })).status, 400);
  await request('/history', a.token, 'DELETE'); assert.equal((await request('/history', a.token)).data.plays.length, 0);
});

test('people and message pagination return older records without gaps or duplicated IDs', async (t) => {
  const { db, request, account } = await fixture(t); const a = await account('alice'), b = await account('bobby');
  const time = new Date().toISOString(), stored = await db.get('SELECT password FROM users WHERE id=?', a.user.id);
  await db.batch(Array.from({ length: 125 }, (_, i) => ({ sql: 'INSERT INTO users (id,email,handle,name,password,created_at) VALUES (?,?,?,?,?,?)', args: [`person-${i}`, `paged${i}@example.test`, `paged_${i}`, `Paged ${i}`, stored.password, time] })));
  let next = null, people = [];
  do { const r = await request(`/people?q=paged${next ? '&cursor=' + encodeURIComponent(next) : ''}`, a.token); assert.equal(r.status, 200); people.push(...r.data.people); next = r.data.nextCursor; } while (next);
  assert.equal(people.length, 125); assert.equal(new Set(people.map((p) => p.id)).size, 125);
  const c = await request('/conversations', a.token, 'POST', { handles: ['bobby'] }); const id = c.data.conversation.id;
  await db.batch(Array.from({ length: 75 }, (_, i) => ({ sql: 'INSERT INTO messages (id,conversation_id,sender_id,sequence,client_id,text,created_at) VALUES (?,?,?,?,?,?,?)', args: [`message-${i}`, id, b.user.id, i + 1, `client-${i}`, `Thought ${i}`, time] })));
  const latest = (await request(`/conversations/${id}/messages`, a.token)).data;
  assert.equal(latest.messages[0].sequence, 26); assert.equal(latest.hasMore, true);
  const earlier = (await request(`/conversations/${id}/messages?before=26`, a.token)).data;
  assert.equal(earlier.messages.length, 25); assert.equal(earlier.hasMore, false);
  const after = (await request(`/conversations/${id}/messages?after=50`, a.token)).data;
  assert.equal(after.messages[0].sequence, 51); assert.equal(after.messages.length, 25);
  assert.equal(new Set([...earlier.messages, ...latest.messages].map((m) => m.id)).size, 75);
});

test('signup requires a purpose-bound email code when configured, with single-use activation', async (t) => {
  const previous = { key: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM }; let mail;
  process.env.RESEND_API_KEY = 'test'; process.env.EMAIL_FROM = 'Riffs <test@example.test>';
  t.after(() => { for (const [env, value] of [['RESEND_API_KEY', previous.key], ['EMAIL_FROM', previous.from]]) { if (value === undefined) delete process.env[env]; else process.env[env] = value; } });
  const { db, request } = await fixture(t, async (url, options) => { assert.equal(url, 'https://api.resend.com/emails'); mail = JSON.parse(options.body); return { ok: true }; });
  const input = { email: 'new@example.test', handle: 'newuser', name: 'New', password: 'good-password-123' };
  assert.equal((await request('/auth/register', null, 'POST', input)).status, 400);
  const issue = await request('/auth/signup/request', null, 'POST', { email: input.email }); assert.equal(issue.status, 200);
  const code = mail.text.match(/code is (\d{6})/)[1], challenge = issue.data.challenge;
  assert.equal((await request('/auth/otp/verify', null, 'POST', { challenge, code })).status, 400);
  const signed = await request('/auth/register', null, 'POST', { ...input, challenge, code }); assert.equal(signed.status, 201, JSON.stringify(signed.data));
  assert.equal((await db.get('SELECT email_verified FROM users')).email_verified, 1);
  assert.equal((await request('/auth/register', null, 'POST', { ...input, email: 'another@example.test', handle: 'otheruser', challenge, code })).status, 400);
});

test('push queues recheck access, remove invalid tokens, and logout removes device registration', async (t) => {
  const before = process.env.PUSH_ENABLED; process.env.PUSH_ENABLED = '1'; t.after(() => { if (before === undefined) delete process.env.PUSH_ENABLED; else process.env.PUSH_ENABLED = before; });
  const { db, request, account } = await fixture(t); const a = await account('alice'), b = await account('bobby');
  await request('/me/preferences', b.token, 'PATCH', { push: true });
  const token = 'ExpoPushToken[test-device-123]'; assert.equal((await request('/push/token', b.token, 'PUT', { token })).status, 200);
  let sends = 0; const push = pushService({ db, getPost: async () => { throw new Error('Private'); }, fetcher: async () => { sends++; return { ok: true, json: async () => ({ data: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }] }) }; } }); t.after(push.close);
  await push.enqueue(b.user.id, a.user.id, 'follow'); assert.equal((await db.get('SELECT COUNT(*) AS n FROM push_jobs')).n, 1);
  await request('/people/alice/block', b.token, 'PUT'); await push.flush(); assert.equal(sends, 0);
  await request('/people/alice/block', b.token, 'DELETE'); await push.enqueue(b.user.id, a.user.id, 'follow'); await push.flush(); assert.equal(sends, 1); assert.equal((await db.get('SELECT COUNT(*) AS n FROM push_tokens')).n, 0);
  await request('/push/token', b.token, 'PUT', { token }); await request('/auth/logout', b.token, 'POST'); assert.equal((await db.get('SELECT COUNT(*) AS n FROM push_tokens')).n, 0);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { openDatabase } from '../db.mjs';
import { createApi, tasteMatch } from '../api.mjs';

async function fixture(t) {
  const db = await openDatabase({ url: '', file: ':memory:' });
  const server = createApi({ db, key: randomBytes(32) });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(async () => { await new Promise((r) => server.close(r)); db.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(path, { token, method = 'GET', body } = {}) {
    const response = await fetch(`${base}/api${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, data: await response.json().catch(() => ({})) };
  }
  async function account(name) {
    const r = await request('/auth/register', { method: 'POST', body: { email: `${name}@example.com`, name, handle: name, password: 'a-long-password-123' } });
    assert.equal(r.status, 201, JSON.stringify(r.data)); return r.data;
  }
  return { db, request, account };
}
const song = (n, artist = 'Charli xcx', extra = {}) => ({ id: `song-${n}`, kind: 'song', title: `Song ${n}`, artist, ...extra });

test('takes: one attached pick at most, polls need exactly two, and takes allow 280 characters', async (t) => {
  const { request, account } = await fixture(t);
  const alice = await account('alice');
  const post = (body) => request('/posts', { token: alice.token, method: 'POST', body: { kind: 'take', visibility: 'public', ...body } });
  const plain = await post({ title: 'brat summer never ended', items: [song(1)] });
  assert.equal(plain.status, 201);
  assert.equal(plain.data.post.kind, 'take');
  assert.equal(plain.data.post.poll, undefined);
  assert.equal((await post({ title: 'x'.repeat(280), items: [] })).status, 201);
  assert.equal((await post({ title: 'x'.repeat(281), items: [] })).status, 400);
  assert.equal((await post({ title: 'two songs, no poll', items: [song(1), song(2)] })).status, 400);
  assert.equal((await post({ title: 'one-sided poll', poll: true, items: [song(1)] })).status, 400);
  assert.equal((await post({ title: 'same song twice', poll: true, items: [song(1), song(1)] })).status, 400);
});

test('polls hide the tally until you vote, let you change or withdraw a vote, and lock options once voted on', async (t) => {
  const { request, account } = await fixture(t);
  const [alice, bob, cara] = [await account('alice'), await account('bob'), await account('cara')];
  const created = await request('/posts', { token: alice.token, method: 'POST', body: { kind: 'take', poll: true, title: 'Von dutch or Espresso?', items: [song(1), song(2, 'Sabrina Carpenter')], visibility: 'public' } });
  assert.equal(created.status, 201);
  const id = created.data.post.id;
  assert.deepEqual(created.data.post.poll, { total: 0, mine: null, counts: [0, 0] }, 'the author always sees the tally');

  const before = await request(`/posts/${id}`, { token: bob.token });
  assert.deepEqual(before.data.post.poll, { total: 0, mine: null, counts: null }, 'voters see only the total before voting');
  assert.equal((await request(`/posts/${id}`)).data.post.poll.counts, null, 'signed-out visitors never see the split');

  const vote = (who, choice) => request(`/posts/${id}/vote`, { token: who.token, method: 'PUT', body: { choice } });
  assert.deepEqual((await vote(bob, 1)).data.post.poll, { total: 1, mine: 1, counts: [0, 1] });
  assert.deepEqual((await vote(cara, 1)).data.post.poll, { total: 2, mine: 1, counts: [0, 2] });
  assert.deepEqual((await vote(bob, 0)).data.post.poll, { total: 2, mine: 0, counts: [1, 1] }, 'changing a vote moves it');
  assert.equal((await vote(bob, 2)).status, 400);
  const withdrawn = await request(`/posts/${id}/vote`, { token: bob.token, method: 'DELETE' });
  assert.deepEqual(withdrawn.data.post.poll, { total: 1, mine: null, counts: null });
  assert.equal((await request(`/posts/${id}/vote`, { method: 'PUT', body: { choice: 0 } })).status, 401);

  const edit = (items) => request(`/posts/${id}`, { token: alice.token, method: 'PUT', body: { kind: 'take', poll: true, title: 'Edited question', items, visibility: 'public' } });
  assert.equal((await edit([song(1), song(3)])).status, 400, 'options are locked once people have voted');
  assert.equal((await edit([song(1), song(2, 'Sabrina Carpenter')])).status, 200, 'the wording can still be fixed');

  const plain = await request('/posts', { token: alice.token, method: 'POST', body: { kind: 'take', title: 'not a poll', items: [], visibility: 'public' } });
  assert.equal((await request(`/posts/${plain.data.post.id}/vote`, { token: bob.token, method: 'PUT', body: { choice: 0 } })).status, 400);

  const hidden = await request('/posts', { token: alice.token, method: 'POST', body: { kind: 'take', poll: true, title: 'secret', items: [song(1), song(2)], visibility: 'private' } });
  assert.equal((await request(`/posts/${hidden.data.post.id}/vote`, { token: bob.token, method: 'PUT', body: { choice: 0 } })).status, 404, 'private polls take no outside votes');
});

test('profile status is saved, shown publicly, and kept when other fields change', async (t) => {
  const { request, account } = await fixture(t);
  const alice = await account('alice');
  const save = (body) => request('/me', { token: alice.token, method: 'PATCH', body: { name: 'Alice', bio: '', ...body } });
  assert.equal((await save({ status: 'Going to the AP Dhillon gig' })).data.user.status, 'Going to the AP Dhillon gig');
  assert.equal((await save({ bio: 'new bio' })).data.user.status, 'Going to the AP Dhillon gig');
  assert.equal((await request('/people/alice')).data.user.status, 'Going to the AP Dhillon gig');
  assert.equal((await save({ status: 'x'.repeat(61) })).status, 400);
  assert.equal((await save({ status: '' })).data.user.status, '');
});

test('preview links are accepted only from Apple over HTTPS', async (t) => {
  const { request, account } = await fixture(t);
  const alice = await account('alice');
  const rate = (previewUrl) => request('/ratings', { token: alice.token, method: 'POST', body: { item: song(1, 'Charli xcx', { previewUrl }), tier: 2, position: 0, visibility: 'public' } });
  const ok = await rate('https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview/a.m4a');
  assert.equal(ok.status, 201);
  assert.equal(ok.data.rating.item.previewUrl, 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview/a.m4a');
  assert.equal((await rate('https://is1-ssl.mzstatic.com/preview.m4a')).status, 200);
  assert.equal((await rate('http://audio-ssl.itunes.apple.com/a.m4a')).status, 400);
  assert.equal((await rate('https://evil.example.com/apple.com.m4a')).status, 400);
  assert.equal((await rate('https://notapple.com/a.m4a')).status, 400);
});

test('taste match rewards agreement, overlap, and shared artists, and needs three ratings a side', () => {
  const r = (n, score, artist = 'Charli xcx', kind = 'song') => ({ item_id: `${kind}-${n}`, score, item: { id: `${kind}-${n}`, kind, title: kind === 'artist' ? artist : `T${n}`, artist: kind === 'artist' ? 'Artist' : artist, artwork: `https://img/${n}` } });
  const mine = [r(1, 10), r(2, 9, 'SZA'), r(3, 4, 'Kendrick Lamar & SZA'), r(9, 8, 'Kendrick Lamar', 'artist')];
  const same = tasteMatch(mine, mine);
  assert.equal(same.percent, 100);
  const opposite = tasteMatch(mine, mine.map((x) => ({ ...x, score: 10 - x.score })));
  assert.ok(opposite.percent < same.percent, 'disagreeing on the same picks scores lower');
  const strangers = tasteMatch(mine, [r(20, 9, 'Metallica'), r(21, 8, 'Slayer'), r(22, 7, 'Megadeth')]);
  assert.equal(strangers.percent, 0);
  assert.deepEqual(strangers.sharedArtists, []);
  const artistsOnly = tasteMatch(mine, [r(30, 9), r(31, 8, 'Kendrick Lamar'), r(32, 7, 'Tame Impala')]);
  assert.ok(artistsOnly.percent > 0, 'shared artists count even without the same songs');
  assert.deepEqual(artistsOnly.sharedArtists.map((a) => a.name).sort(), ['Charli xcx', 'Kendrick Lamar']);
  assert.equal(artistsOnly.sharedArtists.find((a) => a.name === 'Kendrick Lamar').artwork, 'https://img/9', 'the artist photo wins over a cover');
  assert.equal(tasteMatch(mine.slice(0, 2), mine).percent, null);
});

test('match and twins only use ratings the viewer may see', async (t) => {
  const { request, account } = await fixture(t);
  const [alice, bob, cara] = [await account('alice'), await account('bob'), await account('cara')];
  const rate = (who, n, tier, visibility = 'public', artist = 'Charli xcx') => request('/ratings', { token: who.token, method: 'POST', body: { item: song(n, artist), tier, position: 0, visibility } });
  for (const n of [1, 2, 3]) await rate(alice, n, 2);
  for (const n of [1, 2, 3]) await rate(bob, n, 2);
  for (const n of [1, 2, 3]) await rate(cara, n, 2, 'private');

  const match = await request('/people/bob/match', { token: alice.token });
  assert.equal(match.status, 200);
  assert.ok(match.data.percent >= 90, `close twins score high (got ${match.data.percent})`);
  assert.equal(match.data.shared.length, 3);
  assert.deepEqual(match.data.sharedArtists.map((a) => a.name), ['Charli xcx']);
  assert.equal((await request('/people/cara/match', { token: alice.token })).data.percent, null, 'private ratings are invisible');
  assert.equal((await request('/people/bob/match')).status, 401);
  assert.equal((await request('/people/alice/match', { token: alice.token })).status, 404);

  const twins = (await request('/twins', { token: alice.token })).data;
  assert.deepEqual(twins.twins.map((x) => x.user.handle), ['@bob']);
  assert.equal(twins.twins[0].user.status, '');
  const fresh = await account('dana');
  assert.deepEqual((await request('/twins', { token: fresh.token })).data, { twins: [], needed: 3 });
});

test('a ratings-era database gains takes and status without losing pod settings or conversations', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'margin-v2-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, 'v2.db');
  const old = new DatabaseSync(file);
  old.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, handle TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL, bio TEXT NOT NULL DEFAULT '', password TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE posts (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL CHECK(kind IN ('ranking','moodboard','review','pod')), title TEXT NOT NULL, subtitle TEXT NOT NULL DEFAULT '', items TEXT NOT NULL, tiles TEXT NOT NULL DEFAULT '[]', theme TEXT NOT NULL DEFAULT 'night', visibility TEXT NOT NULL CHECK(visibility IN ('public','followers','private')), origin_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, meta TEXT NOT NULL DEFAULT '{}');
    CREATE TABLE comments (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE, text TEXT NOT NULL, item_id TEXT, created_at TEXT NOT NULL);
    INSERT INTO users VALUES ('u1', 'a@example.com', 'alice', 'Alice', '', 'x', '2025-01-01');
    INSERT INTO posts VALUES ('pod1', 'u1', 'pod', 'Open pod', '', '[]', '[]', 'night', 'public', NULL, '2025-01-01', '2025-01-01', '{"open":true}');
    INSERT INTO comments VALUES ('c1', 'u1', 'pod1', 'still here', NULL, '2025-01-01');`);
  old.close();
  const db = await openDatabase({ url: '', file });
  t.after(() => { try { db.close(); } catch { /* already closed */ } });
  assert.equal((await db.get("SELECT meta FROM posts WHERE id='pod1'")).meta, '{"open":true}', 'pod settings survive the rebuild');
  assert.equal((await db.get('SELECT COUNT(*) AS n FROM comments')).n, 1, 'comments survive the rebuild');
  assert.equal((await db.get("SELECT status FROM users WHERE id='u1'")).status, '');
  await db.run("INSERT INTO posts (id, user_id, kind, title, items, visibility, created_at, updated_at, meta) VALUES ('t1', 'u1', 'take', 'hot take', '[]', 'public', 'x', 'x', '{\"poll\":true}')");
  await db.run("INSERT INTO poll_votes VALUES ('u1', 't1', 1, 'x')");
  // Opening again is a no-op: the upgrade only runs once.
  db.close();
  const again = await openDatabase({ url: '', file });
  assert.equal((await again.get('SELECT COUNT(*) AS n FROM poll_votes')).n, 1);
  await again.run("DELETE FROM posts WHERE id='pod1'");
  assert.equal((await again.get('SELECT COUNT(*) AS n FROM comments')).n, 0, 'cascades still work after the rebuild');
  again.close();
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { openDatabase } from '../db.mjs';
import { createApi, tierScores } from '../api.mjs';

async function fixture(t, fetcher) {
  const db = await openDatabase({ url: '', file: ':memory:' });
  const server = createApi({ db, key: randomBytes(32), fetcher });
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
const album = (n) => ({ id: `album-${n}`, kind: 'album', title: `Album ${n}`, artist: 'Someone', artwork: 'https://example.com/a.jpg' });

test('tier scores fill each band from the top down', () => {
  assert.deepEqual(tierScores(2, 1), [10]);
  assert.deepEqual(tierScores(2, 2), [10, 8.4]);
  assert.deepEqual(tierScores(0, 1), [3.3]);
  const many = tierScores(1, 7);
  assert.ok(many.every((s, i) => i === 0 || s < many[i - 1]) && many.at(-1) > 3.4);
});

test('ratings: insertion order sets scores, re-rating moves an item, deleting closes the gap', async (t) => {
  const { request, account } = await fixture(t);
  const alice = await account('alice');
  const rate = (n, tier, position, review = '') => request('/ratings', { token: alice.token, method: 'POST', body: { item: album(n), tier, position, review, visibility: 'public' } });
  const first = await rate(1, 2, 0, 'perfection');
  assert.equal(first.status, 201);
  assert.equal(first.data.rating.score, 10);
  assert.equal(first.data.post.kind, 'review');
  assert.equal(first.data.post.subtitle, 'perfection');
  assert.equal(first.data.post.score, 10);
  await rate(2, 2, 0); // new favourite goes above album 1
  await rate(3, 1, 0);
  let mine = (await request('/sync', { token: alice.token })).data.ratings;
  assert.deepEqual(mine.map((r) => [r.item.id, r.tier, r.position, r.score]), [['album-2', 2, 0, 10], ['album-1', 2, 1, 8.4], ['album-3', 1, 0, 6.7]]);
  assert.equal(mine.find((r) => r.item.id === 'album-1').review, 'perfection');

  // Re-rating keeps the same post (and its conversation) and moves the item.
  const again = await rate(1, 0, 0, 'changed my mind');
  assert.equal(again.status, 200);
  assert.equal(again.data.post.id, first.data.post.id);
  mine = (await request('/sync', { token: alice.token })).data.ratings;
  assert.deepEqual(mine.map((r) => [r.item.id, r.score]), [['album-2', 10], ['album-3', 6.7], ['album-1', 3.3]]);

  // Out-of-range positions are clamped; bad tiers and categories are rejected.
  assert.equal((await rate(4, 2, 99)).data.rating.position, 1);
  assert.equal((await rate(5, 3, 0)).status, 400);
  assert.equal((await request('/ratings', { token: alice.token, method: 'POST', body: { item: { ...album(6), kind: 'vinyl' }, tier: 2, visibility: 'public' } })).status, 400);
  assert.equal((await request('/ratings', { method: 'POST', body: { item: album(7), tier: 2, visibility: 'public' } })).status, 401);
  // Reviews can't be edited as ordinary posts.
  assert.equal((await request(`/posts/${first.data.post.id}`, { token: alice.token, method: 'PUT', body: { kind: 'ranking', title: 'x', items: [album(1), album(2)], visibility: 'public' } })).status, 400);

  // Deleting the review deletes the rating and the remaining loved items close ranks.
  const loved = mine.find((r) => r.item.id === 'album-2');
  assert.equal((await request(`/posts/${loved.postId}`, { token: alice.token, method: 'DELETE' })).status, 200);
  mine = (await request('/sync', { token: alice.token })).data.ratings;
  assert.deepEqual(mine.filter((r) => r.tier === 2).map((r) => [r.item.id, r.position, r.score]), [['album-4', 0, 10]]);
});

test('item pages average only the ratings a viewer may see', async (t) => {
  const { request, account } = await fixture(t);
  const [alice, bob, carol] = [await account('alice'), await account('bob'), await account('carol')];
  await request('/ratings', { token: alice.token, method: 'POST', body: { item: album(1), tier: 2, position: 0, visibility: 'public' } });
  await request('/ratings', { token: bob.token, method: 'POST', body: { item: album(1), tier: 1, position: 0, visibility: 'followers' } });
  const anonymous = (await request(`/items/${encodeURIComponent('album-1')}`)).data;
  assert.equal(anonymous.count, 1);
  assert.equal(anonymous.average, 10);
  assert.equal(anonymous.item.title, 'Album 1');
  await request('/people/bob/follow', { token: carol.token, method: 'PUT' });
  const follower = (await request('/items/album-1', { token: carol.token })).data;
  assert.equal(follower.count, 2);
  assert.equal(follower.average, 8.4);
  assert.equal((await request('/items/bad%20id')).status, 400);
  // Profiles expose only visible ratings.
  assert.equal((await request('/people/bob')).data.ratings.length, 0);
  assert.equal((await request('/people/bob', { token: carol.token })).data.ratings.length, 1);
});

test('pods: open pods take contributions with credit; closed pods and strangers are refused', async (t) => {
  const { request, account } = await fixture(t);
  const [alice, bob] = [await account('alice'), await account('bob')];
  const created = await request('/posts', { token: alice.token, method: 'POST', body: { kind: 'pod', title: 'Rainy day', items: [album(1)], visibility: 'public', open: true } });
  assert.equal(created.status, 201);
  assert.equal(created.data.post.open, true);
  const id = created.data.post.id;
  const added = await request(`/posts/${id}/items`, { token: bob.token, method: 'POST', body: { item: album(2) } });
  assert.equal(added.status, 200);
  assert.equal(added.data.post.items[1].addedBy, '@bob');
  assert.equal((await request(`/posts/${id}/items`, { token: bob.token, method: 'POST', body: { item: album(2) } })).status, 409);
  assert.equal((await request(`/posts/${id}/items/album-1`, { token: bob.token, method: 'DELETE' })).status, 403);
  // The owner's edit can't strip or forge credit.
  const edit = await request(`/posts/${id}`, { token: alice.token, method: 'PUT', body: { kind: 'pod', title: 'Rainy day', items: [{ ...album(1), addedBy: '@bob' }, album(2)], visibility: 'public', open: false } });
  assert.deepEqual(edit.data.post.items.map((i) => i.addedBy), [undefined, '@bob']);
  assert.equal(edit.data.post.open, false);
  assert.equal((await request(`/posts/${id}/items`, { token: bob.token, method: 'POST', body: { item: album(3) } })).status, 403);
  assert.equal((await request(`/posts/${id}/items/album-2`, { token: bob.token, method: 'DELETE' })).status, 200);
  const notes = (await request('/notifications', { token: alice.token })).data.notifications;
  assert.ok(notes.some((n) => n.kind === 'contribution' && n.postId === id));
  // The item page lists pods that contain it.
  assert.equal((await request('/items/album-1')).data.pods[0].id, id);
});

test('catalog search proxies keyless sources and hides movies until TMDB is configured', async (t) => {
  const calls = [];
  const fetcher = async (url) => {
    calls.push(String(url));
    if (String(url).startsWith('https://api.deezer.com')) return new Response(JSON.stringify({ data: [{ id: 525046, name: 'Kendrick Lamar', nb_fan: 12000000, picture_xl: 'https://cdn.example/k.jpg', link: 'https://www.deezer.com/artist/525046' }] }));
    if (String(url).startsWith('https://api.tvmaze.com')) return new Response(JSON.stringify([{ show: { id: 169, name: 'Breaking Bad', premiered: '2008-01-20', network: { name: 'AMC' }, image: { original: 'http://insecure.example/x.jpg' }, url: 'https://www.tvmaze.com/shows/169' } }]));
    return new Response('{}', { status: 500 });
  };
  const { request } = await fixture(t, fetcher);
  const config = (await request('/config')).data;
  assert.equal(config.catalog.movie, false);
  const artists = (await request('/catalog?kind=artist&q=kendrick')).data.items;
  assert.equal(artists[0].id, 'artist-dz525046');
  assert.equal(artists[0].artist, '12M fans');
  const shows = (await request('/catalog?kind=show&q=breaking')).data.items;
  assert.equal(shows[0].artist, 'AMC · 2008');
  assert.equal(shows[0].artwork, undefined, 'non-HTTPS artwork is dropped');
  await request('/catalog?kind=artist&q=KENDRICK');
  assert.equal(calls.filter((u) => u.includes('deezer')).length, 1, 'repeat searches are cached');
  assert.equal((await request('/catalog?kind=movie&q=dune')).status, 503);
  assert.equal((await request('/catalog?kind=vinyl&q=dune')).status, 400);
  assert.equal((await request('/catalog?kind=book&q=x')).status, 400);
});

test('an existing database from before ratings is migrated without losing conversations', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'margin-migrate-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, 'old.db');
  const old = new DatabaseSync(file);
  old.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, handle TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL, bio TEXT NOT NULL DEFAULT '', password TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE posts (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL CHECK(kind IN ('ranking','moodboard')), title TEXT NOT NULL, subtitle TEXT NOT NULL DEFAULT '', items TEXT NOT NULL, tiles TEXT NOT NULL DEFAULT '[]', theme TEXT NOT NULL DEFAULT 'night', visibility TEXT NOT NULL CHECK(visibility IN ('public','followers','private')), origin_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE comments (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE, text TEXT NOT NULL, item_id TEXT, created_at TEXT NOT NULL);
    INSERT INTO users VALUES ('u1', 'a@example.com', 'alice', 'Alice', '', 'x', '2025-01-01');
    INSERT INTO posts VALUES ('p1', 'u1', 'ranking', 'Old list', '', '[]', '[]', 'night', 'public', NULL, '2025-01-01', '2025-01-01');
    INSERT INTO comments VALUES ('c1', 'u1', 'p1', 'still here', NULL, '2025-01-01');`);
  old.close();
  const db = await openDatabase({ url: '', file });
  // Close before the directory cleanup runs: Windows can't delete an open database file.
  t.after(() => { try { db.close(); } catch { /* already closed */ } });
  assert.equal((await db.get('SELECT COUNT(*) AS n FROM comments')).n, 1, 'comments survive the rebuild');
  assert.equal((await db.get("SELECT meta FROM posts WHERE id='p1'")).meta, '{}');
  await db.run("INSERT INTO posts (id, user_id, kind, title, items, visibility, created_at, updated_at) VALUES ('p2', 'u1', 'pod', 'New', '[]', 'public', 'x', 'x')");
  // Cascades still work after the rebuild.
  await db.run("DELETE FROM posts WHERE id='p1'");
  assert.equal((await db.get('SELECT COUNT(*) AS n FROM comments')).n, 0);
  db.close();
});

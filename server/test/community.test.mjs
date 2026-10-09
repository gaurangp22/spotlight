import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../db.mjs';
import { createApi } from '../api.mjs';
import { currentWeek } from '../community.mjs';

const song = { id: 'song-1', kind: 'song', title: 'Reckoner', artist: 'Radiohead' };
const album = { id: 'album-1', kind: 'album', title: 'In Rainbows', artist: 'Radiohead' };
const artist = { id: 'artist-1', kind: 'artist', title: 'Radiohead', artist: 'Artist' };
async function fixture(t) {
  const db = await openDatabase({ url: '', file: ':memory:' }), server = createApi({ db });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise((resolve) => server.close(resolve)); db.close(); });
  const request = async (path, { token, method = 'GET', body } = {}) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, data: await res.json() };
  };
  const account = async (handle) => {
    const res = await request('/auth/register', { method: 'POST', body: { email: `${handle}@example.test`, handle, name: handle, password: 'a-long-password-123' } });
    assert.equal(res.status, 201); return res.data;
  };
  const post = async (person, visibility = 'public') => (await request('/posts', { token: person.token, method: 'POST', body: { kind: 'take', title: 'This song stays with me.', items: [song], visibility } })).data.post;
  return { db, request, account, post };
}

test('onboarding and profile photos persist, validate input, and appear on posts and profiles', async (t) => {
  const { request, account, post } = await fixture(t), alice = await account('alice');
  assert.equal(alice.user.onboardingComplete, false);
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=';
  const update = await request('/me', { token: alice.token, method: 'PATCH', body: { name: 'Alice', bio: 'Music', avatar: png } });
  assert.equal(update.data.user.avatar, png);
  assert.equal((await post(alice)).avatar, png);
  assert.equal((await request('/people/alice')).data.user.avatar, png);
  assert.equal((await request('/me', { token: alice.token, method: 'PATCH', body: { name: 'Alice', bio: '', avatar: 'data:image/png;base64,ZmFrZQ==' } })).status, 400);
  assert.equal((await request('/me/onboarding', { method: 'PUT', body: { artists: [artist] } })).status, 401);
  assert.equal((await request('/me/onboarding', { token: alice.token, method: 'PUT', body: { artists: [song] } })).status, 400);
  assert.equal((await request('/me/onboarding', { token: alice.token, method: 'PUT', body: { artists: [artist, artist] } })).status, 400);
  const setup = await request('/me/onboarding', { token: alice.token, method: 'PUT', body: { artists: [artist], complete: true } });
  assert.equal(setup.data.user.onboardingComplete, true); assert.equal(setup.data.user.favoriteArtists[0].title, 'Radiohead');
  const login = await request('/auth/login', { method: 'POST', body: { email: 'alice@example.test', password: 'a-long-password-123' } });
  assert.equal(login.data.user.onboardingComplete, true); assert.equal(login.data.user.avatar, png);
  assert.equal((await request('/me', { token: alice.token, method: 'PATCH', body: { name: 'Alice', bio: '', avatar: '' } })).data.user.avatar, undefined);
});

test('follow lists paginate and honor both-direction blocks', async (t) => {
  const { db, request, account } = await fixture(t), alice = await account('alice'), bob = await account('bobby');
  await request('/people/alice/follow', { token: bob.token, method: 'PUT' });
  for (let index = 0; index < 32; index++) {
    await db.run('INSERT INTO users (id,email,handle,name,password,created_at) VALUES (?,?,?,?,?,?)', `u-${index}`, `u${index}@example.test`, `user_${index}`, `User ${index}`, 'unused', '2026-01-01');
    await db.run('INSERT INTO follows VALUES (?,?)', `u-${index}`, alice.user.id);
  }
  const first = (await request('/people/alice/followers')).data;
  assert.equal(first.people.length, 30); assert.equal(first.nextOffset, 30);
  assert.equal((await request('/people/alice/followers?offset=30')).data.people.length, 3);
  assert.equal((await request('/people/bobby/following')).data.people[0].id, alice.user.id);
  await request('/people/bobby/block', { token: alice.token, method: 'PUT' });
  assert.equal((await request('/people/alice/followers', { token: bob.token })).status, 404);
  assert.ok(!(await request('/people/alice/followers', { token: alice.token })).data.people.some((person) => person.id === bob.user.id));
});

test('private libraries survive repeat saves but never bypass post visibility or blocks', async (t) => {
  const { request, account, post } = await fixture(t), alice = await account('alice'), bob = await account('bobby');
  const publicPost = await post(alice), privatePost = await post(alice, 'private');
  assert.equal((await request('/library')).status, 401);
  for (let n = 0; n < 2; n++) {
    assert.equal((await request(`/library/items/${song.id}`, { token: bob.token, method: 'PUT', body: { item: song } })).status, 200);
    assert.equal((await request(`/library/posts/${publicPost.id}`, { token: bob.token, method: 'PUT' })).status, 200);
  }
  const library = (await request('/library', { token: bob.token })).data;
  assert.equal(library.items.length, 1); assert.equal(library.posts.length, 1);
  assert.equal((await request(`/library/posts/${privatePost.id}`, { token: bob.token, method: 'PUT' })).status, 404);
  await request(`/posts/${publicPost.id}`, { token: alice.token, method: 'PUT', body: { kind: 'take', title: 'Now private', items: [song], visibility: 'private' } });
  assert.equal((await request('/library', { token: bob.token })).data.posts.length, 0);
  assert.equal((await request('/sync', { token: bob.token })).data.savedPostIds.length, 0);
  const second = await post(alice);
  await request(`/library/posts/${second.id}`, { token: bob.token, method: 'PUT' });
  await request('/people/alice/block', { token: bob.token, method: 'PUT' });
  assert.equal((await request('/library', { token: bob.token })).data.posts.length, 0);
  await request(`/library/items/${song.id}`, { token: bob.token, method: 'DELETE' });
  await request(`/library/posts/${publicPost.id}`, { token: bob.token, method: 'DELETE' });
  assert.equal((await request('/library', { token: alice.token })).data.items.length, 0);
  assert.equal((await request('/library', { token: bob.token })).data.items.length, 0);
});

test('replies and mentions notify once, enforce access and blocks, and survive parent deletion', async (t) => {
  const { db, request, account, post } = await fixture(t), alice = await account('alice'), bob = await account('bobby'), cara = await account('carol'), dan = await account('danny');
  const p = await post(alice), other = await post(alice);
  const parent = (await request(`/posts/${p.id}/comments`, { token: bob.token, method: 'POST', body: { text: 'A favourite.' } })).data.post.comments[0];
  assert.equal((await request(`/posts/${other.id}/comments`, { token: cara.token, method: 'POST', body: { text: 'Wrong post', parentId: parent.id } })).status, 400);
  const reply = await request(`/posts/${p.id}/comments`, { token: cara.token, method: 'POST', body: { text: '@bobby @bobby @alice @danny same here', parentId: parent.id } });
  assert.equal(reply.status, 201); assert.equal(reply.data.post.comments[1].parentId, parent.id);
  assert.equal((await db.get("SELECT COUNT(*) AS n FROM notifications WHERE user_id=? AND actor_id=? AND kind='reply'", bob.user.id, cara.user.id)).n, 1);
  assert.equal((await db.get("SELECT COUNT(*) AS n FROM notifications WHERE user_id=? AND actor_id=? AND kind='mention'", dan.user.id, cara.user.id)).n, 1);
  await request('/people/carol/block', { token: dan.token, method: 'PUT' });
  await request(`/posts/${p.id}/comments`, { token: cara.token, method: 'POST', body: { text: '@danny this should not notify' } });
  assert.equal((await db.get('SELECT COUNT(*) AS n FROM notifications WHERE user_id=? AND actor_id=?', dan.user.id, cara.user.id)).n, 1);
  const privatePost = await post(alice, 'private');
  await request(`/posts/${privatePost.id}/comments`, { token: alice.token, method: 'POST', body: { text: '@bobby private thought' } });
  assert.equal((await db.get('SELECT COUNT(*) AS n FROM notifications WHERE user_id=? AND post_id=?', bob.user.id, privatePost.id)).n, 0);
  await request(`/comments/${parent.id}`, { token: bob.token, method: 'DELETE' });
  const remaining = (await request(`/posts/${p.id}`)).data.post.comments;
  assert.equal(remaining[0].parentId, undefined); assert.ok(remaining[0].text.includes('same here'));
});

test('weekly clubs enforce ownership, one album per UTC week, updates, membership and deletion', async (t) => {
  const { db, request, account } = await fixture(t), alice = await account('alice'), bob = await account('bobby');
  assert.equal(currentWeek(new Date('2026-10-11T23:59:59Z')), '2026-10-05');
  assert.equal(currentWeek(new Date('2026-10-12T00:00:00Z')), '2026-10-12');
  const created = await request('/clubs', { token: alice.token, method: 'POST', body: { name: 'Sunday albums', description: 'One record together.' } });
  assert.equal(created.status, 201); const id = created.data.club.id;
  assert.equal(created.data.club.joined, true);
  for (let n = 0; n < 2; n++) await request(`/clubs/${id}/join`, { token: bob.token, method: 'PUT' });
  assert.equal((await request(`/clubs/${id}`)).data.club.members, 2);
  assert.equal((await request(`/clubs/${id}/weeks`, { token: bob.token, method: 'POST', body: { item: album } })).status, 403);
  assert.equal((await request(`/clubs/${id}/weeks`, { token: alice.token, method: 'POST', body: { item: song } })).status, 400);
  const attempts = await Promise.all([0, 1].map(() => request(`/clubs/${id}/weeks`, { token: alice.token, method: 'POST', body: { item: album } })));
  assert.deepEqual(attempts.map((res) => res.status).sort(), [201, 409]);
  const p = attempts.find((res) => res.status === 201).data.post;
  assert.equal(p.clubId, id); assert.equal(p.items[0].kind, 'album');
  assert.equal((await db.get("SELECT COUNT(*) AS n FROM posts WHERE kind='pod'")).n, 1);
  assert.equal((await request(`/posts/${p.id}/items`, { token: alice.token, method: 'POST', body: { item: song } })).status, 400);
  assert.equal((await request(`/posts/${p.id}/items/${album.id}`, { token: alice.token, method: 'DELETE' })).status, 400);
  assert.equal((await request('/notifications', { token: bob.token })).data.notifications[0].kind, 'club');
  assert.equal((await request(`/posts/${p.id}`, { token: alice.token, method: 'PUT', body: { kind: 'pod', title: 'Changed', items: [song], visibility: 'private' } })).status, 400);
  assert.equal((await request(`/clubs/${id}/join`, { token: alice.token, method: 'DELETE' })).status, 400);
  await request('/people/alice/block', { token: bob.token, method: 'PUT' });
  assert.equal((await request(`/clubs/${id}`, { token: bob.token })).status, 404);
  assert.equal((await request('/clubs', { token: bob.token })).data.clubs.length, 0);
  await request(`/clubs/${id}`, { token: alice.token, method: 'DELETE' });
  assert.equal((await request(`/posts/${p.id}`)).status, 404);
  assert.equal((await db.get('SELECT COUNT(*) AS n FROM club_members')).n, 0);
});

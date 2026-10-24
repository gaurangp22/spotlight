import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../db.mjs';
import { createApi } from '../api.mjs';

const song = { id: 'song-1', kind: 'song', title: 'Reckoner', artist: 'Radiohead' };
const ADMIN = 'test-admin-only-token-at-least-32-characters';
async function fixture(t) {
  const previous = process.env.ADMIN_TOKEN;
  process.env.ADMIN_TOKEN = ADMIN;
  const db = await openDatabase({ url: '', file: ':memory:' }), server = createApi({ db });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    if (previous === undefined) delete process.env.ADMIN_TOKEN; else process.env.ADMIN_TOKEN = previous;
    await new Promise((resolve) => server.close(resolve)); db.close();
  });
  const request = async (path, { token, method = 'GET', body } = {}) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, data: await res.json() };
  };
  const register = (handle, name = handle) => request('/auth/register', { method: 'POST', body: { email: `${handle}@example.test`, handle, name, password: 'a-long-password-123' } });
  const account = async (handle) => { const res = await register(handle); assert.equal(res.status, 201); return res.data; };
  const admin = (path, method = 'GET', body) => request(`/admin/${path}`, { token: ADMIN, method, body });
  return { db, request, register, account, admin };
}

test('staff-looking usernames and display names are reserved at signup and on profile edits', async (t) => {
  const { request, register, account } = await fixture(t);
  for (const handle of ['riffs', 'riffs_team', 'riffsapp', 'admin', 'support', 'the_official', 'mod']) assert.equal((await register(handle)).status, 400, handle);
  for (const name of ['Riffs', 'Riffs Official', 'riffs-support', 'The Riffs Team']) assert.equal((await register(`fan_${name.length}`, name)).status, 400, name);
  const fan = await account('riffsfan');
  assert.equal(fan.user.handle, '@riffsfan');
  assert.equal((await register('mira_admins', 'Mira')).status, 201);
  assert.equal((await request('/me', { token: fan.token, method: 'PATCH', body: { name: 'Riffs HQ', bio: '' } })).status, 400);
  assert.equal((await request('/me', { token: fan.token, method: 'PATCH', body: { name: 'Riffs listener', bio: '' } })).status, 200);
});

test('failed sign-ins are limited per email, successes are not counted, and signup has its own limit', async (t) => {
  const { request, account } = await fixture(t);
  await account('alice');
  const login = (password, email = 'alice@example.test') => request('/auth/login', { method: 'POST', body: { email, password } });
  // Successful sign-ins never use up the allowance.
  for (let i = 0; i < 25; i++) assert.equal((await login('a-long-password-123')).status, 200);
  for (let i = 0; i < 8; i++) assert.equal((await login('wrong-password')).status, 401);
  const locked = await login('a-long-password-123');
  assert.equal(locked.status, 429);
  assert.match(locked.data.error, /this email/);
  // Another account on the same network is unaffected, and so is signing up.
  await account('bob');
  assert.equal((await login('a-long-password-123', 'bob@example.test')).status, 200);
  // Unknown emails lock the same way, so the limit reveals nothing about which accounts exist.
  for (let i = 0; i < 8; i++) assert.equal((await login('wrong-password', 'nobody@example.test')).status, 401);
  assert.equal((await login('wrong-password', 'nobody@example.test')).status, 429);
});

test('comments and profiles can be reported, and moderators can act on the reports', async (t) => {
  const { db, request, account, admin } = await fixture(t);
  const alice = await account('alice'), bob = await account('bob');
  const post = (await request('/posts', { token: alice.token, method: 'POST', body: { kind: 'take', title: 'Bridges are the best part.', items: [song], visibility: 'public' } })).data.post;
  assert.equal((await request(`/posts/${post.id}/comments`, { token: bob.token, method: 'POST', body: { text: 'nasty comment' } })).status, 201);
  const comment = await db.get('SELECT id FROM comments WHERE user_id=?', bob.user.id);

  assert.equal((await request(`/comments/${comment.id}/report`, { method: 'POST', body: { reason: 'Harassment' } })).status, 401);
  assert.equal((await request(`/comments/${comment.id}/report`, { token: bob.token, method: 'POST', body: { reason: 'Harassment' } })).status, 400);
  assert.equal((await request(`/comments/${comment.id}/report`, { token: alice.token, method: 'POST', body: { reason: 'x' } })).status, 400);
  assert.equal((await request('/comments/missing/report', { token: alice.token, method: 'POST', body: { reason: 'Harassment' } })).status, 404);
  assert.equal((await request(`/comments/${comment.id}/report`, { token: alice.token, method: 'POST', body: { reason: 'Harassment' } })).status, 201);
  assert.equal((await request('/people/bob/report', { token: alice.token, method: 'POST', body: { reason: 'Impersonation' } })).status, 201);
  assert.equal((await request('/people/alice/report', { token: alice.token, method: 'POST', body: { reason: 'Impersonation' } })).status, 400);
  assert.equal((await request('/people/nobody/report', { token: alice.token, method: 'POST', body: { reason: 'Impersonation' } })).status, 404);

  assert.equal((await request('/admin/comment-reports', { token: alice.token })).status, 403);
  const comments = (await admin('comment-reports')).data.reports;
  assert.deepEqual(comments.map((r) => [r.author, r.text, r.reporter]), [['bob', 'nasty comment', 'alice']]);
  assert.equal((await admin(`comment-reports/${comments[0].id}`, 'PATCH', { removeComment: true })).status, 200);
  assert.equal(await db.get('SELECT id FROM comments WHERE id=?', comment.id), undefined);
  assert.equal((await admin('comment-reports')).data.reports.length, 0);

  const profiles = (await admin('user-reports')).data.reports;
  assert.deepEqual(profiles.map((r) => [r.target, r.reporter, r.suspended]), [['bob', 'alice', 0]]);
  assert.equal((await admin(`user-reports/${profiles[0].id}`, 'PATCH', { suspend: true })).status, 200);
  assert.equal((await admin('user-reports')).data.reports.length, 0);
  assert.equal((await db.get('SELECT suspended FROM users WHERE id=?', bob.user.id)).suspended, 1);
});

test('suspension signs someone out, blocks sign-in, hides their content, and can be undone', async (t) => {
  const { request, account, admin } = await fixture(t);
  const alice = await account('alice'), bob = await account('bob');
  const take = (await request('/posts', { token: bob.token, method: 'POST', body: { kind: 'take', title: 'Loud opinion.', items: [song], visibility: 'public' } })).data.post;
  const alicePost = (await request('/posts', { token: alice.token, method: 'POST', body: { kind: 'take', title: 'Quiet opinion.', items: [song], visibility: 'public' } })).data.post;
  await request(`/posts/${alicePost.id}/comments`, { token: bob.token, method: 'POST', body: { text: 'bob was here' } });

  assert.equal((await admin('users/bob', 'PATCH', {})).status, 400);
  assert.equal((await admin('users/nobody', 'PATCH', { suspended: true })).status, 404);
  assert.equal((await admin('users/bob', 'PATCH', { suspended: true })).status, 200);

  assert.equal((await request('/me', { token: bob.token })).status, 401);
  const login = await request('/auth/login', { method: 'POST', body: { email: 'bob@example.test', password: 'a-long-password-123' } });
  assert.equal(login.status, 403);
  assert.match(login.data.error, /suspended/);
  // A wrong password still gets the usual answer, so suspension isn't revealed to strangers.
  assert.equal((await request('/auth/login', { method: 'POST', body: { email: 'bob@example.test', password: 'wrong-password' } })).status, 401);

  assert.equal((await request(`/posts/${take.id}`, { token: alice.token })).status, 404);
  assert.equal((await request('/people/bob', { token: alice.token })).status, 404);
  assert.equal((await request('/people/bob/follow', { token: alice.token, method: 'PUT' })).status, 400);
  const feed = (await request('/sync', { token: alice.token })).data;
  assert.ok(!feed.posts.some((p) => p.id === take.id));
  assert.ok(!feed.people.some((p) => p.handle === '@bob'));
  const visible = feed.posts.find((p) => p.id === alicePost.id);
  assert.ok(!visible.comments.some((c) => c.text === 'bob was here'));

  assert.equal((await admin('users/bob', 'PATCH', { suspended: false })).status, 200);
  assert.equal((await request('/auth/login', { method: 'POST', body: { email: 'bob@example.test', password: 'a-long-password-123' } })).status, 200);
  assert.equal((await request(`/posts/${take.id}`, { token: alice.token })).status, 200);
});

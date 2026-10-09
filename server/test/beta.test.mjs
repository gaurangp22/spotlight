import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../db.mjs';
import { createApi } from '../api.mjs';

const ADMIN = 'an-admin-token-that-is-long-enough-1234';
async function fixture(t) {
  const previous = process.env.ADMIN_TOKEN;
  process.env.ADMIN_TOKEN = ADMIN;
  const db = await openDatabase({ url: '', file: ':memory:' }), server = createApi({ db });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { process.env.ADMIN_TOKEN = previous; await new Promise((resolve) => server.close(resolve)); db.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, { token, method = 'GET', body } = {}) => {
    const res = await fetch(`${base}/api${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, data: await res.json() };
  };
  const account = async (handle, invite, email = `${handle}@example.test`) => {
    const res = await request('/auth/register', { method: 'POST', body: { email, handle, name: handle, password: 'a-long-password-123', ...(invite ? { invite } : {}) } });
    assert.equal(res.status, 201, JSON.stringify(res.data)); return res.data;
  };
  return { db, base, request, account };
}

test('invite links: a public landing page, credit and a follow on signup, and no abuse paths', async (t) => {
  const { db, base, request, account } = await fixture(t);
  const mandi = await account('mandi');
  await request('/me', { token: mandi.token, method: 'PATCH', body: { name: 'Mandi <script>', bio: '', status: 'On repeat: TPAB' } });

  const page = await fetch(`${base}/join/Mandi`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /default-src 'none'/);
  const html = await page.text();
  assert.match(html, /Mandi &lt;script&gt; wants you on Riffs/, 'names are escaped');
  assert.match(html, /marginmusic:\/\/join\/mandi/);
  assert.match(html, /On repeat: TPAB/);
  assert.match(await (await fetch(`${base}/join/nobody_here`)).text(), /This invite has expired/);
  assert.equal((await request('/invites/mandi')).data.inviter.handle, '@mandi');
  assert.equal((await request('/invites/nobody_here')).status, 404);

  const ayush = await account('ayush', '@Mandi');
  const sync = await request('/sync', { token: ayush.token });
  assert.ok(sync.data.following.includes('@mandi'), 'new people follow whoever invited them');
  const notes = (await request('/notifications', { token: mandi.token })).data.notifications;
  assert.ok(notes.some((n) => n.kind === 'joined' && n.handle === '@ayush'));
  assert.deepEqual((await request('/me/invites', { token: mandi.token })).data.joined.map((p) => p.handle), ['@ayush']);
  assert.equal((await request('/me/invites')).status, 401);

  // Unknown, malformed, and self invites are ignored rather than failing signup.
  await account('ghost', 'nobody_here');
  await account('weird', '<script>');
  const self = await account('selfie', 'selfie');
  assert.equal((await db.get("SELECT invited_by FROM users WHERE handle='selfie'")).invited_by, null);
  assert.equal((await request('/me/invites', { token: self.token })).data.joined.length, 0);
  // Deleting the inviter keeps the people they invited.
  await db.run("DELETE FROM users WHERE handle='mandi'");
  assert.equal((await db.get("SELECT invited_by FROM users WHERE handle='ayush'")).invited_by, null);
});

test('shared post links preview public posts with a cover and never reveal private ones', async (t) => {
  const { base, request, account } = await fixture(t);
  const alice = await account('alice');
  const item = { id: 'album-1', kind: 'album', title: 'To Pimp a Butterfly', artist: 'Kendrick Lamar', artwork: 'https://is1-ssl.mzstatic.com/a.jpg' };
  const review = (await request('/ratings', { token: alice.token, method: 'POST', body: { item, tier: 2, position: 0, review: 'perfection <b>', visibility: 'public' } })).data.post;
  const secret = (await request('/posts', { token: alice.token, method: 'POST', body: { kind: 'take', title: 'secret take', items: [], visibility: 'private' } })).data.post;
  const followers = (await request('/posts', { token: alice.token, method: 'POST', body: { kind: 'take', title: 'friends only', items: [], visibility: 'followers' } })).data.post;
  const page = await fetch(`${base}/p/${review.id}`);
  assert.match(page.headers.get('content-security-policy'), /img-src https:/);
  const html = await page.text();
  assert.match(html, /alice rated To Pimp a Butterfly 10\/10/);
  assert.match(html, /perfection &lt;b&gt;/);
  assert.match(html, /og:image" content="https:\/\/is1-ssl\.mzstatic\.com\/a\.jpg"/);
  assert.match(html, /\/join\/alice/);
  for (const hidden of [secret, followers]) {
    const text = await (await fetch(`${base}/p/${hidden.id}`)).text();
    assert.match(text, /This post isn’t available/);
    assert.doesNotMatch(text, /secret take|friends only/);
  }
});

test('feedback works signed in or out, is validated and rate limited, and only admins can read it', async (t) => {
  const { request, account } = await fixture(t);
  const alice = await account('alice');
  assert.equal((await request('/feedback', { token: alice.token, method: 'POST', body: { text: 'The poll bars overlap on my phone', context: '/ranking/abc', platform: 'android', version: '2.0.0' } })).status, 201);
  assert.equal((await request('/feedback', { method: 'POST', body: { text: 'Signup button did nothing', platform: 'nonsense' } })).status, 201);
  assert.equal((await request('/feedback', { method: 'POST', body: { text: 'x' } })).status, 400);
  assert.equal((await request('/admin/feedback')).status, 403);
  assert.equal((await request('/admin/feedback', { token: alice.token })).status, 403);
  const open = (await request('/admin/feedback', { token: ADMIN })).data.feedback;
  assert.equal(open.length, 2);
  const mine = open.find((f) => f.handle === 'alice');
  assert.equal(mine.platform, 'android');
  assert.equal(open.find((f) => !f.handle).platform, 'unknown');
  assert.equal((await request(`/admin/feedback/${mine.id}`, { token: ADMIN, method: 'PATCH', body: {} })).status, 200);
  assert.equal((await request('/admin/feedback/missing', { token: ADMIN, method: 'PATCH', body: {} })).status, 404);
  assert.equal((await request('/admin/feedback', { token: ADMIN })).data.feedback.length, 1);
  for (let i = 0; i < 9; i++) await request('/feedback', { token: alice.token, method: 'POST', body: { text: `Note ${i}` } });
  assert.equal((await request('/feedback', { token: alice.token, method: 'POST', body: { text: 'One too many' } })).status, 429);
});

test('founder stats count real activity once a day, exclude demo accounts, and report retention', async (t) => {
  const { db, request, account } = await fixture(t);
  const alice = await account('alice'), bob = await account('bob', 'alice');
  await account('demo_bot', undefined, 'bot@demo.margin.invalid');
  for (let i = 0; i < 3; i++) await request('/sync', { token: alice.token });
  assert.equal((await db.get("SELECT COUNT(*) AS n FROM active_days a JOIN users u ON u.id=a.user_id WHERE u.handle='alice'")).n, 1, 'one row per day');
  await request('/posts', { token: bob.token, method: 'POST', body: { kind: 'take', title: 'Hot take', items: [], visibility: 'public' } });
  // Backdate Alice's signup by 8 days with visits on days 1 and 7.
  const start = new Date(Date.now() - 8 * 86400000);
  await db.run("UPDATE users SET created_at=? WHERE handle='alice'", start.toISOString());
  for (const offset of [1, 7]) await db.run('INSERT OR IGNORE INTO active_days VALUES ((SELECT id FROM users WHERE handle=\'alice\'), ?)', new Date(Date.parse(start.toISOString().slice(0, 10)) + offset * 86400000).toISOString().slice(0, 10));

  assert.equal((await request('/admin/stats')).status, 403);
  const stats = (await request('/admin/stats', { token: ADMIN })).data;
  assert.equal(stats.users, 2, 'demo accounts are excluded');
  assert.equal(stats.dau, 2);
  assert.equal(stats.lastSevenDays.posts.take, 1);
  assert.equal(stats.invites.joined, 1);
  assert.deepEqual(stats.invites.topInviters, [{ handle: '@alice', joined: 1 }]);
  const aliceWeek = stats.retention.find((c) => c.signups === 1 && c.nextDay === 100);
  assert.ok(aliceWeek, JSON.stringify(stats.retention));
  assert.equal(aliceWeek.month, null, 'too early to judge a month');
});

test('an existing database gains invite and activity tables without losing people', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'riffs-beta-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, 'old.db');
  const old = new DatabaseSync(file);
  old.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, handle TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL, bio TEXT NOT NULL DEFAULT '', password TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE posts (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL CHECK(kind IN ('ranking','moodboard','review','pod','take')), title TEXT NOT NULL, subtitle TEXT NOT NULL DEFAULT '', items TEXT NOT NULL, tiles TEXT NOT NULL DEFAULT '[]', theme TEXT NOT NULL DEFAULT 'night', visibility TEXT NOT NULL, origin_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, meta TEXT NOT NULL DEFAULT '{}');
    INSERT INTO users VALUES ('u1', 'a@example.com', 'alice', 'Alice', '', 'x', '2025-01-01');`);
  old.close();
  const db = await openDatabase({ url: '', file });
  assert.equal((await db.get("SELECT invited_by FROM users WHERE id='u1'")).invited_by, null);
  await db.run("INSERT INTO active_days VALUES ('u1', '2026-10-09')");
  await db.run("INSERT INTO feedback (id, text, created_at) VALUES ('f1', 'hello', 'x')");
  assert.equal((await db.get('SELECT COUNT(*) AS n FROM users')).n, 1);
  db.close();
});

test('in development, phones on the same Wi-Fi may use the web app; other sites and production stay locked down', async (t) => {
  const { base } = await fixture(t);
  const health = (origin) => fetch(`${base}/api/config`, { headers: { Origin: origin } }).then((r) => r.status);
  assert.equal(await health('http://192.168.1.23:8081'), 200);
  assert.equal(await health('http://10.0.0.7:8081'), 200);
  assert.equal(await health('https://evil.example'), 403);
  assert.equal(await health('http://192.168.1.23.evil.example'), 403);
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  const db = await openDatabase({ url: '', file: ':memory:' }), server = createApi({ db });
  process.env.NODE_ENV = previous;
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise((resolve) => server.close(resolve)); db.close(); });
  const status = await fetch(`http://127.0.0.1:${server.address().port}/api/config`, { headers: { Origin: 'http://192.168.1.23:8081' } }).then((r) => r.status);
  assert.equal(status, 403);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../db.mjs';
import { createApi } from '../api.mjs';
import { botId, createBotEngine, ensureBots, PERSONAS } from '../bots.mjs';

const ADMIN = 'an-admin-token-that-is-long-enough-1234';
// A fake Apple catalog: three albums and three songs for whichever artist is asked about.
const catalog = async (url) => {
  const u = new URL(url), artist = u.searchParams.get('term'), entity = u.searchParams.get('entity');
  const results = [1, 2, 3].map((n) => entity === 'album'
    ? { collectionId: `${artist.length}${n}`, collectionName: `${artist} Album ${n}`, artistName: artist, artworkUrl100: 'https://is1-ssl.mzstatic.com/a/100x100bb.jpg' }
    : { trackId: `${artist.length}${n}9`, trackName: `${artist} Song ${n}`, collectionName: 'Record', artistName: artist, artworkUrl100: 'https://is1-ssl.mzstatic.com/s/100x100bb.jpg' });
  return new Response(JSON.stringify({ results }));
};

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
  const account = async (handle) => (await request('/auth/register', { method: 'POST', body: { email: `${handle}@example.test`, handle, name: handle, password: 'a-long-password-123' } })).data;
  let clock = Date.now(), seed = 1;
  const engine = (options = {}) => createBotEngine({ db, base, fetcher: catalog, now: () => clock, random: () => ((seed = (seed * 16807) % 2147483647) / 2147483647), log: { warn() {} }, ...options });
  await ensureBots(db);
  return { db, base, request, account, engine, advance: (ms) => { clock += ms; } };
}

test('bots are labelled accounts that cannot be signed into and publish real catalog music within a daily limit', async (t) => {
  const { db, request, engine, advance } = await fixture(t);
  await ensureBots(db); // idempotent
  assert.equal((await db.get('SELECT COUNT(*) AS n FROM users WHERE is_bot=1')).n, PERSONAS.length);
  const radio = (await request('/people/riffs_radio')).data.user;
  assert.equal(radio.bot, true);
  assert.equal((await request('/auth/login', { method: 'POST', body: { email: 'riffs_radio@bots.riffs.invalid', password: 'anything-at-all-123' } })).status, 401);

  const bots = engine({ dailyPosts: 3, gapMs: 60 * 60000 });
  const first = (await bots.tick()).posted;
  assert.ok(first, 'a bot posted');
  assert.equal(first.authorBot, true);
  assert.equal((await bots.tick()).posted, null, 'waits for the gap between posts');
  for (let i = 0; i < 5; i++) { advance(61 * 60000); await bots.tick(); }
  const posts = (await request('/feed?mode=recent')).data.posts.filter((p) => p.authorBot);
  assert.equal(posts.length, 3, 'never more than the daily limit');
  for (const p of posts) {
    assert.ok(['review', 'take'].includes(p.kind));
    assert.ok(p.items.every((i) => i.artwork?.startsWith('https://is1-ssl.mzstatic.com/') && i.artwork.includes('600x600bb')));
  }
});

test('bots like, vote, and reply to real people within limits, and leave alone anyone who hides them', async (t) => {
  const { db, request, account, engine } = await fixture(t);
  const ayush = await account('ayush'), quiet = await account('quiet');
  const item = { id: 'album-9', kind: 'album', title: 'GNX', artist: 'Kendrick Lamar', artwork: 'https://is1-ssl.mzstatic.com/x.jpg' };
  const review = (await request('/ratings', { token: ayush.token, method: 'POST', body: { item, tier: 2, position: 0, review: 'masterpiece', visibility: 'public' } })).data.post;
  const poll = (await request('/posts', { token: ayush.token, method: 'POST', body: { kind: 'take', poll: true, title: 'Which?', items: [item, { ...item, id: 'album-10', title: 'DAMN.' }], visibility: 'public' } })).data.post;
  const secret = (await request('/posts', { token: ayush.token, method: 'POST', body: { kind: 'take', title: 'just for me', items: [], visibility: 'private' } })).data.post;
  assert.equal((await request('/me/preferences', { token: quiet.token, method: 'PATCH', body: { bots: false } })).data.bots, false);
  const hidden = (await request('/posts', { token: quiet.token, method: 'POST', body: { kind: 'take', title: 'no bots please', items: [], visibility: 'public' } })).data.post;

  const bots = engine();
  const result = await bots.tick();
  assert.ok(result.engaged >= 2);
  const liked = (await request(`/posts/${review.id}`, { token: ayush.token })).data.post;
  assert.equal(liked.reactionCount, 1);
  // The Kendrick fan answers a Kendrick review, and the reply is labelled.
  const reply = liked.comments.find((c) => c.bot);
  assert.ok(reply, 'first posts get a reply');
  assert.equal(reply.userId, botId('bars_only'));
  assert.equal((await request(`/posts/${poll.id}`, { token: ayush.token })).data.post.poll.total, 1);
  assert.equal((await request(`/posts/${secret.id}`, { token: ayush.token })).data.post.reactionCount, 0, 'private posts are never touched');
  assert.equal((await request(`/posts/${hidden.id}`, { token: quiet.token })).data.post.reactionCount, 0, 'people who hide bots are left alone');

  // Idempotent: a second tick doesn't like or reply again.
  await bots.tick();
  const again = (await request(`/posts/${review.id}`, { token: ayush.token })).data.post;
  assert.equal(again.reactionCount, 1);
  assert.equal(again.comments.filter((c) => c.bot).length, 1);
  // Never more than two bot replies a day to one person.
  for (let i = 0; i < 4; i++) await request('/posts', { token: ayush.token, method: 'POST', body: { kind: 'take', title: `take ${i}`, items: [], visibility: 'public' } });
  await bots.tick(); await bots.tick();
  assert.ok((await db.get("SELECT COUNT(*) AS n FROM bot_actions WHERE kind='comment' AND recipient=?", ayush.user.id)).n <= 2);

  // New people get a follow from Riffs Radio — except those who hid bots.
  const followers = (await request('/people/ayush')).data.user.followers;
  assert.ok(followers >= 1);
  assert.equal((await request('/people/quiet')).data.user.followers, 0);
});

test('people who hide bots don’t see bot posts in their feed, and founder stats ignore bots', async (t) => {
  const { request, account, engine } = await fixture(t);
  const viewer = await account('viewer');
  await engine({ gapMs: 1 }).tick();
  assert.ok((await request('/feed?mode=you', { token: viewer.token })).data.posts.some((p) => p.authorBot));
  await request('/me/preferences', { token: viewer.token, method: 'PATCH', body: { bots: false } });
  assert.ok(!(await request('/feed?mode=you', { token: viewer.token })).data.posts.some((p) => p.authorBot));
  const stats = (await request('/admin/stats', { token: ADMIN })).data;
  assert.equal(stats.users, 1, 'only the real person counts');
  assert.equal(Object.values(stats.lastSevenDays.posts).reduce((a, b) => a + b, 0), 0);
});

test('a block from a real person stops bots from interacting with them', async (t) => {
  const { request, account, engine } = await fixture(t);
  const ayush = await account('ayush');
  for (const p of PERSONAS) await request(`/people/${p.handle}/block`, { token: ayush.token, method: 'PUT' });
  const post = (await request('/posts', { token: ayush.token, method: 'POST', body: { kind: 'take', title: 'leave me be', items: [], visibility: 'public' } })).data.post;
  await engine().tick();
  const fresh = (await request(`/posts/${post.id}`, { token: ayush.token })).data.post;
  assert.equal(fresh.reactionCount, 0);
  assert.equal(fresh.comments.length, 0);
});

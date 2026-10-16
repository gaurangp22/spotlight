import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { openDatabase } from '../db.mjs';
import { createApi } from '../api.mjs';
import { buildProfile, decay, feedWeights, HALF_LIFE_DAYS, because } from '../taste.mjs';

// Offline stand-ins for Deezer (related artists) and Apple (searches behind recommendations).
const calls = [];
async function fetcher(url) {
  calls.push(url);
  const reply = (body) => ({ ok: true, status: 200, json: async () => body });
  if (url.startsWith('https://api.deezer.com/search/artist')) {
    const q = new URL(url).searchParams.get('q');
    return reply({ data: q === 'metallica' ? [{ id: 119, name: 'Metallica' }] : [] });
  }
  if (url.startsWith('https://api.deezer.com/artist/119/related')) return reply({ data: [{ id: 1, name: 'Megadeth' }, { id: 2, name: 'Slayer' }] });
  if (url.startsWith('https://itunes.apple.com/search')) {
    const term = new URL(url).searchParams.get('term');
    const genre = /taylor|pop/.test(term) ? 'Pop' : 'Metal';
    return reply({ results: [1, 2, 3].map((n) => ({ trackId: 1000 + term.length * 10 + n, trackName: `${term} track ${n}`, artistName: term === 'metal' ? 'Gojira' : term, primaryGenreName: genre, releaseDate: `${n === 3 ? 1986 : 2019}-03-03T08:00:00Z` })) });
  }
  return reply({ data: [] });
}

async function fixture(t) {
  const db = await openDatabase({ url: '', file: ':memory:' }), server = createApi({ db, key: randomBytes(32), fetcher });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(async () => { await new Promise((r) => server.close(r)); db.close(); });
  const request = async (path, token, method = 'GET', body) => { const r = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, data: await r.json() }; };
  const account = async (handle) => { const r = await request('/auth/register', null, 'POST', { email: `${handle}@example.test`, handle, name: handle, password: 'good-password-123' }); assert.equal(r.status, 201, JSON.stringify(r.data)); return r.data; };
  return { db, request, account };
}
const pick = (id, artist, genre, kind = 'song') => ({ id, kind, title: `${artist} ${id}`, artist, ...(genre ? { genre } : {}) });
const day = 86400000;

test('taste profile weighs ratings by score, borrows genres for untagged picks, and pushes away dislikes', () => {
  const now = Date.now(), at = new Date(now).toISOString();
  const profile = buildProfile([
    { item: pick('a', 'Metallica', 'Metal'), weight: 1, at },
    { item: pick('b', 'Metallica', 'Metal'), weight: 0.9, at },
    { item: pick('c', 'Metallica'), weight: 0.8, at },
    { item: pick('d', 'Taylor Swift', 'Pop'), weight: -0.9, at },
    { item: pick('e', 'Metallica & Lou Reed', 'Rock'), weight: 0.2, at },
  ], now);
  assert.equal(profile.genres[0].name, 'metal');
  assert.equal(profile.genres[0].weight, 1);
  assert.equal(profile.families[0].name, 'rock');
  assert.equal(profile.artists[0].name, 'metallica', 'collaborations credit the lead artist');
  assert.ok(profile.artists.find((a) => a.name === 'taylor swift').weight < 0);
  assert.ok(profile.genres.find((g) => g.name === 'pop').weight < 0);
  const weights = feedWeights(profile);
  assert.equal(weights.genres.metal, 1);
  assert.ok(weights.genres['hard rock'] > 0 && weights.genres['hard rock'] < weights.genres.metal, 'a metal fan also leans toward the rest of rock');
  assert.equal(weights.genres['hip-hop/rap'], undefined);
});

test('signals decay with a half-life, so recent taste outweighs old taste', () => {
  const now = Date.now();
  assert.equal(decay(new Date(now).toISOString(), now), 1);
  assert.ok(Math.abs(decay(new Date(now - HALF_LIFE_DAYS * day).toISOString(), now) - 0.5) < 1e-9);
  assert.equal(decay(undefined, now), 1, 'undated signals like favourite artists never fade');
  const profile = buildProfile([
    { item: pick('old', 'Old Band', 'Jazz'), weight: 1, at: new Date(now - 2 * 365 * day).toISOString() },
    { item: pick('new', 'New Band', 'Metal'), weight: 0.5, at: new Date(now - day).toISOString() },
  ], now);
  assert.equal(profile.genres[0].name, 'metal');
  assert.equal(profile.artists[0].name, 'new band');
});

test('For You puts a metal fan’s genre and related artists ahead of newer pop, and pages stay stable', async (t) => {
  const { db, request, account } = await fixture(t);
  const fan = await account('metalfan'), popper = await account('popfan'), poster = await account('poster');
  for (const [i, id] of ['m1', 'm2', 'm3'].entries()) assert.equal((await request('/ratings', fan.token, 'POST', { item: pick(id, 'Metallica', 'Metal'), tier: 2, position: i, visibility: 'private' })).status, 201);
  for (const id of ['p1', 'p2']) await request('/ratings', popper.token, 'POST', { item: pick(id, 'Taylor Swift', 'Pop'), tier: 2, visibility: 'private' });
  const post = async (title, item, minutesAgo) => {
    const at = new Date(Date.now() - minutesAgo * 60000).toISOString();
    await db.run('INSERT INTO posts (id,user_id,kind,title,subtitle,items,tiles,theme,visibility,origin_id,created_at,updated_at,meta) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      randomUUID(), poster.user.id, 'take', title, '', JSON.stringify([item]), '[]', 'night', 'public', null, at, at, '{}');
  };
  await post('Iron Maiden rules', pick('im', 'Iron Maiden', 'Heavy Metal'), 600);
  await post('Gojira deep cut', pick('gj', 'Gojira', 'Metal'), 500);
  await post('Slayer forever', pick('sl', 'Slayer'), 400);
  await post('New pop single', pick('ts', 'Taylor Swift', 'Pop'), 1);
  for (let i = 0; i < 40; i++) await post(`Filler ${i}`, pick(`f${i}`, `Band ${i}`, 'Jazz'), 2000 + i);

  const order = (posts) => posts.map((p) => p.title);
  const first = await request('/feed?mode=you', fan.token);
  assert.equal(first.data.personalized, true);
  const titles = order(first.data.posts);
  for (const metal of ['Iron Maiden rules', 'Gojira deep cut', 'Slayer forever']) assert.ok(titles.indexOf(metal) < titles.indexOf('New pop single'), `${metal} before pop: ${titles.join(' | ')}`);
  assert.equal(titles[0], 'Gojira deep cut', 'an exact genre match beats a family match');
  assert.ok(calls.some((url) => url.includes('/artist/119/related')), 'related artists come from Deezer');

  const pop = order((await request('/feed?mode=you', popper.token)).data.posts);
  assert.equal(pop[0], 'New pop single');

  const second = await request(`/feed?mode=you&cursor=${encodeURIComponent(first.data.nextCursor)}`, fan.token);
  const all = [...first.data.posts, ...second.data.posts].map((p) => p.id);
  assert.equal(new Set(all).size, all.length, 'no post repeats across pages');
  assert.equal(all.length, (await db.get("SELECT COUNT(*) AS n FROM posts WHERE visibility<>'private'")).n, 'every visible post appears once');
});

test('recommendations fall back for signed-out and new listeners and follow a fan’s taste', async (t) => {
  const { request, account } = await fixture(t);
  assert.deepEqual((await request('/recommendations?kind=song')).data, { items: [], personalized: false, basis: [] });
  const fan = await account('newcomer');
  assert.equal((await request('/recommendations?kind=song', fan.token)).data.personalized, false);
  await request('/ratings', fan.token, 'POST', { item: pick('song-1091', 'Metallica', 'Metal'), tier: 2, visibility: 'private' });
  const picks = (await request('/recommendations?kind=song', fan.token)).data;
  assert.equal(picks.personalized, true);
  assert.ok(picks.items.length >= 3);
  assert.ok(picks.items.some((item) => item.id === 'song-1092'), 'the rated song’s neighbours from the same search still show');
  assert.ok(picks.items.every((item) => item.genre === 'Metal'));
  assert.ok(picks.items.some((item) => item.artist === 'megadeth'), 'related artists are searched too');
  assert.ok(picks.basis.includes('metal'));
  assert.ok(!picks.items.some((item) => item.id === 'song-1091'), 'already-rated picks are left out');
});

test('opens and likes count toward genre taste, and validated picks keep their genre', async (t) => {
  const { db, request, account } = await fixture(t);
  const fan = await account('lurker'), poster = await account('jazzcat');
  const made = await request('/posts', poster.token, 'POST', { kind: 'take', title: 'Kind of Blue holds up', visibility: 'public', items: [pick('kob', 'Miles Davis', 'Jazz')] });
  assert.equal(made.status, 201);
  assert.equal(made.data.post.items[0].genre, 'Jazz');
  assert.equal((await request('/posts', poster.token, 'POST', { kind: 'take', title: 'Too long', visibility: 'public', items: [pick('x', 'Y', 'g'.repeat(61))] })).status, 400);
  const id = made.data.post.id;
  assert.equal((await request(`/posts/${id}/open`, null, 'POST')).status, 401);
  assert.equal((await request(`/posts/${id}/open`, fan.token, 'POST')).status, 200);
  assert.equal((await db.get("SELECT kind FROM post_engagements WHERE user_id=?", fan.user.id)).kind, 'open');
  assert.equal((await request('/recommendations?kind=song', fan.token)).data.basis[0], 'jazz');
  await request(`/posts/${id}/reaction`, fan.token, 'PUT');
  assert.equal((await db.get("SELECT COUNT(*) AS n FROM post_engagements WHERE user_id=? AND kind='like'", fan.user.id)).n, 1);
  await request(`/posts/${id}/reaction`, fan.token, 'DELETE');
  assert.equal((await db.get("SELECT COUNT(*) AS n FROM post_engagements WHERE user_id=? AND kind='like'", fan.user.id)).n, 0);
});

test('profiles track the exact songs someone returns to, their eras, regions, and why each artist matters', () => {
  const now = Date.now(), at = new Date(now).toISOString();
  const song = { ...pick('song-7', 'Arijit Singh', 'Bollywood'), title: 'Tum Hi Ho', year: '2013' };
  const profile = buildProfile([
    ...[1, 2, 3, 4].map(() => ({ item: song, weight: 0.3, at, via: 'logged' })),
    { item: { ...pick('song-8', 'Metallica', 'Metal'), year: '1986' }, weight: 0.4, at, via: 'shared' },
    { item: { id: 'artist-dz119', kind: 'artist', title: 'Metallica', artist: 'Artist' }, weight: 1, via: 'favourite' },
  ], now);
  assert.equal(profile.items[0].name, 'song-7');
  assert.equal(profile.items[0].count, 4, 'repeat diary entries are counted');
  assert.equal(profile.items[0].item.title, 'Tum Hi Ho');
  assert.equal(profile.decades[0].name, '2010s');
  assert.deepEqual(profile.regions, ['IN'], 'Bollywood listening points searches at the Indian storefront');
  const metallica = profile.artists.find((a) => a.name === 'metallica');
  assert.equal(metallica.label, 'Metallica');
  assert.equal(because(metallica.via, metallica.label), 'Because you love Metallica');
  assert.equal(profile.deezerIds.metallica, '119');
  const weights = feedWeights(profile);
  assert.ok(weights.items['song-7'] > 0 && weights.decades['2010s'] > 0);
});

test('recommendations explain themselves and draw on diary repeats, shares, and taste twins', async (t) => {
  const { db, request, account } = await fixture(t);
  const fan = await account('repeater'), twin = await account('twinsie'), sharer = await account('sharer');
  const loved = [pick('song-1', 'Metallica', 'Metal'), pick('song-2', 'Megadeth', 'Metal'), pick('song-3', 'Slayer', 'Metal')].map((item) => ({ ...item, year: '1986' }));
  for (const user of [fan, twin]) for (const [i, item] of loved.entries()) await request('/ratings', user.token, 'POST', { item, tier: 2, position: i, visibility: 'public' });
  await request('/ratings', twin.token, 'POST', { item: pick('song-4', 'Anthrax', 'Metal'), tier: 2, position: 0, visibility: 'public' });
  await request('/ratings', twin.token, 'POST', { item: pick('song-5', 'Secret Band', 'Metal'), tier: 2, position: 0, visibility: 'private' });
  const play = pick('song-6', 'Metallica', 'Metal');
  for (const day of [1, 2, 3]) await db.run('INSERT INTO listening_history VALUES (?,?,?,?)', fan.user.id, play.id, new Date(Date.now() - day * 3600000).toISOString(), JSON.stringify({ ...play, title: 'Fade to Black', album: 'Ride the Lightning' }));

  const picks = (await request('/recommendations?kind=song', fan.token)).data;
  const reasons = new Map(picks.items.map((i) => [i.id, i.reason]));
  assert.equal(reasons.get('song-4'), 'Loved by @twinsie, your taste twin', JSON.stringify(picks.items.map((i) => [i.id, i.reason])));
  assert.ok(!reasons.has('song-5'), 'a twin’s private ratings never surface');
  assert.ok(picks.items.some((i) => i.reason === 'Because you rated Metallica'));
  assert.ok(picks.items.some((i) => i.reason === 'Because you keep coming back to Fade to Black'));
  assert.ok(picks.items.some((i) => i.reason === 'More Metal'));
  const metallica = picks.items.filter((i) => i.reason === 'Because you rated Metallica');
  assert.equal(metallica[0].year, '1986', 'favourite decades float to the top of each list');

  // The feed also lifts a stranger's post about the twin's favourite.
  const stranger = await account('stranger');
  await request('/posts', stranger.token, 'POST', { kind: 'take', title: 'Anthrax take', visibility: 'public', items: [pick('song-4', 'Anthrax')] });
  await request('/posts', stranger.token, 'POST', { kind: 'take', title: 'Unrelated take', visibility: 'public', items: [pick('song-99', 'Nobody Known')] });
  const feed = (await request('/feed?mode=you', fan.token)).data.posts.map((p) => p.title);
  assert.ok(feed.indexOf('Anthrax take') < feed.indexOf('Unrelated take'), feed.join(' | '));

  // Someone whose only signal is a song shared in a message still gets explained picks.
  const chat = await request('/conversations', sharer.token, 'POST', { handles: ['@repeater'] });
  await request(`/conversations/${chat.data.conversation.id}/messages`, sharer.token, 'POST', { item: { ...pick('song-9', 'Taylor Swift', 'Pop'), title: 'Cruel Summer' }, clientId: 'share-once-123' });
  const shared = (await request('/recommendations?kind=song', sharer.token)).data;
  assert.equal(shared.personalized, true);
  assert.ok(shared.items.some((i) => i.reason === 'Because you shared Taylor Swift'));
});

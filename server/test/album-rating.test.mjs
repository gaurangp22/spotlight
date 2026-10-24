import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { openDatabase } from '../db.mjs';
import { createApi } from '../api.mjs';
import { catalogService } from '../catalog.mjs';

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
  const r = await request('/auth/register', { method: 'POST', body: { email: 'alice@example.com', name: 'alice', handle: 'alice', password: 'a-long-password-123' } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return { request, token: r.data.token };
}
const ok = (data) => ({ ok: true, status: 200, json: async () => data });
const album = { id: 'album-7', kind: 'album', title: 'Long Album', artist: 'Band', artwork: 'https://example.com/a.jpg' };
const track = (n, score) => ({ id: `song-${n}`, kind: 'song', title: `Track ${n}`, artist: 'Band', album: 'Long Album', ...(score !== undefined ? { score } : {}) });

test('album tracks: Apple lookups come back in disc and track order', async () => {
  const catalog = catalogService(async (url) => {
    assert.match(url, /itunes\.apple\.com\/lookup\?id=7&entity=song/);
    return ok({ results: [
      { wrapperType: 'collection', collectionName: 'Long Album', artistName: 'Band', artworkUrl100: 'https://is1-ssl.mzstatic.com/x/100x100bb.jpg', releaseDate: '2016-08-20T07:00:00Z' },
      { wrapperType: 'track', trackId: 3, trackName: 'Disc two opener', discNumber: 2, trackNumber: 1 },
      { wrapperType: 'track', trackId: 2, trackName: 'Second', discNumber: 1, trackNumber: 2 },
      { wrapperType: 'track', trackId: 1, trackName: 'First', discNumber: 1, trackNumber: 1, previewUrl: 'https://audio-ssl.itunes.apple.com/p.m4a' },
    ] });
  });
  const { album: a, items } = await catalog.albumTracks('album-7');
  assert.equal(a.title, 'Long Album');
  assert.equal(a.year, '2016');
  assert.deepEqual(items.map((i) => i.id), ['song-1', 'song-2', 'song-3']);
  assert.equal(items[0].album, 'Long Album');
  assert.equal(items[0].artwork, 'https://is1-ssl.mzstatic.com/x/600x600bb.jpg');
  await assert.rejects(catalog.albumTracks('song-7'), /Choose an album/);
});

test('album tracks: Deezer pages through long albums', async () => {
  const catalog = catalogService(async (url) => {
    if (url.endsWith('/album/9')) return ok({ id: 9, title: 'Box Set', artist: { name: 'Band' }, cover_xl: 'https://cdn.deezer.com/c.jpg' });
    const index = Number(new URL(url).searchParams.get('index'));
    return ok({ data: Array.from({ length: index ? 50 : 100 }, (_, i) => ({ id: index + i + 1, title: `T${index + i + 1}`, artist: { name: 'Band' } })), ...(index ? {} : { next: 'more' }) });
  });
  const { album: a, items } = await catalog.albumTracks('deezer-album-9');
  assert.equal(a.id, 'deezer-album-9');
  assert.equal(items.length, 150);
  assert.equal(items[149].id, 'deezer-song-150');
});

test('album ratings: more than 100 scored tracks post as a ranking that keeps the album and scores', async (t) => {
  const { request, token } = await fixture(t);
  const items = Array.from({ length: 140 }, (_, i) => track(i + 1, 10 - (i % 10)));
  const posted = await request('/posts', { token, method: 'POST', body: { kind: 'ranking', title: 'Long Album, track by track', subtitle: '', album, items, visibility: 'public' } });
  assert.equal(posted.status, 201, JSON.stringify(posted.data));
  assert.equal(posted.data.post.album.id, 'album-7');
  assert.equal(posted.data.post.items.length, 140);
  assert.equal(posted.data.post.items[0].score, 10);

  // Plain rankings keep their 100-pick limit and never carry scores.
  const plain = await request('/posts', { token, method: 'POST', body: { kind: 'ranking', title: 'Too long', items, visibility: 'public' } });
  assert.equal(plain.status, 400);
  const unscored = await request('/posts', { token, method: 'POST', body: { kind: 'ranking', title: 'Short', items: items.slice(0, 3), visibility: 'public' } });
  assert.equal(unscored.data.post.items[0].score, undefined);
  assert.equal(unscored.data.post.album, undefined);

  const bad = await request('/posts', { token, method: 'POST', body: { kind: 'ranking', title: 'Bad', album, items: [track(1, 11), track(2, 5)], visibility: 'public' } });
  assert.equal(bad.status, 400);
  const notAlbum = await request('/posts', { token, method: 'POST', body: { kind: 'ranking', title: 'Bad', album: track(9), items: [track(1, 1), track(2, 5)], visibility: 'public' } });
  assert.equal(notAlbum.status, 400);
});

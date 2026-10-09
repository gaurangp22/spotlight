import { createServer } from 'node:http';
import { randomUUID, randomBytes } from 'node:crypto';
import { isIP } from 'node:net';
import { digest, randomToken, hashPassword, verifyPassword, fail, text, password } from './security.mjs';
import { spotifyService } from './spotify.mjs';
import { expansionRoutes } from './expansion.mjs';
import { pushService } from './push.mjs';
import { playlistLink, playlistSource } from './playlist.mjs';
import { pages } from './pages.mjs';
import { catalogService } from './catalog.mjs';
import { emailOtpService } from './email-otp.mjs';
import { communityRoutes } from './community.mjs';
import { betaRoutes } from './beta.mjs';

const now = () => new Date().toISOString();
const MAX_BODY = 14 * 1024 * 1024;
const SESSION_LIFETIME = 30 * 24 * 60 * 60 * 1000;
const PUBLIC_USER = 'id, handle, name, bio, status, avatar, favorite_artists, onboarding_complete, created_at, is_bot';
const INSERT_POST = 'INSERT INTO posts (id, user_id, kind, title, subtitle, items, tiles, theme, visibility, origin_id, created_at, updated_at, meta) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)';
const anonymousId = '';
export const CATEGORIES = ['song', 'album', 'artist', 'movie', 'show', 'podcast', 'book'];
// Each gut reaction owns a band of the 0–10 scale; position inside the band sets the exact score.
const TIER_RANGE = { 2: [6.8, 10], 1: [3.4, 6.7], 0: [0, 3.3] };
export function tierScores(tier, count) {
  const [lo, hi] = TIER_RANGE[tier];
  return Array.from({ length: count }, (_, i) => Math.round((lo + (hi - lo) * (count - i) / count) * 10) / 10);
}
const ITEM_ID = /^[A-Za-z0-9_.:-]{1,150}$/;

function profile(row) { return { id: row.id, handle: `@${row.handle}`, name: row.name, ...(row.is_bot ? { bot: true } : {}), bio: row.bio, status: row.status || '', avatar: row.avatar || undefined, favoriteArtists: JSON.parse(row.favorite_artists || '[]'), onboardingComplete: !!row.onboarding_complete, emailVerified: !!row.email_verified, followers: row.followers || 0, following: row.following || 0 }; }
function avatarData(value) {
  if (value === '') return '';
  if (typeof value !== 'string' || value.length > 240000 || !/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(value)) fail(400, 'Choose a JPEG or PNG profile photo under 180 KB.');
  const bytes = Buffer.from(value.split(',')[1], 'base64');
  const valid = value.startsWith('data:image/jpeg') ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (!valid) fail(400, 'This profile photo is not a valid image.');
  return value;
}
// 30-second previews come from Apple's catalog; nothing else may be embedded as playable audio.
const PREVIEW_HOSTS = /(^|\.)(apple\.com|mzstatic\.com)$/;
function previewUrl(value) {
  if (typeof value !== 'string' || value.length > 2000) fail(400, 'Invalid preview link.');
  let url;
  try { url = new URL(value); } catch { fail(400, 'Invalid preview link.'); }
  if (url.protocol !== 'https:') fail(400, 'Preview links must use HTTPS.');
  if (!PREVIEW_HOSTS.test(url.hostname)) fail(400, 'Previews can only come from Apple Music.');
  return value;
}

const CREDIT_SPLIT = /,|&| x |\bfeat\.?|\bft\.|\bwith\b/i;
/** First credited artist ("Kendrick Lamar & SZA" -> "Kendrick Lamar"). */
const leadArtist = (name) => String(name || '').split(CREDIT_SPLIT)[0].trim();
/**
 * How alike two people's taste is, from their ratings: agreement on the things both rated, weighted by
 * how much of the smaller collection overlaps, plus how many artists they share. 0-100, or null when
 * either side has rated fewer than three things.
 */
export function tasteMatch(mine, theirs) {
  const parse = (r) => ({ id: r.item_id, score: r.score, item: typeof r.item === 'string' ? JSON.parse(r.item) : r.item });
  const a = mine.map(parse), b = theirs.map(parse);
  const byId = new Map(b.map((r) => [r.id, r]));
  const shared = a.filter((r) => byId.has(r.id)).map((r) => ({ item: r.item, mine: r.score, theirs: byId.get(r.id).score }));
  const artists = (list) => {
    const found = new Map();
    for (const { item } of list) {
      const name = leadArtist(item.kind === 'artist' ? item.title : item.artist);
      if (!name) continue;
      const key = name.toLowerCase();
      const entry = found.get(key) || { name, count: 0 };
      entry.count++;
      // An artist's own photo beats an album cover for the chip.
      if (item.artwork && (item.kind === 'artist' || !entry.artwork)) entry.artwork = item.artwork;
      found.set(key, entry);
    }
    return found;
  };
  const ours = artists(a), yours = artists(b);
  const common = [...ours.keys()].filter((k) => yours.has(k));
  const union = new Set([...ours.keys(), ...yours.keys()]).size;
  const sharedArtists = common
    .map((k) => ({ name: ours.get(k).name, artwork: ours.get(k).artwork || yours.get(k).artwork, weight: ours.get(k).count + yours.get(k).count }))
    .sort((x, y) => y.weight - x.weight).slice(0, 8).map(({ name, artwork }) => ({ name, ...(artwork ? { artwork } : {}) }));
  const closest = shared.sort((x, y) => Math.abs(x.mine - x.theirs) - Math.abs(y.mine - y.theirs)).slice(0, 12);
  if (a.length < 3 || b.length < 3) return { percent: null, shared: closest, sharedArtists };
  const agreement = shared.length ? shared.reduce((sum, r) => sum + 1 - Math.abs(r.mine - r.theirs) / 10, 0) / shared.length : 0;
  const coverage = shared.length / Math.min(a.length, b.length);
  const artistOverlap = union ? common.length / union : 0;
  const percent = Math.round(100 * Math.min(1, 0.6 * agreement * Math.sqrt(coverage) + 0.4 * Math.sqrt(artistOverlap)));
  return { percent, shared: closest, sharedArtists };
}
function safeUrl(value) {
  if (!value) return undefined;
  if (typeof value !== 'string' || value.length > 2000) fail(400, 'Invalid artwork link.');
  try { if (new URL(value).protocol !== 'https:') fail(400, 'Artwork links must use HTTPS.'); } catch { fail(400, 'Invalid artwork link.'); }
  return value;
}
export function validateItem(i, { allowAddedBy = false } = {}) {
  if (!i || typeof i !== 'object' || Array.isArray(i)) fail(400, 'Invalid pick.');
  const id = text(i.id, 'Item ID', 1, 150);
  if (!ITEM_ID.test(id)) fail(400, 'Invalid item ID.');
  if (!CATEGORIES.includes(i.kind)) fail(400, 'Invalid category.');
  return { id, kind: i.kind, title: text(i.title, 'Title', 1, 300), artist: text(i.artist, 'Artist', 1, 300),
    ...(i.album ? { album: text(i.album, 'Album', 1, 300) } : {}),
    ...(i.artwork ? { artwork: safeUrl(i.artwork) } : {}),
    ...(i.externalUrl ? { externalUrl: safeUrl(i.externalUrl) } : {}),
    ...(i.spotifyId ? { spotifyId: text(i.spotifyId, 'Spotify ID', 1, 50) } : {}),
    ...(i.previewUrl ? { previewUrl: previewUrl(i.previewUrl) } : {}),
    ...(allowAddedBy && typeof i.addedBy === 'string' && /^@[a-z0-9_]{3,24}$/.test(i.addedBy) ? { addedBy: i.addedBy } : {}),
  };
}
export function validatePost(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'Send a valid post.');
  if (body.kind !== undefined && !['ranking', 'moodboard', 'pod', 'take'].includes(body.kind)) fail(400, 'Choose a valid post type.');
  const kind = ['moodboard', 'pod', 'take'].includes(body.kind) ? body.kind : 'ranking';
  if (!['public', 'followers', 'private'].includes(body.visibility)) fail(400, 'Choose a valid visibility.');
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length > 100 || (kind === 'ranking' && items.length < 2)) fail(400, 'Rank between 2 and 100 picks.');
  // A take is a short opinion with at most one attached pick, or a this-or-that poll between exactly two.
  const poll = kind === 'take' && body.poll === true;
  if (poll && items.length !== 2) fail(400, 'A poll needs exactly two picks.');
  if (kind === 'take' && !poll && items.length > 1) fail(400, 'Attach one pick to a take, or make it a poll.');
  const seen = new Set();
  const clean = items.map((i) => {
    const item = validateItem(i, { allowAddedBy: kind === 'pod' });
    if (seen.has(item.id)) fail(400, 'A pick can only appear once.');
    seen.add(item.id);
    return item;
  });
  const tiles = kind === 'moodboard' && Array.isArray(body.tiles) ? body.tiles : [];
  if (tiles.length > 12 || (kind === 'moodboard' && !tiles.length && !clean.length)) fail(400, 'Add music, a photo, or a note to your mood board.');
  const cleanTiles = tiles.map((t) => {
    if (!t || typeof t !== 'object' || Array.isArray(t)) fail(400, 'Invalid mood board tile.');
    const id = text(t.id, 'Tile ID', 1, 100);
    if (seen.has(id)) fail(400, 'Each tile must have a unique ID.');
    seen.add(id);
    if (t.type === 'note') return { id, type: 'note', text: text(t.text, 'Note', 1, 500) };
    if (t.type === 'photo') {
      if (typeof t.uri !== 'string' || t.uri.length > 1100000 || !/^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(t.uri)) fail(400, 'Choose a smaller photo (under 800 KB).');
      return { id, type: 'photo', uri: t.uri, text: text(t.text || '', 'Caption', 0, 500) };
    }
    fail(400, 'Invalid mood board tile.');
  });
  return { kind, title: kind === 'take' ? text(body.title, 'Take', 1, 280) : text(body.title, 'Title', 1, 100), subtitle: text(body.subtitle || '', 'Description', 0, 500), items: clean, tiles: cleanTiles,
    theme: ['night', 'paper', 'rose', 'forest'].includes(body.theme) ? body.theme : 'night', visibility: body.visibility,
    originId: typeof body.originId === 'string' ? body.originId.slice(0, 150) : null,
    meta: kind === 'pod' ? { open: body.open === true, ...(body.sourceUrl ? { sourceUrl: playlistSource(body.sourceUrl) } : {}) } : poll ? { poll: true } : {},
  };
}

export function createApi({ db, key = randomBytes(32), fetcher = fetch } = {}) {
  const spotify = spotifyService(db, key, fetcher);
  const catalog = catalogService(fetcher);
  const emailOtp = emailOtpService(db, key, fetcher);
  const rates = new Map();
  // Expiring, bounded buckets do not retain a history of client IPs.
  const rateCleanup = setInterval(() => { for (const [id, entry] of rates) if (entry.until < Date.now()) rates.delete(id); }, 60000).unref();
  function rate(id, limit, windowMs) {
    const current = rates.get(id);
    if (!current || current.until < Date.now()) { rates.set(id, { count: 1, until: Date.now() + windowMs }); return; }
    if (++current.count > limit) fail(429, 'Too many attempts. Please try again later.');
  }
  const production = process.env.NODE_ENV === 'production';
  const origins = (process.env.ALLOWED_ORIGINS || 'http://localhost:8081,http://127.0.0.1:8081').split(',');
  const webApp = (process.env.WEB_APP_URL || 'http://localhost:8081').replace(/\/$/, '');
  const blockedSQL = `NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.user_id = ? AND b.blocked_id = p.user_id) OR (b.blocked_id = ? AND b.user_id = p.user_id))`;
  const visibleSQL = `(p.user_id = ? OR p.visibility = 'public' OR (p.visibility = 'followers' AND EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = ? AND f.followed_id = p.user_id))) AND ${blockedSQL}`;
  const viewerArgs = (id) => [id || anonymousId, id || anonymousId, id || anonymousId, id || anonymousId];

  async function userFor(req) {
    const token = req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
    if (!token) return null;
    return await db.get(`SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?`, digest(token), Date.now()) || null;
  }
  function requireUser(user) { if (!user) fail(401, 'Sign in to continue.'); return user; }
  async function session(user) {
    const token = randomToken();
    await db.run('DELETE FROM sessions WHERE expires_at < ?', Date.now());
    await db.run('INSERT INTO sessions VALUES (?, ?, ?)', digest(token), user.id, Date.now() + SESSION_LIFETIME);
    return { token, user: profile(user) };
  }
  async function getPost(id, viewer) {
    const p = await db.get(`SELECT p.*, u.handle, u.name, u.avatar FROM posts p JOIN users u ON u.id=p.user_id WHERE p.id=? AND ${visibleSQL}`, id, ...viewerArgs(viewer));
    if (!p) fail(404, 'This post is unavailable or private.');
    return p;
  }
  // House bots are labelled everywhere they appear; their ids rarely change, so they're cached briefly.
  let botCache = { ids: new Set(), until: 0 };
  async function botIds() {
    if (botCache.until < Date.now()) botCache = { ids: new Set((await db.all('SELECT id FROM users WHERE is_bot=1')).map((r) => r.id)), until: Date.now() + 30000 };
    return botCache.ids;
  }
  async function postJSON(p, viewer) {
    const bots = await botIds();
    const [comments, reaction] = await Promise.all([
      db.all(`SELECT c.*, u.name, u.handle, u.avatar FROM comments c JOIN users u ON u.id=c.user_id WHERE c.post_id=? AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.blocked_id=c.user_id) OR (b.blocked_id=? AND b.user_id=c.user_id)) ORDER BY c.created_at LIMIT 200`, p.id, viewer || '', viewer || ''),
      db.get('SELECT COUNT(*) AS count, MAX(CASE WHEN user_id=? THEN 1 ELSE 0 END) AS reacted FROM reactions WHERE post_id=?', viewer || '', p.id),
    ]);
    const meta = JSON.parse(p.meta || '{}');
    const rating = p.kind === 'review' ? await db.get('SELECT score, tier FROM ratings WHERE post_id=?', p.id) : null;
    let poll;
    if (p.kind === 'take' && meta.poll) {
      const rows = await db.all('SELECT choice, COUNT(*) AS n, MAX(CASE WHEN user_id=? THEN 1 ELSE 0 END) AS mine FROM poll_votes WHERE post_id=? GROUP BY choice', viewer || '', p.id);
      const counts = [0, 1].map((c) => rows.find((r) => r.choice === c)?.n || 0);
      const mine = rows.find((r) => r.mine)?.choice ?? null;
      // Results stay hidden until you vote so the tally can't sway you; the author always sees them.
      poll = { total: counts[0] + counts[1], mine, counts: mine !== null || (!!viewer && p.user_id === viewer) ? counts : null };
    }
    return { id: p.id, userId: p.user_id, kind: p.kind, title: p.title, subtitle: p.subtitle,
      ...(rating ? { score: rating.score, tier: rating.tier } : {}), ...(p.kind === 'pod' ? { open: !!meta.open } : {}), ...(poll ? { poll } : {}),
      author: p.name, handle: `@${p.handle}`, ...(bots.has(p.user_id) ? { authorBot: true } : {}), avatar: p.avatar || undefined, clubId: meta.clubId, items: JSON.parse(p.items), tiles: JSON.parse(p.tiles), theme: p.theme,
      sourceUrl: meta.sourceUrl,
      createdAt: p.created_at, updatedAt: p.updated_at, visibility: p.visibility,
      reactionCount: reaction.count, reacted: !!reaction.reacted,
      comments: comments.map((c) => ({ id: c.id, userId: c.user_id, author: c.name, ...(bots.has(c.user_id) ? { bot: true } : {}), handle: `@${c.handle}`, avatar: c.avatar || undefined, text: c.text, itemId: c.item_id || undefined, parentId: c.parent_id || undefined, createdAt: c.created_at })),
      originId: p.origin_id || undefined,
    };
  }
  /** Rewrites tier, position, and score for a user's ratings in one category, in the given order. */
  function reorder(userId, tiers) {
    const statements = [];
    for (const tier of [2, 1, 0]) {
      const scores = tierScores(tier, tiers[tier].length);
      tiers[tier].forEach((itemId, position) => statements.push({ sql: 'UPDATE ratings SET tier=?, position=?, score=? WHERE user_id=? AND item_id=?', args: [tier, position, scores[position], userId, itemId] }));
    }
    return statements;
  }
  async function tiersFor(userId, category, exclude) {
    const rows = await db.all('SELECT item_id, tier FROM ratings WHERE user_id=? AND category=? ORDER BY tier DESC, position', userId, category);
    const tiers = { 0: [], 1: [], 2: [] };
    for (const row of rows) if (row.item_id !== exclude) tiers[row.tier].push(row.item_id);
    return tiers;
  }
  function ratingJSON(r) {
    return { item: JSON.parse(r.item), category: r.category, tier: r.tier, position: r.position, score: r.score, postId: r.post_id,
      review: r.subtitle ?? '', visibility: r.visibility, createdAt: r.created_at, updatedAt: r.updated_at };
  }
  async function notify(target, actor, kind, postId = null) {
    if (target === actor) return;
    if (await db.get('SELECT 1 FROM blocks WHERE (user_id=? AND blocked_id=?) OR (user_id=? AND blocked_id=?)', target, actor, actor, target)) return;
    await db.run('INSERT INTO notifications VALUES (?, ?, ?, ?, ?, 0, ?)', randomUUID(), target, actor, postId, kind, now());
    await push.enqueue(target, actor, kind, postId);
  }
  async function people(viewer, query = '') {
    return (await db.all(`SELECT ${PUBLIC_USER} FROM users u WHERE (handle LIKE ? OR name LIKE ?) AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.blocked_id=u.id) OR (b.blocked_id=? AND b.user_id=u.id)) ORDER BY created_at DESC LIMIT 100`, `%${query}%`, `%${query}%`, viewer || '', viewer || '')).map(profile);
  }
  async function readBody(req) {
    let bytes = 0; const chunks = [];
    for await (const chunk of req) { bytes += chunk.length; if (bytes > MAX_BODY) fail(413, 'This upload is too large. Choose smaller photos.'); chunks.push(chunk); }
    try {
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
      if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'Send a JSON object.');
      return body;
    } catch { fail(400, 'Invalid JSON object.'); }
  }
  const community = communityRoutes({ db, profile, validateItem, getPost, postJSON, visibleSQL, viewerArgs, notify });
  const push = pushService({ db, fetcher, getPost });
  const expansion = expansionRoutes({ db, key, profile, validateItem, getPost, postJSON, visibleSQL, viewerArgs, emailOtp, push });
  const beta = betaRoutes({ db, profile, notify, webApp });
  const server = createServer(async (req, res) => {
    const requestId = randomUUID();
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const send = (data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
    try {
      const origin = req.headers.origin;
      if (origin) {
        // In development, phones on the same Wi-Fi can open the web app by the laptop's LAN address.
        const lan = !production && /^http:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(origin);
        if (!origins.includes(origin) && !lan) fail(403, 'This web origin is not allowed.');
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      }
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
      const url = new URL(req.url, 'http://api.local');
      const path = url.pathname.replace(/\/$/, '');
      const method = req.method;
      let peer = req.socket.remoteAddress || 'unknown';
      const proxies = (process.env.TRUSTED_PROXY_IPS || '').split(',');
      // '*' is for platforms (Render, Railway, Fly) where every request arrives through the platform's own proxy.
      if (proxies.includes('*') || proxies.includes(peer)) {
        const forwarded = String(req.headers['x-forwarded-for'] || '').split(',').at(-1)?.trim();
        if (forwarded && isIP(forwarded)) peer = forwarded;
      }
      rate(`requests:${peer}`, production ? 1200 : 10000, 60000);
      const join = method === 'GET' && path.match(/^\/join\/([a-z0-9_]{3,24})$/i);
      const shared = method === 'GET' && path.match(/^\/p\/([a-zA-Z0-9-]{1,64})$/);
      if (join || shared) {
        // Public HTML: covers come from HTTPS catalog hosts; nothing else loads.
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src https:; frame-ancestors 'none'" });
        res.end(join ? await beta.landing(join[1].toLowerCase()) : await beta.postLanding(shared[1])); return;
      }
      if (method === 'GET' && Object.hasOwn(pages, path)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'" });
        res.end(pages[path]); return;
      }
      if (path === '/api/health') { await db.get('SELECT 1'); return send({ ok: true, database: db.mode }); }
      if (path === '/api/config') return send({ spotify: spotify.configured, spotifyCatalog: spotify.catalog, catalog: catalog.kinds, passwordRecovery: !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM), emailOtp: emailOtp.configured(), signupVerification: emailOtp.configured(), push: push.configured() });
      if (path === '/api/spotify/callback' && method === 'GET') {
        const returnUrl = await spotify.callback(url.searchParams);
        res.writeHead(302, { Location: returnUrl }); res.end(); return;
      }
      const user = await userFor(req);
      await beta.seen(user);
      const body = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) ? await readBody(req) : {};
      if (path === '/api/catalog/playlist-link' && method === 'POST') { requireUser(user); rate(`playlist-link:${user.id}`, 20, 60000); const imported = await playlistLink(body.url, fetcher); return send({ ...imported, items: imported.items.map((item) => validateItem(item)) }); }
      if (await expansion({ path, method, body, user, url, send, rate, req })) return;
      if (await community({ path, method, body, user, url, send, rate })) return;
      if (await beta.routes({ path, method, body, user, url, send, rate, peer })) return;
      if (path.startsWith('/api/admin/')) {
        const expected = process.env.ADMIN_TOKEN;
        const supplied = req.headers.authorization?.replace(/^Bearer /, '') || '';
        if (!expected || expected.length < 32 || digest(supplied) !== digest(expected)) fail(403, 'Administrative access denied.');
        if (await beta.admin({ path, method, send })) return;
        if (path === '/api/admin/message-reports' && method === 'GET') return send({ reports: await db.all('SELECT r.*,m.text,m.conversation_id,u.handle AS reporter FROM message_reports r JOIN messages m ON m.id=r.message_id JOIN users u ON u.id=r.user_id WHERE r.resolved=0 ORDER BY r.created_at LIMIT 200') });
        const messageReport = path.match(/^\/api\/admin\/message-reports\/([a-zA-Z0-9-]+)$/);
        if (messageReport && method === 'PATCH') {
          const row = await db.get('SELECT message_id FROM message_reports WHERE id=?', messageReport[1]);
          if (!row) fail(404, 'Report unavailable.');
          await db.batch([...(body.removeMessage === true ? [{ sql: "UPDATE messages SET deleted=1,text='',item=NULL,post_id=NULL WHERE id=?", args: [row.message_id] }] : []), { sql: 'UPDATE message_reports SET resolved=1 WHERE id=?', args: [messageReport[1]] }]);
          return send({ ok: true });
        }
        if (path === '/api/admin/reports' && method === 'GET') return send({ reports: await db.all('SELECT r.*, p.title, u.handle AS reporter FROM reports r JOIN posts p ON p.id=r.post_id JOIN users u ON u.id=r.user_id WHERE r.resolved=0 ORDER BY r.created_at LIMIT 200') });
        const report = path.match(/^\/api\/admin\/reports\/([a-zA-Z0-9-]+)$/);
        if (report && method === 'PATCH') {
          const row = await db.get('SELECT * FROM reports WHERE id=?', report[1]);
          if (!row) fail(404, 'Report not found.');
          if (body.removePost === true) await db.run('DELETE FROM posts WHERE id=?', row.post_id);
          else await db.run('UPDATE reports SET resolved=1 WHERE id=?', row.id);
          return send({ ok: true });
        }
        fail(404, 'Administrative endpoint not found.');
      }
      if (path === '/api/auth/register' && method === 'POST') {
        rate(`auth:${peer}`, 20, 900000);
        const email = text(body.email, 'Email', 3, 254).toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Enter a valid email address.');
        const handle = text(body.handle, 'Username', 3, 24).toLowerCase().replace(/^@/, '');
        if (!/^[a-z0-9_]{3,24}$/.test(handle)) fail(400, 'Use 3–24 letters, numbers, or underscores for your username.');
        const name = text(body.name, 'Display name', 1, 50);
        const encoded = await hashPassword(password(body.password));
        const id = randomUUID();
        if (await db.get('SELECT 1 FROM users WHERE email=? OR handle=?', email, handle)) fail(409, 'That email or username is already registered.');
        let verified = 0;
        if (emailOtp.configured()) { const proof = await emailOtp.verify(body.challenge, body.code, 'signup'); if (proof.email !== email) fail(400, 'Request a code for this email address.'); verified = 1; }
        else if (production) fail(503, 'Email verification is not configured. Please try again later.');
        try { await db.run('INSERT INTO users (id,email,handle,name,password,created_at,email_verified) VALUES (?,?,?,?,?,?,?)', id, email, handle, name, encoded, now(), verified); }
        catch (error) { if (/UNIQUE|unique/i.test(error.message)) fail(409, 'That email or username is already registered.'); throw error; }
        await beta.joined(id, body.invite);
        return send(await session(await db.get('SELECT * FROM users WHERE id=?', id)), 201);
      }
      if (path === '/api/auth/login' && method === 'POST') {
        rate(`auth:${peer}`, 20, 900000);
        const email = text(body.email, 'Email', 3, 254).toLowerCase();
        const candidate = await db.get('SELECT * FROM users WHERE email=?', email);
        const input = typeof body.password === 'string' && body.password.length <= 128 ? body.password : '';
        const dummy = '00000000000000000000000000000000:' + '00'.repeat(64);
        if (!await verifyPassword(input, candidate?.password || dummy) || !candidate) fail(401, 'Email or password is incorrect.');
        return send(await session(candidate));
      }
      if (path === '/api/auth/otp/request' && method === 'POST') {
        rate(`otp-request:${peer}`, 10, 900000);
        return send(await emailOtp.request(body.email));
      }
      if (path === '/api/auth/otp/verify' && method === 'POST') {
        rate(`otp-verify:${peer}`, 50, 900000);
        return send(await session(await emailOtp.verify(body.challenge, body.code)));
      }
      if (path === '/api/auth/forgot' && method === 'POST') {
        rate(`reset:${peer}`, 5, 900000);
        if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) fail(503, 'Password recovery email is not configured. Contact the app owner.');
        const candidate = await db.get('SELECT * FROM users WHERE email=?', text(body.email, 'Email', 3, 254).toLowerCase());
        if (candidate) {
          const token = randomToken();
          await db.run('INSERT INTO password_resets VALUES (?,?,?)', digest(token), candidate.id, Date.now() + 1800000);
          const response = await fetcher('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.EMAIL_FROM, to: candidate.email, subject: 'Reset your Riffs password', text: `Reset your password within 30 minutes: ${webApp}/reset-password?token=${token}` }), signal: AbortSignal.timeout(15000) });
          if (!response.ok) { await db.run('DELETE FROM password_resets WHERE token_hash=?', digest(token)); console.error('Password recovery delivery failed', requestId); }
        }
        return send({ ok: true, message: 'If this email is registered, a recovery link will arrive shortly.' });
      }
      if (path === '/api/auth/reset' && method === 'POST') {
        rate(`reset:${peer}`, 10, 900000);
        const token = text(body.token, 'Recovery code', 43, 43);
        const row = await db.get('SELECT * FROM password_resets WHERE token_hash=? AND expires_at>?', digest(token), Date.now());
        if (!row) fail(400, 'This recovery link expired or was already used.');
        const encoded = await hashPassword(password(body.password));
        // Password update and token/session revocation are one atomic batch.
        const results = await db.batch([
          { sql: 'UPDATE users SET password=? WHERE id=? AND EXISTS(SELECT 1 FROM password_resets WHERE token_hash=? AND expires_at>?)', args: [encoded, row.user_id, digest(token), Date.now()] },
          { sql: 'DELETE FROM password_resets WHERE user_id=?', args: [row.user_id] },
          { sql: 'DELETE FROM sessions WHERE user_id=?', args: [row.user_id] },
        ]);
        if (!results[0].rowsAffected) fail(400, 'This recovery link was already used.');
        return send({ ok: true });
      }
      if (path === '/api/auth/logout' && method === 'POST') { if (user) await db.run('DELETE FROM sessions WHERE token_hash=?', digest(req.headers.authorization.slice(7))); return send({ ok: true }); }
      if (path === '/api/me' && method === 'GET') {
        requireUser(user);
        const counts = await db.get('SELECT (SELECT COUNT(*) FROM follows WHERE followed_id=?) AS followers, (SELECT COUNT(*) FROM follows WHERE follower_id=?) AS following', user.id, user.id);
        return send({ user: profile({ ...user, ...counts }), spotifyConnected: !!await db.get('SELECT user_id FROM spotify WHERE user_id=?', user.id) });
      }
      if (path === '/api/me' && method === 'PATCH') {
        requireUser(user);
        const status = body.status === undefined ? user.status || '' : text(body.status || '', 'Status', 0, 60);
        const avatar = body.avatar === undefined ? user.avatar || '' : avatarData(body.avatar);
        await db.run('UPDATE users SET name=?, bio=?, status=?, avatar=? WHERE id=?', text(body.name, 'Display name', 1, 50), text(body.bio || '', 'Bio', 0, 160), status, avatar, user.id);
        return send({ user: profile(await db.get('SELECT * FROM users WHERE id=?', user.id)) });
      }
      if (path === '/api/me/password' && method === 'PUT') {
        requireUser(user); rate(`password:${user.id}`, 5, 900000);
        if (!await verifyPassword(text(body.currentPassword, 'Current password', 1, 128), user.password)) fail(401, 'Current password is incorrect.');
        await db.batch([{ sql: 'UPDATE users SET password=? WHERE id=?', args: [await hashPassword(password(body.password)), user.id] }, { sql: 'DELETE FROM sessions WHERE user_id=? AND token_hash<>?', args: [user.id, digest(req.headers.authorization.slice(7))] }]);
        return send({ ok: true });
      }
      if (path === '/api/me' && method === 'DELETE') {
        requireUser(user); rate(`password:${user.id}`, 5, 900000);
        if (!await verifyPassword(text(body.password, 'Password', 1, 128), user.password)) fail(401, 'Password is incorrect.');
        await db.run('DELETE FROM users WHERE id=?', user.id); return send({ ok: true });
      }
      if (path === '/api/people' && method === 'GET') return send({ people: await people(user?.id, (url.searchParams.get('q') || '').slice(0, 100)) });
      const matchRoute = path.match(/^\/api\/people\/([a-z0-9_]{3,24})\/match$/);
      if (matchRoute && method === 'GET') {
        requireUser(user);
        const target = (await people(user.id, matchRoute[1])).find((p) => p.handle === `@${matchRoute[1].toLowerCase()}`);
        if (!target || target.id === user.id) fail(404, 'Profile unavailable.');
        const [mine, theirs] = await Promise.all([
          db.all('SELECT item_id, score, item FROM ratings WHERE user_id=?', user.id),
          db.all(`SELECT r.item_id, r.score, r.item FROM ratings r JOIN posts p ON p.id=r.post_id WHERE r.user_id=? AND ${visibleSQL}`, target.id, ...viewerArgs(user.id)),
        ]);
        return send(tasteMatch(mine, theirs));
      }
      if (path === '/api/twins' && method === 'GET') {
        requireUser(user); rate(`twins:${user.id}`, 30, 60000);
        const mine = await db.all('SELECT item_id, score, item FROM ratings WHERE user_id=?', user.id);
        if (mine.length < 3) return send({ twins: [], needed: 3 - mine.length });
        const candidates = (await people(user.id)).filter((p) => p.id !== user.id);
        if (!candidates.length) return send({ twins: [], needed: 0 });
        const rows = await db.all(`SELECT r.user_id, r.item_id, r.score, r.item FROM ratings r JOIN posts p ON p.id=r.post_id WHERE r.user_id IN (${candidates.map(() => '?').join(',')}) AND ${visibleSQL} LIMIT 20000`, ...candidates.map((p) => p.id), ...viewerArgs(user.id));
        const byUser = new Map();
        for (const r of rows) byUser.set(r.user_id, [...(byUser.get(r.user_id) || []), r]);
        const twins = candidates.map((person) => ({ person, match: tasteMatch(mine, byUser.get(person.id) || []) }))
          .filter((t) => t.match.percent !== null).sort((x, y) => y.match.percent - x.match.percent).slice(0, 20)
          .map(({ person, match }) => ({ user: person, percent: match.percent, sharedArtists: match.sharedArtists.slice(0, 3) }));
        return send({ twins, needed: 0 });
      }
      const personRoute = path.match(/^\/api\/people\/([a-z0-9_]{3,24})$/);
      if (personRoute && method === 'GET') {
        const p = await db.get(`SELECT ${PUBLIC_USER}, (SELECT COUNT(*) FROM follows WHERE followed_id=u.id) AS followers, (SELECT COUNT(*) FROM follows WHERE follower_id=u.id) AS following FROM users u WHERE handle=?`, personRoute[1]);
        if (!p || !((await people(user?.id, personRoute[1])).some((v) => v.id === p.id))) fail(404, 'Profile unavailable.');
        const posts = await db.all(`SELECT p.*, u.handle, u.name, u.avatar FROM posts p JOIN users u ON u.id=p.user_id WHERE p.user_id=? AND ${visibleSQL} ORDER BY p.created_at DESC LIMIT 200`, p.id, ...viewerArgs(user?.id));
        const ratings = await db.all(`SELECT r.*, p.subtitle, p.visibility FROM ratings r JOIN posts p ON p.id=r.post_id WHERE r.user_id=? AND ${visibleSQL} ORDER BY r.category, r.tier DESC, r.position LIMIT 1000`, p.id, ...viewerArgs(user?.id));
        return send({ user: profile(p), posts: await Promise.all(posts.map((r) => postJSON(r, user?.id))), ratings: ratings.map(ratingJSON) });
      }
      if (path === '/api/sync' && method === 'GET') {
        const id = user?.id || '';
        const posts = await db.all(`SELECT p.*, u.handle, u.name, u.avatar FROM posts p JOIN users u ON u.id=p.user_id WHERE ${visibleSQL} ORDER BY p.created_at DESC LIMIT 200`, ...viewerArgs(id));
        const [following, blocks, users, savedItems, savedPosts] = await Promise.all([
          db.all('SELECT u.handle FROM follows f JOIN users u ON u.id=f.followed_id WHERE f.follower_id=?', id),
          db.all('SELECT u.id, u.handle, u.name, u.bio FROM blocks b JOIN users u ON u.id=b.blocked_id WHERE b.user_id=?', id),
          people(id),
          db.all('SELECT item FROM saved_items WHERE user_id=? ORDER BY created_at DESC LIMIT 300', id),
          db.all(`SELECT p.id FROM saved_posts s JOIN posts p ON p.id=s.post_id WHERE s.user_id=? AND ${visibleSQL} ORDER BY s.created_at DESC LIMIT 200`, id, ...viewerArgs(id)),
        ]);
        const ratings = id ? await db.all('SELECT r.*, p.subtitle, p.visibility FROM ratings r JOIN posts p ON p.id=r.post_id WHERE r.user_id=? ORDER BY r.category, r.tier DESC, r.position', id) : [];
        return send({ posts: await Promise.all(posts.map((p) => postJSON(p, id))), following: following.map((u) => `@${u.handle}`), people: users, blocks: blocks.map(profile), ratings: ratings.map(ratingJSON), savedItems: savedItems.map((row) => JSON.parse(row.item)), savedPostIds: savedPosts.map((row) => row.id) });
      }
      const followRoute = path.match(/^\/api\/people\/([a-z0-9_]{3,24})\/follow$/);
      if (followRoute && ['PUT', 'DELETE'].includes(method)) {
        requireUser(user);
        const target = (await people(user.id, followRoute[1])).find((p) => p.handle === `@${followRoute[1]}`);
        if (!target || target.id === user.id) fail(400, 'Cannot follow this profile.');
        if (method === 'PUT') { const r = await db.run('INSERT OR IGNORE INTO follows VALUES (?,?)', user.id, target.id); if (r.rowsAffected) await notify(target.id, user.id, 'follow'); }
        else await db.run('DELETE FROM follows WHERE follower_id=? AND followed_id=?', user.id, target.id);
        return send({ ok: true });
      }
      const blockRoute = path.match(/^\/api\/people\/([a-z0-9_]{3,24})\/block$/);
      if (blockRoute && ['PUT', 'DELETE'].includes(method)) {
        requireUser(user);
        const target = await db.get('SELECT id FROM users WHERE handle=?', blockRoute[1]);
        if (!target || target.id === user.id) fail(400, 'Cannot block this profile.');
        if (method === 'PUT') await db.batch([
          { sql: 'INSERT OR IGNORE INTO blocks VALUES (?,?)', args: [user.id, target.id] },
          { sql: 'DELETE FROM follows WHERE (follower_id=? AND followed_id=?) OR (follower_id=? AND followed_id=?)', args: [user.id, target.id, target.id, user.id] },
        ]);
        else await db.run('DELETE FROM blocks WHERE user_id=? AND blocked_id=?', user.id, target.id);
        return send({ ok: true });
      }
      const postRoute = path.match(/^\/api\/posts(?:\/([a-zA-Z0-9-]+))?$/);
      if (postRoute) {
        const id = postRoute[1];
        if (method === 'GET' && id) return send({ post: await postJSON(await getPost(id, user?.id), user?.id) });
        if (method === 'POST' && !id || method === 'PUT' && id) {
          requireUser(user); rate(`publish:${user.id}`, 60, 60000);
          const p = validatePost(body);
          if (id) {
            const existing = await getPost(id, user.id);
            if (existing.user_id !== user.id) fail(403, 'Only the author can edit this post.');
            if (JSON.parse(existing.meta || '{}').clubId) fail(400, 'The club’s weekly album stays fixed. Choose another album next week.');
            if (existing.kind === 'review') fail(400, 'Edit a review by rating the item again.');
            if (p.kind !== existing.kind) fail(400, 'The post type cannot be changed.');
            const sameOptions = JSON.stringify(p.items.map((i) => i.id)) === JSON.stringify(JSON.parse(existing.items).map((i) => i.id));
            if (p.kind === 'take' && !sameOptions && await db.get('SELECT 1 AS voted FROM poll_votes WHERE post_id=? LIMIT 1', id)) fail(400, 'A poll’s options can’t change after people vote.');
            if (p.kind === 'pod') {
              // Keep contributors' credit when the owner edits; the owner's own additions stay unattributed.
              const credit = new Map(JSON.parse(existing.items).filter((i) => i.addedBy).map((i) => [i.id, i.addedBy]));
              p.items = p.items.map(({ addedBy: _ignored, ...i }) => credit.has(i.id) ? { ...i, addedBy: credit.get(i.id) } : i);
            }
          }
          if (!id && p.kind === 'pod') p.items = p.items.map(({ addedBy: _ignored, ...i }) => i);
          const postId = id || randomUUID(), date = now();
          if (id) await db.run('UPDATE posts SET title=?,subtitle=?,items=?,tiles=?,theme=?,visibility=?,meta=?,updated_at=? WHERE id=? AND user_id=?', p.title, p.subtitle, JSON.stringify(p.items), JSON.stringify(p.tiles), p.theme, p.visibility, JSON.stringify(p.meta), date, id, user.id);
          else await db.run(INSERT_POST, postId, user.id, p.kind, p.title, p.subtitle, JSON.stringify(p.items), JSON.stringify(p.tiles), p.theme, p.visibility, p.originId, date, date, JSON.stringify(p.meta));
          return send({ post: await postJSON(await getPost(postId, user.id), user.id) }, id ? 200 : 201);
        }
        if (method === 'DELETE' && id) {
          requireUser(user); if ((await getPost(id, user.id)).user_id !== user.id) fail(403, 'Only the author can delete this post.');
          const rating = await db.get('SELECT item_id, category FROM ratings WHERE post_id=?', id);
          // Deleting a review removes its rating (cascade); close the gap so the remaining scores stay continuous.
          const tiers = rating ? await tiersFor(user.id, rating.category, rating.item_id) : null;
          await db.batch([{ sql: 'DELETE FROM posts WHERE id=?', args: [id] }, ...(tiers ? reorder(user.id, tiers) : [])]);
          return send({ ok: true });
        }
      }
      const voteRoute = path.match(/^\/api\/posts\/([a-zA-Z0-9-]+)\/vote$/);
      if (voteRoute && ['PUT', 'DELETE'].includes(method)) {
        requireUser(user); rate(`votes:${user.id}`, 120, 60000);
        const p = await getPost(voteRoute[1], user.id);
        if (p.kind !== 'take' || !JSON.parse(p.meta || '{}').poll) fail(400, 'This post is not a poll.');
        if (method === 'DELETE') await db.run('DELETE FROM poll_votes WHERE user_id=? AND post_id=?', user.id, p.id);
        else {
          if (![0, 1].includes(body.choice)) fail(400, 'Pick one of the two options.');
          await db.run('INSERT INTO poll_votes VALUES (?, ?, ?, ?) ON CONFLICT(user_id, post_id) DO UPDATE SET choice=excluded.choice', user.id, p.id, body.choice, now());
        }
        return send({ post: await postJSON(p, user.id) });
      }
      const reactionRoute = path.match(/^\/api\/posts\/([a-zA-Z0-9-]+)\/reaction$/);
      if (reactionRoute && ['PUT', 'DELETE'].includes(method)) {
        requireUser(user); const p = await getPost(reactionRoute[1], user.id);
        if (method === 'PUT') { const r = await db.run('INSERT OR IGNORE INTO reactions VALUES (?,?)', user.id, p.id); if (r.rowsAffected) await notify(p.user_id, user.id, 'reaction', p.id); }
        else await db.run('DELETE FROM reactions WHERE user_id=? AND post_id=?', user.id, p.id);
        return send({ post: await postJSON(p, user.id) });
      }
      const commentsRoute = path.match(/^\/api\/posts\/([a-zA-Z0-9-]+)\/comments$/);
      if (commentsRoute && method === 'POST') {
        requireUser(user); rate(`comments:${user.id}`, 30, 60000);
        const p = await getPost(commentsRoute[1], user.id);
        const commentText = text(body.text, 'Comment', 1, 1000);
        if (body.itemId && !JSON.parse(p.items).some((i) => i.id === body.itemId)) fail(400, 'This pick does not belong to the post.');
        let parent;
        if (body.parentId) {
          parent = await db.get(`SELECT c.* FROM comments c WHERE c.id=? AND c.post_id=? AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.blocked_id=c.user_id) OR (b.blocked_id=? AND b.user_id=c.user_id))`, text(body.parentId, 'Reply', 1, 100), p.id, user.id, user.id);
          if (!parent) fail(400, 'That comment is unavailable. Choose another reply.');
        }
        await db.run('INSERT INTO comments (id,user_id,post_id,text,item_id,created_at,parent_id) VALUES (?,?,?,?,?,?,?)', randomUUID(), user.id, p.id, commentText, body.itemId || parent?.item_id || null, now(), parent?.id || null);
        const targets = new Map([[p.user_id, 'comment']]);
        if (parent) targets.set(parent.user_id, 'reply');
        const handles = [...new Set([...commentText.matchAll(/(?:^|[^a-zA-Z0-9_])@([a-z0-9_]{3,24})(?![a-z0-9_])/gi)].map((m) => m[1].toLowerCase()))].slice(0, 5);
        for (const handle of handles) {
          const mentioned = await db.get('SELECT id FROM users WHERE handle=?', handle);
          if (mentioned && !targets.has(mentioned.id)) targets.set(mentioned.id, 'mention');
        }
        for (const [target, kind] of targets) {
          try { await getPost(p.id, target); await notify(target, user.id, kind, p.id); }
          catch (error) { if (error.status !== 404) throw error; }
        }
        return send({ post: await postJSON(p, user.id) }, 201);
      }
      const commentRoute = path.match(/^\/api\/comments\/([a-zA-Z0-9-]+)$/);
      if (commentRoute && method === 'DELETE') {
        requireUser(user);
        const c = await db.get('SELECT c.*, p.user_id AS owner FROM comments c JOIN posts p ON p.id=c.post_id WHERE c.id=?', commentRoute[1]);
        if (!c || (c.user_id !== user.id && c.owner !== user.id)) fail(403, 'Only the comment or post author can remove this comment.');
        await db.run('DELETE FROM comments WHERE id=?', c.id); return send({ ok: true });
      }
      const reportRoute = path.match(/^\/api\/posts\/([a-zA-Z0-9-]+)\/report$/);
      if (reportRoute && method === 'POST') {
        requireUser(user); rate(`reports:${user.id}`, 10, 3600000); const p = await getPost(reportRoute[1], user.id);
        await db.run('INSERT INTO reports VALUES (?,?,?,?,?,0)', randomUUID(), user.id, p.id, text(body.reason, 'Reason', 3, 500), now());
        return send({ ok: true }, 201);
      }
      if (path === '/api/catalog' && method === 'GET') {
        rate(`catalog:${peer}`, 90, 60000);
        const kind = url.searchParams.get('kind') || '', q = text(url.searchParams.get('q'), 'Search', 2, 100);
        if (['song', 'album', 'artist'].includes(kind) && spotify.catalog) return send({ items: await spotify.search(null, q, kind), source: 'spotify' });
        return send({ items: await catalog.search(kind, q), source: kind === 'artist' ? 'deezer' : kind });
      }
      if (path === '/api/catalog/spotify-link' && method === 'GET') {
        rate(`catalog:${peer}`, 90, 60000);
        return send(await spotify.fromLink(text(url.searchParams.get('url'), 'Link', 10, 300)));
      }
      if (path === '/api/ratings' && method === 'POST') {
        requireUser(user); rate(`ratings:${user.id}`, 120, 60000);
        const item = validateItem(body.item);
        if (![0, 1, 2].includes(body.tier)) fail(400, 'Choose how you felt about it.');
        if (!['public', 'followers', 'private'].includes(body.visibility)) fail(400, 'Choose a valid visibility.');
        const review = text(body.review || '', 'Review', 0, 1000);
        const existing = await db.get('SELECT post_id FROM ratings WHERE user_id=? AND item_id=?', user.id, item.id);
        const tiers = await tiersFor(user.id, item.kind, item.id);
        const position = Math.max(0, Math.min(tiers[body.tier].length, Number.isInteger(body.position) ? body.position : tiers[body.tier].length));
        tiers[body.tier].splice(position, 0, item.id);
        const postId = existing?.post_id || randomUUID(), date = now();
        await db.batch([
          existing
            ? { sql: 'UPDATE posts SET title=?, subtitle=?, items=?, visibility=?, updated_at=? WHERE id=?', args: [item.title, review, JSON.stringify([item]), body.visibility, date, postId] }
            : { sql: INSERT_POST, args: [postId, user.id, 'review', item.title, review, JSON.stringify([item]), '[]', 'night', body.visibility, null, date, date, '{}'] },
          { sql: `INSERT INTO ratings (user_id, item_id, category, item, tier, position, score, post_id, created_at, updated_at) VALUES (?,?,?,?,?,?,0,?,?,?)
            ON CONFLICT(user_id, item_id) DO UPDATE SET item=excluded.item, updated_at=excluded.updated_at`, args: [user.id, item.id, item.kind, JSON.stringify(item), body.tier, position, postId, date, date] },
          ...reorder(user.id, tiers),
        ]);
        const saved = await db.get('SELECT r.*, p.subtitle, p.visibility FROM ratings r JOIN posts p ON p.id=r.post_id WHERE r.user_id=? AND r.item_id=?', user.id, item.id);
        return send({ rating: ratingJSON(saved), post: await postJSON(await getPost(postId, user.id), user.id) }, existing ? 200 : 201);
      }
      const itemRoute = path.match(/^\/api\/items\/([^/]{1,200})$/);
      if (itemRoute && method === 'GET') {
        let itemId;
        try { itemId = decodeURIComponent(itemRoute[1]); } catch { fail(400, 'Invalid item ID.'); }
        if (!ITEM_ID.test(itemId)) fail(400, 'Invalid item ID.');
        const rows = await db.all(`SELECT p.*, u.handle, u.name, u.avatar, r.score FROM ratings r JOIN posts p ON p.id=r.post_id JOIN users u ON u.id=p.user_id WHERE r.item_id=? AND ${visibleSQL} ORDER BY p.updated_at DESC LIMIT 100`, itemId, ...viewerArgs(user?.id));
        const average = rows.length ? Math.round(rows.reduce((sum, r) => sum + r.score, 0) / rows.length * 10) / 10 : null;
        const pods = await db.all(`SELECT p.*, u.handle, u.name, u.avatar FROM posts p JOIN users u ON u.id=p.user_id WHERE p.kind='pod' AND instr(p.items, ?) > 0 AND ${visibleSQL} ORDER BY p.updated_at DESC LIMIT 20`, `"id":${JSON.stringify(itemId)}`, ...viewerArgs(user?.id));
        return send({ item: rows[0] ? JSON.parse(rows[0].items)[0] : null, average, count: rows.length,
          reviews: await Promise.all(rows.map((r) => postJSON(r, user?.id))), pods: await Promise.all(pods.map((r) => postJSON(r, user?.id))) });
      }
      const contributeRoute = path.match(/^\/api\/posts\/([a-zA-Z0-9-]+)\/items(?:\/([^/]{1,200}))?$/);
      if (contributeRoute && ((method === 'POST' && !contributeRoute[2]) || (method === 'DELETE' && contributeRoute[2]))) {
        requireUser(user); rate(`contribute:${user.id}`, 60, 60000);
        const p = await getPost(contributeRoute[1], user.id);
        if (p.kind !== 'pod') fail(400, 'Only pods take contributions.');
        if (JSON.parse(p.meta || '{}').clubId) fail(400, 'The club’s weekly album stays fixed.');
        const owner = p.user_id === user.id;
        let items = JSON.parse(p.items);
        if (method === 'POST') {
          if (!owner && !JSON.parse(p.meta || '{}').open) fail(403, 'This pod is closed to contributions.');
          const item = validateItem(body.item);
          if (items.some((i) => i.id === item.id)) fail(409, 'That’s already in this pod.');
          if (items.length >= 100) fail(400, 'This pod is full (100 items).');
          items = [...items, owner ? item : { ...item, addedBy: `@${user.handle}` }];
        } else {
          let itemId;
          try { itemId = decodeURIComponent(contributeRoute[2]); } catch { fail(400, 'Invalid item ID.'); }
          const target = items.find((i) => i.id === itemId);
          if (!target) fail(404, 'That item isn’t in this pod.');
          if (!owner && target.addedBy !== `@${user.handle}`) fail(403, 'Only the pod owner or the person who added it can remove this.');
          items = items.filter((i) => i.id !== itemId);
        }
        await db.run('UPDATE posts SET items=?, updated_at=? WHERE id=?', JSON.stringify(items), now(), p.id);
        if (method === 'POST') await notify(p.user_id, user.id, 'contribution', p.id);
        return send({ post: await postJSON(await getPost(p.id, user.id), user.id) });
      }
      if (path === '/api/notifications' && method === 'GET') {
        requireUser(user);
        const notes = await db.all(`SELECT n.*, u.name, u.handle, u.avatar FROM notifications n JOIN users u ON u.id=n.actor_id LEFT JOIN posts p ON p.id=n.post_id WHERE n.user_id=? AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.blocked_id=n.actor_id) OR (b.blocked_id=? AND b.user_id=n.actor_id)) AND (n.post_id IS NULL OR (p.id IS NOT NULL AND ${visibleSQL})) ORDER BY n.created_at DESC LIMIT 100`, user.id, user.id, user.id, ...viewerArgs(user.id));
        return send({ notifications: notes.map((n) => ({ id: n.id, name: n.name, avatar: n.avatar || undefined, handle: `@${n.handle}`, postId: n.post_id, kind: n.kind, seen: !!n.seen, createdAt: n.created_at })) });
      }
      if (path === '/api/notifications/read' && method === 'POST') { requireUser(user); await db.run('UPDATE notifications SET seen=1 WHERE user_id=?', user.id); return send({ ok: true }); }
      if (path.startsWith('/api/spotify')) {
        requireUser(user);
        if (path === '/api/spotify/start' && method === 'POST') return send(await spotify.start(user.id, body.returnUri));
        if (path === '/api/spotify' && method === 'DELETE') { await db.batch([{ sql: 'DELETE FROM spotify WHERE user_id=?', args: [user.id] }, { sql: 'DELETE FROM oauth_states WHERE user_id=?', args: [user.id] }]); return send({ ok: true }); }
        const offset = Math.max(0, Math.min(10000, Number(url.searchParams.get('offset')) || 0));
        if (path === '/api/spotify/search' && method === 'GET') return send({ items: await spotify.search(user.id, text(url.searchParams.get('q'), 'Search', 2, 100), ['album', 'artist'].includes(url.searchParams.get('kind')) ? url.searchParams.get('kind') : 'song') });
        if (path === '/api/spotify/playlists' && method === 'GET') return send(await spotify.playlists(user.id, offset));
        if (path === '/api/spotify/top' && method === 'GET') {
          const range = ['short_term', 'medium_term', 'long_term'].includes(url.searchParams.get('range')) ? url.searchParams.get('range') : 'medium_term';
          return send(await spotify.top(user.id, url.searchParams.get('type') === 'artists' ? 'artists' : 'tracks', range));
        }
        const tracks = path.match(/^\/api\/spotify\/playlists\/([a-zA-Z0-9]{22})$/);
        if (tracks && method === 'GET') return send(await spotify.tracks(user.id, tracks[1], offset));
      }
      fail(404, 'Endpoint not found.');
    } catch (error) {
      if (res.headersSent) { res.end(); return; }
      const status = error.status || 500;
      if (status === 500) console.error(`API error ${requestId}`, error.message);
      send({ error: status === 500 ? 'The server could not complete the request. Please try again.' : error.message, requestId }, status);
    }
  });
  server.on('close', () => { clearInterval(rateCleanup); push.close(); expansion.close(); });
  server.requestTimeout = 30000;
  return server;
}

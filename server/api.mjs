import { createServer } from 'node:http';
import { randomUUID, randomBytes } from 'node:crypto';
import { isIP } from 'node:net';
import { digest, randomToken, hashPassword, verifyPassword, fail, text, password } from './security.mjs';
import { spotifyService } from './spotify.mjs';

const now = () => new Date().toISOString();
const MAX_BODY = 14 * 1024 * 1024;
const SESSION_LIFETIME = 30 * 24 * 60 * 60 * 1000;
const PUBLIC_USER = 'id, handle, name, bio, created_at';
const anonymousId = '';

function profile(row) { return { id: row.id, handle: `@${row.handle}`, name: row.name, bio: row.bio, followers: row.followers || 0, following: row.following || 0 }; }
function safeUrl(value) {
  if (!value) return undefined;
  if (typeof value !== 'string' || value.length > 2000) fail(400, 'Invalid artwork link.');
  try { if (new URL(value).protocol !== 'https:') fail(400, 'Artwork links must use HTTPS.'); } catch { fail(400, 'Invalid artwork link.'); }
  return value;
}
export function validatePost(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'Send a valid post.');
  if (body.kind !== undefined && !['ranking', 'moodboard'].includes(body.kind)) fail(400, 'Choose a valid post type.');
  const kind = body.kind === 'moodboard' ? 'moodboard' : 'ranking';
  if (!['public', 'followers', 'private'].includes(body.visibility)) fail(400, 'Choose a valid visibility.');
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length > 100 || (kind === 'ranking' && items.length < 2)) fail(400, 'Rank between 2 and 100 picks.');
  const seen = new Set();
  const clean = items.map((i) => {
    if (!i || typeof i !== 'object' || Array.isArray(i)) fail(400, 'Invalid music pick.');
    const id = text(i.id, 'Music ID', 1, 150);
    if (seen.has(id)) fail(400, 'A pick can only appear once.');
    seen.add(id);
    if (!['song', 'album'].includes(i.kind)) fail(400, 'Invalid music type.');
    return { id, kind: i.kind, title: text(i.title, 'Song title', 1, 300), artist: text(i.artist, 'Artist', 1, 300),
      ...(i.album ? { album: text(i.album, 'Album', 1, 300) } : {}),
      ...(i.artwork ? { artwork: safeUrl(i.artwork) } : {}),
      ...(i.externalUrl ? { externalUrl: safeUrl(i.externalUrl) } : {}),
      ...(i.spotifyId ? { spotifyId: text(i.spotifyId, 'Spotify ID', 1, 50) } : {}),
    };
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
  return { kind, title: text(body.title, 'Title', 1, 100), subtitle: text(body.subtitle || '', 'Description', 0, 500), items: clean, tiles: cleanTiles,
    theme: ['night', 'paper', 'rose', 'forest'].includes(body.theme) ? body.theme : 'night', visibility: body.visibility,
    originId: typeof body.originId === 'string' ? body.originId.slice(0, 150) : null,
  };
}

export function createApi({ db, key = randomBytes(32), fetcher = fetch } = {}) {
  const spotify = spotifyService(db, key, fetcher);
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
    const p = await db.get(`SELECT p.*, u.handle, u.name FROM posts p JOIN users u ON u.id=p.user_id WHERE p.id=? AND ${visibleSQL}`, id, ...viewerArgs(viewer));
    if (!p) fail(404, 'This post is unavailable or private.');
    return p;
  }
  async function postJSON(p, viewer) {
    const [comments, reaction] = await Promise.all([
      db.all(`SELECT c.*, u.name FROM comments c JOIN users u ON u.id=c.user_id WHERE c.post_id=? AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.blocked_id=c.user_id) OR (b.blocked_id=? AND b.user_id=c.user_id)) ORDER BY c.created_at LIMIT 200`, p.id, viewer || '', viewer || ''),
      db.get('SELECT COUNT(*) AS count, MAX(CASE WHEN user_id=? THEN 1 ELSE 0 END) AS reacted FROM reactions WHERE post_id=?', viewer || '', p.id),
    ]);
    return { id: p.id, userId: p.user_id, kind: p.kind, title: p.title, subtitle: p.subtitle,
      author: p.name, handle: `@${p.handle}`, items: JSON.parse(p.items), tiles: JSON.parse(p.tiles), theme: p.theme,
      createdAt: p.created_at, updatedAt: p.updated_at, visibility: p.visibility,
      reactionCount: reaction.count, reacted: !!reaction.reacted,
      comments: comments.map((c) => ({ id: c.id, userId: c.user_id, author: c.name, text: c.text, itemId: c.item_id || undefined, createdAt: c.created_at })),
      originId: p.origin_id || undefined,
    };
  }
  async function notify(target, actor, kind, postId = null) {
    if (target === actor) return;
    await db.run('INSERT INTO notifications VALUES (?, ?, ?, ?, ?, 0, ?)', randomUUID(), target, actor, postId, kind, now());
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
        if (!origins.includes(origin)) fail(403, 'This web origin is not allowed.');
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
      if (proxies.includes(peer)) {
        const forwarded = String(req.headers['x-forwarded-for'] || '').split(',').at(-1)?.trim();
        if (forwarded && isIP(forwarded)) peer = forwarded;
      }
      rate(`requests:${peer}`, production ? 1200 : 10000, 60000);
      if (path === '/api/health') { await db.get('SELECT 1'); return send({ ok: true, database: db.mode }); }
      if (path === '/api/config') return send({ spotify: spotify.configured, passwordRecovery: !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM) });
      if (path === '/api/spotify/callback' && method === 'GET') {
        const returnUrl = await spotify.callback(url.searchParams);
        res.writeHead(302, { Location: returnUrl }); res.end(); return;
      }
      const user = await userFor(req);
      const body = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) ? await readBody(req) : {};
      if (path.startsWith('/api/admin/')) {
        const expected = process.env.ADMIN_TOKEN;
        const supplied = req.headers.authorization?.replace(/^Bearer /, '') || '';
        if (!expected || expected.length < 32 || digest(supplied) !== digest(expected)) fail(403, 'Administrative access denied.');
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
        try { await db.run('INSERT INTO users (id,email,handle,name,password,created_at) VALUES (?,?,?,?,?,?)', id, email, handle, name, encoded, now()); }
        catch (error) { if (/UNIQUE|unique/i.test(error.message)) fail(409, 'That email or username is already registered.'); throw error; }
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
      if (path === '/api/auth/forgot' && method === 'POST') {
        rate(`reset:${peer}`, 5, 900000);
        if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) fail(503, 'Password recovery email is not configured. Contact the app owner.');
        const candidate = await db.get('SELECT * FROM users WHERE email=?', text(body.email, 'Email', 3, 254).toLowerCase());
        if (candidate) {
          const token = randomToken();
          await db.run('INSERT INTO password_resets VALUES (?,?,?)', digest(token), candidate.id, Date.now() + 1800000);
          const response = await fetcher('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.EMAIL_FROM, to: candidate.email, subject: 'Reset your MARGIN password', text: `Reset your password within 30 minutes: ${webApp}/reset-password?token=${token}` }), signal: AbortSignal.timeout(15000) });
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
      if (path === '/api/me' && method === 'GET') { requireUser(user); return send({ user: profile(user), spotifyConnected: !!await db.get('SELECT user_id FROM spotify WHERE user_id=?', user.id) }); }
      if (path === '/api/me' && method === 'PATCH') {
        requireUser(user); await db.run('UPDATE users SET name=?, bio=? WHERE id=?', text(body.name, 'Display name', 1, 50), text(body.bio || '', 'Bio', 0, 160), user.id);
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
      const personRoute = path.match(/^\/api\/people\/([a-z0-9_]{3,24})$/);
      if (personRoute && method === 'GET') {
        const p = await db.get(`SELECT ${PUBLIC_USER}, (SELECT COUNT(*) FROM follows WHERE followed_id=u.id) AS followers, (SELECT COUNT(*) FROM follows WHERE follower_id=u.id) AS following FROM users u WHERE handle=?`, personRoute[1]);
        if (!p || !((await people(user?.id, personRoute[1])).some((v) => v.id === p.id))) fail(404, 'Profile unavailable.');
        const posts = await db.all(`SELECT p.*, u.handle, u.name FROM posts p JOIN users u ON u.id=p.user_id WHERE p.user_id=? AND ${visibleSQL} ORDER BY p.created_at DESC LIMIT 200`, p.id, ...viewerArgs(user?.id));
        return send({ user: profile(p), posts: await Promise.all(posts.map((r) => postJSON(r, user?.id))) });
      }
      if (path === '/api/sync' && method === 'GET') {
        const id = user?.id || '';
        const posts = await db.all(`SELECT p.*, u.handle, u.name FROM posts p JOIN users u ON u.id=p.user_id WHERE ${visibleSQL} ORDER BY p.created_at DESC LIMIT 200`, ...viewerArgs(id));
        const [following, blocks, users] = await Promise.all([
          db.all('SELECT u.handle FROM follows f JOIN users u ON u.id=f.followed_id WHERE f.follower_id=?', id),
          db.all('SELECT u.id, u.handle, u.name, u.bio FROM blocks b JOIN users u ON u.id=b.blocked_id WHERE b.user_id=?', id),
          people(id),
        ]);
        return send({ posts: await Promise.all(posts.map((p) => postJSON(p, id))), following: following.map((u) => `@${u.handle}`), people: users, blocks: blocks.map(profile) });
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
            if (p.kind !== existing.kind) fail(400, 'The post type cannot be changed.');
          }
          const postId = id || randomUUID(), date = now();
          if (id) await db.run('UPDATE posts SET title=?,subtitle=?,items=?,tiles=?,theme=?,visibility=?,updated_at=? WHERE id=? AND user_id=?', p.title, p.subtitle, JSON.stringify(p.items), JSON.stringify(p.tiles), p.theme, p.visibility, date, id, user.id);
          else await db.run('INSERT INTO posts VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', postId, user.id, p.kind, p.title, p.subtitle, JSON.stringify(p.items), JSON.stringify(p.tiles), p.theme, p.visibility, p.originId, date, date);
          return send({ post: await postJSON(await getPost(postId, user.id), user.id) }, id ? 200 : 201);
        }
        if (method === 'DELETE' && id) { requireUser(user); if ((await getPost(id, user.id)).user_id !== user.id) fail(403, 'Only the author can delete this post.'); await db.run('DELETE FROM posts WHERE id=?', id); return send({ ok: true }); }
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
        await db.run('INSERT INTO comments VALUES (?,?,?,?,?,?)', randomUUID(), user.id, p.id, commentText, body.itemId || null, now());
        await notify(p.user_id, user.id, 'comment', p.id);
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
      if (path === '/api/notifications' && method === 'GET') {
        requireUser(user);
        const notes = await db.all(`SELECT n.*, u.name, u.handle FROM notifications n JOIN users u ON u.id=n.actor_id LEFT JOIN posts p ON p.id=n.post_id WHERE n.user_id=? AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.blocked_id=n.actor_id) OR (b.blocked_id=? AND b.user_id=n.actor_id)) AND (n.post_id IS NULL OR (p.id IS NOT NULL AND ${visibleSQL})) ORDER BY n.created_at DESC LIMIT 100`, user.id, user.id, user.id, ...viewerArgs(user.id));
        return send({ notifications: notes.map((n) => ({ id: n.id, name: n.name, handle: `@${n.handle}`, postId: n.post_id, kind: n.kind, seen: !!n.seen, createdAt: n.created_at })) });
      }
      if (path === '/api/notifications/read' && method === 'POST') { requireUser(user); await db.run('UPDATE notifications SET seen=1 WHERE user_id=?', user.id); return send({ ok: true }); }
      if (path.startsWith('/api/spotify')) {
        requireUser(user);
        if (path === '/api/spotify/start' && method === 'POST') return send(await spotify.start(user.id, body.returnUri));
        if (path === '/api/spotify' && method === 'DELETE') { await db.batch([{ sql: 'DELETE FROM spotify WHERE user_id=?', args: [user.id] }, { sql: 'DELETE FROM oauth_states WHERE user_id=?', args: [user.id] }]); return send({ ok: true }); }
        const offset = Math.max(0, Math.min(10000, Number(url.searchParams.get('offset')) || 0));
        if (path === '/api/spotify/search' && method === 'GET') return send({ items: await spotify.search(user.id, text(url.searchParams.get('q'), 'Search', 2, 100), url.searchParams.get('kind') === 'album' ? 'album' : 'song') });
        if (path === '/api/spotify/playlists' && method === 'GET') return send(await spotify.playlists(user.id, offset));
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
  server.on('close', () => clearInterval(rateCleanup));
  server.requestTimeout = 30000;
  return server;
}

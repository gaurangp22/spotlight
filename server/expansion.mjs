import { randomUUID, createHmac } from 'node:crypto';
import { fail, text, digest } from './security.mjs';

export function expansionRoutes({ db, key, profile, validateItem, getPost, postJSON, visibleSQL, viewerArgs, emailOtp, push }) {
  const blocked = (column) => `NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.blocked_id=${column}) OR (b.blocked_id=? AND b.user_id=${column}))`;
  const seal = (data) => { const json = Buffer.from(JSON.stringify(data)).toString('base64url'); return `${json}.${createHmac('sha256', key).update(json).digest('base64url')}`; };
  function cursor(input, scope) {
    if (!input) return null;
    if (input.length > 16000) fail(400, 'Invalid page cursor.');
    const [json, mac] = input.split('.');
    if (createHmac('sha256', key).update(json).digest('base64url') !== mac) fail(400, 'Invalid page cursor.');
    let value; try { value = JSON.parse(Buffer.from(json, 'base64url').toString()); } catch { fail(400, 'Invalid page cursor.'); }
    if (value.scope !== scope || Date.now() - value.time > 86400000) fail(400, 'This page expired. Refresh to continue.');
    return value;
  }
  const preferences = (u) => ({ push: !!u.push_enabled, messages: !!u.allow_messages, bots: u.show_bots !== 0, emailVerified: !!u.email_verified });
  async function member(id, userId) {
    const row = await db.get(`SELECT c.*, m.last_read FROM conversations c JOIN conversation_members m ON m.conversation_id=c.id
      WHERE c.id=? AND m.user_id=? AND NOT EXISTS(SELECT 1 FROM conversation_members x JOIN blocks b ON
      ((b.user_id=? AND b.blocked_id=x.user_id) OR (b.blocked_id=? AND b.user_id=x.user_id)) WHERE x.conversation_id=c.id)`, id, userId, userId, userId);
    if (!row) fail(404, 'Conversation unavailable.'); return row;
  }
  async function threadJSON(c, userId) {
    const members = await db.all('SELECT u.* FROM conversation_members m JOIN users u ON u.id=m.user_id WHERE m.conversation_id=? ORDER BY u.name,u.id', c.id);
    const unread = await db.get(`SELECT COUNT(*) AS n FROM messages m WHERE conversation_id=? AND sender_id<>? AND sequence>? AND deleted=0 AND ${blocked('m.sender_id')}`, c.id, userId, c.last_read || 0, userId, userId);
    const latest = await db.get(`SELECT m.*,u.name FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.conversation_id=? AND ${blocked('m.sender_id')} ORDER BY m.sequence DESC LIMIT 1`, c.id, userId, userId);
    return { id: c.id, kind: c.kind, name: c.kind === 'direct' ? members.find((u) => u.id !== userId)?.name || 'Conversation' : c.name, ownerId: c.owner_id, members: members.map(profile), unread: unread.n,
      lastMessage: latest ? { sender: latest.name, text: latest.deleted ? 'Message removed' : latest.text.slice(0, 120) || 'Shared music', createdAt: latest.created_at } : null };
  }
  async function messageJSON(row, viewer) {
    let post = null;
    if (row.post_id && !row.deleted) { try { post = await postJSON(await getPost(row.post_id, viewer), viewer); } catch (e) { if (e.status !== 404) throw e; } }
    return { id: row.id, sequence: row.sequence, sender: profile({ ...row, id: row.sender_id }), text: row.deleted ? '' : row.text, item: !row.deleted && row.item ? JSON.parse(row.item) : null, post, deleted: !!row.deleted, createdAt: row.created_at };
  }
  const handle = async ({ path, method, body, user, url, send, rate, req }) => {
    const done = (data, status = 200) => { send(data, status); return true; };
    const signed = () => { if (!user) fail(401, 'Sign in to continue.'); };
    const viewer = user?.id || '';
    if (path === '/api/feed' && method === 'GET') {
      const mode = url.searchParams.get('mode') === 'following' ? 'following' : url.searchParams.get('mode') === 'recent' ? 'recent' : 'you';
      const query = (url.searchParams.get('q') || '').trim().slice(0, 100), scope = `feed:${viewer}:${mode}:${query}`;
      const page = cursor(url.searchParams.get('cursor'), scope), time = page?.time || Date.now();
      let artists = page?.artists || [], follows = page?.follows || [];
      if (!page && user && mode === 'you') {
        const rows = await db.all('SELECT item FROM ratings WHERE user_id=? AND tier=2 ORDER BY updated_at DESC LIMIT 40', viewer);
        const history = await db.all('SELECT item FROM listening_history WHERE user_id=? ORDER BY played_at DESC LIMIT 30', viewer);
        const all = [...JSON.parse(user.favorite_artists || '[]'), ...rows.map((r) => JSON.parse(r.item)), ...history.map((r) => JSON.parse(r.item))];
        artists = [...new Set(all.map((i) => (i.kind === 'artist' ? i.title : i.artist).toLowerCase()).filter((name) => name && name.length <= 150))].slice(0, 16);
        follows = (await db.all('SELECT followed_id FROM follows WHERE follower_id=? ORDER BY followed_id LIMIT 50', viewer)).map((r) => r.followed_id);
      }
      const score = mode === 'you' && user ? `8*EXISTS(SELECT 1 FROM json_each(p.items) i JOIN json_each(?) a ON lower(json_extract(i.value,'$.artist'))=a.value OR (json_extract(i.value,'$.kind')='artist' AND lower(json_extract(i.value,'$.title'))=a.value))
        +4*EXISTS(SELECT 1 FROM json_each(?) f WHERE f.value=p.user_id)+max(0,6-(julianday(?)-julianday(p.created_at))*.4)` : '0';
      const args = mode === 'you' && user ? [JSON.stringify(artists), JSON.stringify(follows), new Date(time).toISOString()] : [];
      const filter = (mode === 'following' ? 'AND (p.user_id=? OR EXISTS(SELECT 1 FROM follows f WHERE f.follower_id=? AND f.followed_id=p.user_id))' : '') + (user && user.show_bots === 0 ? ' AND u.is_bot=0' : '');
      const wherePage = page ? 'WHERE (rank_score<? OR (rank_score=? AND (created_at<? OR (created_at=? AND id<?))))' : '';
      const rows = await db.all(`WITH ranked AS (SELECT p.*,u.handle,u.name,u.avatar, ${score} AS rank_score FROM posts p JOIN users u ON u.id=p.user_id
        WHERE ${visibleSQL} AND p.visibility<>'private' AND p.created_at<=? ${filter} AND (?='' OR lower(p.title||' '||p.subtitle||' '||p.items||' '||u.name) LIKE ?))
        SELECT * FROM ranked ${wherePage} ORDER BY rank_score DESC,created_at DESC,id DESC LIMIT 31`, ...args, ...viewerArgs(viewer), new Date(time).toISOString(), ...(mode === 'following' ? [viewer, viewer] : []), query, `%${query.toLowerCase()}%`, ...(page ? [page.score, page.score, page.date, page.date, page.id] : []));
      const more = rows.length > 30; rows.splice(30); const last = rows.at(-1);
      return done({ posts: await Promise.all(rows.map((r) => postJSON(r, viewer))), nextCursor: more ? seal({ scope, time, artists, follows, score: last.rank_score, date: last.created_at, id: last.id }) : null, personalized: !!(user && mode === 'you' && (artists.length || follows.length)) });
    }
    if (path === '/api/people' && method === 'GET') {
      const q = (url.searchParams.get('q') || '').slice(0, 100), scope = `people:${viewer}:${q}`, page = cursor(url.searchParams.get('cursor'), scope), time = page?.time || Date.now();
      const rows = await db.all(`SELECT u.* FROM users u WHERE ${blocked('u.id')} AND created_at<=? AND (handle LIKE ? OR name LIKE ?)
        ${page ? 'AND (created_at<? OR (created_at=? AND id<?))' : ''} ORDER BY created_at DESC,id DESC LIMIT 31`, viewer, viewer, new Date(time).toISOString(), `%${q}%`, `%${q}%`, ...(page ? [page.date, page.date, page.id] : []));
      const more = rows.length > 30; rows.splice(30); const last = rows.at(-1);
      return done({ people: rows.map(profile), nextCursor: more ? seal({ scope, time, date: last.created_at, id: last.id }) : null });
    }
    if (path === '/api/auth/signup/request' && method === 'POST') { rate(`signup:${req.socket.remoteAddress}`, 10, 900000); return done(await emailOtp.request(body.email, 'signup')); }
    if (path === '/api/me/preferences') {
      signed();
      if (method === 'PATCH') {
        for (const field of ['push', 'messages', 'bots']) if (body[field] !== undefined && typeof body[field] !== 'boolean') fail(400, 'Use a true or false preference.');
        for (const [field, column] of [['push', 'push_enabled'], ['messages', 'allow_messages'], ['bots', 'show_bots']]) {
          if (body[field] === undefined) continue;
          if (typeof body[field] !== 'boolean') fail(400, 'Use a true or false preference.');
          await db.run(`UPDATE users SET ${column}=? WHERE id=?`, body[field] ? 1 : 0, viewer);
          if (field === 'push' && !body[field]) await db.run('DELETE FROM push_jobs WHERE user_id=?', viewer);
        }
      }
      if (['GET', 'PATCH'].includes(method)) return done(preferences(await db.get('SELECT * FROM users WHERE id=?', viewer)));
    }
    if (path === '/api/me/verify-email/request' && method === 'POST') { signed(); rate(`verify-email:${viewer}`, 5, 3600000); return done(await emailOtp.request(user.email, 'verify-account')); }
    if (path === '/api/me/verify-email' && method === 'POST') { signed(); const row = await db.get('SELECT user_id FROM email_otps WHERE challenge_hash=?', digest(String(body.challenge || ''))); if (row?.user_id !== viewer) fail(400, 'This code belongs to another account.'); await emailOtp.verify(body.challenge, body.code, 'verify-account'); return done({ ok: true }); }
    if (path === '/api/push/token' && ['PUT', 'DELETE'].includes(method)) {
      signed(); const token = text(body.token, 'Device token', 10, 250);
      if (!/^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]+\]$/.test(token)) fail(400, 'Invalid push token.');
      if (method === 'PUT') await db.run('INSERT INTO push_tokens VALUES (?,?,?) ON CONFLICT(token) DO UPDATE SET user_id=excluded.user_id,session_hash=excluded.session_hash', token, viewer, digest(req.headers.authorization.slice(7)));
      else await db.run('DELETE FROM push_tokens WHERE token=? AND user_id=?', token, viewer);
      return done({ ok: true });
    }
    if (path === '/api/history') {
      signed();
      if (method === 'POST') {
        rate(`history-log:${viewer}`, 60, 60000);
        const item = validateItem(body.item);
        if (!['song','album','artist'].includes(item.kind)) fail(400, 'Log a song, album, or artist.');
        const playedAt = new Date().toISOString();
        await db.run('INSERT INTO listening_history VALUES (?,?,?,?) ON CONFLICT DO NOTHING', viewer, item.id, playedAt, JSON.stringify(item));
        return done({ playedAt }, 201);
      }
      if (method === 'DELETE') { await db.run('DELETE FROM listening_history WHERE user_id=?', viewer); return done({ ok: true }); }
      if (method === 'GET') {
        const scope = `history:${viewer}`, page = cursor(url.searchParams.get('cursor'), scope), time = page?.time || Date.now();
        const rows = await db.all(`SELECT * FROM listening_history WHERE user_id=? ${page ? 'AND (played_at<? OR (played_at=? AND item_id<?))' : ''} ORDER BY played_at DESC,item_id DESC LIMIT 51`, viewer, ...(page ? [page.date, page.date, page.id] : []));
        const more = rows.length > 50; rows.splice(50); const last = rows.at(-1);
        return done({ plays: rows.map((r) => ({ item: JSON.parse(r.item), playedAt: r.played_at })), nextCursor: more ? seal({ scope, time, date: last.played_at, id: last.item_id }) : null });
      }
    }
    if (path === '/api/conversations') {
      signed();
      if (method === 'GET') {
        const offset = Math.max(0, Math.min(10000, Math.trunc(Number(url.searchParams.get('offset')) || 0)));
        const rows = await db.all(`SELECT c.*,m.last_read FROM conversations c JOIN conversation_members m ON m.conversation_id=c.id WHERE m.user_id=? AND NOT EXISTS(SELECT 1 FROM conversation_members x JOIN blocks b ON ((b.user_id=? AND b.blocked_id=x.user_id) OR (b.blocked_id=? AND b.user_id=x.user_id)) WHERE x.conversation_id=c.id)
          ORDER BY coalesce((SELECT max(created_at) FROM messages WHERE conversation_id=c.id),c.created_at) DESC,c.id LIMIT 31 OFFSET ?`, viewer, viewer, viewer, offset);
        const more = rows.length > 30; rows.splice(30); return done({ conversations: await Promise.all(rows.map((r) => threadJSON(r, viewer))), nextOffset: more ? offset + 30 : null });
      }
      if (method === 'POST') {
        rate(`new-chat:${viewer}`, 20, 3600000);
        const kind = body.kind === 'group' ? 'group' : 'direct';
        if (!Array.isArray(body.handles) || !body.handles.length || body.handles.length > (kind === 'direct' ? 1 : 11)) fail(400, 'Choose one person for a message, or up to 11 for a group.');
        const chosen = new Set([viewer]);
        for (const handle of body.handles) {
          const target = await db.get(`SELECT id FROM users WHERE handle=? AND allow_messages=1 AND ${blocked('id')}`, String(handle).replace(/^@/, '').toLowerCase(), viewer, viewer);
          if (!target || target.id === viewer) fail(400, 'A selected person is unavailable for messages.'); chosen.add(target.id);
        }
        const ids = [...chosen]; if (ids.length < 2) fail(400, 'Choose another person.');
        // Prevent creating a group that contains a blocked pair, including between invitees.
        const marks = ids.map(() => '?').join(',');
        if (await db.get(`SELECT 1 FROM blocks WHERE user_id IN (${marks}) AND blocked_id IN (${marks})`, ...ids, ...ids)) fail(400, 'These people cannot share a conversation.');
        const directKey = kind === 'direct' ? ids.sort().join(':') : null;
        let existing = directKey ? await db.get('SELECT * FROM conversations WHERE direct_key=?', directKey) : null;
        if (!existing) {
          const id = randomUUID(), name = kind === 'group' ? text(body.name, 'Group name', 1, 60) : '';
          try { await db.batch([{ sql: 'INSERT INTO conversations VALUES (?,?,?,?,?,?)', args: [id, kind, name, viewer, directKey, new Date().toISOString()] }, ...ids.map((uid) => ({ sql: 'INSERT INTO conversation_members VALUES (?,?,0)', args: [id, uid] }))]); }
          catch (e) { if (!directKey || !/unique/i.test(e.message)) throw e; }
          existing = await db.get('SELECT * FROM conversations WHERE id=? OR direct_key=?', id, directKey);
        }
        return done({ conversation: await threadJSON(await member(existing.id, viewer), viewer) }, 201);
      }
    }
    const report = path.match(/^\/api\/conversations\/([a-zA-Z0-9-]+)\/messages\/([a-zA-Z0-9-]+)\/report$/);
    if (report && method === 'POST') {
      signed(); await member(report[1], viewer); rate(`message-report:${viewer}`, 10, 3600000);
      const message = await db.get(`SELECT sender_id FROM messages m WHERE id=? AND conversation_id=? AND deleted=0 AND ${blocked('m.sender_id')}`, report[2], report[1], viewer, viewer);
      if (!message || message.sender_id === viewer) fail(400, 'Choose another person’s message to report.');
      await db.run('INSERT INTO message_reports VALUES (?,?,?,?,?,0)', randomUUID(), viewer, report[2], text(body.reason, 'Reason', 3, 300), new Date().toISOString());
      return done({ ok: true }, 201);
    }
    const route = path.match(/^\/api\/conversations\/([a-zA-Z0-9-]+)(?:\/(messages|read|leave|members)(?:\/([a-zA-Z0-9-]+))?)?$/);
    if (!route) return false;
    signed(); const [, id, action, messageId] = route;
    // Leaving remains possible after blocking another participant.
    if (action === 'leave' && method === 'POST') {
      const c = await db.get('SELECT c.* FROM conversations c JOIN conversation_members m ON m.conversation_id=c.id WHERE c.id=? AND m.user_id=?', id, viewer);
      if (!c || c.kind !== 'group') fail(400, 'Only group conversations can be left.');
      const next = await db.get('SELECT user_id FROM conversation_members WHERE conversation_id=? AND user_id<>? ORDER BY user_id LIMIT 1', id, viewer);
      if (!next) await db.run('DELETE FROM conversations WHERE id=?', id);
      else await db.batch([{ sql: 'UPDATE conversations SET owner_id=CASE WHEN owner_id=? THEN ? ELSE owner_id END WHERE id=?', args: [viewer, next.user_id, id] }, { sql: 'DELETE FROM conversation_members WHERE conversation_id=? AND user_id=?', args: [id, viewer] }]);
      return done({ ok: true });
    }
    const c = await member(id, viewer);
    if (!action && method === 'GET') return done({ conversation: await threadJSON(c, viewer) });
    if (action === 'members' && method === 'DELETE') {
      if (c.kind !== 'group' || c.owner_id !== viewer || !messageId || messageId === viewer) fail(403, 'Only the group owner can remove another member.');
      await db.run('DELETE FROM conversation_members WHERE conversation_id=? AND user_id=?', id, messageId); return done({ ok: true });
    }
    if (action === 'read' && method === 'POST') {
      const seq = Number(body.sequence); if (!Number.isInteger(seq) || seq < 0) fail(400, 'Invalid read position.');
      await db.run('UPDATE conversation_members SET last_read=max(last_read,min(?,coalesce((SELECT max(sequence) FROM messages WHERE conversation_id=?),0))) WHERE conversation_id=? AND user_id=?', seq, id, id, viewer);
      return done({ ok: true });
    }
    if (action === 'messages' && method === 'GET') {
      const after = url.searchParams.has('after') ? Math.max(0, Number(url.searchParams.get('after')) || 0) : null;
      const before = Math.max(0, Number(url.searchParams.get('before')) || 0);
      const records = await db.all(`SELECT m.*,u.name,u.handle,u.avatar FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.conversation_id=? AND ${blocked('m.sender_id')} ${after !== null ? 'AND m.sequence>?' : before ? 'AND m.sequence<?' : ''} ORDER BY m.sequence ${after !== null ? 'ASC' : 'DESC'} LIMIT 51`, id, viewer, viewer, ...(after !== null ? [after] : before ? [before] : []));
      const more = records.length > 50; records.splice(50); if (after === null) records.reverse();
      return done({ messages: await Promise.all(records.map((r) => messageJSON({ ...r, sender_profile_id: r.sender_id }, viewer))), hasMore: more });
    }
    if (action === 'messages' && method === 'POST') {
      rate(`message:${viewer}`, 60, 60000);
      const clientId = text(body.clientId, 'Message key', 8, 100), value = text(body.text || (body.postId ? 'Shared a post' : ''), 'Message', 0, 2000);
      const item = body.item ? validateItem(body.item) : null;
      if (!value && !item && !body.postId) fail(400, 'Write a message or share a pick.');
      if (body.postId) await getPost(text(body.postId, 'Post', 1, 100), viewer);
      if (c.kind === 'direct') { const target = await db.get('SELECT u.allow_messages FROM users u JOIN conversation_members m ON m.user_id=u.id WHERE m.conversation_id=? AND u.id<>?', id, viewer); if (!target?.allow_messages) fail(403, 'This person has turned off messages.'); }
      const result = await db.run(`INSERT INTO messages (id,conversation_id,sender_id,sequence,client_id,text,item,post_id,created_at)
        SELECT ?,?,?,coalesce((SELECT max(sequence) FROM messages WHERE conversation_id=?),0)+1,?,?,?,?,?
        WHERE EXISTS(SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?)
        AND NOT EXISTS(SELECT 1 FROM conversation_members x JOIN blocks b ON ((b.user_id=? AND b.blocked_id=x.user_id) OR (b.blocked_id=? AND b.user_id=x.user_id)) WHERE x.conversation_id=?)
        AND EXISTS(SELECT 1 FROM conversations c WHERE c.id=? AND (c.kind<>'direct' OR EXISTS(SELECT 1 FROM conversation_members x JOIN users u ON u.id=x.user_id WHERE x.conversation_id=c.id AND x.user_id<>? AND u.allow_messages=1)))
        ON CONFLICT(conversation_id,sender_id,client_id) DO NOTHING`, randomUUID(), id, viewer, id, clientId, value, item ? JSON.stringify(item) : null, body.postId || null, new Date().toISOString(), id, viewer, viewer, viewer, id, id, viewer);
      if (!await db.get('SELECT id FROM messages WHERE conversation_id=? AND sender_id=? AND client_id=?', id, viewer, clientId)) fail(404, 'This conversation changed. Your message was not sent.');
      if (result.rowsAffected) { const recipients = await db.all('SELECT user_id FROM conversation_members WHERE conversation_id=? AND user_id<>?', id, viewer); for (const recipient of recipients) await push.enqueue(recipient.user_id, viewer, 'message', null, id); }
      return done({ ok: true }, 201);
    }
    if (action === 'messages' && messageId && method === 'DELETE') { await db.run("UPDATE messages SET deleted=1,text='',item=NULL,post_id=NULL WHERE id=? AND conversation_id=? AND sender_id=?", messageId, id, viewer); return done({ ok: true }); }
    return false;
  };
  handle.close = () => {};
  return handle;
}

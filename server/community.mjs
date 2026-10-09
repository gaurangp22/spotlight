import { randomUUID } from 'node:crypto';
import { fail, text } from './security.mjs';

export function currentWeek(time = new Date()) {
  const day = new Date(time); day.setUTCHours(0, 0, 0, 0);
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  return day.toISOString().slice(0, 10);
}
export function communityRoutes({ db, profile, validateItem, getPost, postJSON, visibleSQL, viewerArgs, notify }) {
  const unblocked = (column) => `NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.blocked_id=${column}) OR (b.blocked_id=? AND b.user_id=${column}))`;
  async function clubFor(id, viewer) {
    const row = await db.get(`SELECT c.*, u.handle, u.name AS owner_name, u.avatar,
      (SELECT COUNT(*) FROM club_members WHERE club_id=c.id) AS members,
      EXISTS(SELECT 1 FROM club_members WHERE club_id=c.id AND user_id=?) AS joined
      FROM clubs c JOIN users u ON u.id=c.owner_id WHERE c.id=? AND ${unblocked('c.owner_id')}`, viewer || '', id, viewer || '', viewer || '');
    if (!row) fail(404, 'This club is unavailable.');
    return row;
  }
  const clubJSON = (row) => ({ id: row.id, name: row.name, description: row.description, ownerId: row.owner_id,
    owner: row.owner_name, handle: `@${row.handle}`, avatar: row.avatar || undefined, members: row.members, joined: !!row.joined, createdAt: row.created_at });
  return async ({ path, method, body, user, url, send, rate }) => {
    const done = (data, status = 200) => { send(data, status); return true; };
    const signed = () => { if (!user) fail(401, 'Sign in to continue.'); };
    const now = () => new Date().toISOString();
    if (path === '/api/me/onboarding' && method === 'PUT') {
      signed();
      const artists = Array.isArray(body.artists) ? body.artists : [];
      if (artists.length > 8) fail(400, 'Choose up to eight artists.');
      const clean = artists.map((item) => { const pick = validateItem(item); if (pick.kind !== 'artist') fail(400, 'Choose artists for your music profile.'); return pick; });
      if (new Set(clean.map((item) => item.id)).size !== clean.length) fail(400, 'Choose each artist once.');
      await db.run('UPDATE users SET favorite_artists=?, onboarding_complete=? WHERE id=?', JSON.stringify(clean), body.complete === true ? 1 : 0, user.id);
      return done({ user: profile(await db.get('SELECT * FROM users WHERE id=?', user.id)) });
    }
    const connections = path.match(/^\/api\/people\/([a-z0-9_]{3,24})\/(followers|following)$/);
    if (connections && method === 'GET') {
      const viewer = user?.id || '';
      const target = await db.get(`SELECT id FROM users WHERE handle=? AND ${unblocked('id')}`, connections[1], viewer, viewer);
      if (!target) fail(404, 'Profile unavailable.');
      const offset = Math.max(0, Math.min(10000, Number(url.searchParams.get('offset')) || 0));
      const followers = connections[2] === 'followers';
      const rows = await db.all(`SELECT u.* FROM follows f JOIN users u ON u.id=f.${followers ? 'follower_id' : 'followed_id'}
        WHERE f.${followers ? 'followed_id' : 'follower_id'}=? AND ${unblocked('u.id')} ORDER BY u.name,u.id LIMIT 30 OFFSET ?`, target.id, viewer, viewer, offset);
      return done({ people: rows.map(profile), nextOffset: rows.length === 30 ? offset + 30 : null });
    }
    if (path === '/api/library' && method === 'GET') {
      signed();
      const [items, rows] = await Promise.all([
        db.all('SELECT item,created_at FROM saved_items WHERE user_id=? ORDER BY created_at DESC LIMIT 300', user.id),
        db.all(`SELECT p.*, u.handle,u.name,u.avatar FROM saved_posts s JOIN posts p ON p.id=s.post_id JOIN users u ON u.id=p.user_id WHERE s.user_id=? AND ${visibleSQL} ORDER BY s.created_at DESC LIMIT 200`, user.id, ...viewerArgs(user.id)),
      ]);
      return done({ items: items.map((row) => ({ item: JSON.parse(row.item), savedAt: row.created_at })), posts: await Promise.all(rows.map((row) => postJSON(row, user.id))) });
    }
    const savedItem = path.match(/^\/api\/library\/items\/([^/]+)$/);
    if (savedItem && ['PUT', 'DELETE'].includes(method)) {
      signed(); rate(`library:${user.id}`, 90, 60000);
      let id;
      try { id = decodeURIComponent(savedItem[1]); } catch { fail(400, 'Invalid item ID.'); }
      if (method === 'PUT') {
        const item = validateItem(body.item); if (item.id !== id) fail(400, 'This pick does not match the saved item.');
        await db.run('INSERT INTO saved_items VALUES (?,?,?,?) ON CONFLICT(user_id,item_id) DO UPDATE SET item=excluded.item', user.id, item.id, JSON.stringify(item), now());
      } else await db.run('DELETE FROM saved_items WHERE user_id=? AND item_id=?', user.id, id);
      return done({ ok: true });
    }
    const savedPost = path.match(/^\/api\/library\/posts\/([a-zA-Z0-9-]+)$/);
    if (savedPost && ['PUT', 'DELETE'].includes(method)) {
      signed(); rate(`library:${user.id}`, 90, 60000);
      if (method === 'PUT') {
        await getPost(savedPost[1], user.id);
        await db.run('INSERT INTO saved_posts VALUES (?,?,?) ON CONFLICT DO NOTHING', user.id, savedPost[1], now());
      } else await db.run('DELETE FROM saved_posts WHERE user_id=? AND post_id=?', user.id, savedPost[1]);
      return done({ ok: true });
    }
    if (path === '/api/clubs') {
      if (method === 'GET') {
        const viewer = user?.id || '';
        const rows = await db.all(`SELECT c.id FROM clubs c WHERE ${unblocked('c.owner_id')} ORDER BY c.created_at DESC LIMIT 100`, viewer, viewer);
        return done({ clubs: await Promise.all(rows.map(async (row) => clubJSON(await clubFor(row.id, viewer)))) });
      }
      if (method === 'POST') {
        signed(); rate(`create-club:${user.id}`, 5, 3600000);
        const id = randomUUID(), name = text(body.name, 'Club name', 3, 60), description = text(body.description || '', 'Description', 0, 300), time = now();
        await db.batch([{ sql: 'INSERT INTO clubs VALUES (?,?,?,?,?)', args: [id, user.id, name, description, time] },
          { sql: 'INSERT INTO club_members VALUES (?,?,?)', args: [id, user.id, time] }]);
        return done({ club: clubJSON(await clubFor(id, user.id)) }, 201);
      }
    }
    const clubRoute = path.match(/^\/api\/clubs\/([a-zA-Z0-9-]+)(?:\/(join|weeks))?$/);
    if (clubRoute) {
      const [, id, action] = clubRoute, club = await clubFor(id, user?.id);
      if (!action && method === 'GET') {
        const rows = await db.all('SELECT week,post_id FROM club_weeks WHERE club_id=? ORDER BY week DESC LIMIT 52', id);
        const weeks = await Promise.all(rows.map(async (row) => ({ week: row.week, post: await postJSON(await getPost(row.post_id, user?.id), user?.id) })));
        return done({ club: clubJSON(club), weeks, currentWeek: currentWeek() });
      }
      signed();
      if (action === 'join' && ['PUT', 'DELETE'].includes(method)) {
        if (method === 'DELETE' && club.owner_id === user.id) fail(400, 'The owner stays a member. You can delete the club instead.');
        if (method === 'PUT') await db.run('INSERT INTO club_members VALUES (?,?,?) ON CONFLICT DO NOTHING', id, user.id, now());
        else await db.run('DELETE FROM club_members WHERE club_id=? AND user_id=?', id, user.id);
        return done({ club: clubJSON(await clubFor(id, user.id)) });
      }
      if (action === 'weeks' && method === 'POST') {
        if (club.owner_id !== user.id) fail(403, 'Only the club owner can choose the weekly album.');
        rate(`club-week:${user.id}`, 10, 3600000);
        const item = validateItem(body.item); if (item.kind !== 'album') fail(400, 'Choose an album for this week.');
        const week = currentWeek(), postId = randomUUID(), time = now();
        try {
          await db.batch([
            { sql: 'INSERT INTO posts (id,user_id,kind,title,subtitle,items,visibility,created_at,updated_at,meta) VALUES (?,?,?,?,?,?,?,?,?,?)', args: [postId, user.id, 'pod', `${club.name} · Album of the week`.slice(0, 100), 'Listen, rate the album, and tell the club what stayed with you.', JSON.stringify([item]), 'public', time, time, JSON.stringify({ clubId: id, week })] },
            { sql: 'INSERT INTO club_weeks VALUES (?,?,?)', args: [id, week, postId] },
          ]);
        } catch (error) { if (/UNIQUE|unique/.test(error.message)) fail(409, 'This week already has an album. A new week starts on Monday (UTC).'); throw error; }
        const members = await db.all(`SELECT user_id FROM club_members WHERE club_id=? AND ${unblocked('user_id')}`, id, user.id, user.id);
        for (const member of members) await notify(member.user_id, user.id, 'club', postId);
        return done({ post: await postJSON(await getPost(postId, user.id), user.id), week }, 201);
      }
      if (!action && method === 'DELETE') {
        if (club.owner_id !== user.id) fail(403, 'Only the club owner can delete it.');
        await db.batch([{ sql: 'DELETE FROM posts WHERE id IN (SELECT post_id FROM club_weeks WHERE club_id=?)', args: [id] }, { sql: 'DELETE FROM clubs WHERE id=?', args: [id] }]);
        return done({ ok: true });
      }
    }
    return false;
  };
}

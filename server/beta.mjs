import { randomUUID } from 'node:crypto';
import { fail, text } from './security.mjs';

// Beta tooling: personal invite links, in-app feedback, and first-party product metrics.
// Metrics need no tracking SDK: the only new data is one row per user per day they used the app.
const DAY = 86400000;
const dayOf = (time = Date.now()) => new Date(time).toISOString().slice(0, 10);
const escape = (value) => String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
// Seeded demo identities never count toward real usage.
const REAL = "u.email NOT LIKE '%@demo.margin.invalid' AND u.is_bot=0";

function page(title, body, image, description) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} · Riffs</title>
<meta property="og:site_name" content="Riffs"><meta property="og:title" content="${escape(title)}">
${description ? `<meta property="og:description" content="${escape(description)}"><meta name="description" content="${escape(description)}">` : ''}
${image ? `<meta property="og:image" content="${escape(image)}"><meta name="twitter:card" content="summary_large_image">` : ''}
<style>
*{box-sizing:border-box}body{margin:0;background:#000;color:#F5F3EE;font:16px/1.55 -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:480px;margin:0 auto;padding:56px 20px 64px}.brand{font-weight:900;font-size:22px;letter-spacing:-.04em}.brand span{color:#FF6B4A}
.eyebrow{margin:48px 0 6px;color:#FF6B4A;font:700 12px/1 ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase}
h1{font-size:32px;line-height:1.12;letter-spacing:-.03em;margin:0}.handle{color:#A09D97;margin:10px 0 0}.lead{color:#D6D3CD;margin:20px 0 28px}
.quote{font-size:21px;line-height:1.35;margin:18px 0 0}.cover{display:block;width:100%;aspect-ratio:1;object-fit:cover;border-radius:20px;margin:24px 0 8px}
.list span{display:block;color:#A09D97;font-size:14px;padding:6px 0;border-bottom:1px solid #1C1C1E}.list{margin:8px 0 24px}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0 0}.chips span{background:#1C1C1E;border:1px solid #2C2C2E;border-radius:999px;padding:6px 12px;font-size:14px}
.button{display:block;text-align:center;text-decoration:none;color:#F5F3EE;background:#1C1C1E;border-radius:999px;padding:15px 20px;margin:10px 0;font:700 14px/1 ui-monospace,Menlo,monospace;letter-spacing:.06em;text-transform:uppercase}
.button.primary{background:#FF6B4A;color:#000}footer{margin-top:40px;color:#7A7772;font-size:13px}footer a{color:#A09D97}
</style></head><body><main><div class="brand">Riffs<span>.</span></div>${body}
<footer><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></footer></main></body></html>`;
}

export function betaRoutes({ db, profile, notify, webApp }) {
  const seenToday = new Map();
  /** Records that someone used the app today; at most one write per user per day per server. */
  async function seen(user) {
    if (!user) return;
    const day = dayOf();
    if (seenToday.get(user.id) === day) return;
    if (seenToday.size > 50000) seenToday.clear();
    seenToday.set(user.id, day);
    await db.run('INSERT OR IGNORE INTO active_days (user_id, day) VALUES (?, ?)', user.id, day);
  }

  /** Called after signup: credits the inviter, follows them, and lets them know. Invalid invites are ignored. */
  async function joined(userId, invite) {
    await db.run('INSERT OR IGNORE INTO active_days (user_id, day) VALUES (?, ?)', userId, dayOf());
    const handle = typeof invite === 'string' ? invite.trim().toLowerCase().replace(/^@/, '') : '';
    if (!/^[a-z0-9_]{3,24}$/.test(handle)) return;
    const inviter = await db.get('SELECT id FROM users WHERE handle=?', handle);
    if (!inviter || inviter.id === userId) return;
    await db.batch([
      { sql: 'UPDATE users SET invited_by=? WHERE id=? AND invited_by IS NULL', args: [inviter.id, userId] },
      { sql: 'INSERT OR IGNORE INTO follows VALUES (?, ?)', args: [userId, inviter.id] },
    ]);
    await notify(inviter.id, userId, 'joined');
  }

  /** Public landing page for an invite link, so it works for people who don't have the app yet. */
  async function landing(handle) {
    const row = await db.get('SELECT handle, name, status, favorite_artists FROM users WHERE handle=?', handle);
    const app = `marginmusic://join/${encodeURIComponent(handle)}`;
    const web = `${webApp}/join/${encodeURIComponent(handle)}`;
    const android = process.env.ANDROID_DOWNLOAD_URL;
    const artists = row ? JSON.parse(row.favorite_artists || '[]').slice(0, 4).map((a) => a?.title).filter(Boolean) : [];
    const body = row ? `<p class="eyebrow">You’re invited</p>
<h1>${escape(row.name)} wants you on Riffs</h1>
<p class="handle">@${escape(row.handle)}${row.status ? ` · ${escape(row.status)}` : ''}</p>
${artists.length ? `<p class="chips">${artists.map((a) => `<span>${escape(a)}</span>`).join('')}</p>` : ''}
<p class="lead">Rate the music you love, post hot takes, and see how your taste matches your friends’.</p>
<a class="button primary" href="${escape(web)}">Join on the web</a>
<a class="button" href="${escape(app)}">Open in the Riffs app</a>
${android ? `<a class="button" href="${escape(android)}">Download for Android</a>` : ''}` : `<h1>This invite has expired</h1><p class="lead">The person who shared it may have changed their username. You can still join Riffs.</p><a class="button primary" href="${escape(webApp)}">Go to Riffs</a>`;
    return page(row ? `${row.name} invited you to Riffs` : 'Riffs', body, null, 'Rate music, post hot takes, and find people with your taste.');
  }

  /**
   * Public preview of a shared post, so a link sent to someone without the app still shows the take
   * and gives link unfurlers (WhatsApp, iMessage) a cover image. Only public posts are shown.
   */
  async function postLanding(id) {
    const p = await db.get("SELECT p.*, u.handle, u.name FROM posts p JOIN users u ON u.id=p.user_id WHERE p.id=? AND p.visibility='public'", id);
    const items = p ? JSON.parse(p.items || '[]') : [];
    const cover = items.find((i) => typeof i?.artwork === 'string' && i.artwork.startsWith('https://'))?.artwork;
    const rating = p?.kind === 'review' ? await db.get('SELECT score FROM ratings WHERE post_id=?', p.id) : null;
    const lead = !p ? '' : p.kind === 'review' ? `${p.name} rated ${items[0]?.title ?? 'this'}${rating ? ` ${rating.score}/10` : ''}`
      : p.kind === 'take' ? `${p.name} posted a ${JSON.parse(p.meta || '{}').poll ? 'poll' : 'hot take'}` : `${p.name} shared ${p.title}`;
    const quote = !p ? '' : p.kind === 'review' ? p.subtitle : p.kind === 'take' ? p.title : p.subtitle;
    const web = `${webApp}/ranking/${encodeURIComponent(id)}`;
    const body = p ? `<p class="eyebrow">On Riffs</p><h1>${escape(lead)}</h1>
${quote ? `<p class="quote">“${escape(quote)}”</p>` : ''}
${cover ? `<img class="cover" src="${escape(cover)}" alt="">` : ''}
<p class="list">${items.slice(0, 5).map((i) => `<span>${escape(i.title)} · ${escape(i.artist)}</span>`).join('')}</p>
<a class="button primary" href="${escape(web)}">See it on Riffs</a>
<a class="button" href="marginmusic://ranking/${escape(encodeURIComponent(id))}">Open in the Riffs app</a>
<a class="button" href="/join/${escape(p.handle)}">Join @${escape(p.handle)} on Riffs</a>` : `<h1>This post isn’t available</h1><p class="lead">It may be private or deleted.</p><a class="button primary" href="${escape(webApp)}">Go to Riffs</a>`;
    return page(p ? lead : 'Riffs', body, cover, quote);
  }

  async function stats() {
    const today = dayOf(), week = dayOf(Date.now() - 6 * DAY), month = dayOf(Date.now() - 29 * DAY);
    const since = new Date(Date.now() - 7 * DAY).toISOString();
    const active = async (from) => (await db.get(`SELECT COUNT(DISTINCT a.user_id) AS n FROM active_days a JOIN users u ON u.id=a.user_id WHERE a.day>=? AND ${REAL}`, from)).n;
    const [users, fresh, dau, wau, mau, posts, ratings, comments, messages, invited, inviters, feedback] = await Promise.all([
      db.get(`SELECT COUNT(*) AS n FROM users u WHERE ${REAL}`),
      db.get(`SELECT COUNT(*) AS n FROM users u WHERE ${REAL} AND u.created_at>=?`, since),
      active(today), active(week), active(month),
      db.all(`SELECT p.kind, COUNT(*) AS n FROM posts p JOIN users u ON u.id=p.user_id WHERE ${REAL} AND p.created_at>=? GROUP BY p.kind ORDER BY n DESC`, since),
      db.get(`SELECT COUNT(*) AS n FROM ratings r JOIN users u ON u.id=r.user_id WHERE ${REAL} AND r.created_at>=?`, since),
      db.get(`SELECT COUNT(*) AS n FROM comments c JOIN users u ON u.id=c.user_id WHERE ${REAL} AND c.created_at>=?`, since),
      db.get(`SELECT COUNT(*) AS n FROM messages m JOIN users u ON u.id=m.sender_id WHERE ${REAL} AND m.created_at>=?`, since),
      db.get(`SELECT COUNT(*) AS n FROM users u WHERE ${REAL} AND u.invited_by IS NOT NULL`),
      db.all(`SELECT i.handle, COUNT(*) AS joined FROM users u JOIN users i ON i.id=u.invited_by WHERE ${REAL} GROUP BY i.id ORDER BY joined DESC LIMIT 5`),
      db.get('SELECT COUNT(*) AS n FROM feedback WHERE resolved=0'),
    ]);
    // Signup-week cohorts: did people come back the next day, in their second week, and a month later?
    const cohortUsers = await db.all(`SELECT u.id, u.created_at FROM users u WHERE ${REAL} AND u.created_at>=?`, new Date(Date.now() - 56 * DAY).toISOString());
    const days = await db.all(`SELECT a.user_id, a.day FROM active_days a JOIN users u ON u.id=a.user_id WHERE ${REAL} AND u.created_at>=?`, new Date(Date.now() - 56 * DAY).toISOString());
    const byUser = new Map();
    for (const d of days) { if (!byUser.has(d.user_id)) byUser.set(d.user_id, new Set()); byUser.get(d.user_id).add(d.day); }
    const cohorts = new Map();
    for (const u of cohortUsers) {
      const start = Date.parse(u.created_at.slice(0, 10));
      const monday = new Date(start); monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
      const key = dayOf(monday.getTime());
      const seenDays = byUser.get(u.id) || new Set();
      const within = (from, to) => { for (let t = from; t <= to; t++) if (seenDays.has(dayOf(start + t * DAY))) return true; return false; };
      const elapsed = Math.floor((Date.now() - start) / DAY);
      const c = cohorts.get(key) || { week: key, signups: 0, d1: [0, 0], w2: [0, 0], d30: [0, 0] };
      c.signups++;
      if (elapsed >= 1) { c.d1[1]++; if (within(1, 1)) c.d1[0]++; }
      if (elapsed >= 13) { c.w2[1]++; if (within(7, 13)) c.w2[0]++; }
      if (elapsed >= 36) { c.d30[1]++; if (within(30, 36)) c.d30[0]++; }
      cohorts.set(key, c);
    }
    const pct = ([hit, of]) => (of ? Math.round((hit / of) * 100) : null);
    return {
      users: users.n, newThisWeek: fresh.n, dau, wau, mau, stickiness: mau ? Math.round((dau / mau) * 100) : null,
      lastSevenDays: { posts: Object.fromEntries(posts.map((p) => [p.kind, p.n])), ratings: ratings.n, comments: comments.n, messages: messages.n },
      invites: { joined: invited.n, topInviters: inviters.map((i) => ({ handle: `@${i.handle}`, joined: i.joined })) },
      retention: [...cohorts.values()].sort((a, b) => b.week.localeCompare(a.week)).map((c) => ({ week: c.week, signups: c.signups, nextDay: pct(c.d1), secondWeek: pct(c.w2), month: pct(c.d30) })),
      openFeedback: feedback.n,
    };
  }

  /** Routes for signed-in and anonymous users. */
  async function routes({ path, method, body, user, url, send, rate, peer }) {
    const done = (data, status = 200) => { send(data, status); return true; };
    const invite = path.match(/^\/api\/invites\/([a-z0-9_]{3,24})$/i);
    if (invite && method === 'GET') {
      const row = await db.get('SELECT * FROM users WHERE handle=?', invite[1].toLowerCase());
      if (!row) fail(404, 'This invite isn’t valid any more.');
      return done({ inviter: profile(row) });
    }
    if (path === '/api/me/invites' && method === 'GET') {
      if (!user) fail(401, 'Sign in to continue.');
      const rows = await db.all('SELECT * FROM users WHERE invited_by=? ORDER BY created_at DESC LIMIT 50', user.id);
      return done({ joined: rows.map(profile) });
    }
    if (path === '/api/feedback' && method === 'POST') {
      rate(`feedback:${user?.id || peer}`, 10, 3600000);
      const message = text(body.text, 'Feedback', 3, 2000);
      const context = text(body.context || '', 'Context', 0, 200);
      const platform = ['ios', 'android', 'web'].includes(body.platform) ? body.platform : 'unknown';
      const version = text(body.version || '', 'Version', 0, 20);
      await db.run('INSERT INTO feedback (id, user_id, text, context, platform, version, created_at, resolved) VALUES (?,?,?,?,?,?,?,0)',
        randomUUID(), user?.id || null, message, context, platform, version, new Date().toISOString());
      return done({ ok: true }, 201);
    }
    void url;
    return false;
  }

  /** Admin-only routes; the caller has already checked the admin token. */
  async function admin({ path, method, send }) {
    if (path === '/api/admin/stats' && method === 'GET') { send(await stats()); return true; }
    if (path === '/api/admin/feedback' && method === 'GET') {
      send({ feedback: await db.all('SELECT f.id, f.text, f.context, f.platform, f.version, f.created_at, u.handle FROM feedback f LEFT JOIN users u ON u.id=f.user_id WHERE f.resolved=0 ORDER BY f.created_at DESC LIMIT 200') });
      return true;
    }
    const item = path.match(/^\/api\/admin\/feedback\/([a-zA-Z0-9-]+)$/);
    if (item && method === 'PATCH') {
      const result = await db.run('UPDATE feedback SET resolved=1 WHERE id=?', item[1]);
      if (!result.rowsAffected) fail(404, 'Feedback not found.');
      send({ ok: true }); return true;
    }
    return false;
  }

  return { seen, joined, landing, postLanding, routes, admin, stats };
}

import { randomUUID } from 'node:crypto';

// Durable jobs survive restarts; delivery never blocks a social write. Payloads omit private text.
export function pushService({ db, fetcher, getPost }) {
  const configured = () => process.env.PUSH_ENABLED === '1';
  let working = false;
  async function enqueue(userId, actorId, kind, postId = null, conversationId = null) {
    if (!configured() || userId === actorId) return;
    if (await db.get('SELECT 1 FROM blocks WHERE (user_id=? AND blocked_id=?) OR (user_id=? AND blocked_id=?)', userId, actorId, actorId, userId)) return;
    const tokens = await db.all('SELECT t.token FROM push_tokens t JOIN users u ON u.id=t.user_id JOIN sessions s ON s.token_hash=t.session_hash WHERE t.user_id=? AND u.push_enabled=1 AND s.expires_at>?', userId, Date.now());
    if (tokens.length) await db.batch(tokens.map((t) => ({ sql: 'INSERT INTO push_jobs (id,user_id,actor_id,post_id,conversation_id,token,kind,due_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)', args: [randomUUID(), userId, actorId, postId, conversationId, t.token, kind, Date.now(), Date.now()] })));
  }
  async function eligible(job) {
    const valid = await db.get(`SELECT 1 FROM push_tokens t JOIN users u ON u.id=t.user_id JOIN sessions s ON s.token_hash=t.session_hash WHERE t.token=? AND t.user_id=? AND u.push_enabled=1 AND s.expires_at>? AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.blocked_id=?) OR (b.user_id=? AND b.blocked_id=?))`, job.token, job.user_id, Date.now(), job.user_id, job.actor_id, job.actor_id, job.user_id);
    if (!valid) return false;
    if (job.post_id) { try { await getPost(job.post_id, job.user_id); } catch { return false; } }
    if (job.conversation_id && !await db.get(`SELECT 1 FROM conversation_members m WHERE m.conversation_id=? AND m.user_id=? AND NOT EXISTS(SELECT 1 FROM conversation_members x JOIN blocks b ON ((b.user_id=? AND b.blocked_id=x.user_id) OR (b.blocked_id=? AND b.user_id=x.user_id)) WHERE x.conversation_id=m.conversation_id)`, job.conversation_id, job.user_id, job.user_id, job.user_id)) return false;
    return true;
  }
  async function call(path, body) {
    const res = await fetcher(`https://exp.host/--/api/v2/push/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error('Push unavailable'); return res.json();
  }
  async function flush() {
    if (working || !configured()) return; working = true;
    try {
      const jobs = await db.all('SELECT * FROM push_jobs WHERE due_at<=? ORDER BY due_at LIMIT 100', Date.now());
      for (const job of jobs) {
        if (!await eligible(job) || job.attempts >= 5 || Date.now() - job.created_at > 86400000) { await db.run('DELETE FROM push_jobs WHERE id=?', job.id); continue; }
        try {
          const result = job.ticket ? (await call('getReceipts', { ids: [job.ticket] })).data?.[job.ticket] : (await call('send', [{ to: job.token, sound: 'default', title: 'Riffs', body: job.kind === 'message' ? 'You have a new message.' : 'There’s new activity on Riffs.', data: job.conversation_id ? { conversationId: job.conversation_id } : { postId: job.post_id }, ttl: 3600 }])).data?.[0];
          if (result?.details?.error === 'DeviceNotRegistered') { await db.run('DELETE FROM push_tokens WHERE token=?', job.token); continue; }
          if (!result || result.status !== 'ok') throw new Error('Push not accepted');
          if (job.ticket) await db.run('DELETE FROM push_jobs WHERE id=?', job.id);
          else if (result.id) await db.run('UPDATE push_jobs SET ticket=?,due_at=?,attempts=0 WHERE id=?', result.id, Date.now() + 900000, job.id);
          else throw new Error('Missing push ticket');
        } catch { await db.run('UPDATE push_jobs SET attempts=attempts+1,due_at=? WHERE id=?', Date.now() + Math.min(3600000, 30000 * 2 ** job.attempts), job.id); }
      }
    } finally { working = false; }
  }
  const timer = setInterval(() => { flush().catch(() => {}); }, 5000).unref();
  return { configured, enqueue, flush, close: () => clearInterval(timer) };
}

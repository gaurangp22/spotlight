const demoListener = 'margin-demo-demo_listener';
const actors = ['mira', 'dev', 'asha'].map((name) => `margin-demo-demo_${name}`);

/** Local demo simulation. Only the dedicated demo listener's public, user-created posts qualify. */
export async function respondToDemoPosts(db) {
  if (process.env.NODE_ENV === 'production' || process.env.TURSO_DATABASE_URL || db.mode !== 'sqlite') throw new Error('Demo bots are local-development only.');
  const posts = await db.all("SELECT p.* FROM posts p WHERE p.user_id=? AND p.visibility='public' AND p.id NOT LIKE 'margin-demo-%' AND NOT EXISTS (SELECT 1 FROM comments c WHERE c.id='margin-demo-live-comment-' || p.id || '-0') ORDER BY p.created_at LIMIT 3", demoListener);
  for (const post of posts) {
    const marker = `margin-demo-live-comment-${post.id}-0`;
    if (await db.get('SELECT 1 AS done FROM comments WHERE id=?', marker)) continue;
    const people = await db.all(`SELECT u.id FROM users u WHERE u.id IN (${actors.map(() => '?').join(',')}) AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.blocked_id=u.id) OR (b.blocked_id=? AND b.user_id=u.id))`, ...actors, demoListener, demoListener);
    const allowed = actors.filter((actor) => people.some((person) => person.id === actor));
    if (!allowed.length) continue;
    const items = JSON.parse(post.items);
    const poll = post.kind === 'take' && JSON.parse(post.meta || '{}').poll;
    const now = new Date().toISOString();
    const statements = [];
    const add = (sql, ...args) => statements.push({ sql, args });
    allowed.forEach((actor, i) => {
      const choice = (post.id.charCodeAt(0) + i) % 2;
      const line = poll ? `I picked ${items[choice].title} today. Curious where everyone lands.` : i === 0 && items[0] ? `Adding ${items[0].title} to my next-listen list. What pulled you into it?` : ['What would you recommend listening to after this?', 'I like the idea. The best music conversations start with a different opinion.', 'Worth another listen with headphones. That is usually where I hear something new.'][i];
      add('INSERT INTO reactions (user_id,post_id) VALUES (?,?) ON CONFLICT DO NOTHING', actor, post.id);
      add('INSERT INTO comments (id,user_id,post_id,text,created_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING', `margin-demo-live-comment-${post.id}-${i}`, actor, post.id, line, now);
      if (poll) add('INSERT INTO poll_votes (user_id,post_id,choice,created_at) VALUES (?,?,?,?) ON CONFLICT DO NOTHING', actor, post.id, choice, now);
      add('INSERT INTO notifications (id,user_id,actor_id,post_id,kind,seen,created_at) VALUES (?,?,?,?,?,0,?) ON CONFLICT(id) DO NOTHING', `margin-demo-live-note-${post.id}-${i}`, demoListener, actor, post.id, 'comment', now);
    });
    // The statement gate handles a post deleted while the timer was reading it.
    if (await db.get('SELECT 1 AS present FROM posts WHERE id=?', post.id)) {
      try { await db.batch(statements); } catch (error) {
        if (await db.get('SELECT 1 AS present FROM posts WHERE id=?', post.id)) throw error;
      }
    }
  }
}

export function startDemoBots(db, intervalMs = 12000) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await respondToDemoPosts(db); } catch (error) { console.error('Demo bot simulation:', error.message); }
    finally { running = false; }
  };
  const timer = setInterval(() => void tick(), intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}

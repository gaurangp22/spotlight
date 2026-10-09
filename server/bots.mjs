import { digest, hashPassword, randomToken } from './security.mjs';

// House bots keep Riffs feeling alive while the community is small. They are always labelled as bots,
// act only through the public API (so every privacy, block, and validation rule applies to them),
// post real music from the public catalog, and engage with real people within strict daily limits.
// Anyone can switch them off in Settings; they never count in founder stats.

const HOUR = 3600000, DAY = 24 * HOUR;
const pick = (list, random) => list[Math.floor(random() * list.length) % list.length];

export const PERSONAS = [
  { handle: 'riffs_radio', name: 'Riffs Radio', status: 'On air: today’s pick',
    bio: 'The Riffs house bot. Daily picks, polls, and a hello when you join. I’m a bot — you can hide bots in Settings.',
    artists: ['Arctic Monkeys', 'Kendrick Lamar', 'Taylor Swift', 'Prateek Kuhad', 'Frank Ocean', 'Tame Impala', 'Radiohead', 'SZA'],
    takes: ['Albums are better than playlists. Fight me.', 'The best song on an album is almost never the single.', 'Your first listen of a great album is a moment you never get back.', 'A perfect closing track can rescue a whole record.', 'Hot take: deluxe editions make good albums worse.'] },
  { handle: 'desi_decks', name: 'Desi Decks', status: 'Looping Prateek Kuhad on the metro',
    bio: 'Indie, Punjabi, Bollywood, and everything in between. A Riffs bot with very strong opinions about mixtapes.',
    artists: ['Prateek Kuhad', 'AP Dhillon', 'Diljit Dosanjh', 'Arijit Singh', 'A. R. Rahman', 'Seedhe Maut', 'The Local Train', 'Anuv Jain'],
    takes: ['Indian indie is having its best decade and nobody is talking about it enough.', 'A. R. Rahman scored half of everyone’s childhood.', 'Punjabi pop runs every wedding and every gym, and that’s a compliment.', 'Seedhe Maut deserve stadium stages.', 'Every Anuv Jain song is a voice note from your heart.'] },
  { handle: 'bars_only', name: 'Bars Only', status: 'Rewinding the second verse',
    bio: 'Hip-hop and R&B, lyric-first. I’m a Riffs bot — I rate what I can’t stop replaying.',
    artists: ['Kendrick Lamar', 'Frank Ocean', 'Tyler, The Creator', 'SZA', 'J. Cole', 'Travis Scott', 'Kanye West', 'Doechii'],
    takes: ['To Pimp a Butterfly is the best rap album of the 2010s. Not close.', 'Frank Ocean releasing nothing is still more interesting than most releases.', 'Tyler, The Creator has the best album-to-album growth of his generation.', 'Production carries more rap albums than people admit.', 'A great feature verse can outshine the whole song.'] },
  { handle: 'pop_oracle', name: 'Pop Oracle', status: 'Predicting the next earworm',
    bio: 'Pop, charts, and big choruses. A Riffs bot that thinks a bridge can change your life.',
    artists: ['Taylor Swift', 'Dua Lipa', 'The Weeknd', 'Olivia Rodrigo', 'Charli xcx', 'Sabrina Carpenter', 'Billie Eilish', 'Lorde'],
    takes: ['A perfect bridge is the most underrated part of pop music.', 'Melodrama is the best pop album of the last ten years.', 'Brat changed what a pop album could sound like.', 'Every great pop song is a sad song in disguise.', 'Pop gets called simple by people who have never tried to write a hook.'] },
  { handle: 'indie_hours', name: 'Indie Hours', status: 'Headphones on, curtains closed',
    bio: 'Bedroom pop, guitars, and late-night records. A Riffs bot for people who read liner notes.',
    artists: ['Arctic Monkeys', 'Tame Impala', 'Mitski', 'Phoebe Bridgers', 'The 1975', 'Cigarettes After Sex', 'Mac DeMarco', 'Beach House'],
    takes: ['AM is good but Favourite Worst Nightmare is better.', 'Currents is a breakup album you can dance to.', 'Mitski writes the songs you only admit to liking at 2 a.m.', 'Indie music peaked when every song sounded like a summer you never had.', 'Some albums are only for headphones. Beach House makes most of them.'] },
  { handle: 'crate_digger', name: 'Crate Digger', status: 'Flipping through the dollar bin',
    bio: 'Classics, soul, jazz, and records older than your parents. A Riffs bot that judges albums by their B-sides.',
    artists: ['Radiohead', 'Fleetwood Mac', 'Pink Floyd', 'Marvin Gaye', 'Portishead', 'Talking Heads', 'Miles Davis', 'Daft Punk'],
    takes: ['Rumours is the most listenable album ever made.', 'Kid A sounded like the future and still does.', 'What’s Going On is more relevant now than in 1971.', 'Discovery by Daft Punk is a perfect album. Every track.', 'Old records aren’t better. The ones that survived are.'] },
];

const REVIEW = {
  2: ['{title} still sounds like nothing else.', 'Front to back, no skips. {artist} at their best.', 'The kind of record you build a whole week around.', 'Every time I come back to {title}, I hear something new.', 'This is the one I’d hand to someone who “doesn’t get” {artist}.', 'Ten out of ten moods. Headphones strongly advised.'],
  1: ['Some highs, some filler. Worth another listen.', '{title} has moments — just not enough of them.', 'Good, not great. The best songs are really good, though.', 'I like it more than I respect it. Or is it the other way round?'],
  0: ['I wanted to love {title}. It never quite landed for me.', 'Not for me — but I get why people swear by it.', 'Everyone told me this was a classic. I’m still waiting.'],
};
const POLLS = ['Which one are you running back tonight?', 'One album for a long drive. Pick.', 'Settle it: which is the better record?', 'Only one stays on the playlist. Which?', 'Which one would you play for someone new to {artist}?'];
const REPLIES = {
  review: ['{score} for {title}? I respect it. What’s the standout track for you?', 'Adding {title} to my queue on your word.', 'Love seeing {artist} get some love in here.', 'What would you play right after {title}?'],
  take: ['Okay, this is going to start a debate.', 'Strong take. Who’s agreeing and who’s fighting it?', 'I’d argue the opposite — but I respect the conviction.', 'Saving this one for the next group chat argument.'],
  pod: ['Great pod. A few of these are going straight into my rotation.', 'This collection has a real mood to it.'],
  other: ['This is the kind of post Riffs is for.', 'Taking notes. Good list.'],
};
const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ''));

export const botId = (handle) => `riffs-bot-${handle}`;

/** Creates or refreshes the bot accounts. Bot accounts can't be signed into: their password is random and discarded. */
export async function ensureBots(db) {
  for (const p of PERSONAS) {
    const id = botId(p.handle);
    const exists = await db.get('SELECT id FROM users WHERE id=?', id);
    if (exists) await db.run('UPDATE users SET name=?, bio=?, status=?, is_bot=1, onboarding_complete=1 WHERE id=?', p.name, p.bio, p.status, id);
    else await db.run('INSERT INTO users (id,email,handle,name,bio,password,created_at,status,is_bot,onboarding_complete,email_verified) VALUES (?,?,?,?,?,?,?,?,1,1,1)',
      id, `${p.handle}@bots.riffs.invalid`, p.handle, p.name, p.bio, await hashPassword(randomToken() + randomToken()), new Date().toISOString(), p.status);
  }
}

export function createBotEngine({ db, base, fetcher = fetch, random = Math.random, now = () => Date.now(), dailyPosts = Number(process.env.BOT_DAILY_POSTS || 8), gapMs = Number(process.env.BOT_POST_GAP_MINUTES || 45) * 60000, log = console }) {
  const tokens = new Map();
  const catalogCache = new Map();
  let warned = false;

  async function sessions() {
    if (tokens.size) return;
    await db.run(`DELETE FROM sessions WHERE user_id IN (${PERSONAS.map(() => '?').join(',')})`, ...PERSONAS.map((p) => botId(p.handle)));
    for (const p of PERSONAS) {
      const token = randomToken();
      await db.run('INSERT INTO sessions VALUES (?, ?, ?)', digest(token), botId(p.handle), now() + 3650 * DAY);
      tokens.set(p.handle, token);
    }
  }
  async function call(handle, path, method = 'GET', body) {
    const response = await fetch(`${base}/api${path}`, { method, headers: { Authorization: `Bearer ${tokens.get(handle)}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error || `HTTP ${response.status}`), { status: response.status });
    return data;
  }
  const record = (bot, target, kind, recipient = null) => db.run('INSERT OR IGNORE INTO bot_actions (bot_id, target, kind, recipient, created_at) VALUES (?,?,?,?,?)', botId(bot), target, kind, recipient, new Date(now()).toISOString());

  /** Real albums and songs for an artist from Apple's public catalog, cached for six hours. */
  async function catalog(artist, entity) {
    const key = `${artist}:${entity}`;
    const hit = catalogCache.get(key);
    if (hit && hit.until > now()) return hit.items;
    const response = await fetcher(`https://itunes.apple.com/search?${new URLSearchParams({ term: artist, entity, limit: '25', country: 'IN' })}`, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Catalog unavailable');
    const { results = [] } = await response.json();
    const wanted = artist.toLowerCase();
    const items = results.filter((r) => r.artistName?.toLowerCase().includes(wanted) && (r.artworkUrl100 || r.artworkUrl600)).map((r) => entity === 'album'
      ? { id: `album-${r.collectionId}`, kind: 'album', title: r.collectionName, artist: r.artistName, artwork: (r.artworkUrl600 || r.artworkUrl100).replace('100x100bb', '600x600bb'), ...(r.collectionViewUrl ? { externalUrl: r.collectionViewUrl } : {}) }
      : { id: `song-${r.trackId}`, kind: 'song', title: r.trackName, artist: r.artistName, album: r.collectionName, artwork: (r.artworkUrl600 || r.artworkUrl100).replace('100x100bb', '600x600bb'), ...(r.trackViewUrl ? { externalUrl: r.trackViewUrl } : {}) })
      .filter((i) => i.title && !/(karaoke|instrumental|tribute)/i.test(i.title));
    catalogCache.set(key, { items, until: now() + 6 * HOUR });
    return items;
  }

  /** One new post from one bot: a review, a hot take, or a poll, at most `dailyPosts` a day across all bots. */
  async function publish() {
    const since = new Date(now() - DAY).toISOString();
    const recent = await db.all(`SELECT p.created_at FROM posts p JOIN users u ON u.id=p.user_id WHERE u.is_bot=1 AND p.created_at>=? ORDER BY p.created_at DESC`, since);
    if (recent.length >= dailyPosts) return null;
    if (recent[0] && now() - Date.parse(recent[0].created_at) < gapMs) return null;
    const persona = PERSONAS[Math.floor(now() / gapMs + recent.length) % PERSONAS.length];
    const artist = pick(persona.artists, random);
    const roll = random();
    if (roll < 0.5) {
      const entity = random() < 0.65 ? 'album' : 'song';
      const items = await catalog(artist, entity);
      if (!items.length) return null;
      const item = pick(items.slice(0, 12), random);
      const tierRoll = random(), tier = tierRoll < 0.68 ? 2 : tierRoll < 0.92 ? 1 : 0;
      const result = await call(persona.handle, '/ratings', 'POST', { item, tier, position: Math.floor(random() * 4), review: fill(pick(REVIEW[tier], random), { title: item.title, artist: item.artist }), visibility: 'public' });
      return result.post;
    }
    if (roll < 0.8) {
      const items = random() < 0.6 ? await catalog(artist, 'album') : [];
      const attach = items.length ? [pick(items.slice(0, 10), random)] : [];
      return (await call(persona.handle, '/posts', 'POST', { kind: 'take', title: pick(persona.takes, random), items: attach, visibility: 'public' })).post;
    }
    const albums = (await catalog(artist, 'album')).slice(0, 10);
    if (albums.length < 2) return null;
    const first = pick(albums, random);
    const second = pick(albums.filter((a) => a.id !== first.id), random);
    return (await call(persona.handle, '/posts', 'POST', { kind: 'take', poll: true, title: fill(pick(POLLS, random), { artist }), items: [first, second], visibility: 'public' })).post;
  }

  /** Likes, poll votes, and the occasional reply on real people's recent public posts. */
  async function engage(limit = 6) {
    const since = new Date(now() - 2 * DAY).toISOString();
    const posts = await db.all(`SELECT p.id, p.kind, p.title, p.items, p.meta, p.user_id, (SELECT score FROM ratings r WHERE r.post_id=p.id) AS score,
      (SELECT COUNT(*) FROM posts q WHERE q.user_id=p.user_id) AS authored
      FROM posts p JOIN users u ON u.id=p.user_id
      WHERE u.is_bot=0 AND u.show_bots=1 AND u.email NOT LIKE '%@demo.margin.invalid' AND p.visibility='public' AND p.created_at>=?
        AND NOT EXISTS (SELECT 1 FROM bot_actions a WHERE a.target=p.id AND a.kind='like')
      ORDER BY p.created_at DESC LIMIT ?`, since, limit);
    let actions = 0;
    for (const post of posts) {
      const items = JSON.parse(post.items || '[]');
      const artist = (items[0]?.kind === 'artist' ? items[0]?.title : items[0]?.artist || '').toLowerCase();
      // Prefer the bot whose taste matches what was posted.
      const fan = PERSONAS.find((p) => p.handle !== 'riffs_radio' && p.artists.some((a) => a.toLowerCase() === artist));
      const bot = fan ?? pick(PERSONAS, random);
      try {
        await call(bot.handle, `/posts/${post.id}/reaction`, 'PUT');
        await record(bot.handle, post.id, 'like', post.user_id); actions++;
        if (post.kind === 'take' && JSON.parse(post.meta || '{}').poll) { await call(bot.handle, `/posts/${post.id}/vote`, 'PUT', { choice: random() < 0.5 ? 0 : 1 }); await record(bot.handle, post.id, 'vote', post.user_id); }
        // Replies are rarer: always on someone's first few posts, sometimes after that, never more than two a day per person.
        const today = new Date(now() - DAY).toISOString();
        const replied = (await db.get("SELECT COUNT(*) AS n FROM bot_actions WHERE recipient=? AND kind='comment' AND created_at>=?", post.user_id, today)).n;
        if (replied < 2 && (post.authored <= 3 || random() < 0.35)) {
          const kind = REPLIES[post.kind] ? post.kind : 'other';
          const text = fill(pick(REPLIES[kind], random), { title: items[0]?.title ?? 'this', artist: items[0]?.artist ?? 'them', score: post.score ?? '' });
          await call(bot.handle, `/posts/${post.id}/comments`, 'POST', { text });
          await record(bot.handle, post.id, 'comment', post.user_id);
        }
      } catch (error) {
        // Blocked, deleted, or made private since we looked: never retry this post.
        await record(bot.handle, post.id, 'like', post.user_id);
        if (error.status !== 404 && error.status !== 403) throw error;
      }
    }
    return actions;
  }

  /** Riffs Radio follows new people so their first notification isn't silence. */
  async function welcome() {
    const since = new Date(now() - 3 * DAY).toISOString();
    const fresh = await db.all(`SELECT u.id, u.handle FROM users u WHERE u.is_bot=0 AND u.show_bots=1 AND u.email NOT LIKE '%@demo.margin.invalid' AND u.created_at>=?
      AND NOT EXISTS (SELECT 1 FROM bot_actions a WHERE a.target=u.id AND a.kind='welcome') LIMIT 20`, since);
    for (const person of fresh) {
      try { await call('riffs_radio', `/people/${person.handle}/follow`, 'PUT'); } catch (error) { if (error.status >= 500) throw error; }
      await record('riffs_radio', person.id, 'welcome', person.id);
    }
    return fresh.length;
  }

  async function tick() {
    await sessions();
    const result = { posted: null, engaged: 0, welcomed: 0 };
    for (const [name, step] of [['welcomed', welcome], ['engaged', engage], ['posted', publish]]) {
      try { result[name] = await step(); }
      catch (error) { if (!warned) { log.warn?.(`Riffs bots: ${name} failed (${error.message}). Will keep trying quietly.`); warned = true; } }
    }
    return result;
  }

  function start(intervalMs = Number(process.env.BOT_INTERVAL_MINUTES || 5) * 60000) {
    let running = false;
    const run = async () => { if (running) return; running = true; try { await tick(); } finally { running = false; } };
    const first = setTimeout(() => void run(), 15000); first.unref();
    const timer = setInterval(() => void run(), intervalMs); timer.unref();
    return () => { clearTimeout(first); clearInterval(timer); };
  }

  return { tick, publish, engage, welcome, start };
}

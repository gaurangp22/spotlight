import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openDatabase } from './db.mjs';
import { tierScores, validateItem, validatePost } from './api.mjs';
import { hashPassword } from './security.mjs';
import { currentWeek } from './community.mjs';

export const DEMO_CREDENTIALS = { email: 'listener@demo.margin.invalid', password: 'MarginDemo2026!', handle: 'demo_listener' };
const prefix = 'margin-demo-';
const catalog = JSON.parse(readFileSync(new URL('./demo/catalog.json', import.meta.url), 'utf8')).artists;
const personas = [
  ['mira', 'Mira', 'Radiohead', 'Frank Ocean', 'Headphones on. In Rainbows again.', 'Records that reveal something on the tenth listen.', 'A great album does not need a skip button.', 'The quietest song on an album is usually the one that stays with me.'],
  ['dev', 'Dev', 'A. R. Rahman', 'Anuv Jain', 'The train ride needs a soundtrack.', 'Film scores, Hindi indie, and songs for long journeys.', 'A. R. Rahman makes a five-minute song feel like a whole film.', 'A song from your childhood can bring back an entire place.'],
  ['asha', 'Asha', 'Charli xcx', 'Sabrina Carpenter', 'Pop music, no guilty pleasures.', 'Big hooks and bigger opinions. Demo pop obsessive.', 'There is no such thing as a guilty pleasure if the song is good.', 'A perfect chorus is harder to write than people think.'],
  ['kabir', 'Kabir', 'Kendrick Lamar', 'Frank Ocean', 'Reading the lyrics on the second listen.', 'Hip-hop albums deserve a front-to-back listen.', 'The best rap albums reward reading the lyrics as much as hearing them.', 'Production can tell a story before the first verse starts.'],
  ['zoe', 'Zoe', 'Billie Eilish', 'Lorde', 'Soft vocals. Loud feelings.', 'For the songs that make a room go quiet.', 'Whispered vocals can hit harder than the loudest chorus.', 'The space between the notes is part of the song.'],
  ['arjun', 'Arjun', 'AP Dhillon', 'Anuv Jain', 'Punjabi hooks for the evening drive.', 'Punjabi pop, indie discoveries, and late drives.', 'A great Punjabi hook works before you even learn all the words.', 'Your driving playlist says more about you than your bio.'],
  ['noor', 'Noor', 'Anuv Jain', 'A. R. Rahman', 'Acoustic songs and the window seat.', 'Small arrangements, honest writing. Demo indie listener.', 'You do not need a huge arrangement to make a huge feeling.', 'Some songs belong to a season, even if you hear them all year.'],
  ['leo', 'Leo', 'Tame Impala', 'Daft Punk', 'Looking for that bassline.', 'Psychedelic pop and electronic music, with headphones.', 'A bassline can carry a whole song without anyone noticing.', 'The right electronic album makes a boring walk feel cinematic.'],
  ['ivy', 'Ivy', 'Lorde', 'Billie Eilish', 'Albums for the walk home.', 'Coming-of-age albums and beautifully specific lyrics.', 'The best coming-of-age records still make sense when you grow up.', 'A specific lyric is more universal than a vague one.'],
  ['sam', 'Sam', 'Daft Punk', 'Tame Impala', 'One more time means one more time.', 'Dance music, disco, and drums you can feel.', 'Dance music deserves the same close listening as any other genre.', 'A four-minute song can change the energy of an entire night.'],
  ['ria', 'Ria', 'Sabrina Carpenter', 'Charli xcx', 'A chorus stuck in my head all day.', 'New pop releases, melodic hooks, and zero gatekeeping.', 'If the chorus gets stuck in your head, the songwriter did their job.', 'A good pop album can be smart and fun at the same time.'],
  ['ellis', 'Ellis', 'Frank Ocean', 'Kendrick Lamar', 'One album, start to finish.', 'R&B, layered production, and albums over algorithms.', 'Listening to an album in order is a different experience from shuffling it.', 'Some records need patience. They meet you halfway eventually.'],
];
const uid = (handle) => `${prefix}${handle}`;
const song = (item) => validateItem(item);
const tracks = (artist) => catalog[artist].map(song);
const foundation = tracks('Radiohead').slice(0, 3);
const dedupe = (items) => [...new Map(items.map((item) => [item.id, item])).values()];
function albums(artist) {
  return [...new Map(catalog[artist].filter((item) => item.collectionId).map((item) => [item.collectionId, validateItem({ id: `album-${item.collectionId}`, title: item.album, artist: item.artist, kind: 'album', artwork: item.artwork, externalUrl: item.collectionUrl })])).values()].slice(0, 2);
}

function assertLocal(db) {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo seeding is disabled in production.');
  if (db.mode !== 'sqlite' || process.env.TURSO_DATABASE_URL) throw new Error('Demo seeding only supports a local SQLite database.');
}

/** Insert a labelled demo community. Re-running preserves real users and edits to existing demo rows. */
export async function seedDemo(db, { now = Date.now() } = {}) {
  assertLocal(db);
  const statements = [];
  const age = (hours) => new Date(now - hours * 3600000).toISOString();
  const add = (sql, ...args) => statements.push({ sql, args });
  const people = personas.map(([handle, name, artist, second, status, bio, take, otherTake], index) => ({ handle: `demo_${handle}`, name: `${name} · Bot`, artist, second, status, bio, take, otherTake, index }));
  const listener = { handle: DEMO_CREDENTIALS.handle, name: 'You · Demo', status: 'Exploring the Riffs demo community.', bio: 'A demo listener account. Try voting, reviewing, following, and adding picks to open pods.' };
  const botPassword = await hashPassword(randomBytes(48).toString('hex'));
  const listenerPassword = await hashPassword(DEMO_CREDENTIALS.password);
  for (const person of [...people, listener]) {
    const id = uid(person.handle);
    const existing = await db.get('SELECT handle,email FROM users WHERE id=?', id);
    const email = `${person.handle === listener.handle ? 'listener' : person.handle}@demo.margin.invalid`;
    if (existing && (existing.handle !== person.handle || existing.email !== email)) throw new Error(`Demo ID collision: ${id}`);
    add('INSERT INTO users (id,email,handle,name,bio,password,created_at,status) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING', id, email, person.handle, person.name, person.bio, person === listener ? listenerPassword : botPassword, age(120 + (person.index ?? 0)), person.status);
    if (person === listener) add('UPDATE users SET status=? WHERE id=? AND status=?', 'Exploring the Riffs demo community.', id, 'Exploring the MARGIN demo community.');
  }
  function post(person, key, body, hours) {
    const data = validatePost(body);
    const id = `${prefix}${key}`;
    add('INSERT INTO posts (id,user_id,kind,title,subtitle,items,tiles,theme,visibility,origin_id,created_at,updated_at,meta) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING', id, uid(person.handle), data.kind, data.title, data.subtitle, JSON.stringify(data.items), JSON.stringify(data.tiles), data.theme, data.visibility, data.originId, age(hours), age(hours), JSON.stringify(data.meta));
    return id;
  }
  const reviewIds = new Map();
  function ratings(person, items) {
    const grouped = new Map();
    for (const [index, item] of items.entries()) {
      const tier = person === listener ? (index < 5 ? 2 : 1) : index < 3 ? (person.index % 4 === 2 ? 1 : 2) : index < 6 ? 2 : 1;
      const key = `${item.kind}:${tier}`;
      grouped.set(key, [...(grouped.get(key) ?? []), item]);
    }
    for (const [key, group] of grouped) {
      const tier = Number(key.split(':')[1]);
      const scores = tierScores(tier, group.length);
      group.forEach((item, position) => {
        const id = `${prefix}review-${person.handle.replaceAll('_', '-')}-${item.id}`;
        const created = age(30 + (person.index ?? 0) * 1.5 + position * 0.3);
        const review = person === listener ? 'A favourite worth coming back to. What do you hear in it?' : tier === 2 ? `This is why ${item.artist} keeps finding a way back into my rotation.` : 'I like this one, but a few others in my collection stay with me longer.';
        add('INSERT INTO posts (id,user_id,kind,title,subtitle,items,visibility,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING', id, uid(person.handle), 'review', item.title, review, JSON.stringify([item]), 'public', created, created);
        add('INSERT INTO ratings (user_id,item_id,category,item,tier,position,score,post_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,item_id) DO NOTHING', uid(person.handle), item.id, item.kind, JSON.stringify(item), tier, position, scores[position], id, created, created);
        reviewIds.set(`${person.handle}:${item.id}`, id);
      });
    }
  }
  for (const person of people) ratings(person, dedupe([...foundation, ...tracks(person.artist).slice(0, 3), ...tracks(person.second).slice(0, 2), ...albums(person.artist)]));
  ratings(listener, dedupe([...foundation, ...tracks('Frank Ocean').slice(0, 2), ...tracks('AP Dhillon').slice(0, 2), tracks('Charli xcx')[0]]));

  const social = [];
  for (const person of people) {
    const own = tracks(person.artist);
    const other = tracks(person.second);
    const hour = 0.15 + person.index * 0.38;
    social.push({ id: post(person, `take-${person.index}`, { kind: 'take', title: person.take, items: [own[0]], visibility: 'public' }, hour), owner: person, poll: false });
    social.push({ id: post(person, `thought-${person.index}`, { kind: 'take', title: person.otherTake, items: person.index % 2 ? [] : [own[1]], visibility: 'public' }, 8 + person.index * 0.5), owner: person, poll: false });
    if (person.index < 8) social.push({ id: post(person, `poll-${person.index}`, { kind: 'take', poll: true, title: ['One song for the last train home. Which are you choosing?', 'Which song would you introduce to a friend first?', 'Two very different moods. Which one wins today?', 'One stays in your rotation. One has to go.'][person.index % 4], items: dedupe([own[0], other[0]]), visibility: 'public' }, hour + 1.3), owner: person, poll: true });
    if (person.index < 6) {
      const picks = dedupe([...own.slice(0, 3), ...other.slice(0, 3)]).map((item, index) => index < 3 ? item : { ...item, addedBy: `@${people[(person.index + index) % people.length].handle}` });
      const title = ['The last train home', 'Window-seat songs', 'Pop songs with no skips', 'Lyrics worth pausing for', 'Quiet songs, loud feelings', 'The evening drive'][person.index];
      social.push({ id: post(person, `pod-${person.index}`, { kind: 'pod', title, subtitle: 'A demo community pod. Add a pick and tell us why it belongs.', open: person.index % 2 === 0, items: picks, visibility: 'public' }, hour + 3), owner: person, poll: false });
      social.push({ id: post(person, `ranking-${person.index}`, { kind: 'ranking', title: `Five ${person.artist} songs I keep returning to`, subtitle: 'My order today. Remix it if yours is different.', items: own.slice(0, 5), visibility: 'public' }, hour + 6), owner: person, poll: false });
    }
    if (person.index < 3) social.push({ id: post(person, `mood-${person.index}`, { kind: 'moodboard', title: ['A slow Sunday morning', 'Music for a monsoon window', 'Friday, finally'][person.index], subtitle: 'A demo mood board, with a soundtrack.', items: own.slice(0, 3), tiles: [{ id: `demo-note-${person.index}`, type: 'note', text: ['Coffee cooling. A whole album. Nowhere to rush.', 'Rain outside. Headphones inside.', 'The week is over. Turn it up.'][person.index] }], theme: ['night', 'forest', 'rose'][person.index], visibility: 'public' }, hour + 12), owner: person, poll: false });
  }
  const welcome = post(listener, 'listener-take', { kind: 'take', title: 'Finding my people one album at a time. What should I listen to next?', items: [foundation[0]], visibility: 'public' }, 0.65);
  social.push({ id: welcome, owner: listener, poll: false });
  post(listener, 'listener-ranking', { kind: 'ranking', title: 'My current top five', subtitle: 'A starting point for your own taste. Edit or remix freely.', items: dedupe([...foundation, ...tracks('Frank Ocean').slice(0, 2)]), visibility: 'public' }, 10);
  post(listener, 'listener-private', { kind: 'take', title: 'My private listening note: revisit these records this weekend.', items: [foundation[1]], visibility: 'private' }, 5);
  const replies = ['The second listen is where it clicked for me.', 'I hear it differently, but that is what makes this fun.', 'Adding this to my weekend listening list.', 'The production deserves a whole conversation.', 'What album would you play immediately after this?', 'Headphones make such a difference on this one.'];
  social.forEach(({ id, owner, poll }, index) => {
    people.forEach((person, j) => {
      if (person.handle === owner.handle) return;
      if ((index + j) % 3 !== 0) add('INSERT INTO reactions (user_id,post_id) VALUES (?,?) ON CONFLICT DO NOTHING', uid(person.handle), id);
      if (poll) add('INSERT INTO poll_votes (user_id,post_id,choice,created_at) VALUES (?,?,?,?) ON CONFLICT DO NOTHING', uid(person.handle), id, (index + j * 3) % 2, age(0.1 + j * 0.02));
    });
    for (let j = 0; j < 2 + index % 2; j++) {
      const person = people[((owner.index ?? 0) + j + 1) % people.length];
      add('INSERT INTO comments (id,user_id,post_id,text,created_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING', `${prefix}comment-${index}-${j}`, uid(person.handle), id, replies[(index + j) % replies.length], age(0.07 + j * 0.025));
    }
  });
  for (const person of people) {
    for (let offset = 1; offset <= 4; offset++) add('INSERT INTO follows (follower_id,followed_id) VALUES (?,?) ON CONFLICT DO NOTHING', uid(person.handle), uid(people[(person.index + offset) % people.length].handle));
    if (person.index < 6) {
      add('INSERT INTO follows (follower_id,followed_id) VALUES (?,?) ON CONFLICT DO NOTHING', uid(person.handle), uid(listener.handle));
      add('INSERT INTO notifications (id,user_id,actor_id,kind,seen,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING', `${prefix}notification-follow-${person.index}`, uid(listener.handle), uid(person.handle), 'follow', person.index > 2 ? 1 : 0, age(person.index + 0.1));
    }
    if (person.index < 5) add('INSERT INTO follows (follower_id,followed_id) VALUES (?,?) ON CONFLICT DO NOTHING', uid(listener.handle), uid(person.handle));
  }
  people.slice(0, 4).forEach((person, i) => {
    add('INSERT INTO reactions (user_id,post_id) VALUES (?,?) ON CONFLICT DO NOTHING', uid(person.handle), welcome);
    add('INSERT INTO notifications (id,user_id,actor_id,post_id,kind,seen,created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING', `${prefix}notification-reaction-${i}`, uid(listener.handle), uid(person.handle), welcome, 'reaction', 0, age(0.1 + i * 0.03));
  });
  // A couple of real comments on the listener's first review also exercise per-item conversations.
  people.slice(0, 2).forEach((person, i) => {
    const id = reviewIds.get(`${listener.handle}:${foundation[0].id}`);
    add('INSERT INTO comments (id,user_id,post_id,text,item_id,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING', `${prefix}review-comment-${i}`, uid(person.handle), id, ['This is a great place to start. Try the whole album next.', 'The guitar layers are the thing I keep coming back for.'][i], foundation[0].id, age(0.2 + i * 0.1));
    add('INSERT INTO notifications (id,user_id,actor_id,post_id,kind,seen,created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING', `${prefix}notification-comment-${i}`, uid(listener.handle), uid(person.handle), id, 'comment', 0, age(0.2 + i * 0.1));
  });
  for (const [index, person] of people.slice(0, 3).entries()) {
    const clubId = `${prefix}club-${index}`, existing = await db.get('SELECT week FROM club_weeks WHERE club_id=? ORDER BY week LIMIT 1', clubId);
    const week = existing?.week || currentWeek(new Date(now)), album = albums(person.artist)[0];
    const clubName = ['The Sunday record · Demo', 'Monsoon listening · Demo', 'Pop after hours · Demo'][index];
    add('INSERT INTO clubs VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING', clubId, uid(person.handle), clubName, 'A labelled demo club. One album, a week to listen, and a place to discuss it.', age(36));
    for (const member of [listener, ...people.slice(0, 8)]) add('INSERT INTO club_members VALUES (?,?,?) ON CONFLICT DO NOTHING', clubId, uid(member.handle), age(30));
    const postId = post(person, `club-week-${index}-${week}`, { kind: 'pod', title: `${clubName} · Album of the week`, subtitle: 'A demo weekly discussion. Listen in your music app, rate the album, and leave a thought.', items: [album], visibility: 'public' }, 0.8 + index);
    // Keep the club identity when validation serializes the ordinary pod fields.
    add('UPDATE posts SET meta=? WHERE id=? AND meta=?', JSON.stringify({ clubId, week }), postId, JSON.stringify({ open: false }));
    add('INSERT INTO club_weeks VALUES (?,?,?) ON CONFLICT DO NOTHING', clubId, week, postId);
  }
  await db.batch(statements);
  return demoCounts(db);
}

export async function demoCounts(db) {
  const result = {};
  for (const [table, column] of [['users', 'id'], ['posts', 'id'], ['ratings', 'user_id'], ['comments', 'id'], ['reactions', 'user_id'], ['poll_votes', 'user_id'], ['follows', 'follower_id'], ['notifications', 'id']]) result[table] = (await db.get(`SELECT COUNT(*) AS count FROM ${table} WHERE ${column} LIKE ?`, `${prefix}%`)).count;
  return result;
}

/** Only the reserved seed IDs with our exact demo email suffix may be removed. */
export async function clearDemo(db) {
  assertLocal(db);
  const before = await demoCounts(db);
  await db.run('DELETE FROM users WHERE id LIKE ? AND email LIKE ?', `${prefix}%`, '%@demo.margin.invalid');
  return before;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.env.NODE_ENV === 'production' || process.env.TURSO_DATABASE_URL) throw new Error('Demo tools are local-development only.');
  const file = process.env.DATABASE_PATH || fileURLToPath(new URL('./data/margin.db', import.meta.url));
  const db = await openDatabase({ url: '', file });
  try {
    if (process.argv.includes('--clear')) console.log('Removed demo community:', await clearDemo(db));
    else {
      console.log('Demo community ready:', await seedDemo(db));
      console.log(`Sign in locally: ${DEMO_CREDENTIALS.email} / ${DEMO_CREDENTIALS.password}`);
      console.log('All bots and the demo listener are labelled. Existing accounts and posts are preserved.');
    }
  } finally { db.close(); }
}

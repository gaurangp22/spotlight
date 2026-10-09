import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

// Databases created before ratings, pods, and takes existed have a posts table whose kind CHECK
// rejects the new post types (and, before ratings, lacks the meta column). SQLite can't alter a CHECK, so
// the table is rebuilt with foreign keys disabled: dropping it with them on would cascade-delete
// every comment, reaction, and report.
const POSTS_V2 = `CREATE TABLE posts_v2 (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('ranking','moodboard','review','pod','take')), title TEXT NOT NULL,
 subtitle TEXT NOT NULL DEFAULT '', items TEXT NOT NULL, tiles TEXT NOT NULL DEFAULT '[]',
 theme TEXT NOT NULL DEFAULT 'night', visibility TEXT NOT NULL CHECK(visibility IN ('public','followers','private')),
 origin_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, meta TEXT NOT NULL DEFAULT '{}'
)`;
const columns = 'id, user_id, kind, title, subtitle, items, tiles, theme, visibility, origin_id, created_at, updated_at';
// Tables rebuilt from the ratings-era schema already have meta (a pod's open flag lives there).
const upgradePosts = (hasMeta) => [
  POSTS_V2,
  `INSERT INTO posts_v2 (${columns}${hasMeta ? ', meta' : ''}) SELECT ${columns}${hasMeta ? ', meta' : ''} FROM posts`,
  'DROP TABLE posts',
  'ALTER TABLE posts_v2 RENAME TO posts',
  'CREATE INDEX IF NOT EXISTS posts_author_date ON posts(user_id, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS posts_visibility_date ON posts(visibility, created_at DESC)',
].map((sql) => ({ sql, args: [] }));

export async function openDatabase({ url = process.env.TURSO_DATABASE_URL, token = process.env.TURSO_AUTH_TOKEN, file = process.env.DATABASE_PATH || './data/margin.db' } = {}) {
  let execute, batch, migrate, close;
  if (url) {
    if (!token) throw new Error('TURSO_AUTH_TOKEN is required when TURSO_DATABASE_URL is set.');
    const { createClient } = await import('@libsql/client/web');
    const client = createClient({ url, authToken: token, intMode: 'number' });
    execute = (sql, args = []) => client.execute({ sql, args });
    batch = (statements) => client.batch(statements, 'write');
    // libSQL's migrate runs the batch in one transaction with foreign key enforcement off.
    migrate = (statements) => client.migrate(statements);
    close = () => client.close();
  } else {
    const { DatabaseSync } = await import('node:sqlite');
    if (file !== ':memory:') mkdirSync(dirname(resolve(file)), { recursive: true });
    const sqlite = new DatabaseSync(file);
    sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
    const syncExecute = (sql, args = []) => {
      const stmt = sqlite.prepare(sql);
      if (/^\s*(SELECT|WITH|PRAGMA)/i.test(sql)) return { rows: stmt.all(...args) };
      const result = stmt.run(...args);
      return { rows: [], rowsAffected: Number(result.changes) };
    };
    execute = async (sql, args) => syncExecute(sql, args);
    batch = async (statements) => {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const results = statements.map(({ sql, args }) => syncExecute(sql, args));
        sqlite.exec('COMMIT');
        return results;
      } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    };
    migrate = async (statements) => {
      // foreign_keys can only change outside a transaction.
      sqlite.exec('PRAGMA foreign_keys=OFF');
      try {
        const results = await batch(statements);
        if (sqlite.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Migration left dangling references.');
        return results;
      } finally { sqlite.exec('PRAGMA foreign_keys=ON'); }
    };
    close = () => sqlite.close();
  }
  const posts = (await execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='posts'")).rows[0];
  const columnsOf = async (table) => (await execute(`SELECT name FROM pragma_table_info('${table}')`)).rows.map((r) => r.name);
  if (posts && !String(posts.sql).includes("'take'")) await migrate(upgradePosts((await columnsOf('posts')).includes('meta')));
  // Adding a column with a constant default is safe in place; no rebuild needed.
  if (posts && !(await columnsOf('users')).includes('status')) await batch([{ sql: "ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT ''", args: [] }]);
  if (posts) {
    const userColumns = await columnsOf('users');
    for (const [name, definition] of [['avatar', "TEXT NOT NULL DEFAULT ''"], ['favorite_artists', "TEXT NOT NULL DEFAULT '[]'"], ['onboarding_complete', 'INTEGER NOT NULL DEFAULT 0'], ['email_verified', 'INTEGER NOT NULL DEFAULT 0'], ['push_enabled', 'INTEGER NOT NULL DEFAULT 0'], ['allow_messages', 'INTEGER NOT NULL DEFAULT 1'], ['invited_by', 'TEXT REFERENCES users(id) ON DELETE SET NULL'], ['is_bot', 'INTEGER NOT NULL DEFAULT 0'], ['show_bots', 'INTEGER NOT NULL DEFAULT 1']]) {
      if (!userColumns.includes(name)) await batch([{ sql: `ALTER TABLE users ADD COLUMN ${name} ${definition}`, args: [] }]);
    }
    if ((await columnsOf('comments')).length && !(await columnsOf('comments')).includes('parent_id')) await batch([{ sql: 'ALTER TABLE comments ADD COLUMN parent_id TEXT REFERENCES comments(id) ON DELETE SET NULL', args: [] }]);
    if ((await columnsOf('email_otps')).length && !(await columnsOf('email_otps')).includes('purpose')) await batch([{ sql: "ALTER TABLE email_otps ADD COLUMN purpose TEXT NOT NULL DEFAULT 'signin'", args: [] }]);
  }
  const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
  await batch(schema.split(';').map((sql) => sql.trim()).filter(Boolean).map((sql) => ({ sql, args: [] })));
  return {
    all: async (sql, ...args) => (await execute(sql, args)).rows,
    get: async (sql, ...args) => (await execute(sql, args)).rows[0],
    run: async (sql, ...args) => execute(sql, args),
    batch, close, mode: url ? 'turso' : 'sqlite',
  };
}

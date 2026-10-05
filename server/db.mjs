import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

export async function openDatabase({ url = process.env.TURSO_DATABASE_URL, token = process.env.TURSO_AUTH_TOKEN, file = process.env.DATABASE_PATH || './data/margin.db' } = {}) {
  let execute, batch, close;
  if (url) {
    if (!token) throw new Error('TURSO_AUTH_TOKEN is required when TURSO_DATABASE_URL is set.');
    const { createClient } = await import('@libsql/client/web');
    const client = createClient({ url, authToken: token, intMode: 'number' });
    execute = (sql, args = []) => client.execute({ sql, args });
    batch = (statements) => client.batch(statements, 'write');
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
    close = () => sqlite.close();
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

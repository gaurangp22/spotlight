import { openDatabase } from './db.mjs';
import { secretKey } from './security.mjs';
import { createApi } from './api.mjs';

const demo = process.env.MARGIN_DEMO_BOTS === '1';
if (demo && (process.env.NODE_ENV === 'production' || process.env.TURSO_DATABASE_URL)) throw new Error('Demo mode is only available with local SQLite in development.');
const db = await openDatabase();
let stopBots = () => {};
if (demo) {
  const { seedDemo } = await import('./demo-seed.mjs');
  const { startDemoBots } = await import('./demo-bots.mjs');
  const counts = await seedDemo(db);
  stopBots = startDemoBots(db);
  console.log(`Local demo mode: ${counts.users - 1} labelled bots. Replies are limited to the demo listener account.`);
}
const server = createApi({ db, key: secretKey() });
const port = Number(process.env.PORT || 8787);
let stopHouseBots = () => {};
server.listen(port, process.env.HOST || '0.0.0.0', async () => {
  console.log(`Riffs API listening on ${port} (${db.mode})`);
  // House bots: labelled accounts that post real music and greet new people. Off unless RIFFS_BOTS=1.
  if (process.env.RIFFS_BOTS === '1') {
    const { createBotEngine, ensureBots, PERSONAS } = await import('./bots.mjs');
    await ensureBots(db);
    stopHouseBots = createBotEngine({ db, base: `http://127.0.0.1:${port}` }).start();
    console.log(`House bots on: ${PERSONAS.length} labelled accounts.`);
  }
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  stopBots(); stopHouseBots();
  server.close(() => { db.close(); process.exit(0); });
});

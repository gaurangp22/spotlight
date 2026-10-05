import { openDatabase } from './db.mjs';
import { secretKey } from './security.mjs';
import { createApi } from './api.mjs';

const db = await openDatabase();
const server = createApi({ db, key: secretKey() });
const port = Number(process.env.PORT || 8787);
server.listen(port, process.env.HOST || '0.0.0.0', () => console.log(`MARGIN API listening on ${port} (${db.mode})`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  server.close(() => { db.close(); process.exit(0); });
});

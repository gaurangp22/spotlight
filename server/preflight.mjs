// Launch checklist for the server environment. Run before deploying:  npm --prefix server run preflight
// Exits with a non-zero code when something would break or weaken a production launch.
import { openDatabase } from './db.mjs';

const env = process.env;
const results = [];
const check = (level, ok, label, fix) => results.push({ level: ok ? 'ok' : level, label, fix: ok ? '' : fix });
const https = (value) => { try { return new URL(value).protocol === 'https:'; } catch { return false; } };
const key = (env.TOKEN_ENCRYPTION_KEY || '').replace(/\s+/g, '').replace(/^["']+|["']+$/g, '');
const origins = (env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);

check('error', env.NODE_ENV === 'production', 'NODE_ENV is production', 'Set NODE_ENV=production.');
check('error', /^[0-9a-fA-F]{64}$/.test(key), 'TOKEN_ENCRYPTION_KEY is 64 hex characters', 'Generate one: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))" — and back it up; losing it breaks encrypted data.');
check('error', https(env.PUBLIC_API_URL), 'PUBLIC_API_URL uses HTTPS', 'Set PUBLIC_API_URL to the HTTPS address of this API. Invite links and emails use it.');
check('error', https(env.WEB_APP_URL), 'WEB_APP_URL uses HTTPS', 'Set WEB_APP_URL to the HTTPS address of the web app. Invite links and password resets open it.');
check('error', origins.length > 0 && origins.every(https) && origins.includes((env.WEB_APP_URL || '').replace(/\/$/, '')), 'ALLOWED_ORIGINS lists only HTTPS origins, including the web app', 'Set ALLOWED_ORIGINS to the web app origin (comma-separated, HTTPS only).');
check('info', !!(env.RESEND_API_KEY && env.EMAIL_FROM), 'Optional email delivery (Resend) is configured', 'Off. Password signup and sign-in work without email delivery. Set RESEND_API_KEY and a verified EMAIL_FROM to enable signup verification, email sign-in, and password recovery.');
check('warn', (env.ADMIN_TOKEN || '').length >= 32, 'ADMIN_TOKEN is set (32+ characters)', 'Set ADMIN_TOKEN to read stats, feedback, and reports with admin.mjs.');
check('warn', !!env.TRUSTED_PROXY_IPS, 'TRUSTED_PROXY_IPS is set', 'Behind a hosting proxy, set TRUSTED_PROXY_IPS (use * on Render, Railway, or Fly) so rate limits apply per person.');
check('warn', !!env.TURSO_DATABASE_URL || !!env.DATABASE_PATH, 'Database location is explicit', 'Use Turso, or set DATABASE_PATH to a persistent volume so data survives redeploys.');
check('info', env.PUSH_ENABLED === '1', 'Push notifications are on', 'Off. Set PUSH_ENABLED=1 once FCM/APNs credentials are set up in EAS and tested on a phone.');
check('info', !!env.ANDROID_DOWNLOAD_URL, 'Invite page offers an Android download', 'Optional: set ANDROID_DOWNLOAD_URL (Play Store or APK link).');
check('error', env.MARGIN_DEMO_BOTS !== '1', 'Demo bots are off', 'Unset MARGIN_DEMO_BOTS in production.');

try {
  const db = await openDatabase();
  const demo = (await db.get("SELECT COUNT(*) AS n FROM users WHERE email LIKE '%@demo.margin.invalid'")).n;
  const people = (await db.get("SELECT COUNT(*) AS n FROM users WHERE email NOT LIKE '%@demo.margin.invalid'")).n;
  check('warn', demo === 0, `No demo accounts in the database (${people} real ${people === 1 ? 'person' : 'people'})`, `${demo} labelled demo accounts are present. Run npm run demo:clear before inviting real people.`);
  db.close();
} catch (error) {
  check('error', false, 'Database is reachable', `Could not open the database: ${error.message}`);
}

const icon = { ok: '✔', info: '·', warn: '!', error: '✖' };
for (const r of results) console.log(`${icon[r.level]} ${r.label}${r.fix ? `\n    ${r.fix}` : ''}`);
const errors = results.filter((r) => r.level === 'error').length, warnings = results.filter((r) => r.level === 'warn').length;
console.log(`\n${errors ? `${errors} blocking ${errors === 1 ? 'issue' : 'issues'}` : 'Ready to launch'}${warnings ? `, ${warnings} ${warnings === 1 ? 'warning' : 'warnings'}` : ''}.`);
process.exitCode = errors ? 1 : 0;

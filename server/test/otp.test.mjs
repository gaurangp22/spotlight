import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../db.mjs';
import { createApi } from '../api.mjs';
import { digest } from '../security.mjs';

async function fixture(t, enabled = true) {
  const previous = { key: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM };
  if (enabled) { process.env.RESEND_API_KEY = 'test-only-key'; process.env.EMAIL_FROM = 'Riffs <test@example.test>'; }
  else { delete process.env.RESEND_API_KEY; delete process.env.EMAIL_FROM; }
  const db = await openDatabase({ url: '', file: ':memory:' }), mails = [];
  let delivery = true;
  const server = createApi({ db, fetcher: async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    mails.push(JSON.parse(options.body)); return { ok: delivery };
  } });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(async () => {
    await new Promise((r) => server.close(r)); db.close();
    for (const [name, value] of [['RESEND_API_KEY', previous.key], ['EMAIL_FROM', previous.from]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  });
  const request = async (path, body, token) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, data: await res.json() };
  };
  // This fixture represents an existing account created before email delivery was configured.
  delete process.env.RESEND_API_KEY; delete process.env.EMAIL_FROM;
  const account = await request('/auth/register', { email: 'listener@example.test', name: 'Listener', handle: 'listener', password: 'listener-password-123' });
  if (enabled) { process.env.RESEND_API_KEY = 'test-only-key'; process.env.EMAIL_FROM = 'Riffs <test@example.test>'; }
  assert.equal(account.status, 201);
  const issue = async (email = 'listener@example.test') => {
    const res = await request('/auth/otp/request', { email });
    const code = mails.at(-1)?.text.match(/code is (\d{6})/)[1];
    return { ...res, code };
  };
  const age = () => db.run('UPDATE email_otps SET created_at=created_at-61000');
  return { db, mails, request, issue, age, failDelivery: () => { delivery = false; }, account: account.data };
}

test('email OTP: delivery, hashed storage, one-use concurrent sign-in, and no account enumeration', async (t) => {
  const { db, request, issue, mails, account } = await fixture(t);
  assert.equal((await request('/config')).data.emailOtp, true);
  const first = await issue('LISTENER@example.test');
  assert.equal(first.status, 200); assert.match(first.code, /^\d{6}$/);
  assert.equal(first.data.code, undefined); assert.equal(mails[0].to, 'listener@example.test');
  const row = await db.get('SELECT * FROM email_otps WHERE challenge_hash=?', digest(first.data.challenge));
  assert.equal(row.user_id, account.user.id); assert.notEqual(row.code_hash, first.code); assert.equal(row.code_hash.length, 64);
  assert.equal((await issue()).status, 429);
  const verify = () => request('/auth/otp/verify', { challenge: first.data.challenge, code: first.code });
  const attempts = await Promise.all([verify(), verify()]);
  assert.deepEqual(attempts.map((r) => r.status).sort(), [200, 400]);
  const signed = attempts.find((r) => r.status === 200).data;
  assert.equal(signed.user.id, account.user.id);
  assert.equal((await request('/me', undefined, signed.token)).status, 200);
  assert.equal((await verify()).status, 400);
  const unknown = await issue('unknown@example.test');
  assert.equal(unknown.status, 200); assert.equal(unknown.data.message, first.data.message);
  assert.equal(mails.at(-1).to, 'unknown@example.test');
  assert.equal((await request('/auth/otp/verify', { challenge: unknown.data.challenge, code: unknown.code })).status, 400);
  assert.equal((await db.get('SELECT COUNT(*) AS n FROM users')).n, 1);
});

test('email OTP: wrong-attempt lockout, expiry, challenge binding, persistent resend limits', async (t) => {
  const { db, request, issue, age } = await fixture(t);
  const first = await issue();
  const wrong = first.code === '000000' ? '000001' : '000000';
  for (let n = 0; n < 5; n++) assert.equal((await request('/auth/otp/verify', { challenge: first.data.challenge, code: wrong })).status, 400);
  assert.equal((await request('/auth/otp/verify', { challenge: first.data.challenge, code: first.code })).status, 400);
  await age(); const expired = await issue();
  await db.run('UPDATE email_otps SET expires_at=0 WHERE challenge_hash=?', digest(expired.data.challenge));
  assert.equal((await request('/auth/otp/verify', { challenge: expired.data.challenge, code: expired.code })).status, 400);
  await age(); const third = await issue();
  assert.equal((await request('/auth/otp/verify', { challenge: third.data.challenge, code: first.code })).status, first.code === third.code ? 200 : 400);
  await age(); assert.equal((await issue()).status, 200);
  await age(); assert.equal((await issue()).status, 200);
  await age(); assert.equal((await issue()).status, 429);
  assert.equal((await request('/auth/otp/verify', { challenge: third.data.challenge, code: '123' })).status, 400);
});

test('email OTP: missing configuration and delivery failure never yield usable codes', async (t) => {
  await t.test('unconfigured', async (child) => {
    const { issue, request, mails } = await fixture(child, false);
    assert.equal((await request('/config')).data.emailOtp, false);
    assert.equal((await issue()).status, 503); assert.equal(mails.length, 0);
  });
  await t.test('failed delivery', async (child) => {
    const { db, issue, failDelivery } = await fixture(child);
    failDelivery(); assert.equal((await issue()).status, 503);
    assert.equal((await db.get('SELECT consumed FROM email_otps')).consumed, 1);
    assert.equal((await issue()).status, 429);
  });
});

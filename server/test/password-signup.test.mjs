import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { openDatabase } from '../db.mjs';
import { createApi } from '../api.mjs';

test('production without email delivery supports password signup and sign-in', async (t) => {
  const names = ['NODE_ENV', 'RESEND_API_KEY', 'EMAIL_FROM'];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  process.env.NODE_ENV = 'production';
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  t.after(() => {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  });
  const db = await openDatabase({ url: '', file: ':memory:' });
  const server = createApi({ db, key: randomBytes(32), fetcher: () => { throw new Error('Password authentication must not send email.'); } });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise((resolve) => server.close(resolve)); db.close(); });
  const request = async (path, { body, token } = {}) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, data: await response.json() };
  };
  const config = (await request('/config')).data;
  assert.equal(config.signupVerification, false);
  assert.equal(config.emailOtp, false);
  assert.equal(config.passwordRecovery, false);
  const input = { email: 'password@example.test', handle: 'passworduser', name: 'Password user', password: 'good-password-123' };
  const weak = await request('/auth/register', { body: { ...input, password: 'short' } });
  assert.equal(weak.status, 400);
  const registered = await request('/auth/register', { body: input });
  assert.equal(registered.status, 201, JSON.stringify(registered.data));
  const stored = await db.get('SELECT password,email_verified FROM users WHERE id=?', registered.data.user.id);
  assert.notEqual(stored.password, input.password);
  assert.equal(stored.email_verified, 0);
  assert.equal((await request('/me', { token: registered.data.token })).status, 200);
  assert.equal((await request('/auth/register', { body: input })).status, 409);
  assert.equal((await request('/auth/login', { body: { email: input.email, password: 'wrong-password' } })).status, 401);
  const login = await request('/auth/login', { body: { email: input.email, password: input.password } });
  assert.equal(login.status, 200);
  assert.equal(login.data.user.id, registered.data.user.id);
  assert.equal((await request('/me', { token: login.data.token })).status, 200);
});

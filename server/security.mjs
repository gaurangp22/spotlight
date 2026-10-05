import { scrypt, randomBytes, createHash, timingSafeEqual, createCipheriv, createDecipheriv } from 'node:crypto';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const derive = promisify(scrypt);
export const digest = (value) => createHash('sha256').update(value).digest('hex');
export const randomToken = () => randomBytes(32).toString('base64url');
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await derive(password, salt, 64);
  return `${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  const [salt, encoded] = stored.split(':');
  const actual = await derive(password, salt, 64);
  const expected = Buffer.from(encoded, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export function secretKey() {
  if (process.env.TOKEN_ENCRYPTION_KEY) {
    // Tolerate the usual copy-paste slips from hosting dashboards: surrounding quotes and whitespace.
    const raw = process.env.TOKEN_ENCRYPTION_KEY.replace(/\s+/g, '').replace(/^["']+|["']+$/g, '');
    if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
      const invalid = raw.replace(/[0-9a-fA-F]/g, '').length;
      throw new Error(`TOKEN_ENCRYPTION_KEY must be exactly 64 hexadecimal characters (0-9, a-f). Received ${raw.length} characters${invalid ? `, ${invalid} of them not hexadecimal` : ''}.`);
    }
    return Buffer.from(raw, 'hex');
  }
  if (process.env.NODE_ENV === 'production') throw new Error('Set TOKEN_ENCRYPTION_KEY in production.');
  const file = resolve(process.env.DATA_DIR || './data', 'encryption.key');
  mkdirSync(dirname(file), { recursive: true });
  try { return readFileSync(file); } catch { const key = randomBytes(32); writeFileSync(file, key, { mode: 0o600 }); return key; }
}
export function encrypt(value, key) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}
export function decrypt(value, key) {
  const bytes = Buffer.from(value, 'base64'), cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
  cipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString());
}
export function fail(status, message) { throw Object.assign(new Error(message), { status }); }
export function text(value, label, min = 0, max = 200) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) fail(400, `${label} must be ${min}–${max} characters.`);
  return value.trim();
}
export function password(value) {
  if (typeof value !== 'string' || value.length < 10 || value.length > 128) fail(400, 'Use a password of 10–128 characters.');
  return value;
}

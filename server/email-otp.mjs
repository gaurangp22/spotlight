import { createHmac, randomInt } from 'node:crypto';
import { digest, randomToken, text, fail } from './security.mjs';

// Challenges bind a code to a particular request; the keyed digest protects six-digit codes at rest.
export function emailOtpService(db, key, fetcher) {
  const configured = () => !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
  const codeHash = (challenge, code) => createHmac('sha256', key).update(`${challenge}:${code}`).digest('hex');
  async function request(input, purpose = 'signin') {
    if (!configured()) fail(503, 'Email sign-in is not configured yet. Use your password for now.');
    const email = text(input, 'Email', 3, 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Enter a valid email address.');
    const time = Date.now();
    await db.run('DELETE FROM email_otps WHERE created_at<?', time - 3600000);
    const candidate = await db.get('SELECT id FROM users WHERE email=?', email);
    const challenge = randomToken(), hash = digest(challenge), code = String(randomInt(1000000)).padStart(6, '0');
    // The conditional insert enforces both limits even when requests arrive concurrently or after a restart.
    const result = await db.run(`INSERT INTO email_otps (challenge_hash,email,user_id,code_hash,created_at,expires_at,purpose)
      SELECT ?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM email_otps WHERE email=? AND created_at>?)
      AND (SELECT COUNT(*) FROM email_otps WHERE email=?)<5`,
    hash, email, candidate?.id || null, codeHash(challenge, code), time, time + 600000, purpose, email, time - 60000, email);
    if (!result.rowsAffected) fail(429, 'Wait at least a minute before requesting another code. You can request five per hour.');
    try {
      // Send the same email for registered and unregistered addresses, without exposing account existence.
      const response = await fetcher('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: process.env.EMAIL_FROM, to: email, subject: purpose === 'signin' ? 'Your Riffs sign-in code' : 'Verify your Riffs email', text: purpose === 'signin' ? `Your Riffs sign-in code is ${code}. It expires in 10 minutes and works once.\n\nUse this code with the sign-in screen that requested it. If you don't have an account yet, create one first. Never share this code. If you didn't request it, ignore this email.` : `Your Riffs verification code is ${code}. It expires in 10 minutes and works once. Use it on the screen that requested it. If you didn't request it, ignore this email.` }), signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('Delivery failed');
    } catch {
      // Retain the cooldown, but invalidate a code whose delivery could not be confirmed.
      await db.run('UPDATE email_otps SET consumed=1 WHERE challenge_hash=?', hash);
      fail(503, 'We could not send your code. Try again in a minute or use your password.');
    }
    return { challenge, expiresIn: 600, resendAfter: 60, message: purpose === 'signin' ? 'Check your email for a six-digit code. It expires in 10 minutes. Create an account first if you haven’t registered yet.' : 'Check your email for a six-digit verification code. It expires in 10 minutes.' };
  }
  async function verify(challenge, code, purpose = 'signin') {
    const invalid = () => fail(400, 'This code is incorrect, expired, or already used. Request a new code if needed.');
    if (typeof challenge !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) invalid();
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) invalid();
    const hash = digest(challenge), expected = codeHash(challenge, code);
    const row = await db.get('SELECT * FROM email_otps WHERE challenge_hash=?', hash);
    if (!row || row.purpose !== purpose) invalid();
    // Only one concurrent redemption can claim a valid code. Wrong attempts also count atomically.
    const result = await db.run(`UPDATE email_otps SET attempts=attempts+1, consumed=CASE WHEN code_hash=? THEN 1 ELSE 0 END
      WHERE challenge_hash=? AND consumed=0 AND attempts<5 AND expires_at>?`, expected, hash, Date.now());
    if (!result.rowsAffected || row.code_hash !== expected) invalid();
    if (purpose === 'signup') return { email: row.email };
    if (!row.user_id) invalid();
    const user = await db.get('SELECT * FROM users WHERE id=?', row.user_id);
    if (!user) invalid();
    await db.run('UPDATE users SET email_verified=1 WHERE id=?', user.id);
    return { ...user, email_verified: 1 };
  }
  return { configured, request, verify };
}

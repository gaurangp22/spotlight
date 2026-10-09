import { readFileSync } from 'node:fs';

// Public, static pages for store listings: privacy policy, terms, and account deletion instructions.
const legal = JSON.parse(readFileSync(new URL('./legal.json', import.meta.url), 'utf8'));
const escape = (value) => String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

function layout(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} · Riffs</title>
<style>
:root{--bg:#F7F5F1;--fg:#121211;--muted:#6B6862;--accent:#C63A22;--line:rgba(18,18,17,.1)}
@media (prefers-color-scheme:dark){:root{--bg:#0E0E0F;--fg:#F5F3EE;--muted:#A09D97;--accent:#FF6B4A;--line:rgba(255,255,255,.1)}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:680px;margin:0 auto;padding:48px 20px 80px}.brand{font-weight:800;letter-spacing:-.04em;font-size:20px;text-decoration:none;color:var(--fg)}.brand span{color:var(--accent)}
h1{font-size:34px;line-height:1.15;letter-spacing:-.03em;margin:40px 0 6px}h2{font-size:19px;letter-spacing:-.01em;margin:36px 0 8px}.updated{color:var(--muted);font-size:14px;margin:0 0 24px}
p,li{color:var(--muted)}p.lead{color:var(--fg);font-size:17px}ol{padding-left:20px}footer{margin-top:56px;padding-top:20px;border-top:1px solid var(--line);font-size:14px;color:var(--muted)}a{color:var(--accent)}
</style></head><body><main><a class="brand" href="/privacy">Riffs<span>.</span></a>${body}
<footer><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/delete-account">Delete your account</a></footer></main></body></html>`;
}

function legalPage(doc) {
  const sections = doc.sections.map((section) => `<h2>${escape(section.heading)}</h2>${section.body.map((p) => `<p>${escape(p)}</p>`).join('')}`).join('');
  return layout(doc.title, `<h1>${escape(doc.title)}</h1><p class="updated">Last updated ${escape(legal.updated)}</p><p class="lead">${escape(doc.intro)}</p>${sections}`);
}

const deletion = layout('Delete your account', `<h1>Delete your Riffs account</h1><p class="updated">Last updated ${escape(legal.updated)}</p>
<p class="lead">You can permanently delete your account and data at any time, directly in the app.</p>
<ol><li>Open Riffs and go to <strong>Profile</strong>.</li><li>Tap the <strong>Settings</strong> icon.</li><li>Scroll down and tap <strong>Delete account</strong>.</li><li>Enter your password to confirm.</li></ol>
<h2>What is deleted</h2><p>Deletion is immediate and permanent. It removes your profile, ratings and reviews, rankings, pods, mood boards and photos, comments, reactions, follows, blocks, sessions, and Spotify connection. Drafts stored on your device are removed when you delete the account from that device, or when you uninstall the app.</p>
<h2>Can’t sign in?</h2><p>Reset your password from the sign-in screen first, then follow the steps above. If you no longer have access to your email address, contact us through the support address on our store listing and we will verify ownership before deleting the account.</p>`);

export const pages = { '/privacy': legalPage(legal.privacy), '/terms': legalPage(legal.terms), '/delete-account': deletion };

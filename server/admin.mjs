const base = (process.env.PUBLIC_API_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');
if (!process.env.ADMIN_TOKEN) throw new Error('Set ADMIN_TOKEN in the server environment.');
const usage = 'Usage: node --env-file=.env admin.mjs stats | feedback | resolve-feedback <id> | reports | dismiss <report-id> | remove <report-id>';
const [command = 'stats', id] = process.argv.slice(2);
const needsId = ['dismiss', 'remove', 'resolve-feedback'];
if (!['stats', 'feedback', 'reports', ...needsId].includes(command) || (needsId.includes(command) && !/^[a-zA-Z0-9-]+$/.test(id || ''))) throw new Error(usage);

async function call(path, method = 'GET', body) {
  const response = await fetch(`${base}/api/admin/${path}`, {
    method, headers: { Authorization: `Bearer ${process.env.ADMIN_TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return data;
}
const percent = (value) => (value === null ? '—' : `${value}%`);

if (command === 'stats') {
  const s = await call('stats');
  console.log(`\nRiffs — ${new Date().toDateString()} (demo accounts excluded)\n`);
  console.table({ People: s.users, 'New this week': s.newThisWeek, 'Active today': s.dau, 'Active this week': s.wau, 'Active this month': s.mau, 'Daily/monthly': percent(s.stickiness), 'Joined by invite': s.invites.joined, 'Open feedback': s.openFeedback });
  console.log('Last 7 days');
  console.table({ ...s.lastSevenDays.posts, ratings: s.lastSevenDays.ratings, comments: s.lastSevenDays.comments, messages: s.lastSevenDays.messages });
  if (s.retention.length) {
    console.log('Retention by signup week (share of people who came back)');
    console.table(s.retention.map((c) => ({ week: c.week, signups: c.signups, 'next day': percent(c.nextDay), 'second week': percent(c.secondWeek), 'a month later': percent(c.month) })));
  }
  if (s.invites.topInviters.length) { console.log('Top inviters'); console.table(s.invites.topInviters); }
} else if (command === 'feedback') {
  const { feedback } = await call('feedback');
  if (!feedback.length) console.log('No open feedback.');
  for (const f of feedback) console.log(`\n[${f.id}] ${f.created_at.slice(0, 16).replace('T', ' ')} · ${f.handle ? `@${f.handle}` : 'signed out'} · ${f.platform} ${f.version}${f.context ? ` · ${f.context}` : ''}\n${f.text}`);
} else if (command === 'resolve-feedback') {
  await call(`feedback/${id}`, 'PATCH', {});
  console.log('Feedback marked as handled.');
} else if (command === 'reports') {
  const data = await call('reports');
  console.table(data.reports.map(({ id: reportId, title, reporter, reason, created_at }) => ({ id: reportId, title, reporter, reason, created_at })));
} else {
  await call(`reports/${id}`, 'PATCH', { removePost: command === 'remove' });
  console.log('Report handled.');
}

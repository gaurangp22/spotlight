const base = (process.env.PUBLIC_API_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');
if (!process.env.ADMIN_TOKEN) throw new Error('Set ADMIN_TOKEN in the server environment.');
const usage = `Usage: node --env-file=.env admin.mjs <command>
  stats | feedback | resolve-feedback <id>
  reports                      posts, comments and profiles people reported
  dismiss <report-id>          keep the post, comment or profile; close the report
  remove <report-id>           delete the reported post or comment
  suspend <report-id|handle>   suspend a reported profile, or any account by username
  unsuspend <handle>`;
const [command = 'stats', id] = process.argv.slice(2);
const needsId = ['dismiss', 'remove', 'resolve-feedback', 'suspend', 'unsuspend'];
if (!['stats', 'feedback', 'reports', ...needsId].includes(command) || (needsId.includes(command) && !/^@?[a-zA-Z0-9_-]+$/.test(id || ''))) throw new Error(usage);

async function call(path, method = 'GET', body) {
  const response = await fetch(`${base}/api/admin/${path}`, {
    method, headers: { Authorization: `Bearer ${process.env.ADMIN_TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error), { status: response.status });
  return data;
}
const percent = (value) => (value === null ? '—' : `${value}%`);
// Report ids are unique across the three queues, so try each until one recognises the id.
async function handleReport(reportId, bodies) {
  for (const [queue, body] of Object.entries(bodies)) {
    try { await call(`${queue}/${reportId}`, 'PATCH', body); return true; } catch (error) { if (error.status !== 404) throw error; }
  }
  return false;
}

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
  const [posts, comments, profiles] = await Promise.all([call('reports'), call('comment-reports'), call('user-reports')]);
  console.log('Posts'); console.table(posts.reports.map(({ id: reportId, title, reporter, reason, created_at }) => ({ id: reportId, title, reporter, reason, created_at })));
  console.log('Comments'); console.table(comments.reports.map(({ id: reportId, author, text, reporter, reason, created_at }) => ({ id: reportId, author: `@${author}`, comment: text.slice(0, 60), reporter, reason, created_at })));
  console.log('Profiles'); console.table(profiles.reports.map(({ id: reportId, target, suspended, reporter, reason, created_at }) => ({ id: reportId, profile: `@${target}${suspended ? ' (suspended)' : ''}`, reporter, reason, created_at })));
} else if (command === 'unsuspend' || (command === 'suspend' && !/^[0-9a-f-]{36}$/.test(id))) {
  await call(`users/${id.replace(/^@/, '').toLowerCase()}`, 'PATCH', { suspended: command === 'suspend' });
  console.log(command === 'suspend' ? `@${id.replace(/^@/, '')} is suspended and signed out everywhere.` : `@${id.replace(/^@/, '')} can sign in again.`);
} else {
  const bodies = command === 'suspend' ? { 'user-reports': { suspend: true } }
    : { reports: { removePost: command === 'remove' }, 'comment-reports': { removeComment: command === 'remove' }, ...(command === 'dismiss' ? { 'user-reports': {} } : {}) };
  if (!await handleReport(id, bodies)) throw new Error(command === 'remove' ? 'No post or comment report has that id. Use suspend for a profile report.' : 'No open report has that id.');
  console.log('Report handled.');
}

const base = (process.env.PUBLIC_API_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');
if (!process.env.ADMIN_TOKEN) throw new Error('Set ADMIN_TOKEN in the server environment.');
const [command = 'reports', id] = process.argv.slice(2);
if (!['reports', 'dismiss', 'remove'].includes(command) || (command !== 'reports' && !/^[a-zA-Z0-9-]+$/.test(id || ''))) throw new Error('Usage: node --env-file=.env admin.mjs reports|dismiss <report-id>|remove <report-id>');
const response = await fetch(`${base}/api/admin/reports${command === 'reports' ? '' : `/${id}`}`, {
  method: command === 'reports' ? 'GET' : 'PATCH',
  headers: { Authorization: `Bearer ${process.env.ADMIN_TOKEN}`, 'Content-Type': 'application/json' },
  body: command === 'reports' ? undefined : JSON.stringify({ removePost: command === 'remove' }),
});
const data = await response.json();
if (!response.ok) throw new Error(data.error);
if (data.reports) console.table(data.reports.map(({ id, title, reporter, reason, created_at }) => ({ id, title, reporter, reason, created_at })));
else console.log('Report handled.');

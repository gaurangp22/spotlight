const { createServer } = require('node:http');
const { createReadStream, statSync } = require('node:fs');
const { resolve } = require('node:path');

const file = resolve(__dirname, '../artifacts/margin-local.apk');
const size = statSync(file).size;
createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end('<!doctype html><html><meta name="viewport" content="width=device-width, initial-scale=1"><title>MARGIN for Android</title><body style="background:#F3F0E8;color:#1A1A18;font:18px system-ui;padding:24px;max-width:540px;margin:auto"><h1>MARGIN for Android.</h1><p>Install the local test app. Keep your phone and this computer on the same Wi-Fi.</p><p><a style="color:#A33323" href="/margin-local.apk">Download APK</a></p><p>The app connects to the API on this computer. Spotify setup comes later.</p></body></html>');
    return;
  }
  if (req.url !== '/margin-local.apk') { res.writeHead(404); res.end(); return; }
  res.writeHead(200, {
    'Content-Type': 'application/vnd.android.package-archive',
    'Content-Disposition': 'attachment; filename="margin-local.apk"',
    'Content-Length': size,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  if (req.method === 'HEAD') res.end();
  else {
    const stream = createReadStream(file);
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  }
}).listen(8790, '0.0.0.0', () => console.log('APK download: http://YOUR_COMPUTER_LAN_IP:8790'));

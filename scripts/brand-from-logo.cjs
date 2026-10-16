// Builds every Riffs brand asset from the original logo artwork (assets/brand/source/riffs-logo-original.png):
// - recolours the record's red label and ring to Riffs Volt,
// - fills the hairline-outlined RIFFS wordmark so it reads at small sizes,
// - cuts the R + record mark out on transparency (white R for dark backgrounds, black R for light),
// - renders the app icon (mark only), adaptive Android layers, favicon, splash, and the full lockup.
// Usage: node scripts/brand-from-logo.cjs
const fs = require('node:fs');
const sharp = require('sharp');

const SOURCE = 'assets/brand/source/riffs-logo-original.png';
const VOLT = [198, 255, 61], AQUA = [46, 230, 197];
const LABEL = [239, 66, 67], RING = [214, 25, 84];

/** Splits a pixel into "how much of the brand red it holds" and the neutral grey it is mixed with. */
function recolour(px) {
  const [r, g, b] = px;
  if (r - Math.max(g, b) < 25) return px;
  const ring = b > g + 15, from = ring ? RING : LABEL, to = ring ? VOLT : VOLT;
  const a = Math.max(0, Math.min(1, (r - g) / (from[0] - from[1])));
  const grey = a >= 0.98 ? 0 : Math.max(0, Math.min(255, (g - a * from[1]) / (1 - a)));
  return to.map((v) => Math.round(a * v + (1 - a) * grey));
}

/** Fills outlined lettering: dark regions nested inside an odd number of outlines become white. */
function fillOutlined(px, W, H, box) {
  const [x0, x1, y0, y1] = box, w = x1 - x0 + 1, h = y1 - y0 + 1;
  const light = (x, y) => { const i = ((y0 + y) * W + (x0 + x)) * 3; return px[i] + px[i + 1] + px[i + 2] > 384; };
  const label = new Int32Array(w * h).fill(-1); const kinds = [];
  for (let start = 0; start < w * h; start++) {
    if (label[start] >= 0) continue;
    const id = kinds.length, isLight = light(start % w, Math.floor(start / w)); kinds.push(isLight);
    const stack = [start]; label[start] = id;
    while (stack.length) {
      const p = stack.pop(), x = p % w, y = Math.floor(p / w);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx; if (label[q] < 0 && light(nx, ny) === isLight) { label[q] = id; stack.push(q); }
      }
    }
  }
  // Region adjacency, then depth from the outside (border regions are depth 0).
  const edges = kinds.map(() => new Set());
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = label[y * w + x];
    if (x + 1 < w) { const b = label[y * w + x + 1]; if (a !== b) { edges[a].add(b); edges[b].add(a); } }
    if (y + 1 < h) { const b = label[(y + 1) * w + x]; if (a !== b) { edges[a].add(b); edges[b].add(a); } }
  }
  const depth = kinds.map(() => -1), queue = [];
  for (let x = 0; x < w; x++) for (const y of [0, h - 1]) { const id = label[y * w + x]; if (depth[id] < 0 && !kinds[id]) { depth[id] = 0; queue.push(id); } }
  for (let y = 0; y < h; y++) for (const x of [0, w - 1]) { const id = label[y * w + x]; if (depth[id] < 0 && !kinds[id]) { depth[id] = 0; queue.push(id); } }
  while (queue.length) {
    const id = queue.shift();
    for (const n of edges[id]) if (depth[n] < 0) { depth[n] = kinds[n] === kinds[id] ? depth[id] : depth[id] + (kinds[id] ? 0 : 1); queue.push(n); }
  }
  // A dark region one outline deep is a letter body; two deep is a counter (the hole in R), which stays dark.
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const id = label[y * w + x];
    if (!kinds[id] && depth[id] % 2 === 1) { const i = ((y0 + y) * W + (x0 + x)) * 3; px[i] = px[i + 1] = px[i + 2] = 255; }
  }
}

const png = (raw, w, h, channels) => sharp(raw, { raw: { width: w, height: h, channels } }).png();

(async () => {
  const { data, info } = await sharp(SOURCE).flatten({ background: '#000000' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, px = Buffer.from(data);
  for (let i = 0; i < px.length; i += 3) { const [r, g, b] = recolour([px[i], px[i + 1], px[i + 2]]); px[i] = r; px[i + 1] = g; px[i + 2] = b; }

  // Regions measured on the 2000×2000 original.
  const s = W / 2000;
  const word = [692, 1314, 139, 429].map((v) => Math.round(v * s));
  fillOutlined(px, W, H, [word[0] - 6, word[1] + 6, word[2] - 6, word[3] + 6]);
  const disc = { x: 1239 * s, y: 862 * s, r: 345 * s };
  const mark = [379, 1620, 487, 1898].map((v) => Math.round(v * s));

  // Full lockup (wordmark over mark) on black: splash, store art, and the landing page.
  const lockup = await png(px, W, H, 3).resize(1024, 1024).toBuffer();
  fs.writeFileSync('assets/brand/riffs-logo.png', lockup);

  // Mark on transparency. Outside the record, brightness becomes opacity so edges stay smooth on any colour.
  const mw = mark[1] - mark[0] + 1, mh = mark[3] - mark[2] + 1, side = Math.max(mw, mh) + Math.round(40 * s);
  const cut = (ink) => {
    const out = Buffer.alloc(side * side * 4), ox = Math.round((side - mw) / 2), oy = Math.round((side - mh) / 2);
    for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
      const sx = mark[0] + x, sy = mark[2] + y, i = (sy * W + sx) * 3, o = ((oy + y) * side + ox + x) * 4;
      const inDisc = Math.hypot(sx - disc.x, sy - disc.y) <= disc.r;
      if (inDisc) { out[o] = px[i]; out[o + 1] = px[i + 1]; out[o + 2] = px[i + 2]; out[o + 3] = 255; continue; }
      const lum = Math.max(px[i], px[i + 1], px[i + 2]);
      out[o] = ink; out[o + 1] = ink; out[o + 2] = ink; out[o + 3] = lum;
    }
    return png(out, side, side, 4);
  };
  const markWhite = await (await cut(255)).toBuffer(), markBlack = await (await cut(0)).toBuffer();
  fs.writeFileSync('assets/brand/riffs-mark-white.png', await sharp(markWhite).resize(512, 512).png().toBuffer());
  fs.writeFileSync('assets/brand/riffs-mark-black.png', await sharp(markBlack).resize(512, 512).png().toBuffer());

  // Solid wordmark on transparency, white, for tinting.
  const ww = word[1] - word[0] + 1, wh = word[3] - word[2] + 1, wm = Buffer.alloc(ww * wh * 4);
  for (let y = 0; y < wh; y++) for (let x = 0; x < ww; x++) { const i = ((word[2] + y) * W + word[0] + x) * 3, o = (y * ww + x) * 4; wm[o] = wm[o + 1] = wm[o + 2] = 255; wm[o + 3] = Math.max(px[i], px[i + 1], px[i + 2]); }
  await png(wm, ww, wh, 4).resize({ width: 600 }).toFile('assets/brand/riffs-wordmark.png');

  // App icon: the mark alone, large, on black (the tiny wordmark is unreadable at home-screen size).
  const onBlack = async (size, scale) => {
    const inner = Math.round(size * scale), pad = Math.round((size - inner) / 2);
    return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } })
      .composite([{ input: await sharp(markWhite).resize(inner, inner).toBuffer(), left: pad, top: pad }]).flatten({ background: '#000000' }).png();
  };
  const clear = (size, scale, source) => sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: source, left: Math.round(size * (1 - scale) / 2), top: Math.round(size * (1 - scale) / 2) }]).png();
  const mono = Buffer.from(await sharp(markWhite).ensureAlpha().raw().toBuffer());
  for (let i = 0; i < mono.length; i += 4) mono[i] = mono[i + 1] = mono[i + 2] = 255;
  const monoPng = await sharp(mono, { raw: { width: 512, height: 512, channels: 4 } }).png().toBuffer();

  await Promise.all([
    (await onBlack(1024, 0.78)).toFile('assets/icon.png'),
    (await onBlack(64, 0.86)).toFile('assets/favicon.png'),
    (await onBlack(512, 0.78)).toFile('assets/brand/riffs-icon-preview.png'),
    (await onBlack(256, 0.82)).toFile('assets/brand/riffs-logo-small.png'),
    clear(1024, 0.6, await sharp(markWhite).resize(614, 614).toBuffer()).toFile('assets/android-icon-foreground.png'),
    clear(1024, 0.6, await sharp(monoPng).resize(614, 614).toBuffer()).toFile('assets/android-icon-monochrome.png'),
    sharp(lockup).toFile('assets/splash-icon.png'),
    sharp(lockup).toFile('assets/splash-icon-dark.png'),
  ]);
  console.log('Riffs logo, mark, wordmark, native icons, favicon, and splash assets generated.');
})().catch((error) => { console.error(error); process.exit(1); });

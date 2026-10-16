// Builds every icon slot from the Riffs logo artwork (black square, RIFFS wordmark, R with a record).
// Usage: node scripts/brand-from-logo.cjs [path/to/logo.png]   (defaults to assets/brand/riffs-logo.png)
const fs = require('node:fs');
const sharp = require('sharp');

const master = 'assets/brand/riffs-logo.png';
const input = process.argv[2] || master;
const black = { r: 0, g: 0, b: 0, alpha: 1 };
const clear = { r: 0, g: 0, b: 0, alpha: 0 };

(async () => {
  const source = fs.readFileSync(input);
  // The master is kept at 1024 so every other slot is resized from one copy.
  const logo = await sharp(source).resize(1024, 1024).flatten({ background: black }).png().toBuffer();
  fs.writeFileSync(master, logo);

  /** The logo scaled into Android's adaptive-icon safe zone (the launcher crops the outer third). */
  const inset = async (scale, buffer = logo) => {
    const size = Math.round(1024 * scale), pad = Math.round((1024 - size) / 2);
    const inner = await sharp(buffer).resize(size, size).png().toBuffer();
    return sharp({ create: { width: 1024, height: 1024, channels: 4, background: clear } }).composite([{ input: inner, left: pad, top: pad }]).png();
  };

  // Monochrome (themed) icon: keep only the light parts of the artwork as white, everything else transparent.
  const { data, info } = await sharp(logo).raw().toBuffer({ resolveWithObject: true });
  const mono = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0, o = 0; i < data.length; i += info.channels, o += 4) {
    const light = (data[i] + data[i + 1] + data[i + 2]) / 3;
    mono[o] = mono[o + 1] = mono[o + 2] = 255; mono[o + 3] = light > 150 ? 255 : 0;
  }
  const monoPng = await sharp(mono, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();

  await Promise.all([
    sharp(logo).toFile('assets/icon.png'),
    sharp(logo).resize(64, 64).toFile('assets/favicon.png'),
    sharp(logo).resize(512, 512).toFile('assets/brand/riffs-icon-preview.png'),
    sharp(logo).resize(256, 256).toFile('assets/brand/riffs-logo-small.png'),
    (await inset(0.7)).toFile('assets/android-icon-foreground.png'),
    (await inset(0.7, monoPng)).toFile('assets/android-icon-monochrome.png'),
    sharp(logo).resize(1024, 1024).toFile('assets/splash-icon.png'),
    sharp(logo).resize(1024, 1024).toFile('assets/splash-icon-dark.png'),
  ]);
  console.log('Riffs logo, native icons, favicon, and splash assets generated.');
})().catch((error) => { console.error(error); process.exit(1); });

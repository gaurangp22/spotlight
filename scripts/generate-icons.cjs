// Original vector geometry for Riffs. Regenerate all icon slots with: node scripts/generate-icons.cjs
const fs = require('node:fs');
const sharp = require('sharp');
const mark = 'M24 128V30H54V48C66 35 84 27 108 27H132V59H107C72 59 54 81 54 113V128Z';
const f = 'M20 128V66H6V40H20V31C20 10 35 0 55 0H77V27H60C52 27 49 32 49 40H77V66H49V128Z';
const s = 'M80 41C66 32 54 27 38 27C14 27 1 40 1 57C1 76 14 83 36 88L47 91C55 93 59 95 59 100C59 105 54 108 44 108C31 108 19 102 9 95L0 120C12 130 29 136 47 136C73 136 89 123 89 103C89 84 77 76 53 70L43 68C34 66 30 64 30 59C30 54 35 52 43 52C54 52 64 56 72 61Z';
const svg = (content, viewBox = '0 0 1024 1024') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${content}</svg>`;
const glyph = (color) => `<g fill="${color}" transform="translate(102 96) scale(5.5)"><path d="${mark}"/></g>`;
function stampOrigin(file) {
  const png = fs.readFileSync(file), data = Buffer.from('impeccable:prompt\0Origin: original Riffs vector geometry authored in scripts/generate-icons.cjs; rendered with sharp.'), type = Buffer.from('tEXt');
  const payload = Buffer.concat([type, data]); let crc = 0xffffffff;
  for (const byte of payload) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1; }
  const length = Buffer.alloc(4), checksum = Buffer.alloc(4); length.writeUInt32BE(data.length); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  const chunk = Buffer.concat([length, payload, checksum]), offset = 33; fs.writeFileSync(file, Buffer.concat([png.subarray(0, offset), chunk, png.subarray(offset)]));
}
const wordmark = (color) => svg(`<g fill="${color}"><path d="${mark}" transform="translate(-12 8) scale(.82 1)"/><path d="M112 40H142V136H112Z"/><circle cx="127" cy="15" r="15"/><path d="${f}" transform="translate(160 8)"/><path d="${f}" transform="translate(240 8)"/><path d="${s}" transform="translate(330 0)"/></g>`, '0 0 430 148');
fs.mkdirSync('assets/brand', { recursive: true });
fs.writeFileSync('assets/brand/riffs-mark.svg', svg(`<path fill="#E8174A" d="${mark}"/>`, '0 0 156 156'));
fs.writeFileSync('assets/brand/riffs-wordmark.svg', wordmark('#FFFFFF'));
fs.writeFileSync('assets/brand/riffs-wordmark-rose.svg', wordmark('#E8174A'));
const icon = svg(`<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF2D55"/><stop offset="1" stop-color="#AF52DE"/></linearGradient></defs><rect width="1024" height="1024" fill="url(#g)"/>${glyph('#FFFFFF')}`);
fs.writeFileSync('assets/brand/riffs-icon.svg', icon);
(async () => {
  const render = (source, file, size) => sharp(Buffer.from(source)).resize(size, size).png().toFile(file);
  await Promise.all([
    render(icon, 'assets/icon.png', 1024), render(icon, 'assets/favicon.png', 64),
    render(svg(glyph('#FFFFFF')), 'assets/android-icon-foreground.png', 1024),
    render(svg(glyph('#FFFFFF')), 'assets/android-icon-monochrome.png', 1024),
    render(svg(glyph('#E8174A')), 'assets/splash-icon.png', 1024),
    render(svg(glyph('#FF375F')), 'assets/splash-icon-dark.png', 1024),
    sharp(Buffer.from(wordmark('#FFFFFF'))).resize({ width: 1200 }).png().toFile('assets/brand/riffs-wordmark.png'),
    sharp(Buffer.from(svg(`<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF2D55"/><stop offset="1" stop-color="#AF52DE"/></linearGradient></defs><rect width="1024" height="1024" rx="224" fill="url(#g)"/>${glyph('#FFFFFF')}`))).resize(512, 512).png().toFile('assets/brand/riffs-icon-preview.png'),
  ]);
  for (const file of ['assets/icon.png', 'assets/favicon.png', 'assets/android-icon-foreground.png', 'assets/android-icon-monochrome.png', 'assets/splash-icon.png', 'assets/splash-icon-dark.png', 'assets/brand/riffs-wordmark.png', 'assets/brand/riffs-icon-preview.png']) stampOrigin(file);
  console.log('Riffs vector logo, wordmarks, native icons, favicon, and splash assets generated.');
})().catch((error) => { console.error(error); process.exit(1); });

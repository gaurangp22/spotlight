// Rasterize the original MARGIN monogram for Expo's native icon slots.
const fs = require('node:fs');
const { PNG } = require('pngjs');
const shape = [[260, 285], [360, 285], [470, 470], [580, 285], [680, 285], [680, 725], [590, 725], [590, 450], [470, 635], [350, 450], [350, 725], [260, 725]];
function contains(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function draw(file, size, transparent = false, mono = false) {
  const png = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const sx = x * 1024 / size, sy = y * 1024 / size;
    let rgba = transparent ? [0, 0, 0, 0] : [243, 240, 232, 255];
    if (contains(sx, sy, shape)) rgba = [26, 26, 24, 255];
    if (sx >= 725 && sx < 810 && sy >= 640 && sy < 725) rgba = mono ? [26, 26, 24, 255] : [195, 67, 46, 255];
    const offset = (y * size + x) * 4;
    rgba.forEach((channel, i) => { png.data[offset + i] = channel; });
  }
  fs.writeFileSync(file, PNG.sync.write(png));
}
draw('assets/icon.png', 1024);
draw('assets/android-icon-foreground.png', 1024, true);
draw('assets/android-icon-monochrome.png', 1024, true, true);
draw('assets/favicon.png', 64);
console.log('MARGIN icons generated.');

// Gera og-image.jpg (1200x630) e apple-touch-icon.png a partir do logo.
import sharp from 'sharp';

const bg = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs>
    <radialGradient id="g" cx="78%" cy="85%" r="60%">
      <stop offset="0" stop-color="#ff5a14" stop-opacity=".45"/>
      <stop offset="1" stop-color="#0b0b0c" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="c" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#16171a"/><stop offset=".2" stop-color="#f4f6f8"/>
      <stop offset=".45" stop-color="#6f747b"/><stop offset=".6" stop-color="#2c2f33"/>
      <stop offset=".8" stop-color="#8c9299"/><stop offset="1" stop-color="#101113"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="#0b0b0c"/>
  <rect width="1200" height="630" fill="url(#g)"/>
  <rect x="560" y="470" width="700" height="96" fill="url(#c)"/>
  <text x="80" y="300" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="92" fill="#ededef" letter-spacing="-3">Superfícies</text>
  <text x="80" y="395" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="92" fill="#ff7a2e" letter-spacing="-3">que resistem.</text>
  <text x="82" y="460" font-family="Courier New, monospace" font-size="24" fill="#9b9ba3">ASPERSÃO TÉRMICA · CROMO DURO · USINAGEM</text>
</svg>`);

const logo = await sharp('public/img/logo-tfm.png').resize(260).toBuffer();
await sharp(bg).composite([{ input: logo, left: 80, top: 70 }]).jpeg({ quality: 86 }).toFile('public/og-image.jpg');
await sharp('public/favicon.svg').resize(180, 180).png().toFile('public/apple-touch-icon.png');
console.log('ok');

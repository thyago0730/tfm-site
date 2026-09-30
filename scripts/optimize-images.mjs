// Converte as imagens originais do site antigo para WebP otimizado.
// Uso: node scripts/optimize-images.mjs <pasta-origem>
import sharp from 'sharp';
import { readdirSync } from 'node:fs';
import { join, parse } from 'node:path';

const src = process.argv[2];
const out = 'public/img';
const map = {
  '01-585x415.jpg': 'case-cilindro-laminacao',
  '02-585x415.jpg': 'case-rosca-transportadora',
  '03-585x415.jpg': 'case-pistao-prensa',
  '04-585x415.jpg': 'case-pinch-roll',
  '05-01-585x415.jpg': 'case-garra-sucata',
  '07-585x415.jpg': 'case-bobina-trefila',
  'TFM-FOTO-370x273.jpg': 'equipe-soldagem',
  'slide1-h2.jpg': 'planta-industrial',
  'slide2-h2.jpg': 'industria-2',
  'slide3-h2.jpg': 'industria-3',
  'service3.jpg': 'servico-3',
};

for (const file of readdirSync(src)) {
  const name = map[file];
  if (name) {
    await sharp(join(src, file)).webp({ quality: 82 }).toFile(join(out, `${name}.webp`));
  } else if (file.endsWith('-logo.png')) {
    await sharp(join(src, file)).png({ compressionLevel: 9 }).toFile(join(out, `cliente-${parse(file).name.replace('-logo', '').toLowerCase()}.png`));
  } else if (file === 'logo-site-novo-1.png') {
    await sharp(join(src, file)).png({ compressionLevel: 9 }).toFile(join(out, 'logo-tfm.png'));
    await sharp(join(src, file)).webp({ quality: 90 }).toFile(join(out, 'logo-tfm.webp'));
  }
}
console.log('ok');

// Converte as fotos extraídas do PDF de portfólio (pdfimages -j) para WebP.
// Uso: node scripts/extract-portfolio.mjs <pasta-com-img-NNN.jpg>
import sharp from 'sharp';
import { join } from 'node:path';

const src = process.argv[2];
const map = {
  'img-016.jpg': 'jornada-1-recebimento',
  'img-018.jpg': 'jornada-2-usinagem',
  'img-015.jpg': 'jornada-3-metalizacao',
  'img-017.jpg': 'jornada-4-acabamento',
  'img-014.jpg': 'jornada-5-final',
  'img-037.jpg': 'garra-antes',
  'img-038.jpg': 'garra-depois',
  'img-043.jpg': 'valvula-antes',
  'img-042.jpg': 'valvula-depois',
  'img-021.jpg': 'carbeto-antes',
  'img-020.jpg': 'carbeto-depois',
};

for (const [file, name] of Object.entries(map)) {
  await sharp(join(src, file)).sharpen({ sigma: 0.6 }).webp({ quality: 84 }).toFile(`public/img/${name}.webp`);
}
console.log('ok');

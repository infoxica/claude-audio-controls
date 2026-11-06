import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, writeFileSync, readFileSync, copyFileSync } from 'node:fs';
const svg = readFileSync('assets/branding/icon.svg', 'utf8');
mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/brand.svg', svg);
for (const size of [16, 32, 48, 128, 256, 512]) writeFileSync(`public/icons/icon-${size}.png`, new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng());
copyFileSync('assets/branding/icon.png', 'public/icons/icon-512.png');
console.log('Generated icons from the supplied brand artwork.');

import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
const staging = process.argv.includes('--staging');
const assetRoot = resolve('build/web-assets');
if (assetRoot !== join(resolve('.'), 'build', 'web-assets')) throw new Error('Unexpected asset directory');
rmSync(assetRoot, {recursive:true, force:true});
mkdirSync('build/web-assets', { recursive: true });
cpSync('site-dist', 'build/web-assets', { recursive: true });
function visit(directory: string) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) visit(file);
    else if (entry.name.endsWith('.html') && staging) {
      const html = readFileSync(file, 'utf8').replaceAll('https://claude-audio-controls.infoxica.com/', '/').replace(/data-ga4="[^"]*"/, 'data-ga4=""');
      writeFileSync(file, html);
    }
  }
}
visit('build/web-assets');
if (staging) {
  writeFileSync('build/web-assets/_headers', '/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n');
  writeFileSync('build/web-assets/robots.txt', 'User-agent: *\nDisallow: /\n');
}
console.log(staging ? 'Prepared isolated staging assets with analytics disabled.' : 'Prepared production candidate assets.');

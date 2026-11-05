import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import pkg from '../package.json';
mkdirSync('public/licenses', { recursive: true });
const seen = new Set<string>();
function visit(name: string): void {
  if (seen.has(name)) return; seen.add(name);
  const dir = join('node_modules', name), manifest = join(dir, 'package.json');
  if (!existsSync(manifest)) throw new Error(`Missing license package: ${name}`);
  const meta = JSON.parse(readFileSync(manifest, 'utf8'));
  const file = readdirSync(dir).find(file => /^licen[sc]e(?:\.|$)/i.test(file));
  if (file) writeFileSync(join('public/licenses', name.replaceAll('/', '-') + '.txt'), `${name}@${meta.version}\n${meta.repository?.url || ''}\n\n${readFileSync(join(dir, file), 'utf8')}`);
  for (const dep of Object.keys(meta.dependencies || {})) visit(dep);
}
Object.keys(pkg.dependencies).forEach(visit);
writeFileSync('public/THIRD_PARTY_NOTICES.txt', readFileSync('THIRD_PARTY_NOTICES.md'));
console.log(`Collected notices for ${seen.size} production packages.`);

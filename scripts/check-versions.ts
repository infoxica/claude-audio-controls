import { readFileSync } from 'node:fs';
import pkg from '../package.json';
import manifest from '../public/manifest.json';
import { EXTENSION_VERSION } from '../src/shared/constants';
export function checkVersions(): void {
  if (pkg.version !== manifest.version || pkg.version !== EXTENSION_VERSION) throw new Error('Version mismatch');
  const userscript = readFileSync('userscript/claude-audio-controls.user.js', 'utf8');
  if (!userscript.includes(`// @version      ${pkg.version}\n`)) throw new Error('Userscript version mismatch; regenerate it');
  console.log(`All artifacts: ${pkg.version}`);
}
if (import.meta.main) checkVersions();

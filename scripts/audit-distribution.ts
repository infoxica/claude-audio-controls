import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, relative, extname } from 'node:path';
import { checkVersions } from './check-versions';

checkVersions();
const root = resolve('.');
const candidates = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {encoding:'utf8'}).split('\0').filter(Boolean))].sort();
const allowedRoots = new Set(['.github', 'assets', 'config', 'docs', 'feedback', 'public', 'scripts', 'site', 'src', 'tests', 'userscript']);
const allowedRootFiles = new Set(['.gitattributes','.gitignore','LICENSE','README.md','CHANGELOG.md','CONTRIBUTING.md','PRIVACY.md','THIRD_PARTY_NOTICES.md','bun.lock','package.json','playwright.config.mjs','tsconfig.json','vite.config.ts']);
const binary = new Set(['.png']);
const findings: string[] = [];
const inventory: {path:string; bytes:number; sha256:string}[] = [];
const forbiddenText = [
  /(?:chatgpt\.com|chat\.openai\.com)/i,
  new RegExp(['aifalimlfgiepmbejcemcofninobaiea','cmhbacgmcgiolpidfjcpefkhbbeamemf','G-WBW9CYB4LN'].join('|')),
  /(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/,
  /(?:oauth_token|api_token|client_secret|TURNSTILE_SECRET_KEY)\s*[=:]\s*["']?[A-Za-z0-9_-]{28,}/i,
  /https:\/\/claude\.ai\/chat\/[0-9a-f]{8}-[0-9a-f-]{27,}/i,
];
for (const path of candidates) {
  if (!(path.includes('/') ? allowedRoots.has(path.split('/')[0]) : allowedRootFiles.has(path))) findings.push(`${path}: not in publication allowlist`);
  if (/(^|\/)(?:\.env(?:\.|$)|\.dev\.vars|(?:node_modules|\.wrangler|build|dist|site-dist|\.git)(?:\/|$))/.test(path) || /\.(webm|wav|pcm|opus|log|zip)$/i.test(path)) findings.push(`${path}: private or generated artifact`);
  const bytes = readFileSync(resolve(root,path));
  inventory.push({path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
  if (binary.has(extname(path))) {
    if (!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) findings.push(`${path}: invalid PNG`);
    continue;
  }
  if (bytes.includes(0)) findings.push(`${path}: unexpected binary`);
  // This file declares the exact inherited identifiers being prohibited.
  if (path !== 'scripts/audit-distribution.ts') {
    const text = bytes.toString('utf8');
    forbiddenText.forEach((pattern,index) => { if (pattern.test(text)) findings.push(`${path}: prohibited content pattern ${index+1}`); });
  }
}
const manifest = JSON.parse(readFileSync('dist/manifest.json','utf8'));
if (JSON.stringify(manifest.permissions) !== '["storage"]' || manifest.host_permissions || manifest.web_accessible_resources) findings.push('manifest: unexpected permissions/exposure');
if (manifest.content_scripts.some((script:any) => script.all_frames || script.run_at !== 'document_start' || JSON.stringify(script.matches) !== '["https://claude.ai/*"]')) findings.push('manifest: unexpected site/frame/timing');
if (!existsSync('dist/THIRD_PARTY_NOTICES.txt') || !existsSync('dist/licenses/mediabunny.txt')) findings.push('distribution: dependency notices absent');
const walk = (dir:string):string[] => readdirSync(dir).flatMap(name => { const file = resolve(dir,name); return statSync(file).isDirectory() ? walk(file) : [file]; });
for (const file of walk(resolve('dist'))) {
  const path = relative(resolve('dist'),file).replaceAll('\\','/');
  if (/\.(map|ts|tsx)$/.test(path) || /(?:\.env|\.dev\.vars|test-results)/.test(path)) findings.push(`dist/${path}: unexpected package content`);
}
// Check ZIP CRCs and compare every archived byte to dist, including the root manifest.
const zip = readdirSync('dist-zip').filter(file=>file.endsWith('.zip'));
if (zip.length !== 1) findings.push('distribution: expected one versioned ZIP');
else execFileSync('python', ['-B','-c', `import zipfile,pathlib,sys
root=pathlib.Path('dist')
with zipfile.ZipFile(sys.argv[1]) as z:
 assert z.testzip() is None
 files={p.relative_to(root).as_posix():p.read_bytes() for p in root.rglob('*') if p.is_file()}
 entries={n.replace('\\\\','/'):z.read(n) for n in z.namelist() if not n.endswith('/')}
 assert files==entries, 'ZIP differs from dist'
 assert 'manifest.json' in entries
`, resolve('dist-zip',zip[0])], {stdio:'inherit'});
mkdirSync('build', {recursive:true});
writeFileSync('build/publication-audit.json', JSON.stringify({createdAt:new Date().toISOString(), files:inventory, findings},null,2)+'\n');
if (findings.length) throw new Error(findings.join('\n'));
console.log(`Audited ${inventory.length} public source/assets (${inventory.reduce((n,f)=>n+f.bytes,0)} bytes), manifest scope, notices, and exact ZIP contents. No prohibited content found.`);

import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { checkVersions } from './check-versions';

checkVersions();

const distDir = resolve(__dirname, "../dist");
const zipDir = resolve(__dirname, "../dist-zip");
const packageJson = JSON.parse(readFileSync(resolve(__dirname, "../package.json"), "utf8")) as {
  version: string;
};

if (!existsSync(zipDir)) {
  mkdirSync(zipDir, { recursive: true });
}

const zipPath = resolve(zipDir, `claude-audio-controls-v${packageJson.version}.zip`);
rmSync(zipPath, { force: true });

execFileSync('python', ['-B', '-c', `import pathlib,sys,zipfile
root=pathlib.Path(sys.argv[1])
with zipfile.ZipFile(sys.argv[2], 'w', zipfile.ZIP_DEFLATED) as archive:
 for file in sorted(root.rglob('*')):
  if file.is_file(): archive.write(file, file.relative_to(root).as_posix())
`, distDir, zipPath], {stdio:'inherit'});

console.log(`Extension package zip created at: ${zipPath}`);

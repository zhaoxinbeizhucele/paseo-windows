import { readdirSync, readFileSync, writeFileSync, copyFileSync, statSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { config, root } from './common.mjs';

const source = resolve(process.argv[2] ?? '.upstream');
const output = resolve(root, 'release');
const built = resolve(source, 'packages/desktop/release');
const plan = JSON.parse(readFileSync(resolve(root, 'plan.json'), 'utf8'));
const installer = `Paseo-Setup-${plan.version}-x64.exe`;
for (const name of [installer, `${installer}.blockmap`, 'latest.yml']) {
  if (!statSync(resolve(built, name)).isFile()) throw new Error(`Missing ${name}`);
  copyFileSync(resolve(built, name), resolve(output, name));
}
const yaml = createRequire(import.meta.url)(resolve(source, 'node_modules/js-yaml/index.js'));
const manifestPath = resolve(output, 'latest.yml');
const manifest = yaml.load(readFileSync(manifestPath, 'utf8'));
if (manifest.version !== plan.version) throw new Error('Updater version does not match build');
const entry = manifest.files?.find(file => file.url === installer);
const installerBytes = readFileSync(resolve(output, installer));
if (!entry || entry.sha512 !== createHash('sha512').update(installerBytes).digest('base64')) {
  throw new Error('Updater manifest installer checksum mismatch');
}
manifest.rolloutHours = 0;
manifest.releaseDate = new Date().toISOString();
writeFileSync(manifestPath, yaml.dump(manifest));
const packagedFeed = yaml.load(readFileSync(resolve(built, 'win-unpacked/resources/app-update.yml'), 'utf8'));
const [owner, repo] = config.repository.split('/');
if (packagedFeed.provider !== 'github' || packagedFeed.owner !== owner || packagedFeed.repo !== repo) {
  throw new Error('Packaged update feed does not point at our repository');
}
const archive = spawnSync('git', ['archive', '--format=zip', `--output=${resolve(output, 'upstream-source.zip')}`, 'HEAD'], {
  cwd: source, encoding: 'utf8',
});
if (archive.status !== 0) throw new Error(archive.stderr || 'Source archive failed');
const sums = readdirSync(output).filter(name => name !== 'SHA256SUMS.txt' && statSync(resolve(output, name)).isFile())
  .sort().map(name => `${createHash('sha256').update(readFileSync(resolve(output, name))).digest('hex')}  ${basename(name)}`);
writeFileSync(resolve(output, 'SHA256SUMS.txt'), `${sums.join('\n')}\n`);
console.log(`Verified installer, updater feed and checksums for ${plan.tag}`);

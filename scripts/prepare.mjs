import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { config, root } from './common.mjs';

const source = resolve(process.argv[2] ?? '.upstream');
const plan = JSON.parse(readFileSync(resolve(root, 'plan.json'), 'utf8'));
function git(args, optional = false) {
  const result = spawnSync('git', args, { cwd: source, encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0 && !optional) throw new Error(result.stderr || `git ${args[0]} failed`);
  return result;
}
if (git(['rev-parse', 'HEAD']).stdout.trim() !== plan.upstreamSha) {
  throw new Error('Source checkout does not match planned upstream commit');
}
if (git(['status', '--porcelain', '--untracked-files=no']).stdout.trim()) {
  throw new Error('Refusing to prepare a source checkout with existing tracked changes');
}
const patches = config.patches.map(patch => {
  const patchPath = resolve(root, patch.file);
  const sha256 = createHash('sha256').update(readFileSync(patchPath)).digest('hex');
  let state;
  if (git(['apply', '--reverse', '--check', patchPath], true).status === 0) {
    state = 'already-in-upstream';
  } else {
    git(['apply', '--check', patchPath]);
    git(['apply', patchPath]);
    state = 'applied';
  }
  console.log(`${patch.file}: ${state}`);
  return { ...patch, sha256, state };
});
// The managed daemon and app must report the same personal build version.
const rootPackagePath = resolve(source, 'package.json');
const rootPackage = JSON.parse(readFileSync(rootPackagePath, 'utf8'));
rootPackage.version = plan.version;
writeFileSync(rootPackagePath, `${JSON.stringify(rootPackage, null, 2)}\n`);
const sync = spawnSync(process.execPath, ['scripts/sync-workspace-versions.mjs'], { cwd: source, encoding: 'utf8' });
if (sync.status !== 0) throw new Error(sync.stderr || 'Workspace version sync failed');
const lockPath = resolve(source, 'package-lock.json');
const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
lock.version = plan.version;
for (const workspace of ['', ...rootPackage.workspaces]) {
  const pkg = JSON.parse(readFileSync(resolve(source, workspace, 'package.json'), 'utf8'));
  const locked = lock.packages[workspace];
  if (!locked) throw new Error(`Missing workspace lock entry: ${workspace}`);
  locked.version = pkg.version;
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    if (pkg[section]) locked[section] = pkg[section];
  }
}
writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);

const builderPath = resolve(source, 'packages/desktop/electron-builder.yml');
let builder = readFileSync(builderPath, 'utf8');
const originalFeed = /publish:\r?\n  provider: github\r?\n  owner: getpaseo\r?\n  repo: paseo(?=\r?\n)/g;
if ([...builder.matchAll(originalFeed)].length !== 1) throw new Error('Upstream update feed changed; review required');
const [owner, repo] = config.repository.split('/');
builder = builder.replace(originalFeed, `publish:\n  provider: github\n  owner: ${owner}\n  repo: ${repo}`);
writeFileSync(builderPath, builder);

// Keep notifications/downloads inside Paseo; installation stays a user action.
const updaterPath = resolve(source, 'packages/desktop/src/features/auto-updater.ts');
let updater = readFileSync(updaterPath, 'utf8');
if (!updater.includes('autoUpdater.autoInstallOnAppQuit = false;')) {
  throw new Error('Upstream install behavior changed; review required');
}
mkdirSync(resolve(root, 'release'), { recursive: true });
const provenance = {
  ...plan,
  repository: config.repository,
  automationSha: process.env.GITHUB_SHA ?? 'local-preview',
  patches,
  buildRun: process.env.GITHUB_RUN_ID
    ? `https://github.com/${config.repository}/actions/runs/${process.env.GITHUB_RUN_ID}` : null,
};
writeFileSync(resolve(root, 'release/provenance.json'), `${JSON.stringify(provenance, null, 2)}\n`);
writeFileSync(resolve(root, 'release/applied-changes.patch'), git(['diff', '--binary', 'HEAD']).stdout);
writeFileSync(resolve(root, 'release/RELEASE-NOTES.md'), [
  `Paseo Windows ${plan.upstreamTag}，补丁修订 ${plan.revision}（应用版本 ${plan.version}）。`,
  '',
  `上游：[${plan.upstreamTag}](${plan.upstreamRelease})，源码提交 \`${plan.upstreamSha}\`。`,
  '',
  '包含 Windows 盘符链接修复 [#7711](https://github.com/getpaseo/paseo/pull/7711)。',
  '更新源为本仓库；保留 Paseo 的更新提示和手动安装行为。只构建 Windows x64。',
  '',
  '此为个人维护的非官方版本，安装包没有官方代码签名，Windows 可能显示未知发布者提示。',
  '自动验证包括文件链接回归测试、类型检查、构建及 Windows 打包运行检查；真实会话点击和覆盖安装需要人工验收。',
  '',
  '首次使用：下载 Paseo-Setup-*.exe，保存工作后退出 Paseo，再运行安装包。后续使用应用内更新入口。',
  'upstream-source.zip + applied-changes.patch 提供本次构建的源码；SHA256SUMS.txt 提供文件校验。',
  '',
].join('\n'));

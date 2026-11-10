import { writeFileSync } from 'node:fs';
import { buildVersion, config, github, outputs } from './common.mjs';

const release = await github(`repos/${config.upstream}/releases/latest`);
if (release.draft || release.prerelease) throw new Error('Latest upstream release must be stable');
const upstreamTag = release.tag_name;
const version = buildVersion(upstreamTag, config.revision);
const tag = `v${version}`;
let object = (await github(`repos/${config.upstream}/git/ref/tags/${upstreamTag}`)).object;
for (let depth = 0; object.type === 'tag' && depth < 5; depth++) {
  object = (await github(`repos/${config.upstream}/git/tags/${object.sha}`)).object;
}
if (object.type !== 'commit' || !/^[a-f0-9]{40}$/.test(object.sha)) {
  throw new Error('Could not resolve upstream tag to a commit');
}
const existing = await github(`repos/${config.repository}/releases/tags/${tag}`, { optional404: true });
const plan = {
  upstream: config.upstream,
  upstreamTag,
  upstreamSha: object.sha,
  upstreamRelease: release.html_url,
  version,
  tag,
  revision: config.revision,
};
writeFileSync('plan.json', `${JSON.stringify(plan, null, 2)}\n`);
outputs({ ...plan, needed: !existing || existing.draft });

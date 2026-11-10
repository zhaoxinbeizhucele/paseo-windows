import { readFileSync } from 'node:fs';
import { config, github, root } from './common.mjs';
import { resolve } from 'node:path';

// Real repository activity prevents GitHub disabling an otherwise idle public schedule.
const path = `repos/${config.repository}/contents/state/last-check.json`;
const current = await github(path, { optional404: true });
if (current) {
  const state = JSON.parse(Buffer.from(current.content, 'base64').toString('utf8'));
  const age = Date.now() - Date.parse(state.checkedAt);
  if (Number.isFinite(age) && age < 30 * 86400000) {
    console.log('Monthly schedule maintenance is not due');
    process.exit(0);
  }
}
const plan = JSON.parse(readFileSync(resolve(root, 'plan.json'), 'utf8'));
const content = `${JSON.stringify({ checkedAt: new Date().toISOString(), upstreamTag: plan.upstreamTag, upstreamSha: plan.upstreamSha }, null, 2)}\n`;
await github(path, { method: 'PUT', body: {
  message: 'Record monthly upstream check to keep daily schedule active',
  content: Buffer.from(content).toString('base64'),
  ...(current ? { sha: current.sha } : {}),
  branch: 'main',
} });
console.log('Recorded monthly schedule maintenance');

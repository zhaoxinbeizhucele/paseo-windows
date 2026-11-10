import { readFileSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const config = JSON.parse(readFileSync(resolve(root, 'config.json'), 'utf8'));

export function buildVersion(tag, revision) {
  const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(tag);
  if (!match || !Number.isInteger(revision) || revision < 1 || revision > 99) {
    throw new Error('Expected a stable vMAJOR.MINOR.PATCH tag and revision 1..99');
  }
  const [major, minor, patch] = match.slice(1).map(Number);
  const encodedPatch = patch * 100 + revision;
  if ([major, minor, encodedPatch].some(n => !Number.isSafeInteger(n) || n > 65535)) {
    throw new Error('Version exceeds Windows version component limits');
  }
  return `${major}.${minor}.${encodedPatch}`;
}

export async function github(path, { optional404 = false, method = 'GET', body } = {}) {
  const response = await fetch(`https://api.github.com/${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(process.env.GH_TOKEN ? { Authorization: `Bearer ${process.env.GH_TOKEN}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(60000),
  });
  if (optional404 && response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub ${path}: HTTP ${response.status}`);
  return response.json();
}

export function outputs(values) {
  for (const [name, value] of Object.entries(values)) {
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
    console.log(`${name}=${value}`);
  }
}

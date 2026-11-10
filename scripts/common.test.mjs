import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildVersion } from './common.mjs';

test('successive patch, upstream patch, minor and major versions remain ordered', () => {
  const tags = [['v0.15.3', 1], ['v0.15.3', 2], ['v0.15.4', 1], ['v0.16.0', 1], ['v1.0.0', 1]];
  const versions = tags.map(([tag, revision]) => buildVersion(tag, revision).split('.').map(Number));
  for (let i = 1; i < versions.length; i++) {
    const firstDifferent = versions[i].findIndex((value, n) => value !== versions[i - 1][n]);
    assert.ok(firstDifferent >= 0 && versions[i][firstDifferent] > versions[i - 1][firstDifferent]);
  }
});

test('rejects prereleases, malformed tags, overlapping revisions and Windows overflow', () => {
  for (const [tag, revision] of [['v0.15.3-beta.1', 1], ['0.15.3', 1], ['v0.15.3', 0], ['v0.15.3', 100], ['v0.15.656', 1]]) {
    assert.throws(() => buildVersion(tag, revision));
  }
});

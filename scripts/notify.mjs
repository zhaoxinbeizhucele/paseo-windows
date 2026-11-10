import { config, github } from './common.mjs';

const tag = process.env.RELEASE_TAG;
if (!/^v\d+\.\d+\.\d+$/.test(tag ?? '')) throw new Error('Invalid release tag');
const prefix = `repos/${config.repository}`;
const release = await github(`${prefix}/releases/tags/${tag}`);
if (release.draft || release.prerelease) throw new Error('Refusing to notify an unpublished stable release');
const threadMarker = '<!-- paseo-update-notifications -->';
const releaseMarker = `<!-- paseo-release:${tag} -->`;
const text = `${releaseMarker}\n\n@${config.repository.split('/')[0]}，Paseo Windows **${tag}** 已构建完成。\n\n[下载安装包](${release.html_url})\n\n${release.body}\n\n安装前请保存工作并正常退出 Paseo。`;
const issues = await github(`${prefix}/issues?state=all&per_page=100`);
const issue = issues.find(item => !item.pull_request && item.body?.includes(threadMarker));
if (!issue) {
  await github(`${prefix}/issues`, { method: 'POST', body: {
    title: 'Paseo Windows 更新提醒',
    body: `${threadMarker}\n\n这里自动通知已发布的安装包。关闭此 issue 可停止后续 GitHub 提醒；应用内更新提示不受影响。\n\n${text}`,
    assignees: [config.repository.split('/')[0]],
  } });
  console.log('Created assigned GitHub update notification');
} else if (issue.state === 'closed') {
  console.log('Notification thread is closed; respecting opt-out');
} else if (issue.body?.includes(releaseMarker)) {
  console.log('Release already notified');
} else {
  let notified = false;
  for (let page = 1; ; page++) {
    const comments = await github(`${prefix}/issues/${issue.number}/comments?per_page=100&page=${page}`);
    if (comments.some(comment => comment.body?.includes(releaseMarker))) { notified = true; break; }
    if (comments.length < 100) break;
  }
  if (!notified) await github(`${prefix}/issues/${issue.number}/comments`, { method: 'POST', body: { body: text } });
  console.log(notified ? 'Release already notified' : 'Posted GitHub update notification');
}

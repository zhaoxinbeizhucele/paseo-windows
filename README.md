# Paseo Windows 个人补丁构建

从 [getpaseo/paseo](https://github.com/getpaseo/paseo) 的最新稳定标签取源码，应用固定补丁，构建 Windows x64 安装包。此为个人维护的非官方版本。

当前补丁：[PR #7711](https://github.com/getpaseo/paseo/pull/7711)，使 Windows 工作区中的 `/E:/...` 文件链接正确解析。

## 使用

从本仓库 [Releases](https://github.com/zhaoxinbeizhucele/paseo-windows/releases/latest) 下载 `Paseo-Setup-*-x64.exe`。保存工作、正常退出 Paseo 后运行安装包。保留原有 Paseo 应用标识和用户数据目录，便于覆盖安装；首次覆盖安装和真实会话点击仍需人工验收。

后续使用 Paseo 自带更新入口。打包时更新源改为本仓库，应用继续提示更新、下载更新，由用户决定安装。安装包没有官方代码签名，Windows 可能显示未知发布者提示。

每次成功发布后，也会在本仓库的“Paseo Windows 更新提醒”issue 中通知并提及仓库拥有者，附上下载链接。GitHub 收件箱可查看；是否收到邮件或手机推送取决于用户的 GitHub 通知设置。关闭该 issue 可停用此渠道，应用内提示继续保留。

## 同步和发布

- 每天北京时间 09:23 检查最新官方稳定版，GitHub 调度可能延迟；也可手动运行 Actions。
- 仅在缺少对应个人版本时构建；不会追踪上游 main 或 beta。
- 每次从稳定标签解析出的固定提交检出干净源码，再应用仓库内的固定补丁。不依赖持续累积的合并分支。
- 补丁已完整进入上游时自动跳过；补丁冲突、测试、类型检查、构建、打包运行检查或更新元数据验证失败时停止发布。
- 只发布完整、校验通过的安装包及 `latest.yml`、blockmap、源码、差异和构建出处；构建过程没有生产凭据，不会操作用户机器。
- 使用 GitHub Actions 默认 `GITHUB_TOKEN`，无需个人 Token 或 npm 发布权限。

版本号使用 `MAJOR.MINOR.(PATCH * 100 + revision)`，例如官方 `0.15.3` 的修订 1 为 `0.15.301`。这是有效的稳定版号，保证同一上游版本增加补丁及上游升级时，应用更新器都能正确比较版本。每次修改补丁或重新发布同一上游版本，必须增加 `config.json` 的 revision（1–99）。GitHub Release 正文记录对应的官方版本。

GitHub Actions 失败会保留运行记录和诊断文件。定时工作流每 30 天记录一次上游检查状态，防止公开仓库因 60 天无活动被 GitHub 自动停用调度。应用内更新提醒从首次安装本仓库版本后生效。

## 本地检查与追溯

`npm test` 检查版本顺序及输入边界，无需安装依赖。`node scripts/plan.mjs` 解析最新稳定版；`.upstream` 中须检出 plan.json 指定的提交，然后运行 `node scripts/prepare.mjs .upstream`。

安装包的 `SHA256SUMS.txt` 可用于校验；`provenance.json` 记录上游提交、补丁哈希和 Actions 运行。`upstream-source.zip` 解压后应用 `applied-changes.patch` 即为修改后的构建源码；上游许可保留在源码归档内。

官方合并并发布修复后，可以撤掉相应补丁；恢复官方更新源需安装官方包，不会在后台自动切换。

# 发布到 GitHub

项目仓库：[boxuanzou468-blip/quietfeed](https://github.com/boxuanzou468-blip/quietfeed)。下方说明从源码生成附件及发布新版本的流程；远端结果以 [Actions](https://github.com/boxuanzou468-blip/quietfeed/actions) 和 [Releases](https://github.com/boxuanzou468-blip/quietfeed/releases) 为准。

## 1. 验证并生成附件

```sh
npm ci
npm run check
npm run release
```

`artifacts/` 中应有 Chrome ZIP、Edge ZIP、源码 ZIP 和 `SHA256SUMS.txt`。
扩展 ZIP 根目录直接包含 `manifest.json`。源码 ZIP 包含 `quietfeed/` 目录，不含依赖、浏览器配置、测试日志或用户数据。

## 2. 创建与推送仓库

在 GitHub 创建公开的 `quietfeed` 仓库，暂不添加远端 README 或许可证。
在源码目录运行下列命令，将 `YOUR_USERNAME` 换成自己的 GitHub 用户名。

```sh
git init -b main
git add .
git commit -m "Release QuietFeed v0.2.0"
git remote add origin https://github.com/YOUR_USERNAME/quietfeed.git
git push -u origin main
```

如果已经初始化仓库，跳过 `git init`；如果已经配置远端，先用 `git remote -v` 检查，不要覆盖其他仓库地址。
GitHub 登录和凭据由自己在本机完成，不要把 Token 放进源代码、截图、Issue 或聊天消息。

## 3. 创建版本

先确认 CI 通过，再推送版本标签：

```sh
git tag v0.2.0
git push origin v0.2.0
```

`release.yml` 会检查标签与 `package.json` 的版本相同，重新运行测试并将 3 个 ZIP 和校验文件附到 GitHub Release。
首次运行前需允许仓库执行 GitHub Actions；发布 job 只申请 `contents: write`。

## 发布说明

发布前阅读 [验证记录](VERIFICATION.md) 和新增站点的结构证据。v0.2.0 提供五站设置；百度仅首页热搜，CSDN 仅首页资讯、开源、精选博客和侧栏社区/直播/课程推荐（含 iframe 的广告保留），知乎明确为待登录实测的试验适配。发布说明必须保留这些页面范围，以及真实网站、原生授权弹窗与登录态的覆盖限制；不要把模拟页面测试或 v0.1 历史结果写成本轮网站完整验收。
仓库上传、远端 CI 和 Release 附件只有在 GitHub 页面实际可见后才算发布完成。

# 百度桌面网页版适配证据

日期：2026-10-22。通过项目 Playwright 启动全新、无登录的独立 Chromium；未访问用户的试用配置或日常浏览器配置，未登录、未处理验证码。

## 实际访问

- `https://www.baidu.com/` 首次返回 HTTP 200，页面标题为“百度一下，你就知道”，DOM 包含原站搜索结构和首页热搜。首次检查未记录搜索控件尺寸，不能据此将 DOM 中的 `#kw` 认定为可见输入。
- 实际 DOM 中观察到 `#form`（提交地址 `https://www.baidu.com/s`）、`input#kw[name="wd"]`、`#s-hotsearch-wrapper`、`.s-hotsearch-title`、`#hotsearch-content-wrapper` 和 `.hotsearch-item`。该次 `#kw` 未设置 placeholder；未获得单独“默认搜索热词”模块的证据，因此不隐藏占位文字或输入后的联想建议。
- `https://www.baidu.com/s?wd=TypeScript` 跳转到 `wappass.baidu.com` 的安全验证页面，标题“百度安全验证”。未完成验证，也未读取结果页结构。
- 随后独立 Chromium 和 Edge 的首页检查均遇到 `net::ERR_CONNECTION_CLOSED`。这两次未获得补充 DOM，不算通过。未采用修改身份、验证码或登录绕过手段。
- 补充一次独立 Chromium 只读检查后得到 HTTP 200：实际可见搜索控件为 `textarea#chat-textarea.chat-input-textarea.chat-input-scroll-style`，在 1440×1000 视口中尺寸 771×28，依次位于 `#chat-input-area`、`.chat-input-container`、`.chat-input-wrapper.chat-normal-wrapper` 内，不在 `form` 内。旧 `input#kw.s_ipt[name="wd"]` 仍在 `form#form.fm.virtual-form` 内，但原生尺寸为 0×0、不可见。该 textarea 当时有原站动态热词 placeholder；本轮不增加占位词隐藏规则，也未输入或提交搜索。

## 纳入规则

仅提供 `homeHotSearch`（首页热搜）。首页路径只认可 `/`；`/s` 搜索结果及其他路径保留原样，其他百度子域不在本适配器权限范围内。

隐藏目标为已观察到的 `#s-hotsearch-wrapper #hotsearch-content-wrapper` 和 `#s-hotsearch-wrapper .s-hotsearch-title`。保留外层 `#s-hotsearch-wrapper` 作为可撤销搜索引导的挂载点，引导按钮优先聚焦实测可见的 `textarea#chat-textarea`，保留 `#form #kw` 作为旧版输入布局回退。规则不移除原站节点，不扩大到页面根节点、搜索表单、结果区或整个右侧栏。

搜索表单、搜索输入、结果区、通用弹层以及百度登录/验证节点列入保护。若目标包含受保护节点，目标整体保留。未匹配已知结构时由通用引擎报告模块未匹配，不推测新的隐藏范围。

## 验证范围与待验收

`tests/fixtures/baidu-home.html` 是根据上述首页选择器编写的脱敏合成页面，包含实际观察到的可见 textarea 和隐藏虚拟表单结构，非原网页快照；`baidu-search.html` 是保守边界测试页面，其结果区结构仅用于验证“不隐藏”约束，不能作为真实结果页结构证据。独立 Vitest 覆盖隐藏与完整恢复、开关、textarea 优先聚焦和旧版输入回退、用户输入不变、联想建议、登录验证码保护、路由跳转和未知结构。

尚未完成：登录态首页、真实浏览器安装后的隐藏/恢复、原生授权接受/拒绝、真实输入后搜索与联想、真实结果页及 Edge 页面行为。结果页热榜侧栏 `searchSidebar` 和默认热词 `searchHotWords` 未纳入本轮支持。

# CSDN 适配证据与边界

检查日期：2026-10-22。使用项目 Playwright 的 Chromium 全新无登录上下文，只读检查公开 DOM，并在独立测试上下文运行生产网页引擎检查隐藏与恢复，未使用现有试用浏览器配置或登录态。

## 已看到的真实页面结构

访问 `https://www.csdn.net/` 得到 HTTP 200，标题为“CSDN_专业开发者社区”。两次独立成功访问中确认：

| 模块           | 实际 DOM                                                                             | 本版处理                                                                 |
| -------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| 资讯头条及轮播 | `#home-content-box > .home-info`，子节点 `.home-info-banner`、`.home-info-headlines` | 仅收起标题、头条列表和不含受保护内容的轮播链接，不隐藏包含 iframe 的外层 |
| 推荐开源项目   | `#home-content-box > .home-project`                                                  | 由“首页推荐”控制                                                         |
| 精选博客       | `#home-content-box > .home-article`                                                  | 由“首页推荐”控制                                                         |
| 侧栏广告       | `#home_box_right #kp_box_www_swiper`，文字“广告”，内部含 iframe                      | 保留，避免覆盖 iframe 保护                                               |
| 侧栏社区推荐   | `#home_box_right #www-home-silde > .ContentBlock`                                    | 由“侧栏推荐”控制                                                         |
| 侧栏直播推荐   | `#home_box_right #www-home-silde > .broadcast`                                       | 由“侧栏推荐”控制                                                         |
| 侧栏精品课程   | `#home_box_right #www-home-silde > .member`                                          | 由“侧栏推荐”控制                                                         |
| 侧栏活动日历   | `#home_box_right #www-home-silde > .calendar`                                        | 保留                                                                     |
| 顶部原生搜索   | `#toolbar-search-input`，默认占位“搜CSDN”                                            | 保留                                                                     |
| 原生登录入口   | `#csdn-toolbar-profile-nologin`                                                      | 保留                                                                     |
| 左侧个人导航   | `.layout-sidebar-aside`，含关注、收藏、历史                                          | 整体保留                                                                 |

搜索引导插入 `#home-content-box`；只隐藏已确认的推荐子模块，不隐藏整个容器。不对活动日历、整栏布局、应用根节点或原生工具栏设置隐藏规则。

真实页面首次执行生产 `QuietFeedEngine` 后，确认 `.home-info` 内 `#kp_box_987` 及侧栏广告内部的 `#kp_box_585` 等含有 iframe，受通用保护规则影响而无法整体隐藏。因此取消这两处外层隐藏规则：资讯改为精确的标题、`.home-info-headlines` 和 `.home-info-banner a#banner-box`，侧栏广告保留。没有取消 iframe、播放器或登录保护，也不声称本版能消除 CSDN 所有广告。

## 未能验证的页面

访问以下公开文章时，Playwright 最终得到 HTTP 403、标题“403 Forbidden”，未获得正文 DOM；其他请求先后出现 `net::ERR_CONNECTION_CLOSED` 和 HTTP 521：

- `https://blog.csdn.net/blogdevteam/article/details/126135357`
- `https://blog.csdn.net/blogdevteam/article/details/90369522`
- `https://blog.csdn.net/csdnnews/article/details/168762710`

因此本版**不发布文章页相关推荐规则，不申请 `blog.csdn.net` 权限，也不向博客注入脚本**。正文、代码、作者、目录、评论均保留原样。要支持文章页，需要在可访问环境重新确认实际结构。

## 自动化证据的含义

`tests/fixtures/csdn-home.html` 为根据已见 DOM 编写的脱敏结构测试页，文字为合成内容。`csdn-article.html` 是专门验证“不支持的路由保持原样”的虚构页面，不是抓取到的文章。Vitest 覆盖精确路由、独立模块开关、同节点恢复、动态加载、搜索跳转和保护节点；这些测试不代表真实站点已完成隐藏效果或登录态验收。

最终规则在真实首页 HTTP 200 上再次运行生产 `QuietFeedEngine`：8 条选择器合计命中 11 个可见节点，启用后其中 10 个隐藏；剩余 1 个轮播链接含 iframe，按保护规则保持可见。关闭后 11 个节点全部恢复，扩展拥有的样式和引导节点为 0；原生搜索、左导航、活动日历、iframe 广告保持可见。可见性检查同时使用元素及祖先的 `display`/`visibility` 和 `getClientRects()`。该检查由 Vite 内存编译当前 adapter/engine 后在独立浏览器页面执行，不代表扩展安装及授权流程验收。

Chrome、Edge 真实扩展启用授权、登录及完整浏览行为仍需人工试用验证。匹配失败时保留页面并报告未匹配，不扩大选择器。

## 搜索控件追加检查

同日最后一次追加真实首页只读检查，计划枚举 `input`、`textarea`、`[contenteditable="true"]` 的尺寸、可见性和祖先结构；导航在 25 秒超时，未获得可用 DOM，按要求未重试、未登录、未输入。此前成功检查中 `#toolbar-search-input` 可见（`display: inline-block`、`getClientRects().length = 1`），但该历史结果不能证明最终扩展 smoke 时同样可见。本次没有证据支持改用另一控件，因此保留该精确选择器，并将当前搜索控件确认记为尚未完成。

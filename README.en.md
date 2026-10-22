# QuietFeed · 静流

**Search first, scroll intentionally.**

A local-first browser extension that hides selected recommendation surfaces while preserving content you choose to open. Version 0.2.0 adds the Baidu homepage, the CSDN homepage, and experimental Zhihu support alongside Bilibili and Xiaohongshu.

[简体中文](README.md) · [User guide, Chinese](docs/USER_GUIDE.md) · [Manual validation](docs/VALIDATION.md) · [Privacy](PRIVACY.md)

[Download for Chrome](https://github.com/boxuanzou468-blip/quietfeed/releases/download/v0.2.0/quietfeed-0.2.0-chrome.zip) · [Download for Edge](https://github.com/boxuanzou468-blip/quietfeed/releases/download/v0.2.0/quietfeed-0.2.0-edge.zip) · [All releases](https://github.com/boxuanzou468-blip/quietfeed/releases) · [Report an issue](https://github.com/boxuanzou468-blip/quietfeed/issues)

[![CI](https://github.com/boxuanzou468-blip/quietfeed/actions/workflows/ci.yml/badge.svg)](https://github.com/boxuanzou468-blip/quietfeed/actions/workflows/ci.yml)

![QuietFeed settings](docs/assets/options.png)

![QuietFeed demonstration](docs/assets/demo.gif)

The settings screenshot shows the five sites in v0.2. The animation uses a visibly labeled original synthetic layout driven by the real extension. It is not live-site compatibility evidence.

## Features

- Hide homepage feeds, default search trends, and related recommendations through built-in, site-specific modules.
- Configure all five sites independently. Every site starts disabled and requests access to its exact host when you enable it. Zhihu is clearly labeled experimental.
- Restore individual modules without turning off the whole extension.
- Temporarily allow a site for 10 minutes, with automatic expiry and an early resume option.
- Keep configuration on your device. No account, cloud sync, AI service, or analytics.

QuietFeed supports desktop Chrome and Edge. It changes the visibility of supported webpage regions; it does not block network requests or control mobile apps. The interface is currently Chinese.

| Site                | Adapted surfaces                                                                                                                                | Preserved pages and limits                                                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Bilibili            | Homepage feed, promotions, trending/ranking entries, default search trends, related videos                                                      | Player, episode lists and comments; search, activity and profile subdomains receive no scripts                                           |
| Xiaohongshu         | Discovery feed, discovery category navigation, default search trends                                                                            | Search results, note details, comments, profiles, messages and login flows                                                               |
| Baidu               | Homepage hot-search list only                                                                                                                   | Native search and typed suggestions; result pages remain unchanged                                                                       |
| CSDN                | Homepage news titles/headlines/carousel links, open-source projects and featured blogs; right-side community/live-stream/course recommendations | Search, navigation and iframe advertisements remain; no injection on blog articles, code, tables of contents or comments                 |
| Zhihu, experimental | Homepage recommendations and question-page related sidebar modules                                                                              | Search, questions, answers, comments, following, profiles and collections; no column-host injection; **signed-in live testing required** |

Each site requests one exact `www` host, without wildcard subdomains. Baidu result-page sidebars, CSDN blog articles and Zhihu columns are outside the added hiding rules. Live Zhihu attempts encountered sign-in redirects or HTTP 403; its rules have not passed signed-in live testing. See the evidence for [Baidu](docs/evidence/baidu.md), [CSDN](docs/evidence/csdn.md) and [Zhihu](docs/evidence/zhihu.md).

## Install an unpacked release

Download these packages from the repository's [Releases](https://github.com/boxuanzou468-blip/quietfeed/releases) page, or run `npm run release` to generate them locally in `artifacts/`:

- `quietfeed-0.2.0-chrome.zip`
- `quietfeed-0.2.0-edge.zip`

Each release also includes `quietfeed-0.2.0-source.zip` and `SHA256SUMS.txt`.

1. Extract the browser ZIP into a folder you intend to keep.
2. Open `chrome://extensions` or `edge://extensions` and enable Developer mode.
3. Choose **Load unpacked**, then select the extracted directory containing `manifest.json`.
4. Pin QuietFeed, open its settings, enable a site, and approve access for that site.
5. Open or refresh the site and check the selected modules.

Do not load the ZIP itself. If release attachments are not available yet, build locally and load `.output/chrome-mv3` or `.output/edge-mv3`.

![QuietFeed popup](docs/assets/popup.png)

Disabling a site restores its normal page display. Browser permissions are managed separately in the browser's extension settings. Click **放行一下** to allow a site for 10 minutes; click **提前结束** to resume hiding early. Other sites keep their settings. Disabling an individual hiding module switches that site to custom mode.

There is no arbitrary element picker, shared rule system, account system, or cloud service in this version.

## Validation status

| Check                                                   | Status                                                                                                                                                                      |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v0.2 unit, lint, type and local-fixture browser tests   | Passed: 122 unit tests, 13 Chrome fixture tests, and 5 additional-site/permission fixture tests in installed Edge; see [verification details](docs/VERIFICATION.md)         |
| v0.2 Chrome / Edge builds and packaging                 | Both builds, browser/source ZIPs and per-entry integrity checks passed                                                                                                      |
| Historical Bilibili / Xiaohongshu live checks           | Retained as v0.1 evidence, not a v0.2 rerun: Bilibili homepage partly verified; latest Xiaohongshu run restricted, with an earlier Edge run verifying two discovery regions |
| Live Baidu homepage                                     | Two original hot-list regions completed hide/restore and permission-removal cycles in Chrome and Edge; real search focus passed. Results remain unadapted                   |
| Live CSDN homepage                                      | Ten original targets completed hide/restore and permission-removal cycles in both browsers; real search focus passed. Blog articles are not injected                        |
| Live Zhihu behavior                                     | Experimental, signed-in testing required; sign-in redirects or HTTP 403 prevented verification                                                                              |
| All five sites signed in, and native permission prompts | Full manual acceptance outstanding                                                                                                                                          |
| v0.2 manual unpacked loading in Chrome and Edge         | Pending this release's manual acceptance                                                                                                                                    |

Passing local tests does not establish compatibility with live sites or all account states. Follow [the manual checklist](docs/VALIDATION.md) before marking those checks complete.

Historical automated effect tests used test-only host pregrants in isolated profiles. Native permission prompts remain a manual acceptance item. Public structure inspection and synthetic-fixture tests for added sites are recorded separately; they do not establish live compatibility for every page. See [verification details](docs/VERIFICATION.md) and [GitHub Actions](https://github.com/boxuanzou468-blip/quietfeed/actions) for remote checks.

## Develop

Use Node.js 22.12 or newer and npm. CI runs Node.js 24.

```sh
npm ci
npm run dev
```

```sh
npm run dev:edge
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run release
```

The release command builds both browsers and writes extension ZIPs, a source ZIP, and checksums into `artifacts/`.

## Contribute

QuietFeed is available under the [MIT license](LICENSE). See [CONTRIBUTING.md](CONTRIBUTING.md) for development, compatibility reports, and privacy-conscious bug reporting.

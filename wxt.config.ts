import { defineConfig } from 'wxt';
import { SITE_IDS, SITES } from './src/core/config';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: '静流 QuietFeed',
    description: '让搜索回到首页。按网站隐藏推荐、热搜与相关推荐，保留主动选择的内容。',
    version: '0.2.0',
    permissions: ['storage', 'scripting', 'alarms', 'activeTab'],
    optional_host_permissions: SITE_IDS.flatMap((site) => SITES[site].origins),
    action: { default_title: '静流 QuietFeed' },
    options_ui: { page: 'options.html', open_in_tab: true },
    icons: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' },
    minimum_chrome_version: '120',
  },
});

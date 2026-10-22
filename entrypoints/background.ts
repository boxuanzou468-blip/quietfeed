import { browser } from 'wxt/browser';
import { createController } from '../src/background/controller';

export default defineBackground(() => {
  const controller = createController();
  const reconcile = () => {
    void controller.reconcile().catch((error: unknown) => {
      console.warn(
        'QuietFeed could not reconcile settings:',
        error instanceof Error ? error.message : 'Unknown error',
      );
    });
  };
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Only our own extension pages issue commands. Website scripts cannot change settings.
    if (
      sender.id !== browser.runtime.id ||
      (sender.url && !sender.url.startsWith(browser.runtime.getURL('')))
    )
      return false;
    if (
      !message ||
      typeof message !== 'object' ||
      !('type' in message) ||
      typeof message.type !== 'string' ||
      message.type.startsWith('quietfeed:')
    )
      return false;
    void controller.handle(message).then(sendResponse);
    return true;
  });
  browser.runtime.onInstalled.addListener(reconcile);
  browser.runtime.onStartup.addListener(reconcile);
  browser.permissions.onRemoved.addListener(reconcile);
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name.startsWith('quietfeed:resume:')) reconcile();
  });
  // Also reconcile on a worker restart: alarms can disappear across browser sessions.
  reconcile();
});

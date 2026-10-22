import { browser } from 'wxt/browser';
import type { Command, CommandResult, Snapshot } from './protocol';

export async function sendCommand(command: Command): Promise<Snapshot> {
  const result: CommandResult | undefined = await browser.runtime.sendMessage(command);
  if (!result) throw new Error('扩展后台暂时没有响应，请重新打开静流。');
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

/**
 * Browser Extension API wrapper with modern TypeScript patterns
 */

import { browserAPI } from './browser-api';

export interface Settings {
  activationKey: string;
  endKey: string;
  toggleMode: boolean;
  dedupe: boolean;
  deepResolve: boolean;
  grabDelay: number;
}

export function storageGet<T = any>(keys: string[]): Promise<Record<string, T>> {
  return browserAPI.storageGet<T>(keys);
}

export function storageSet(items: Record<string, any>): Promise<void> {
  return browserAPI.storageSet(items);
}

export function downloadsDownload(options: chrome.downloads.DownloadOptions): Promise<number> {
  return browserAPI.downloadFile(options);
}

export function runtimeOnMessageAddListener(
  callback: (
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ) => void | boolean | Promise<any>
): void {
  browserAPI.addMessageListener(callback);
}

export async function getSettings(): Promise<Settings> {
  try {
    const data = await storageGet<Settings>(['settings']);
    return data.settings || getDefaultSettings();
  } catch (error) {
    return getDefaultSettings();
  }
}

export function sendMessage<T = any>(message: any): Promise<T> {
  return browserAPI.sendMessage<T>(message);
}

function getDefaultSettings(): Settings {
  return {
    activationKey: 'ShiftLeft',   // LEFT SHIFT key code
    endKey: 'ControlLeft',        // LEFT CTRL key code
    toggleMode: false,
    dedupe: true,
    deepResolve: true,
    grabDelay: 500
  };
}
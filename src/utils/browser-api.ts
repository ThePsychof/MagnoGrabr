/**
 * Universal Cross-Browser Extension API
 * Works on Chrome, Firefox, Edge, Opera, Brave, Safari, etc.
 */

import type { GrabbedLink } from "./helpers";

declare const browser: any;
declare const chrome: any;

// Browser detection
const detectBrowser = () => {
  // Firefox uses the `browser` namespace
  if (typeof browser !== "undefined" && browser.runtime) {
    return { name: "Firefox", api: browser };
  }
  
  // Chrome and Chromium-based browsers use `chrome` namespace
  if (typeof chrome !== "undefined" && chrome.runtime) {
    // Detect specific browser (check more specific ones first!)
    const userAgent = navigator.userAgent.toLowerCase();
    
    // Brave - check for navigator.brave which Brave exposes
    if ((navigator as any).brave && typeof (navigator as any).brave.isBrave === 'function') {
      return { name: "Brave", api: chrome };
    }
    // Opera - check for Opera-specific identifiers
    if (userAgent.includes("opr") || userAgent.includes("opera")) {
      return { name: "Opera", api: chrome };
    }
    // Edge - check for Edge-specific identifiers
    if (userAgent.includes("edg")) {
      return { name: "Edge", api: chrome };
    }
    // Safari - check for Safari without Chrome
    if (userAgent.includes("safari") && !userAgent.includes("chrome")) {
      return { name: "Safari", api: chrome };
    }
    
    // Default to Chrome for other Chromium-based browsers
    return { name: "Chrome", api: chrome };
  }
  
  return null;
};

const browserInfo = detectBrowser();
const ext = browserInfo?.api || null;

if (!ext || !ext.runtime) {
  // Extension API not available - this should not happen in extension context
}

// Storage keys
const STORAGE_KEYS = {
  SETTINGS: "settings",
  LINKS_SESSION: "MagnoGrabr_links",
  DOWNLOAD_SETTINGS: "download_settings",
} as const;

// Interfaces
export interface ExtensionSettings {
  activationKey: string;
  endKey: string;
  toggleMode: boolean;
  dedupe: boolean;
  deepResolve: boolean;
  grabDelay: number;
  effects: boolean;
  highlightColor: string;
  notifyDuration: number;
  defaultCursor: string;
  customCursor?: string;
  cursorFlag: boolean;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  activationKey: "ShiftLeft",
  endKey: "ControlLeft",
  toggleMode: false,
  dedupe: true,
  deepResolve: false,
  grabDelay: 250,
  effects: true,
  highlightColor: "#4CAF50",
  notifyDuration: 2000,
  defaultCursor: "cursor.png",
  customCursor: "",
  cursorFlag: false
}

export interface DownloadSettings {
  useNative: boolean;
  savePath: string;
  batchSize: number;
  concurrent: number;
}

export const MessageTypes = {
  TOGGLE_GRABBER: "TOGGLE_GRABBER",
  GET_STATE: "GET_STATE",
  PROBE_URL: "PROBE_URL",
  PING: "PING",
  GET_SESSION: "GET_SESSION",
  STORE_SESSION: "STORE_SESSION",
  DOWNLOAD_URLS: "DOWNLOAD_URLS",
  DETECT_MANAGERS: "DETECT_MANAGERS",
  SCAN_PAGE_LINKS: "SCAN_PAGE_LINKS",
} as const;

export type MessageType = typeof MessageTypes[keyof typeof MessageTypes];

export interface ExtensionMessage<T = unknown> {
  type: MessageType;
  payload?: T;
  data?: any;
}

export interface ExtensionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

class BrowserAPIService {
  private static instance: BrowserAPIService | null = null;

  static getInstance(): BrowserAPIService {
    if (!BrowserAPIService.instance) {
      BrowserAPIService.instance = new BrowserAPIService();
    }
    return BrowserAPIService.instance;
  }

  async storageGet<T = any>(keys: string[]): Promise<Record<string, T>> {
    return new Promise((resolve, reject) => {
      try {
        // Check if extension context is still valid
        if (!ext || !ext.runtime || !ext.runtime.id) {
          reject(new Error("Extension context invalidated"));
          return;
        }
        
        // Firefox uses promises, Chrome uses callbacks
        const result = ext.storage.local.get(keys);
        
        if (result && typeof result.then === 'function') {
          // Firefox - result is a promise
          result.then((data: any) => resolve(data as Record<string, T>))
                .catch((err: any) => reject(err));
        } else {
          // Chrome - result is undefined, use callback
          ext.storage.local.get(keys, (result: any) => {
            if (ext.runtime.lastError) {
              reject(ext.runtime.lastError);
            } else {
              resolve(result as Record<string, T>);
            }
          });
        }
      } catch (e) {
        reject(e);
      }
    });
  }

  async storageSet(data: Record<string, any>): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Check if extension context is still valid
        if (!ext || !ext.runtime || !ext.runtime.id) {
          reject(new Error("Extension context invalidated"));
          return;
        }
        
        // Firefox uses promises, Chrome uses callbacks
        const result = ext.storage.local.set(data);
        
        if (result && typeof result.then === 'function') {
          // Firefox - result is a promise
          result.then(() => resolve())
                .catch((err: any) => reject(err));
        } else {
          // Chrome - result is undefined, use callback
          ext.storage.local.set(data, () => {
            if (ext.runtime.lastError) {
              reject(ext.runtime.lastError);
            } else {
              resolve();
            }
          });
        }
      } catch (e) {
        reject(e);
      }
    });
  }

  async downloadFile(options: chrome.downloads.DownloadOptions): Promise<number> {
    return new Promise((resolve, reject) => {
      try {
        // Firefox uses promises, Chrome uses callbacks
        const result = ext.downloads.download(options);
        
        if (result && typeof result.then === 'function') {
          // Firefox - result is a promise
          result.then((id: number) => resolve(id))
                .catch((err: any) => reject(err));
        } else {
          // Chrome - result is undefined, use callback
          ext.downloads.download(options, (id: number) => {
            if (ext.runtime.lastError) {
              reject(ext.runtime.lastError);
            } else {
              resolve(id);
            }
          });
        }
      } catch (e) {
        reject(e);
      }
    });
  }

  addMessageListener(
    callback: Parameters<typeof ext.runtime.onMessage.addListener>[0]
  ): void {
    ext.runtime.onMessage.addListener(callback);
  }

  removeMessageListener(
    callback: Parameters<typeof ext.runtime.onMessage.removeListener>[0]
  ): void {
    ext.runtime.onMessage.removeListener(callback);
  }

  async getSettings(): Promise<ExtensionSettings> {
    const result = await this.storageGet<ExtensionSettings>([STORAGE_KEYS.SETTINGS]);
    return result[STORAGE_KEYS.SETTINGS] || this.getDefaultSettings();
  }

  async setSettings(settings: Partial<ExtensionSettings>): Promise<void> {
    const current = (await this.getSettings()) ?? DEFAULT_SETTINGS;
    await this.storageSet({
      [STORAGE_KEYS.SETTINGS]: { ...current, ...settings },
    });
  }

  async storeGrabbedLinks(links: GrabbedLink[]): Promise<void> {
    await this.storageSet({ [STORAGE_KEYS.LINKS_SESSION]: links });
  }

  async getGrabbedLinks(): Promise<GrabbedLink[]> {
    const result = await this.storageGet<GrabbedLink[]>([STORAGE_KEYS.LINKS_SESSION]);
    return result[STORAGE_KEYS.LINKS_SESSION] || [];
  }

  async getDownloadSettings(): Promise<DownloadSettings> {
    const result = await this.storageGet<DownloadSettings>([STORAGE_KEYS.DOWNLOAD_SETTINGS]);
    return result[STORAGE_KEYS.DOWNLOAD_SETTINGS] || this.getDefaultDownloadSettings();
  }

  async setDownloadSettings(settings: Partial<DownloadSettings>): Promise<void> {
    const current = await this.getDownloadSettings();
    await this.storageSet({
      [STORAGE_KEYS.DOWNLOAD_SETTINGS]: { ...current, ...settings },
    });
  }

  async sendMessage<T = any>(message: ExtensionMessage): Promise<T> {
    return new Promise((resolve, reject) => {
      try {
        // Firefox uses promises, Chrome uses callbacks
        const result = ext.runtime.sendMessage(message);
        
        if (result && typeof result.then === 'function') {
          // Firefox - result is a promise
          result.then((response: T) => resolve(response))
                .catch((err: any) => reject(err));
        } else {
          // Chrome - result is undefined, use callback
          ext.runtime.sendMessage(message, (response: T) => {
            if (ext.runtime.lastError) {
              reject(ext.runtime.lastError);
            } else {
              resolve(response);
            }
          });
        }
      } catch (e) {
        reject(e);
      }
    });
  }

  getResourceUrl(path: string): string {
    return ext.runtime.getURL(path);
  }

  getManifest(): chrome.runtime.Manifest {
    return ext.runtime.getManifest();
  }

  private getDefaultSettings(): ExtensionSettings {
    return DEFAULT_SETTINGS;
  }

  private getDefaultDownloadSettings(): DownloadSettings {
    return {
      useNative: true,
      savePath: "MagnoGrabr Downloads",
      batchSize: 5,
      concurrent: 3,
    };
  }
}

export const browserAPI = BrowserAPIService.getInstance();


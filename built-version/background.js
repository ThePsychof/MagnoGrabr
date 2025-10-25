const detectBrowser = () => {
  if (typeof browser !== "undefined" && browser.runtime) {
    return { name: "Firefox", api: browser };
  }
  if (typeof chrome !== "undefined" && chrome.runtime) {
    const userAgent = navigator.userAgent.toLowerCase();
    if (navigator.brave && typeof navigator.brave.isBrave === "function") {
      return { name: "Brave", api: chrome };
    }
    if (userAgent.includes("opr") || userAgent.includes("opera")) {
      return { name: "Opera", api: chrome };
    }
    if (userAgent.includes("edg")) {
      return { name: "Edge", api: chrome };
    }
    if (userAgent.includes("safari") && !userAgent.includes("chrome")) {
      return { name: "Safari", api: chrome };
    }
    return { name: "Chrome", api: chrome };
  }
  return null;
};
const browserInfo = detectBrowser();
const ext = browserInfo?.api || null;
if (!ext || !ext.runtime) ;
const STORAGE_KEYS = {
  SETTINGS: "settings",
  LINKS_SESSION: "MagnoGrabr_links",
  DOWNLOAD_SETTINGS: "download_settings"
};
const MessageTypes = {
  TOGGLE_GRABBER: "TOGGLE_GRABBER",
  GET_STATE: "GET_STATE",
  PROBE_URL: "PROBE_URL",
  PING: "PING",
  GET_SESSION: "GET_SESSION",
  STORE_SESSION: "STORE_SESSION",
  DOWNLOAD_URLS: "DOWNLOAD_URLS",
  DETECT_MANAGERS: "DETECT_MANAGERS",
  SCAN_PAGE_LINKS: "SCAN_PAGE_LINKS"
};
class BrowserAPIService {
  static instance = null;
  static getInstance() {
    if (!BrowserAPIService.instance) {
      BrowserAPIService.instance = new BrowserAPIService();
    }
    return BrowserAPIService.instance;
  }
  async storageGet(keys) {
    return new Promise((resolve, reject) => {
      try {
        if (!ext || !ext.runtime || !ext.runtime.id) {
          reject(new Error("Extension context invalidated"));
          return;
        }
        const result = ext.storage.local.get(keys);
        if (result && typeof result.then === "function") {
          result.then((data) => resolve(data)).catch((err) => reject(err));
        } else {
          ext.storage.local.get(keys, (result2) => {
            if (ext.runtime.lastError) {
              reject(ext.runtime.lastError);
            } else {
              resolve(result2);
            }
          });
        }
      } catch (e) {
        reject(e);
      }
    });
  }
  async storageSet(data) {
    return new Promise((resolve, reject) => {
      try {
        if (!ext || !ext.runtime || !ext.runtime.id) {
          reject(new Error("Extension context invalidated"));
          return;
        }
        const result = ext.storage.local.set(data);
        if (result && typeof result.then === "function") {
          result.then(() => resolve()).catch((err) => reject(err));
        } else {
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
  async downloadFile(options) {
    return new Promise((resolve, reject) => {
      try {
        const result = ext.downloads.download(options);
        if (result && typeof result.then === "function") {
          result.then((id) => resolve(id)).catch((err) => reject(err));
        } else {
          ext.downloads.download(options, (id) => {
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
  addMessageListener(callback) {
    ext.runtime.onMessage.addListener(callback);
  }
  removeMessageListener(callback) {
    ext.runtime.onMessage.removeListener(callback);
  }
  async getSettings() {
    const result = await this.storageGet([STORAGE_KEYS.SETTINGS]);
    return result[STORAGE_KEYS.SETTINGS] || this.getDefaultSettings();
  }
  async setSettings(settings) {
    const current = await this.getSettings();
    await this.storageSet({
      [STORAGE_KEYS.SETTINGS]: { ...current, ...settings }
    });
  }
  async storeGrabbedLinks(links) {
    await this.storageSet({ [STORAGE_KEYS.LINKS_SESSION]: links });
  }
  async getGrabbedLinks() {
    const result = await this.storageGet([STORAGE_KEYS.LINKS_SESSION]);
    return result[STORAGE_KEYS.LINKS_SESSION] || [];
  }
  async getDownloadSettings() {
    const result = await this.storageGet([STORAGE_KEYS.DOWNLOAD_SETTINGS]);
    return result[STORAGE_KEYS.DOWNLOAD_SETTINGS] || this.getDefaultDownloadSettings();
  }
  async setDownloadSettings(settings) {
    const current = await this.getDownloadSettings();
    await this.storageSet({
      [STORAGE_KEYS.DOWNLOAD_SETTINGS]: { ...current, ...settings }
    });
  }
  async sendMessage(message) {
    return new Promise((resolve, reject) => {
      try {
        const result = ext.runtime.sendMessage(message);
        if (result && typeof result.then === "function") {
          result.then((response) => resolve(response)).catch((err) => reject(err));
        } else {
          ext.runtime.sendMessage(message, (response) => {
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
  getResourceUrl(path) {
    return ext.runtime.getURL(path);
  }
  getManifest() {
    return ext.runtime.getManifest();
  }
  getDefaultSettings() {
    return {
      activationKey: "ShiftLeft",
      endKey: "ControlLeft",
      toggleMode: false,
      dedupe: true,
      deepResolve: true,
      grabDelay: 500,
      effects: true,
      highlightColor: "#4CAF50",
      notifyDuration: 2e3
    };
  }
  getDefaultDownloadSettings() {
    return {
      useNative: true,
      savePath: "MagnoGrabr Downloads",
      batchSize: 5,
      concurrent: 3
    };
  }
}
const browserAPI = BrowserAPIService.getInstance();
const backgroundListener = (msg, _sender, sendResponse) => {
  (async () => {
    try {
      let response;
      switch (msg.type) {
        case MessageTypes.GET_SESSION:
          const session = await browserAPI.getGrabbedLinks();
          response = { session };
          break;
        case MessageTypes.DOWNLOAD_URLS:
          const urls = msg.payload?.urls || msg.urls;
          if (!urls || !urls.length) {
            response = { error: "No URLs provided for download" };
            break;
          }
          await Promise.all(
            urls.map(
              (u) => browserAPI.downloadFile({ url: u }).catch(() => {
              })
            )
          );
          response = { started: true };
          break;
        default:
          response = { error: `Unknown message type: ${msg.type}` };
      }
      sendResponse(response);
    } catch (err) {
      sendResponse({ error: err instanceof Error ? err.message : "Unknown error" });
    }
  })();
  return true;
};
browserAPI.addMessageListener(backgroundListener);

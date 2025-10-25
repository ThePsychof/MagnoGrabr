(function(exports) {
  "use strict";
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
  function uid() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
  function categorizeUrl(url) {
    try {
      const lower = url.toLowerCase();
      if (/\.(jpg|jpeg|png|gif|webp|svg)$/.test(lower)) return "images";
      if (/\.(zip|rar|7z|exe|iso|pdf|mp4|mp3|mkv|flac|torrent)$/.test(lower)) return "downloads";
      if (/\.(mp4|webm|ogg|mp3|wav|m4a)$/.test(lower)) return "media";
      if (url.startsWith("#") || /^https?:\/\/[^/]+\/#/.test(url)) return "anchors";
      return "others";
    } catch {
      return "suspicious";
    }
  }
  function normalizeHref(href, base = window.location.href) {
    try {
      if (!href || typeof href !== "string") {
        return "";
      }
      if (!base || typeof base !== "string") {
        base = window.location.href;
      }
      const url = new URL(href, base);
      return url.toString();
    } catch (error) {
      return href;
    }
  }
  function detectBrowserName() {
    const userAgent = navigator.userAgent.toLowerCase();
    if (typeof browser !== "undefined" && browser.runtime) {
      return "Firefox";
    }
    if (typeof chrome !== "undefined" && chrome.runtime) {
      if (navigator.brave && typeof navigator.brave.isBrave === "function") {
        return "Brave";
      }
      if (userAgent.includes("opr") || userAgent.includes("opera")) return "Opera";
      if (userAgent.includes("edg")) return "Edge";
      if (userAgent.includes("safari") && !userAgent.includes("chrome")) return "Safari";
      return "Chrome";
    }
    return "Unknown";
  }
  detectBrowserName();
  class LinkGrabber {
    isActive = false;
    settings = null;
    grabbed = /* @__PURE__ */ new Map();
    notifier = null;
    lastHoveredEl = null;
    hoverTimer = null;
    eventListeners = [];
    STORAGE_KEY = "MagnoGrabr_links";
    /** Initialize the grabber: load settings, attach events */
    async init() {
      try {
        this.settings = await browserAPI.getSettings();
      } catch (error) {
        throw new Error("Failed to initialize LinkGrabber: Could not load settings");
      }
      this.attachGlobalEvents();
    }
    /** Attach key & mouse events */
    attachGlobalEvents() {
      const handlers = [
        { element: document, event: "keydown", handler: (e) => this.onKeyDown(e) },
        { element: document, event: "keyup", handler: (e) => this.onKeyUp(e) },
        { element: document, event: "mousemove", handler: (e) => this.onMouseMove(e) }
      ];
      handlers.forEach(({ element, event, handler }) => {
        element.addEventListener(event, handler, true);
        this.eventListeners.push({ element, event, handler });
      });
    }
    /** Cleanup events & timers */
    cleanup() {
      this.eventListeners.forEach(({ element, event, handler }) => element.removeEventListener(event, handler, true));
      this.eventListeners = [];
      if (this.hoverTimer) clearTimeout(this.hoverTimer);
      this.removeNotifier();
      this.grabbed.clear();
      this.isActive = false;
    }
    /** Keyboard handlers */
    onKeyDown(e) {
      if (!this.settings) return;
      if (e.code === this.settings.activationKey && !this.isActive) {
        this.toggleGrabber(true);
      }
      if (e.code === this.settings.endKey && this.isActive && e.shiftKey) {
        this.finalizeSession();
      }
    }
    onKeyUp(e) {
      if (!this.settings) return;
      if (e.code === this.settings.activationKey && this.isActive) {
        this.toggleGrabber(false);
      }
    }
    /** Mouse hover capture */
    onMouseMove(e) {
      if (!this.isActive || !this.settings) return;
      const el = e.target;
      if (el === this.lastHoveredEl) return;
      this.lastHoveredEl = el;
      if (this.hoverTimer) clearTimeout(this.hoverTimer);
      this.hoverTimer = window.setTimeout(() => this.attemptCapture(el), this.settings.grabDelay ?? 250);
    }
    /** Enable/disable grabber */
    toggleGrabber(state) {
      this.isActive = state;
      state ? this.activateUI() : this.deactivateUI();
    }
    applyCursor() {
      const cursorUrl = browserAPI.getResourceUrl("cursor.png");
      let styleEL = document.getElementById("Cursor");
      if (!styleEL) {
        styleEL = document.createElement("style");
        styleEL.id = "Cursor";
        document.head.appendChild(styleEL);
      }
      styleEL.innerHTML = `.cursor-MagnoGrabr, .cursor-MagnoGrabr * { cursor: url("${cursorUrl}") 16 16, crosshair !important; }`;
      document.body.classList.add("cursor-MagnoGrabr");
    }
    resetCursor() {
      document.body.classList.remove("cursor-MagnoGrabr");
    }
    activateUI() {
      this.applyCursor();
      this.createNotifier();
    }
    deactivateUI() {
      this.resetCursor();
      this.removeNotifier();
    }
    /** Notifier */
    createNotifier() {
      if (this.notifier) return;
      this.notifier = document.createElement("div");
      this.notifier.id = "magnoNotifier";
      Object.assign(this.notifier.style, {
        position: "fixed",
        top: "10px",
        right: "10px",
        background: "rgba(0,0,0,0.8)",
        color: "white",
        padding: "8px 12px",
        borderRadius: "8px",
        zIndex: "999999",
        fontSize: "12px",
        fontFamily: "monospace",
        border: "2px solid #ff6b6b",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
      });
      document.body.appendChild(this.notifier);
      this.updateNotifier();
    }
    removeNotifier() {
      if (!this.notifier) return;
      this.notifier.remove();
      this.notifier = null;
    }
    updateNotifier() {
      if (!this.notifier) return;
      this.notifier.innerHTML = `
      <div style="color: #ff6b6b; font-weight: bold;">🔗 MagnoGrabr Active</div>
      <div style="font-size: 10px; margin-top: 2px;">Captured: ${this.grabbed.size}</div>
      <div style="font-size: 9px; margin-top: 1px; color: #94a3b8;">Shift+Ctrl to save</div>
    `;
    }
    /** Capture logic */
    async attemptCapture(el) {
      if (!this.settings) return;
      const linkEl = this.findLinkElement(el);
      if (!linkEl) return;
      const href = this.extractUrl(linkEl);
      if (!href) return;
      let normalized;
      try {
        normalized = normalizeHref(href);
      } catch {
        return;
      }
      if (this.settings.dedupe && this.grabbed.has(normalized)) return;
      const link = {
        id: uid(),
        url: href,
        normalized,
        category: categorizeUrl(normalized),
        text: linkEl.textContent?.trim() ?? "",
        timestamp: Date.now()
      };
      this.grabbed.set(normalized, link);
      this.updateNotifier();
      this.spawnFlyingText(el.getBoundingClientRect(), "+");
    }
    findLinkElement(el) {
      if (this.isLinkElement(el)) return el;
      let current = el.parentElement;
      for (let depth = 0; current && depth < 3; depth++, current = current.parentElement)
        if (this.isLinkElement(current)) return current;
      return null;
    }
    isLinkElement(el) {
      return el instanceof HTMLAnchorElement || el instanceof HTMLAreaElement || el.hasAttribute("href") || el.hasAttribute("data-href") || el.hasAttribute("onclick") || el.getAttribute("role") === "link";
    }
    extractUrl(el) {
      if (el instanceof HTMLAnchorElement || el instanceof HTMLAreaElement) return el.href;
      const href = el.getAttribute("href") ?? el.getAttribute("data-href");
      if (!href) return null;
      try {
        return new URL(href, window.location.href).toString();
      } catch {
        return href;
      }
    }
    spawnFlyingText(rect, text) {
      const el = document.createElement("div");
      el.textContent = text;
      Object.assign(el.style, {
        position: "fixed",
        left: `${rect.left + rect.width / 2}px`,
        top: `${rect.top}px`,
        color: "lime",
        fontWeight: "bold",
        zIndex: "999999",
        transition: "all 0.8s ease-out",
        pointerEvents: "none"
      });
      document.body.appendChild(el);
      requestAnimationFrame(() => {
        el.style.transform = "translateY(-20px)";
        el.style.opacity = "0";
      });
      setTimeout(() => el.remove(), 900);
    }
    /** Save session to storage */
    async finalizeSession() {
      try {
        const links = Array.from(this.grabbed.values());
        await browserAPI.storeGrabbedLinks(links);
        this.grabbed.clear();
        this.toggleGrabber(false);
        if (this.notifier) {
          this.notifier.innerHTML = ` 
          <div style="color: #4ade80; font-weight: bold;">✅ Links Saved!</div>
          <div style="font-size: 10px; margin-top: 2px;">${links.length} total links</div>`;
          setTimeout(() => this.removeNotifier(), 3e3);
        }
      } catch (error) {
        if (this.notifier) {
          this.notifier.innerHTML = `
          <div style="color: #ef4444; font-weight: bold;">❌ Save Failed</div>
          <div style="font-size: 10px; margin-top: 2px;">Please reload the page</div>`;
          setTimeout(() => this.removeNotifier(), 3e3);
        }
      }
    }
  }
  const linkGrabber = new LinkGrabber();
  function initialize() {
    linkGrabber.init().catch(() => {
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
  exports.LinkGrabber = LinkGrabber;
  Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
})(this.MagnoGrabrContent = this.MagnoGrabrContent || {});

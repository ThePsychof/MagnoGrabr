import { browserAPI, DEFAULT_SETTINGS } from "./utils/browser-api";
import { uid, normalizeHref, categorizeUrl, type GrabbedLink } from "./utils/linkCategorizer";
import type { ExtensionSettings } from "./utils/browser-api";
import './styles/tailwind.css';
import { initThemeFromSettings } from "./utils/theme";
import { showToast } from "./utils/toastHelper";
import { getLinkInfo } from "./utils/getLinkInfo";
import { MessageTypes } from "./utils/browser-api";
import "./utils/extractAll";

// keep runtime detection granular so cursor/theme logic adapts per browser.
declare const browser: any;
declare const chrome: any;

function detectBrowserName() {
  const userAgent = navigator.userAgent.toLowerCase();

  if (typeof browser !== "undefined" && browser.runtime) {
    return "Firefox";
  }
  if (typeof chrome !== "undefined" && chrome.runtime) {
    // Check more specific browsers first!
    // Brave - check for navigator.brave API
    if (
      (navigator as any).brave &&
      typeof (navigator as any).brave.isBrave === "function"
    ) {
      return "Brave";
    }
    if (userAgent.includes("opr") || userAgent.includes("opera")) return "Opera";
    if (userAgent.includes("edg")) return "Edge";
    if (userAgent.includes("safari") && !userAgent.includes("chrome"))
      return "Safari";
    return "Chrome";
  }
  return "Unknown";
}

const browserName = detectBrowserName();

type EventListenerEntry = {
  element: EventTarget;
  event: string;
  handler: EventListener;
};

export class LinkGrabber {
  private isActive = false;
  private settings: ExtensionSettings | null = null;
  private grabbed = new Map<string, GrabbedLink>();
  // Track in-flight metadata probes per-normalized URL so we can await them on finalize
  private pending = new Map<string, Promise<void>>();
  private notifier: HTMLElement | null = null;
  private notifierMoveHandler: ((e: MouseEvent) => void) | null = null;
  private lastMousePos: { x: number; y: number } | null = null;
  private lastHoveredEl: Element | null = null;
  private hoverTimer: number | null = null;
  private eventListeners: EventListenerEntry[] = [];
  private storageChangeHandler: ((changes: any, area: string) => void) | null = null;
  private readonly STORAGE_KEY = "MagnoGrabr_links";

  /** Initialize the grabber: load settings, attach events */
  async init(): Promise<void> {
    try {
      this.settings = await browserAPI.getSettings();
    } catch (error) {
      throw new Error("Failed to initialize LinkGrabber: Could not load settings");
    }
    this.attachGlobalEvents();
    try { initThemeFromSettings(this.settings || undefined); } catch {}

    const ext = (typeof browser !== 'undefined' && browser.storage) ? browser : (typeof chrome !== 'undefined' && chrome.storage) ? chrome : null;
    if (ext && ext.storage && ext.storage.onChanged) {
      this.storageChangeHandler = (changes: any, area: string) => {
        if (area !== 'local') return;
        try {
          if (changes && changes.settings) {
            const newSettings = changes.settings.newValue || changes.settings;
            this.settings = { ...(this.settings || (DEFAULT_SETTINGS as any)), ...(newSettings || {}) } as ExtensionSettings;
            // Re-apply theme when settings change so content reflects new theme
            try { initThemeFromSettings(newSettings || this.settings || undefined); } catch {}
          }
        } catch {}
      };
      try { ext.storage.onChanged.addListener(this.storageChangeHandler); } catch {}
    }
  }

  /** Attach key & mouse events */
  private attachGlobalEvents(): void {
    const handlers: EventListenerEntry[] = [
      { element: document, event: "keydown", handler: (e) => this.onKeyDown(e as KeyboardEvent) },
      { element: document, event: "keyup", handler: (e) => this.onKeyUp(e as KeyboardEvent) },
      { element: document, event: "mousemove", handler: (e) => this.onMouseMove(e as MouseEvent) },
    ];

    handlers.forEach(({ element, event, handler }) => {
      element.addEventListener(event, handler, true);
      this.eventListeners.push({ element, event, handler });
    });
  }

  /** Cleanup events & timers */
  cleanup(): void {
    this.eventListeners.forEach(({ element, event, handler }) => element.removeEventListener(event, handler, true));
    this.eventListeners = [];
    if (this.hoverTimer) clearTimeout(this.hoverTimer);
    this.removeNotifier();
    this.grabbed.clear();
    this.isActive = false;
    // remove storage change listener if attached
    const ext = (typeof browser !== 'undefined' && browser.storage) ? browser : (typeof chrome !== 'undefined' && chrome.storage) ? chrome : null;
    if (ext && ext.storage && ext.storage.onChanged && this.storageChangeHandler) {
      try { ext.storage.onChanged.removeListener(this.storageChangeHandler); } catch {}
      this.storageChangeHandler = null;
    }
  }

  /** Keyboard handlers */
  private onKeyDown(e: KeyboardEvent): void {
    if (!this.settings) return;

    const isToggleMode = this.settings.toggleMode ?? false;

    // activation key is either toggle or hold depending on settings.
    if (e.code === this.settings.activationKey) {
      if (isToggleMode) {
        if (!this.isActive) {
          this.toggleGrabber(true);
        } else {
          if (this.settings?.oneKeyMode) {
            this.finalizeSession();
          } else {
            this.toggleGrabber(false);
          }
        }
      } else {
        if (!this.isActive) this.toggleGrabber(true);
      }
    }

    // End key
    // Finalize session whenever grabber is active, works in both modes
    if (e.code === this.settings.endKey && this.isActive) {
      this.finalizeSession();
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    if (!this.settings) return;
    if (!this.settings.toggleMode && e.code === this.settings.activationKey && this.isActive) {
      if (this.settings.oneKeyMode) {
        this.finalizeSession();
      } else {
        this.toggleGrabber(false);
      }
    }
  }

  /** Mouse hover capture */
  private onMouseMove(e: MouseEvent): void {
    this.lastMousePos = { x: e.clientX, y: e.clientY };
    if (!this.isActive || !this.settings) return;
    const el = e.target as Element;
    if (el === this.lastHoveredEl) return;
    this.lastHoveredEl = el;

    if (this.hoverTimer) clearTimeout(this.hoverTimer);
    this.hoverTimer = window.setTimeout(() => this.attemptCapture(el), this.settings.grabDelay ?? 250);
  }

  /** Enable/disable grabber */
  private toggleGrabber(state: boolean): void {
    this.isActive = state;
    state ? this.activateUI() : this.deactivateUI();
  }

  public setCursor() {
    this.applyCursor();
  }
  private async applyCursor(): Promise<void> {
    const settings = await browserAPI.getSettings();
    const cursorflag = settings.cursorFlag;
    let cursorUrl: string = '';
    if (cursorflag && settings.customCursor) {
      cursorUrl = settings.customCursor;
    } else {
      const res = browserAPI.getResourceUrl(settings.defaultCursor);
      cursorUrl = res || '';
    }

    let styleEL = document.getElementById("Cursor") as HTMLStyleElement | null;
    if (!styleEL) {
      styleEL = document.createElement("style");
      styleEL.id = "Cursor";
      document.head.appendChild(styleEL);
    }
    // only include url(...) when provided, otherwise force crosshair for clarity.
    if (cursorUrl) {
      styleEL.innerHTML = `.cursor-MagnoGrabr, .cursor-MagnoGrabr * { cursor: url("${cursorUrl}") 16 16, crosshair !important; }`;
    } else {
      styleEL.innerHTML = `.cursor-MagnoGrabr, .cursor-MagnoGrabr * { cursor: crosshair !important; }`;
    }

    document.body.classList.add('cursor-MagnoGrabr');
  }
  private resetCursor(): void {
    document.body.classList.remove('cursor-MagnoGrabr');
  }

  private activateUI(): void {
    this.applyCursor();
    this.createNotifier();
  }

  private deactivateUI(): void {
    this.resetCursor();
    this.removeNotifier();
  }

  /** Notifier */
  private createNotifier(): void {
    if (this.notifier) return;
    this.notifier = document.createElement("div");
    this.notifier.id = "magnoNotifier";
    // small floating badge mirrors cursor so users know grabber state.
    Object.assign(this.notifier.style, {
      position: "fixed",
      left: "0px",
      top: "0px",
      width: "28px",
      height: "28px",
      minWidth: "28px",
      background: "var(--RootBG)",
      color: "var(--TextIn)",
      padding: "0 4px",
      borderRadius: "50%",
      zIndex: "999999",
      fontSize: "16px",
      fontFamily: "monospace",
      border: "2px solid var(--ButtonActive)",
      boxShadow: "0 4px 12px var(--RootBG)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      pointerEvents: "none",
      transform: "translateY(-50%)",
    });

    document.body.appendChild(this.notifier);
    this.updateNotifier();

    const offset = 33;
    this.notifier.style.transition = 'transform 0.08s linear';
    this.notifier.style.transform = `translate3d(0px, 0px, 0) translate(-50%,-50%)`;

    const applyPosition = (x: number, y: number) => {
      if (!this.notifier) return;
      this.notifier.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%,-50%)`;
    };

    const initialPos = this.lastMousePos;
    if (initialPos) {
      applyPosition(initialPos.x + offset, initialPos.y);
    }

    this.notifierMoveHandler = (e: MouseEvent) => {
      if (!this.notifier) return;
      const x = e.clientX + offset;
      const y = e.clientY;
      // use transforms for buttery movement without repaint churn.
      applyPosition(x, y);
    };
    document.addEventListener('mousemove', this.notifierMoveHandler);
  }

  private removeNotifier(): void {
    if (!this.notifier) return;
    this.notifier.remove();
    this.notifier = null;
    if (this.notifierMoveHandler) {
      try { document.removeEventListener('mousemove', this.notifierMoveHandler); } catch {}
      this.notifierMoveHandler = null;
    }
  }

  private updateNotifier(): void {
    if (!this.notifier) return;
    const count = this.grabbed.size || 0;
    const displayCount = count > 99 ? "99+" : String(count);
    this.notifier.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-weight:600;font-size:14px;">${displayCount}</div>
    `;
  }

  /** Capture logic */
  private async attemptCapture(el: Element): Promise<void> {
    if (!this.settings) return;
    const linkEl = this.findLinkElement(el);
    if (!linkEl) return;

    const href = this.extractUrl(linkEl);
    if (!href) return;

    let normalized: string;
    try { normalized = normalizeHref(href); } catch { return; }

    if (this.settings.dedupe && this.grabbed.has(normalized)) return;

    const typeAttr = linkEl.getAttribute?.("type");
    const dataMime = linkEl.getAttribute?.("data-mime");
    const dataType = linkEl.getAttribute?.("data-type") ?? linkEl.getAttribute?.("data-filetype");
    const downloadAttr = linkEl instanceof HTMLAnchorElement ? linkEl.getAttribute("download") : null;
    const dataFilename = linkEl.getAttribute?.("data-filename");
    const mimeHint = typeAttr && typeAttr.includes("/") ? typeAttr : dataMime || null;
    const typeHint = !mimeHint ? (dataType || (typeAttr && !typeAttr.includes("/") ? typeAttr : null)) : dataType ?? null;

    const link: GrabbedLink = {
      id: uid(),
      url: href,
      normalized,
      category: categorizeUrl(normalized, {
        filename: downloadAttr || dataFilename || null,
        mime: mimeHint || undefined,
        typeHint: typeHint || undefined,
      }),
      text: linkEl.textContent?.trim() ?? "",
      timestamp: Date.now(),
      type: typeHint ?? null,       // will be refined after getLinkInfo
      mime: mimeHint ?? null,
      size: null,
      filename: null,
    };

    this.grabbed.set(normalized, link);
    this.updateNotifier();
    this.spawnFlyingText(el.getBoundingClientRect(), "+");

    // --- Async fetch of metadata ---
    try {
      let info = await getLinkInfo(href);

      // If content context couldn't fetch (CORS or blocked), ask background to probe
      if (!info.ok) {
        try {
          // Use browserAPI to send a PROBE_URL message to background
          const probeRes = await browserAPI.sendMessage({ type: MessageTypes.PROBE_URL, payload: { url: href } }) as any;
          // background sends LinkInfo object directly via sendResponse in background.ts
          info = probeRes || info;
        } catch (bgErr) {
          // ignore background probe errors
        }
      }

      if (info.ok) {
        // Update your grabbed link with metadata
        link.size = info.size ?? null;
        link.filename = info.filename ?? null;
        link.mime = info.mime ?? link.mime ?? null;
        link.type = info.type ?? link.type ?? null;
        link.category = categorizeUrl(link.normalized || link.url, {
          filename: link.filename ?? undefined,
          mime: link.mime ?? undefined,
          typeHint: link.type ?? undefined,
        });

        // Debug: log probe result
        try {
          // eslint-disable-next-line no-console
          console.debug('[LinkGrabber] probe result for', normalized, { info });
        } catch {}

        // Format size to human readable preferring numeric sizeNumber
        try {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          const { formatBytes } = await import("./utils/linkCategorizer");
          const preferred = (info as any).sizeNumber ?? info.size;
          link.size = formatBytes(preferred) ?? (info.size ?? null);
        } catch {
          // ignore formatting errors
        }

        // Track that this link has completed metadata processing; store on finalize only
        try {
          const p = Promise.resolve();
          this.pending.set(normalized, p);
          // ensure we remove pending when done
          p.then(() => this.pending.delete(normalized)).catch(() => this.pending.delete(normalized));
        } catch {
          // ignore
        }
      }
    } catch (err) {
      // ignore
    }
  }

  private findLinkElement(el: Element): Element | null {
    if (this.isLinkElement(el)) return el;
    let current = el.parentElement;
    for (let depth = 0; current && depth < 3; depth++, current = current.parentElement)
      if (this.isLinkElement(current)) return current;
    return null;
  }

  private isLinkElement(el: Element): boolean {
    return el instanceof HTMLAnchorElement ||
      el instanceof HTMLAreaElement ||
      el.hasAttribute("href") ||
      el.hasAttribute("data-href") ||
      el.hasAttribute("onclick") ||
      el.getAttribute("role") === "link";
  }

  private extractUrl(el: Element): string | null {
    if (el instanceof HTMLAnchorElement || el instanceof HTMLAreaElement) return el.href;
    const href = el.getAttribute("href") ?? el.getAttribute("data-href");
    if (!href) return null;
    try { return new URL(href, window.location.href).toString(); } catch { return href; }
  }

  private spawnFlyingText(rect: DOMRect, text: string): void {
    const el = document.createElement("div");
    el.textContent = text;
    Object.assign(el.style, {
      position: "fixed",
      left: `${rect.left + rect.width / 2}px`,
      top: `${rect.top}px`,
      color: "red",
      fontWeight: "bold",
      zIndex: "999999",
      transition: "all 0.8s ease-out",
      pointerEvents: "none",
    });
    document.body.appendChild(el);
    requestAnimationFrame(() => { el.style.transform = "translateY(-20px)"; el.style.opacity = "0"; });
    setTimeout(() => el.remove(), 900);
  }

  private async finalizeSession(): Promise<void> {
    try {
      // Wait for any pending metadata probes to finish (but don't wait forever)
      const pendingPromises = Array.from(this.pending.values());
      if (pendingPromises.length) {
        try {
          await Promise.race([
            Promise.all(pendingPromises),
            new Promise((res) => setTimeout(res, 2000)), // 2s max wait
          ]);
        } catch {
          // ignore
        }
      }

      const links = Array.from(this.grabbed.values());

      if (this.settings?.oneKeyMode) {
        try {
          const existing = await browserAPI.getGrabbedLinks();
          let combined = (existing || []).concat(links);
          if (this.settings.dedupe) {
            const seen = new Set<string>();
            combined = combined.filter((l: GrabbedLink) => {
              const n = l.normalized;
              if (seen.has(n)) return false;
              seen.add(n);
              return true;
            });
          }
          await browserAPI.storeGrabbedLinks(combined);
        } catch (err) {
          // fallback to storing just the captured links
          await browserAPI.storeGrabbedLinks(links);
        }
      } else {
        await browserAPI.storeGrabbedLinks(links);
      }

      this.grabbed.clear();
      this.toggleGrabber(false);

      if (this.notifier) {
        this.notifier.innerHTML = `
          <div style="color: #4ade80; font-weight: bold;">✅ Links Saved!</div>
          <div style="font-size: 10px; margin-top: 2px;">${links.length} total links</div>`;
        setTimeout(() => this.removeNotifier(), 3000);
      }
    } catch (error) {
      if (this.notifier) {
        this.notifier.innerHTML = `
          <div style="color: #ef4444; font-weight: bold;">❌ Save Failed</div>
          <div style="font-size: 10px; margin-top: 2px;">Please reload the page</div>`;
        setTimeout(() => this.removeNotifier(), 3000);
      }
    }
  }
}

const linkGrabber = new LinkGrabber();

// Initialize when DOM is ready
function initialize() {
  linkGrabber.init().catch(() => {
    // Initialization failed silently
  });
}

// Check if document is already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  // DOM is already loaded
  initialize();
}
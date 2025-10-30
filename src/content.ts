import { browserAPI } from "./utils/browser-api";
import { uid, normalizeHref, categorizeUrl, type GrabbedLink } from "./utils/helpers";
import type { ExtensionSettings } from "./utils/browser-api";
import './styles/tailwind.css';

// Check which browser we're in with detailed detection
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
    if ((navigator as any).brave && typeof (navigator as any).brave.isBrave === 'function') {
      return "Brave";
    }
    if (userAgent.includes("opr") || userAgent.includes("opera")) return "Opera";
    if (userAgent.includes("edg")) return "Edge";
    if (userAgent.includes("safari") && !userAgent.includes("chrome")) return "Safari";
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
  private notifier: HTMLElement | null = null;
  private lastHoveredEl: Element | null = null;
  private hoverTimer: number | null = null;
  private eventListeners: EventListenerEntry[] = [];
  private readonly STORAGE_KEY = "MagnoGrabr_links";

  /** Initialize the grabber: load settings, attach events */
  async init(): Promise<void> {
    try {
      this.settings = await browserAPI.getSettings();
    } catch (error) {
      throw new Error("Failed to initialize LinkGrabber: Could not load settings");
    }
    this.attachGlobalEvents();
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
  }

  /** Keyboard handlers */
  private onKeyDown(e: KeyboardEvent): void {
    if (!this.settings) return;

    const isToggleMode = this.settings.toggleMode ?? false;

    // Activation key
    if (e.code === this.settings.activationKey) {
      if (isToggleMode) {
        // Toggle on/off each press
        this.toggleGrabber(!this.isActive);
      } else {
        // Hold mode: activate only while holding
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
      // only run in hold mode
      this.toggleGrabber(false);
    }
  }

  /** Mouse hover capture */
  private onMouseMove(e: MouseEvent): void {
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

  private applyCursor(): void {
    const cursorUrl = browserAPI.getResourceUrl("cursor.png");

    let styleEL = document.getElementById("Cursor") as HTMLStyleElement | null;
    if (!styleEL) {
      styleEL = document.createElement("style");
      styleEL.id = "Cursor";
      document.head.appendChild(styleEL);
    }
    styleEL.innerHTML = `.cursor-MagnoGrabr, .cursor-MagnoGrabr * { cursor: url("${cursorUrl}") 16 16, crosshair !important; }`;

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
      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    });
    document.body.appendChild(this.notifier);
    this.updateNotifier();
  }

  private removeNotifier(): void {
    if (!this.notifier) return;
    this.notifier.remove();
    this.notifier = null;
  }

  private updateNotifier(): void {
    if (!this.notifier) return;
    this.notifier.innerHTML = `
      <div style="color: #ff6b6b; font-weight: bold;">🔗 MagnoGrabr Active</div>
      <div style="font-size: 10px; margin-top: 2px;">Captured: ${this.grabbed.size}</div>
      <div style="font-size: 9px; margin-top: 1px; color: #94a3b8;">Shift+Ctrl to save</div>
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

    const link: GrabbedLink = {
      id: uid(),
      url: href,
      normalized,
      category: categorizeUrl(normalized),
      text: linkEl.textContent?.trim() ?? "",
      timestamp: Date.now(),
    };

    this.grabbed.set(normalized, link);
    this.updateNotifier();
    this.spawnFlyingText(el.getBoundingClientRect(), "+");
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
      color: "lime",
      fontWeight: "bold",
      zIndex: "999999",
      transition: "all 0.8s ease-out",
      pointerEvents: "none",
    });
    document.body.appendChild(el);
    requestAnimationFrame(() => { el.style.transform = "translateY(-20px)"; el.style.opacity = "0"; });
    setTimeout(() => el.remove(), 900);
  }

  /** Save session to storage */
  private async finalizeSession(): Promise<void> {
    try {
      const links = Array.from(this.grabbed.values());
      await browserAPI.storeGrabbedLinks(links);
      this.grabbed.clear();
      this.toggleGrabber(false);

      if (this.notifier) {
        this.notifier.innerHTML =` 
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
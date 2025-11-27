import { browserAPI, MessageTypes } from "./browser-api";
import { categorizeUrl, normalizeHref, uid, type GrabbedLink } from "./linkCategorizer";

export type ExtractAllResult = {
  added: number;
  total: number;
  links: GrabbedLink[];
};

type ExtractAllMessageResponse = {
  success: boolean;
  added?: number;
  total?: number;
  links?: GrabbedLink[];
  error?: string;
};

const HREF_SELECTORS = [
  "[href]",
  "[data-href]",
  "[xlink\\:href]",
  "svg use[href]",
  "svg use[xlink\\:href]",
  "svg image[href]",
  "svg image[xlink\\:href]"
].join(",");

function getHrefFromElement(el: Element): string | null {
  if (!el) return null;

  // Standard HTML elements with href attribute (anchors, areas, links, etc.)
  const direct = el.getAttribute("href") ?? el.getAttribute("data-href");
  if (direct) return direct;

  // SVG elements may expose href as an animated string
  const anyEl = el as unknown as { href?: { baseVal?: string } | string };
  if (anyEl && typeof anyEl.href === "object" && anyEl.href && "baseVal" in anyEl.href) {
    const baseVal = anyEl.href.baseVal;
    if (baseVal) return baseVal;
  }
  if (anyEl && typeof anyEl.href === "string") {
    return anyEl.href;
  }

  // Namespaced href (xlink)
  try {
    const namespaced = el.getAttributeNS?.("http://www.w3.org/1999/xlink", "href");
    if (namespaced) return namespaced;
  } catch {
    // ignore namespace errors
  }

  return null;
}

function getElementLabel(el: Element): string {
  const text = el.textContent?.trim();
  if (text) return text;

  const attrs = ["title", "alt", "aria-label", "data-label", "data-title"];
  for (const attr of attrs) {
    const value = el.getAttribute(attr);
    if (value && value.trim()) return value.trim();
  }

  return "";
}

function getFilenameFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (!segments.length) return null;
    const last = segments[segments.length - 1];
    if (!last) return null;
    const decoded = decodeURIComponent(last);
    return decoded || null;
  } catch {
    return null;
  }
}

export async function extractAllLinks(root: Document | Element = document): Promise<ExtractAllResult> {
  const scope = root instanceof Document ? root : root.ownerDocument ?? document;
  const candidates = Array.from(scope.querySelectorAll(HREF_SELECTORS));
  const now = Date.now();

  const existing = await browserAPI.getGrabbedLinks();
  const merged = new Map<string, GrabbedLink>();

  for (const link of existing) {
    const key = link.normalized || link.url;
    if (!key) continue;
    const mimeHint = link.mime ?? (link.type && link.type.includes("/") ? link.type : null);
    const typeHint = link.type && !link.type.includes("/") ? link.type : null;
    const recategorized = categorizeUrl(key, {
      filename: link.filename ?? undefined,
      mime: mimeHint ?? undefined,
      typeHint: typeHint ?? undefined,
    });
    merged.set(key, { ...link, normalized: link.normalized || key, category: recategorized });
  }

  let added = 0;

  for (const el of candidates) {
    const rawHref = getHrefFromElement(el);
    if (!rawHref || typeof rawHref !== "string") continue;

    const trimmed = rawHref.trim();
    if (!trimmed || trimmed.startsWith("javascript:")) continue;

    let normalized = "";
    try {
      normalized = normalizeHref(trimmed);
    } catch {
      normalized = trimmed;
    }

    if (!normalized) continue;
    if (merged.has(normalized)) {
      const existingLink = merged.get(normalized);
      if (existingLink) {
        const label = getElementLabel(el);
        if ((!existingLink.text || !existingLink.text.trim()) && label) {
          existingLink.text = label;
        }
        if (!existingLink.filename) {
          const filename = getFilenameFromUrl(normalized);
          if (filename) existingLink.filename = filename;
        }
        const typeAttr = el.getAttribute("type");
        const dataMime = el.getAttribute("data-mime");
        const dataType = el.getAttribute("data-type") ?? el.getAttribute("data-filetype");
        const mimeHint = typeAttr && typeAttr.includes("/") ? typeAttr : dataMime || null;
        const typeHint = !mimeHint ? (dataType || (typeAttr && !typeAttr.includes("/") ? typeAttr : null)) : dataType ?? null;
        if (!existingLink.mime && mimeHint) existingLink.mime = mimeHint;
        if (!existingLink.type && typeHint) existingLink.type = typeHint;
        const mimeHintExisting = existingLink.mime ?? (existingLink.type && existingLink.type.includes("/") ? existingLink.type : null);
        const typeHintExisting = existingLink.type && !existingLink.type.includes("/") ? existingLink.type : null;
        existingLink.category = categorizeUrl(existingLink.normalized || existingLink.url, {
          filename: existingLink.filename ?? undefined,
          mime: mimeHintExisting ?? undefined,
          typeHint: typeHintExisting ?? undefined,
        });
      }
      continue;
    }

    const label = getElementLabel(el);
    const filename = getFilenameFromUrl(normalized);
    const downloadAttr = el.getAttribute("download") ?? el.getAttribute("data-filename");
    const typeAttr = el.getAttribute("type");
    const dataMime = el.getAttribute("data-mime");
    const dataType = el.getAttribute("data-type") ?? el.getAttribute("data-filetype");
    const mimeHint = typeAttr && typeAttr.includes("/") ? typeAttr : dataMime || null;
    const typeHint = !mimeHint ? (dataType || (typeAttr && !typeAttr.includes("/") ? typeAttr : null)) : dataType ?? null;
    const filenameHint = downloadAttr || filename || null;

    const newLink: GrabbedLink = {
      id: uid(),
      url: trimmed,
      normalized,
      category: categorizeUrl(normalized, {
        filename: filenameHint ?? undefined,
        mime: mimeHint ?? undefined,
        typeHint: typeHint ?? undefined,
      }),
      text: label,
      timestamp: now,
      type: typeHint ?? null,
      mime: mimeHint ?? null,
      size: null,
      filename: filename ?? (downloadAttr ?? null)
    };

    merged.set(normalized, newLink);
    added++;
  }

  const links = Array.from(merged.values());
  await browserAPI.storeGrabbedLinks(links);

  return {
    added,
    total: links.length,
    links
  };
}

export async function extractAll(root: Document | Element = document): Promise<ExtractAllResult> {
  return extractAllLinks(root);
}

export async function extractAllFromActiveTab(): Promise<ExtractAllResult> {
  const tabs = await browserAPI.queryTabs({ active: true, currentWindow: true });
  const active = tabs.find(tab => typeof tab.id === "number" && !tab.url?.startsWith("chrome://"));

  if (!active || typeof active.id !== "number") {
    throw new Error("No active tab available");
  }

  const response = await browserAPI.sendMessageToTab<ExtractAllMessageResponse>(active.id, {
    type: MessageTypes.SCAN_PAGE_LINKS
  });

  if (!response) {
    throw new Error("No response from content script");
  }

  if (!response.success) {
    throw new Error(response.error || "Failed to extract links");
  }

  return {
    added: response.added ?? 0,
    total: response.total ?? 0,
    links: response.links ?? []
  };
}

let listenerRegistered = false;

export function ensureExtractAllMessageListener(): void {
  if (listenerRegistered) return;
  if (typeof window === "undefined" || typeof document === "undefined") return;

  try {
    const listener = ((message: any, _sender: unknown, sendResponse: (response: ExtractAllMessageResponse) => void) => {
      if (!message || message.type !== MessageTypes.SCAN_PAGE_LINKS) return;

      extractAllLinks()
        .then(result => {
          sendResponse({ success: true, ...result });
        })
        .catch((error: unknown) => {
          const errMsg = error instanceof Error ? error.message : String(error);
          sendResponse({ success: false, error: errMsg });
        });

      return true as unknown as void;
    }) as Parameters<typeof browserAPI.addMessageListener>[0];

    browserAPI.addMessageListener(listener);
    listenerRegistered = true;
  } catch {
    // Ignore listener registration failures
  }
}

ensureExtractAllMessageListener();


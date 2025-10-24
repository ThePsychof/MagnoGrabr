/**
 * Categories of grabbed links
 */
export type LinkCategory = "images" | "downloads" | "media" | "anchors" | "others" | "suspicious";

/**
 * Interface for grabbed links
 */
export interface GrabbedLink {
  id: string;
  url: string;
  normalized: string;
  category: LinkCategory;
  text?: string;
  timestamp: number;
}

/**
 * Generate a unique identifier
 */
export function uid(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Categorize URL based on extension / type
 */
export function categorizeUrl(url: string): LinkCategory {
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

/**
 * Normalize URL relative to page base
 */
export function normalizeHref(href: string, base: string = window.location.href): string {
  try {
    // Handle empty or invalid href
    if (!href || typeof href !== 'string') {
      return '';
    }
    
    // Handle empty or invalid base
    if (!base || typeof base !== 'string') {
      base = window.location.href;
    }
    
    const url = new URL(href, base);
    return url.toString();
  } catch (error) {
    return href;
  }
}
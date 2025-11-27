import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { exportLinks, type ExportFormat } from "../utils/exportLinks";
// runtime globals used below
declare const chrome: any;
declare const browser: any;
import type { GrabbedLink, LinkCategory } from "../utils/linkCategorizer";
import { browserAPI, DEFAULT_SETTINGS, type ExtensionSettings, MessageTypes } from "../utils/browser-api";
import { categorizeUrl, formatBytes } from "../utils/linkCategorizer";
import { KeyCapture, getKeyDisplayName, isValidKey } from "../utils/key-capture";
import { Github } from "lucide-react";
import { clickReset, clickSave } from "../options/Options";
import { showToast } from "../utils/toastHelper";
import '../styles/tailwind.css';
import ThemeManager from "../utils/theme";
import { extractAllFromActiveTab } from "../utils/extractAll";

type Grouped = Record<string, GrabbedLink[]>;

const CATEGORY_ORDER: LinkCategory[] = [
  "media",
  "files",
  "links",
  "software",
  "suspicious"
];

const CATEGORY_LABELS: Record<LinkCategory, { emoji: string; text: string }> = {
  media: { emoji: "🖼️", text: "Media" },
  files: { emoji: "📁", text: "Files" },
  links: { emoji: "🌐", text: "Links" },
  software: { emoji: "📀", text: "Software" },
  suspicious: { emoji: "🥷", text: "Suspicious" },
  misc: { emoji: "🧐", text: "Misc" },
};

const getCategoryIndex = (category: string): number => {
  const idx = CATEGORY_ORDER.indexOf(category as LinkCategory);
  return idx === -1 ? CATEGORY_ORDER.length + 1 : idx;
};

const getCategoryLabel = (category: string): string => {
  const entry = CATEGORY_LABELS[category as LinkCategory];
  if (entry) return entry.text;
  return category.replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase());
};

const getCategoryEmoji = (category: string): string => {
  const entry = CATEGORY_LABELS[category as LinkCategory];
  return entry ? entry.emoji : "";
};

const recategorizeLinks = (links: GrabbedLink[]) => {
  let changed = false;
  const updated = links.map(link => {
    const source = link.normalized || link.url;
    const mimeHint = link.mime ?? (link.type && link.type.includes("/") ? link.type : null);
    const typeHint = link.type && !link.type.includes("/") ? link.type : null;
    const category = categorizeUrl(source, {
      filename: link.filename ?? undefined,
      mime: mimeHint ?? undefined,
      typeHint: typeHint ?? undefined,
    });
    if (link.category === category) return link;
    changed = true;
    return { ...link, category };
  });
  return { updated, changed };
};

const groupLinks = (list: GrabbedLink[]): Grouped =>
  list.reduce((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {} as Grouped);

export default function Popup() {
  const [links, setLinks] = useState<GrabbedLink[]>([]);
  const [grouped, setGrouped] = useState<Grouped>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const listRef = useRef<HTMLDivElement | null>(null);
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    (async () => {
      try {
        const loadedSettings = await browserAPI.getSettings();
        setSettings(prev => ({ ...DEFAULT_SETTINGS, ...loadedSettings }));
        // apply theme to popup document via ThemeManager
        try { ThemeManager.initThemeFromSettings(loadedSettings); } catch {}
        if (loadedSettings.defaultExport) setExportFormat(loadedSettings.defaultExport as ExportFormat);
      } catch {
        setSettings(DEFAULT_SETTINGS); // fallback
      }
    })();
  }, []);

  // ensure theme updates if settings change after mount
  useEffect(() => {
    try { ThemeManager.setTheme((settings && (settings as any).theme) || DEFAULT_SETTINGS.theme); } catch {}
  }, [settings]);

  const setTheme = (themeName: string) => {
    setSettings(prev => ({ ...(prev ?? DEFAULT_SETTINGS), theme: themeName }));
    ThemeManager.setTheme(themeName);
  };

  const [capturingKey, setCapturingKey] = useState<'activation' | 'end' | null>(null);

  const STORAGE_KEY = "MagnoGrabr_links";

  const loadSession = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);

    try {
      const session = await browserAPI.getGrabbedLinks();
      const { updated, changed } = recategorizeLinks(session);
      setLinks(updated);
      setGrouped(groupLinks(updated));
      if (changed) {
        try { browserAPI.storeGrabbedLinks(updated); } catch {}
      }
      // After loading saved session, probe any links that lack size/filename
      probeMissingMetadata(updated).catch(() => {});
      setLoading(false);
      if (showRefresh) showToast(`Refreshed - ${updated.length} links`, "success");
    } catch {
      setLinks([]);
      setGrouped({});
      setLoading(false);
      if (showRefresh) showToast("No links found", "info");
    } finally {
      if (showRefresh) setRefreshing(false);
    }
  };

  // Probe missing metadata from background (uses PROBE_URL) and persist updates
  const probeMissingMetadata = async (sessionLinks: GrabbedLink[]) => {
    if (!sessionLinks || !sessionLinks.length) return;
    const toProbe = sessionLinks.filter(l => !l.size && !l.filename);
    if (!toProbe.length) return;

    // Deduplicate by normalized URL
    const seen = new Set<string>();
    for (const link of toProbe) {
      if (seen.has(link.normalized)) continue;
      seen.add(link.normalized);

      try {
        const res: any = await browserAPI.sendMessage({ type: MessageTypes.PROBE_URL, payload: { url: link.normalized } });
        // background returns LinkInfo object directly
        if (res && res.ok) {
          // find and update the link in current state
          setLinks(prev => {
            const updated = prev.map(p => {
              if (p.normalized === link.normalized) {
                const sizeNum = (res.sizeNumber ?? null) as number | null;
                const formatted = sizeNum ? formatBytes(sizeNum) : (res.size ?? null);
                const mime = (res as any).mime ?? null;
                const type = res.type ?? null;
                return {
                  ...p,
                  size: formatted ?? p.size,
                  filename: res.filename ?? p.filename,
                  mime: mime ?? p.mime ?? null,
                  type: type ?? p.type ?? null,
                };
              }
              return p;
            });
            const { updated: recategorized } = recategorizeLinks(updated);
            setGrouped(groupLinks(recategorized));
            // persist the updated session
            try { browserAPI.storeGrabbedLinks(recategorized); } catch {}
            return recategorized;
          });
        }
      } catch (err) {
        // ignore per-link errors
      }
    }
  };

  useEffect(() => {
    loadSession();
  }, []);

  // Listen for storage changes so popup updates in real-time when content script saves metadata
  useEffect(() => {
    const ext = (typeof browser !== 'undefined' && browser.storage) ? browser : (typeof chrome !== 'undefined' && chrome.storage) ? chrome : null;
    if (!ext || !ext.storage || !ext.storage.onChanged) return;

    const handler = (changes: any, area: string) => {
      if (area !== 'local') return;
      if (changes && changes.MagnoGrabr_links) {
        loadSession();
      }
    };

    ext.storage.onChanged.addListener(handler);
    return () => {
      try { ext.storage.onChanged.removeListener(handler); } catch { }
    };
  }, []);

  const getDisplayFilename = useCallback((link: GrabbedLink): string | null => {
    if (link.filename) return link.filename;
    try {
      const u = new URL(link.normalized);
      const parts = u.pathname.split('/').filter(Boolean);
      const last = parts.length ? parts[parts.length - 1] || '' : '';
      return last ? decodeURIComponent(last) : null;
    } catch {
      return null;
    }
  }, []);

  const startKeyCapture = (keyType: 'activation' | 'end') => {
    setCapturingKey(keyType);

    const keyCapture = new KeyCapture({
      onKeyCaptured: (key: string) => {
        if (keyType === 'activation') {
          setSettings(prev => ({ ...prev, activationKey: key }));
        } else {
          setSettings(prev => ({ ...prev, endKey: key }));
        }
        setCapturingKey(null);
        showToast(`Key captured: ${getKeyDisplayName(key)}`, "success");
      },

      onCancel: () => {
        setCapturingKey(null);
      },
      timeout: 10000 // 10 second timeout
    });

    keyCapture.startCapture();
  };

  const copyAll = async () => {
    if (!links.length) return;
    await navigator.clipboard.writeText(links.map(l => l.normalized).join("\n"));
    showToast(`Copied ${links.length} link${links.length > 1 ? "s" : ""}`, "success");
  };

  // Export format state (manual choice)
  const [exportFormat, setExportFormat] = useState<ExportFormat>((settings.defaultExport as ExportFormat) || "text");

  const sortedCategories = useMemo(() => {
    const entries = Object.entries(grouped)
      .filter(([, items]) => items && items.length)
      .map(([cat, items]) => {
        const sortedItems = [...items].sort((a, b) => {
          const keyA = (getDisplayFilename(a) ?? a.normalized).toLowerCase();
          const keyB = (getDisplayFilename(b) ?? b.normalized).toLowerCase();
          return keyA.localeCompare(keyB);
        });
        return {
          key: cat,
          label: getCategoryLabel(cat),
          items: sortedItems,
          order: getCategoryIndex(cat)
        };
      });

    entries.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.label.localeCompare(b.label);
    });

    return entries;
  }, [grouped, getDisplayFilename]);

  useEffect(() => {
    const validKeys = new Set(sortedCategories.map(cat => cat.key));
    Object.keys(categoryRefs.current).forEach(key => {
      if (!validKeys.has(key)) {
        delete categoryRefs.current[key];
      }
    });
  }, [sortedCategories]);

  useEffect(() => {
    if (!sortedCategories.length) {
      setActiveCategory(null);
      return;
    }
    setActiveCategory(prev => {
      if (prev && sortedCategories.some(cat => cat.key === prev)) {
        return prev;
      }
      return sortedCategories[0]?.key ?? null;
    });
  }, [sortedCategories]);

  const programmaticScrollRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const container = listRef.current;
    if (!container || !sortedCategories.length) return;

    let rafId: number | null = null;

    const updateActiveCategory = () => {
      // CRITICAL: Skip ALL detection while programmatic scroll is active
      if (programmaticScrollRef.current) {
        return;
      }

      const stickyHeaderHeight = 48;
      const scrollTop = container.scrollTop;
      const viewportTop = scrollTop + stickyHeaderHeight + 8; // Position in scroll container where we check
      let found: string | null = null;

      for (const { key } of sortedCategories) {
        const section = categoryRefs.current[key];
        if (!section) continue;

        // Calculate position relative to the scroll container using getBoundingClientRect
        const containerRect = container.getBoundingClientRect();
        const sectionRect = section.getBoundingClientRect();
        // Position of section relative to container's scroll position
        const sectionTop = sectionRect.top - containerRect.top + scrollTop;
        
        if (sectionTop <= viewportTop) {
          found = key;
        } else {
          // Once we find a section that's below the threshold, stop
          break;
        }
      }

      // Update active category - use found category or default to first if at top
      if (found !== null) {
        setActiveCategory(prev => (prev === found ? prev : found));
      } else if (scrollTop < 10 && sortedCategories.length > 0) {
        // If we're at the very top, select the first category
        const firstCategory = sortedCategories[0]?.key;
        if (firstCategory) {
          setActiveCategory(prev => (prev === firstCategory ? prev : firstCategory));
        }
      }
    };

    const handleScroll = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateActiveCategory);
    };

    // Initial update after a brief delay to ensure refs are set
    const initialTimeout = setTimeout(() => {
      updateActiveCategory();
    }, 100);

    container.addEventListener("scroll", handleScroll, { passive: true });
    
    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      clearTimeout(initialTimeout);
    };
  }, [sortedCategories]);

  const handleScrollToCategory = useCallback((category: string) => {
    const container = listRef.current;
    const section = categoryRefs.current[category];
    
    // Set active immediately for visual feedback
    setActiveCategory(category);
    
    if (!container || !section) return;

    // CRITICAL: Block detection during entire smooth scroll
    programmaticScrollRef.current = true;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    
    // Timeout must be longer than browser's smooth scroll duration (typically 600-800ms)
    scrollTimeoutRef.current = setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 1200);

    // Calculate target scroll position
    const containerRect = container.getBoundingClientRect();
    const sectionRect = section.getBoundingClientRect();
    const stickyHeaderHeight = 48;
    const targetScroll = sectionRect.top - containerRect.top + container.scrollTop - stickyHeaderHeight;

    // Scroll smoothly to the target
    container.scrollTo({
      top: Math.max(0, targetScroll),
      behavior: "smooth"
    });
  }, []);

  const exportAll = async (format: ExportFormat = exportFormat) => {
    if (!links.length) return showToast("No links to export!", "error");
    try {
      await exportLinks(links, format);
      showToast(`Exported ${links.length} link${links.length > 1 ? "s" : ""}!`, "success");
    } catch (error) {
      showToast("Export failed", "error");
    }
  };

  const extractAllFromPage = async () => {
    if (extracting) return;
    setExtracting(true);
    try {
      const result = await extractAllFromActiveTab();
      if (result.added > 0) {
        showToast(`Extracted ${result.added} new link${result.added > 1 ? "s" : ""}`, "success");
      } else {
        showToast("No new links found", "info");
      }
      await loadSession();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to extract links";
      showToast(message, "error");
    } finally {
      setExtracting(false);
    }
  };

  const downloadAll = async () => {
    if (!links.length) return;
    try {
      await browserAPI.sendMessage({ type: "DOWNLOAD_URLS", payload: { urls: links.map(l => l.normalized) } });
      showToast("Download started", "success");
    } catch {
      showToast("Download failed", "error");
    }
  };

  const clearAll = async () => {
    if (!links.length) {
      showToast("No links to clear", "info");
      return;
    }
    try {
      setLinks([]);
      setGrouped({});
      setActiveCategory(null);
      await browserAPI.clearGrabbedLinks();
      showToast("Cleared all links", "success");
    } catch {
      showToast("Failed to clear links", "error");
    }
  };

  const copyOne = async (url: string) => {
    await navigator.clipboard.writeText(url);
    showToast("Copied", "success");
  };

  const downloadOne = async (url: string) => {
    try {
      await browserAPI.sendMessage({ type: "DOWNLOAD_URLS", payload: { urls: [url] } });
      showToast("Downloading...", "info");
    } catch {
      showToast("Download failed", "error");
    }
  };

  const removeOne = async (cat: string, id: string) => {
    setGrouped(prev => {
      const updatedGrouped = {
        ...prev,
        [cat]: prev[cat]?.filter(link => link.id !== id) || []
      };

      const updatedLinks = Object.values(updatedGrouped).flat();

      setLinks(updatedLinks);

      browserAPI.storeGrabbedLinks(updatedLinks);

      return updatedGrouped;
    });
  };

  const removeCategory = async (cat: string) => {
    setGrouped(prev => {
      if (!prev[cat]) return prev;
      const updatedGrouped = { ...prev };
      delete updatedGrouped[cat];

      const updatedLinks = Object.values(updatedGrouped).flat();

      setLinks(updatedLinks);

      try { browserAPI.storeGrabbedLinks(updatedLinks); } catch {}

      // update active category if the removed one was active
      setActiveCategory(prevActive => (prevActive === cat ? (Object.keys(updatedGrouped)[0] ?? null) : prevActive));

      showToast(`Removed ${cat} (${(prev[cat] || []).length} link${(prev[cat] || []).length !== 1 ? 's' : ''})`, "success");

      return updatedGrouped;
    });
  };

  const renderMainContent = () => (
    <>
      <button
        className="top-2 right-2 absolute bg-ButtonNotActive rounded hover:bg-ButtonNotActiveHover px-2 py-1 text-TextOut"
        onClick={() => setShowSettings(true)}
      >
        ⚙️
      </button>

      <div className="mx-3 my-3 flex flex-wrap gap-2">
        <button onClick={copyAll} className="px-3 py-1 bg-ButtonActive rounded hover:bg-ButtonActiveHover text-TextIn">
          Copy All
        </button>
        <button
          onClick={extractAllFromPage}
          disabled={extracting}
          className={`px-3 py-1 rounded text-TextIn ${extracting ? "bg-ButtonActive" : "bg-ButtonActive hover:bg-ButtonActiveHover"}`}
        >
          {extracting ? "Extracting..." : "Extract Page"}
        </button>
        <div className="relative inline-block">
          <button onClick={() => exportAll()} className="px-3 py-1 bg-ButtonActive rounded hover:bg-ButtonActiveHover text-TextIn">
            Export All
          </button>
        </div>
        <button onClick={downloadAll} className="px-3 py-1 bg-ButtonActive rounded hover:bg-ButtonActiveHover text-TextIn">
          Download All
        </button>
        <button
          onClick={clearAll}
          disabled={!links.length}
          className={`px-3 py-1 rounded text-TextOut ${links.length ? "bg-ButtonNotActive hover:bg-ButtonNotActiveHover" : "bg-ButtonNotActive opacity-60"}`}
        >
          Clear All
        </button>
      </div>

      <div
        ref={listRef}
        className="relative space-y-4 max-h-[420px] overflow-y-scroll pr-1 scroll-thumb-primary"
      >
        {sortedCategories.length > 0 && (
          <div className="sticky w-[96%] left-[2%] top-2.5 z-10 bg-FilterTagBG bg-opacity-60 backdrop-blur-sm px-1.5 border border-ButtonActive rounded-xl">
            <div className="flex items-center justify-center gap-1 flex-nowrap">
              {sortedCategories.map(({ key, label, items }) => {
                const isActive = activeCategory === key;
                return (
                  <button 
                    key={key}
                    onClick={() => handleScrollToCategory(key)}
                    className={`relative group flex items-center justify-evenly gap-1 px-2 py-1 rounded-xl font-weight-200 text-[16px] transition-all duration-200 flex-shrink-0 ${
                      isActive
                        ? "bg-ButtonActive hover:bg-ButtonActiveHover text-TextIn shadow-lg"
                        : "bg-ButtonNotActive text-TextOut hover:bg-ButtonNotActiveHover hover:text-TextOut"
                    }`}
                    aria-label={`${getCategoryLabel(key)} (${items.length})`}
                    title={`${getCategoryLabel(key)} — ${items.length} link${items.length !== 1 ? 's' : ''}`}
                  >
                    <span className="text-sm leading-none">{getCategoryEmoji(key)}</span>
                    <span className={`inline-flex items-center justify-center px-1 rounded text-[15px] font-semibold ${
                      isActive ? "text-TextIn" : "text-TextOut"
                    }`}>
                      {items.length}
                    </span>

                    {/* remove button */}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); removeCategory(key); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); removeCategory(key); } }}
                      className={`opacity-0 group-hover:opacity-100 flex items-center justify-center w-3.5 h-3.5 rounded-t text-[10px] font-bold transition-all duration-150 cursor-pointer leading-none ${
                            isActive
                              ? "bg-white/30 hover:bg-white/40 text-TextIn"
                              : "bg-ButtonNotActive hover:bg-ButtonActive text-TextOut"
                      }`}
                      title={`Remove ${getCategoryLabel(key)}`}
                      aria-label={`Remove ${getCategoryLabel(key)}`}
                    >
                      ✕
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {sortedCategories.map(({ key: cat, label, items }) => (
          <div
            className="bg-LinkBG p-2 rounded-lg"
            key={cat}
            ref={el => {
              if (el) {
                categoryRefs.current[cat] = el;
              } else {
                delete categoryRefs.current[cat];
              }
            }}
            data-category={cat}
          >
            <div className="text-sm text-Lable mb-1 uppercase tracking-wide">{label}</div>
            <div className="space-y-2">
              {items.map(link => (
                <div
                  key={link.id}
                  className="p-2 bg-ButtonNotActive rounded flex justify-between items-center hover:bg-ButtonNotActiveHover transition-colors duration-200"
                >
                  <div className="flex-1 flex flex-col">
                    <a
                      className="text-sm break-all"
                      href={link.normalized}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {link.normalized}
                    </a>
                    {(link.filename || link.size) && (() => {
                      const displayName = getDisplayFilename(link);

                      return (
                        <div className="text-xs text-TextOut mt-0.5 flex items-center w-full">
                          {/* filename */}
                          <div className="flex-1 min-w-0">
                            {displayName ? (
                              <div className="overflow-hidden relative w-full h-4">
                                <div className="absolute left-0 inset-y-0 flex items-center whitespace-nowrap mg-marquee hover:[animation-play-state:paused]">
                                  <span className="pr-8" title={displayName}>{displayName}</span>
                                  <span className="pr-8" aria-hidden="true">{displayName}</span>
                                </div>
                              </div>
                            ) : null}
                          </div>

                          {/* | size */}
                          {displayName && link.size && <span className="mx-1">|</span>}
                          {link.size && <span className="flex-shrink-0">{link.size}</span>}
                        </div>
                      );
                    })()}
                  </div>
                    <div className="ml-2 flex gap-1 flex-col shrink-0">
                    <button
                      className="text-xs px-1 py-0.5 bg-ButtonNotActive rounded hover:bg-ButtonNotActiveHover transition-colors text-TextOut"
                      onClick={() => copyOne(link.normalized)}
                      title="Copy Link"
                    >
                      📎
                    </button>
                    <button
                      className="text-xs px-1 py-0.5 bg-ButtonNotActive rounded hover:bg-ButtonNotActiveHover transition-colors text-TextOut"
                      onClick={() => downloadOne(link.normalized)}
                      title="Download"
                    >
                      ⬇️
                    </button>
                    <button
                      className="text-xs px-1 py-0.5 bg-ButtonNotActive rounded hover:bg-ButtonNotActiveHover transition-colors text-TextOut"
                      onClick={() => removeOne(link.category, link.id)}
                      title="Remove"
                    >
                      ❌
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {!loading && links.length === 0 && (
        <div className="text-center">
          <div className="text-TextMd mb-3"><p>No links captured yet.</p></div>
          <div className="mb-3">
            <p className="font-semibold text-Lable text-sm mb-1 mt-3">Reload page before using MagnoGrabr</p>
            <p className="text-Lable text-xs">Hold {getKeyDisplayName(settings.activationKey)} to capture links, then {getKeyDisplayName(settings.activationKey)}+{getKeyDisplayName(settings.endKey)} to save them here.</p>
          </div>
        </div>
      )}
    </>
  );

  const renderSettings = () => (
    <>
        <button
        className="top-2 right-2 absolute bg-ButtonNotActive rounded hover:bg-ButtonNotActiveHover px-2 py-1 text-TextOut"
        onClick={() => setShowSettings(false)}
      >
        🏠
      </button>

      <div className="space-y-4 max-h-[420px] overflow-auto pr-1">
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-Lable mb-2">Activation Key</label>
            <button
              className={`w-full p-3 rounded text-left ${
                capturingKey === 'activation' 
                  ? 'bg-ButtonActive hover:bg-ButtonActiveHover text-TextIn' 
                  : 'bg-ButtonNotActive hover:bg-ButtonNotActiveHover text-TextOut'
              }`}
              onClick={() => startKeyCapture('activation')}
              disabled={capturingKey !== null}
            >
              {capturingKey === 'activation' 
                ? 'Press any key...' 
                : getKeyDisplayName(settings.activationKey)
              }
            </button>
          </div>

          <div>
            <label className="block text-sm text-Lable mb-2">End Key (may not work with some keys)</label>
            <button
              className={`w-full p-3 rounded text-left ${
                capturingKey === 'end' 
                  ? 'bg-ButtonActive hover:bg-ButtonActiveHover text-TextIn' 
                  : 'bg-ButtonNotActive hover:bg-ButtonNotActiveHover text-TextOut'
              }`}
              onClick={() => startKeyCapture('end')}
              disabled={capturingKey !== null}
            >
              {capturingKey === 'end' 
                ? 'Press any key...' 
                : getKeyDisplayName(settings.endKey)
              }
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setSettings(prev => ({ ...(prev ?? DEFAULT_SETTINGS), toggleMode: !(prev?.toggleMode) }))}
            className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 select-none
              ${settings?.toggleMode
                ? "bg-ButtonActive hover:bg-ButtonActiveHover text-TextIn"
                : "bg-ButtonNotActive hover:bg-ButtonNotActiveHover text-TextOut"}`}
          >
            Toggle Mode
          </button>
          <button
            onClick={() => {
              const next = !(settings?.oneKeyMode);
              setSettings(prev => ({ ...(prev ?? DEFAULT_SETTINGS), oneKeyMode: next }));
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 select-none
              ${settings?.oneKeyMode
                ? "bg-ButtonActive hover:bg-ButtonActiveHover text-TextIn"
                : "bg-ButtonNotActive hover:bg-ButtonNotActiveHover text-TextOut"}`}
          >
            OneKey Mode
          </button>
          <div className="relative group inline-block">
            <input
              type="number"
              step="10"
              min="0"
              value={settings.grabDelay ?? 0}
              onChange={(e) => {
                const newVal = Number(e.target.value);
                setSettings((prev) => ({ ...prev, grabDelay: newVal }));
              }}
              placeholder="Grab delay (ms)"
              className="w-28 p-2 rounded-lg bg-ButtonNotActive text-TextOut placeholder-muted 
                        focus:outline-none focus:ring-2 focus:ring-primary 
                        appearance-none 
                        [&::-webkit-inner-spin-button]:appearance-none 
                        [&::-webkit-outer-spin-button]:appearance-none"
            />
            {/* tooltip */}
            <span className="absolute -top-5 left-1/2 -translate-x-1/2 opacity-0 hover:opacity-100 group-hover:opacity-100 pointer-events-none bg-ButtonNotActive text-TextOut text-xs px-3 py-1 rounded-lg shadow-md transition-opacity duration-300 whitespace-nowrap translate-y-1 group-hover:-translate-y-1">Grab delay in ms</span>  
          </div>
          <div className="relative inline-block">
            <button
              className="px-3 py-1 rounded bg-ButtonNotActive hover:bg-ButtonNotActiveHover text-TextOut font-medium transition-colors text-left flex justify-between items-center gap-2"
              onClick={(e) => {
                const menu = (e.currentTarget.nextElementSibling as HTMLElement);
                menu.classList.toggle('hidden');
              }}
            >
              <span className="capitalize">{settings.defaultExport || exportFormat}</span>
              <span className="text-xs">▼</span>
            </button>
            <div className="hidden absolute top-full left-0 mt-1 bg-FilterTagBG border border-ButtonNotActive rounded z-10" data-export-menu>
              {(['text', 'csv', 'json'] as ExportFormat[]).map(format => (
                <button
                  key={format}
                  onClick={() => {
                    setExportFormat(format);
                    setSettings(prev => ({ ...prev, defaultExport: format }));
                    const menu = document.querySelector('[data-export-menu]') as HTMLElement;
                    if (menu) menu.classList.add('hidden');
                  }}
                  className="w-full px-3 py-1 text-left hover:bg-ButtonNotActive text-TextOut capitalize text-sm first:rounded-t last:rounded-b transition-colors"
                >
                  {format}
                </button>
              ))}
            </div>
          </div>
          <div className="relative inline-block">
            <button
              className="px-3 py-1 rounded bg-ButtonNotActive hover:bg-ButtonNotActiveHover text-TextOut font-medium transition-colors text-left flex justify-between items-center gap-2"
              onClick={(e) => {
                const menu = (e.currentTarget.nextElementSibling as HTMLElement);
                menu.classList.toggle('hidden');
              }}
            >
              <span className="capitalize">{(settings as any)?.theme || 'default'}</span>
              <span className="text-xs">▼</span>
            </button>
            <div className="hidden absolute top-full left-0 mt-1 bg-FilterTagBG border border-ButtonNotActive rounded z-10" data-theme-menu>
              {[
                { key: 'red', label: 'Red' },
                  { key: 'pink', label: 'Pink' },
                  { key: 'blue', label: 'Blue' }
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => {
                    setTheme(t.key);
                    const menu = document.querySelector('[data-theme-menu]') as HTMLElement;
                    if (menu) menu.classList.add('hidden');
                  }}
                  className="w-full px-3 py-1 text-left hover:bg-ButtonNotActive text-TextOut capitalize text-sm first:rounded-t last:rounded-b transition-colors"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label 
              htmlFor="custom-cursor"
              className = "w-60 h-20 p-2 rounded-lg bg-ButtonNotActive text-TextOut cursor-pointer hover:bg-ButtonNotActiveHover transition-all duration-200 border border-ButtonNotActive hover:border-ButtonActive"
              >
              Uploud custom Cursor
            </label>
            <input
              placeholder="cursor"
              type="file"
              accept="image/png, image/svg+xml, image/gif"
              id="custom-cursor"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                const img = new Image();
                const reader = new FileReader();

                reader.onload = () => {
                  img.src = reader.result as string;
                };

                img.onload = async () => {
                  // Resize to 16x16 max
                  const canvas = document.createElement("canvas");
                  const maxSize = 32;
                  let w = img.width;
                  let h = img.height;

                  if (w > h && w > maxSize) {
                    h = (h / w) * maxSize;
                    w = maxSize;
                  } else if (h > maxSize) {
                    w = (w / h) * maxSize;
                    h = maxSize;
                  }

                  canvas.width = w;
                  canvas.height = h;
                  const ctx = canvas.getContext("2d");
                  ctx?.drawImage(img, 0, 0, w, h);

                  const base64 = canvas.toDataURL("image/png");

                  // Save to local state only — settings are persisted when Save is clicked
                  setSettings(prev => ({ ...prev, customCursor: base64 }));
                };

                reader.readAsDataURL(file);
              }}
            />
          </div>
          <div className="flex flex-row gap-2">
              {settings.defaultCursor && (
              <img
                src={settings.defaultCursor}
                alt="default"
                className={`mt-2 w-10 h-10 object-contain border-4 rounded ${settings.cursorFlag ? 'border-ButtonNotActive' : 'border-ButtonActive'}`}
                onClick={() =>
                    setSettings(prev => ({ ...prev, cursorFlag: false }))
                }
              />
              )}
              {settings.customCursor && (
              <img
                src={settings.customCursor}
                alt="custom"
                className={`mt-2 w-10 h-10 object-contain border-4 rounded ${settings.cursorFlag ? 'border-ButtonActive' : 'border-ButtonNotActive'}`}
                onClick={() => setSettings(prev => ({ ...prev, cursorFlag: true }))
                }
              />
              )}
          </div>
        </div>

        <div className="flex gap-2 pt-4">
            <button 
            className="flex-1 px-3 py-2 bg-ButtonActive rounded hover:bg-ButtonActiveHover text-TextIn"
            onClick={async (e) => {
              e.preventDefault();
              await clickSave(settings)(e);
            }}
          >
            Save
          </button>
          <button 
            className="flex-1 px-3 py-2 bg-ButtonNotActive rounded hover:bg-ButtonNotActiveHover text-TextOut"
            onClick={clickReset(setSettings)}
          >
            Reset
          </button>
        </div>
        <div className="mt-1 flex justify-center items-center">
          <a
            href="https://github.com/ThePsychof/MagnoGrabr"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-Source hover:text-SourceHover decoration-Source decoration-2 transition-all"
          >
            <Github className="w-4 h-4" />
            <span>Source</span>
          </a>
        </div>
      </div>
    </>
  );

  return (
    <div className="p-4 app-root w-[500px] max-w-[540px] font-mono relative">
      <h2 className="text-2xl text-MagnoGrabr mb-3 font-semibold">MagnoGrabr</h2>

      {loading && <div className="text-TextMd">Loading…</div>}

      {!loading && (showSettings ? renderSettings() : (
        <div className="grid grid-cols-6 gap-3">
          <div className="col-span-6">
            {/** main controls and action buttons + tag bar */}
            {renderMainContent()}
          </div>
        </div>
      ))}
    </div>
  );
}
import React, { useEffect, useState } from "react";
import type { GrabbedLink } from "../utils/helpers";
import { browserAPI, DEFAULT_SETTINGS, type ExtensionSettings } from "../utils/browser-api";
import { KeyCapture, getKeyDisplayName, isValidKey } from "../utils/key-capture";
import { Github } from "lucide-react";
import { clickReset, clickSave, grabDelay, toggleMode, updateSetting } from "../options/Options";
import { showToast } from "../utils/toastHelper";
import '../styles/tailwind.css';
import { LinkGrabber } from "../content";

type Grouped = Record<string, GrabbedLink[]>;

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
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);

  const grabber = new LinkGrabber();
  useEffect(() => {
    (async () => {
      try {
        const loaded = await browserAPI.getSettings();
        setSettings(loaded);
      } catch {
        setSettings(DEFAULT_SETTINGS); // fallback
      }
    })();
  }, []);
  
  const [capturingKey, setCapturingKey] = useState<'activation' | 'end' | null>(null);

  const STORAGE_KEY = "MagnoGrabr_links";

  const loadSession = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);

    try {
      const session = await browserAPI.getGrabbedLinks();
      setLinks(session);
      setGrouped(groupLinks(session));
      setLoading(false);
      if (showRefresh) showToast(`Refreshed - ${session.length} links`, "success");
    } catch {
      setLinks([]);
      setGrouped({});
      setLoading(false);
      if (showRefresh) showToast("No links found", "info");
    } finally {
      if (showRefresh) setRefreshing(false);
    }
  };

  useEffect(() => {
    loadSession();
    loadSettingsMerged();
  }, []);

  const loadSettingsMerged = async () => {
    try {
      const loadedSettings = await browserAPI.getSettings();
      setSettings(prev => ({ ...DEFAULT_SETTINGS, ...loadedSettings }));
      showToast("Settings loaded" , "success");
    } catch {
      setSettings(DEFAULT_SETTINGS);
      showToast("No settings found", "info");
    }
  }

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

  const exportAll = async () => {
      if (!links.length) return showToast("No links to export!", "error");

      const text = links.map(l => l.normalized).join("\n");
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;

      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, "0");
      a.download = `MagnoGrabr_Links_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}_${pad(now.getMinutes())}_${pad(now.getSeconds())}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      showToast(`Exported ${links.length} link${links.length > 1 ? "s" : ""}!`, "success");
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

  const renderMainContent = () => (
    <>
      <button
        className="top-2 right-2 absolute bg-zinc-800 rounded hover:bg-zinc-700 px-2 py-1"
        onClick={() => setShowSettings(true)}
      >
        ⚙️
      </button>

      <div className="mx-3 my-3 flex flex-wrap justify-between">
        <button onClick={copyAll} className="px-3 py-1 bg-red-600 rounded hover:bg-red-700">
          Copy All
        </button>
        <button onClick={exportAll} className="px-3 py-1 bg-red-600 rounded hover:bg-red-700">
          Export All
        </button>
        <button onClick={downloadAll} className="px-3 py-1 bg-red-600 rounded hover:bg-red-700">
          Download All
        </button>
      </div>

      <div className="space-y-4 max-h-[420px] overflow-y-scroll pr-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-black [&::-webkit-scrollbar-thumb]:bg-red-600 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-red-600 [scrollbar-width]:thin [scrollbar-color]:red-600">
        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat}>
            <div className="text-sm text-zinc-400 mb-1 uppercase tracking-wide">{cat}</div>
            <div className="space-y-2">
              {items.map(link => (
                <div
                  key={link.id}
                  className="p-2 bg-zinc-800 rounded flex justify-between items-center hover:bg-zinc-900 transition"
                >
                  <a
                    className="text-sm break-all flex-1"
                    href={link.normalized}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {link.normalized}
                  </a>
                  <div className="ml-2 flex gap-2 shrink-0 flex-col">
                    <button
                      className="text-2xs px-[0.75] py-[0.75] bg-zinc-800 rounded hover:bg-zinc-700"
                      onClick={() => copyOne(link.normalized)}
                    >
                      📎
                    </button>
                    <button
                      className="text-2xs px-[0.75] py-[0.75] bg-zinc-800 rounded hover:bg-zinc-700"
                      onClick={() => downloadOne(link.normalized)}
                    >
                      ⬇️
                    </button>
                    <button
                      className="text-2xs px-[0.75] py-[0.75] bg-zinc-800 rounded hover:bg-zinc-700"
                      onClick={() => removeOne(link.category, link.id)}
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
          <div className="text-zinc-500 mb-3"><p>No links captured yet.</p></div>
          <div className="mb-3">
            <p className="font-semibold text-zinc-400 text-sm mb-1">Reload page before using MagnoGrabr</p>
            <p className="text-zinc-400 text-xs">Hold {getKeyDisplayName(settings.activationKey)} to capture links, then {getKeyDisplayName(settings.activationKey)}+{getKeyDisplayName(settings.endKey)} to save them here.</p>
          </div>
        </div>
      )}
    </>
  );

  const renderSettings = () => (
    <>
      <button
        className="top-2 right-2 absolute bg-zinc-800 rounded hover:bg-zinc-700 px-2 py-1"
        onClick={() => setShowSettings(false)}
      >
        🏠
      </button>

      <div className="space-y-4 max-h-[420px] overflow-auto pr-1">
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Activation Key</label>
            <button
              className={`w-full p-3 rounded text-left ${
                capturingKey === 'activation' 
                  ? 'bg-yellow-600 hover:bg-yellow-700' 
                  : 'bg-zinc-800 hover:bg-zinc-700'
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
            <label className="block text-sm text-zinc-400 mb-2">End Key (may not work with some keys)</label>
            <button
              className={`w-full p-3 rounded text-left ${
                capturingKey === 'end' 
                  ? 'bg-yellow-600 hover:bg-yellow-700' 
                  : 'bg-zinc-800 hover:bg-zinc-700'
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
            onClick={() => toggleMode(setSettings)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 select-none
              ${settings?.toggleMode
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200"}`}
          >
            Toggle Mode
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
              className="w-28 p-2 rounded-lg bg-zinc-800 text-white placeholder-zinc-500 
                        focus:outline-none focus:ring-2 focus:ring-red-700 
                        appearance-none 
                        [&::-webkit-inner-spin-button]:appearance-none 
                        [&::-webkit-outer-spin-button]:appearance-none"
            />
            {/* tooltip */}
            <span className="absolute -top-5 left-1/2 -translate-x-1/2 opacity-0 hover:opacity-100 group-hover:opacity-100 pointer-events-none bg-zinc-900 text-white text-xs px-3 py-1 rounded-lg shadow-md transition-opacity duration-300 whitespace-nowrap translate-y-1 group-hover:-translate-y-1">Grab delay in ms</span>
          </div>

          <div>
            <label 
              htmlFor="custom-cursor"
              className = "w-60 h-20 p-2 rounded-lg bg-zinc-800 text-white cursor-pointer hover:bg-zinc-700 transition-all duration-200 border border-zinc-700 hover:border-red-600"
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

                  // Save to state + browser
                  setSettings(prev => ({ ...prev, customCursor: base64 }));
                  await browserAPI.setSettings({ ...settings, customCursor: base64 });
                  await updateSetting("customCursor", base64);

                  showToast("Custom cursor loaded and resized!", "success");
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
                className={`mt-2 w-10 h-10 object-contain border-4 rounded ${settings.cursorFlag ? 'border-zinc-600' : 'border-red-600'}`}
                onClick={() =>
                    setSettings(prev => ({ ...prev, cursorFlag: false }))
                }
              />
              )}
              {settings.customCursor && (
              <img
                src={settings.customCursor}
                alt="custom"
                className={`mt-2 w-10 h-10 object-contain border-4 rounded ${settings.cursorFlag ? 'border-red-600' : 'border-zinc-600'}`}
                onClick={() => setSettings(prev => ({ ...prev, cursorFlag: true }))
                }
              />
              )}
          </div>
        </div>

        <div className="flex gap-2 pt-4">
          <button 
            className="flex-1 px-3 py-2 bg-red-600 rounded hover:bg-red-700"
            onClick={async (e) => {
              e.preventDefault();
              await grabDelay(settings.grabDelay);
              await clickSave(settings)(e);
            }}
          >
            Save
          </button>
          <button 
            className="flex-1 px-3 py-2 bg-zinc-700 rounded hover:bg-zinc-600"
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
            className="flex items-center gap-1 text-zinc-400 hover:text-red-600 decoration-zinc-400 decoration-2 transition-all"
          >
            <Github className="w-4 h-4" />
            <span>Source</span>
          </a>
        </div>
      </div>
    </>
  );

  return (
    <div className="p-4 bg-zinc-900 min-w-[360px] text-white font-mono relative">
      <h2 className="text-2xl text-red-700 mb-3 font-semibold">MagnoGrabr</h2>

      {loading && <div className="text-zinc-400">Loading…</div>}

      {!loading && (showSettings ? renderSettings() : renderMainContent())}
    </div>
  );
}
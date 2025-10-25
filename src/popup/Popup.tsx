import React, { useEffect, useState } from "react";
import type { GrabbedLink } from "../utils/helpers";
import { browserAPI, type ExtensionSettings } from "../utils/browser-api";
import { KeyCapture, getKeyDisplayName, isValidKey } from "../utils/key-capture";
import { Github } from "lucide-react";

declare const browser: any;
declare const chrome: any;

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
  const [toast, setToast] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<ExtensionSettings>({
    activationKey: "ShiftLeft",
    endKey: "ControlLeft",
    toggleMode: false,
    dedupe: true,
    deepResolve: true,
    grabDelay: 500,
    effects: true,
    highlightColor: "#4CAF50",
    notifyDuration: 2000,
  });
  const [capturingKey, setCapturingKey] = useState<'activation' | 'end' | null>(null);

  const STORAGE_KEY = "MagnoGrabr_links";

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const loadSession = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);

    try {
      const session = await browserAPI.getGrabbedLinks();
      setLinks(session);
      setGrouped(groupLinks(session));
      setLoading(false);
      if (showRefresh) showToast(`Refreshed - ${session.length} links`);
    } catch {
      setLinks([]);
      setGrouped({});
      setLoading(false);
      if (showRefresh) showToast("No links found");
    } finally {
      if (showRefresh) setRefreshing(false);
    }
  };

  useEffect(() => {
    loadSession();
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const loadedSettings = await browserAPI.getSettings();
      setSettings(loadedSettings);
    } catch (error) {
      // Settings will use defaults if loading fails
    }
  };

  const saveSettings = async () => {
    try {
      await browserAPI.setSettings(settings);
      showToast("Settings saved!");
    } catch (error) {
      showToast("Failed to save settings");
    }
  };

  const resetSettings = async () => {
    const defaultSettings: ExtensionSettings = {
      activationKey: "ShiftLeft",
      endKey: "ControlLeft",
      toggleMode: false,
      dedupe: true,
      deepResolve: true,
      grabDelay: 500,
      effects: true,
      highlightColor: "#4CAF50",
      notifyDuration: 2000,
    };
    setSettings(defaultSettings);
    try {
      await browserAPI.setSettings(defaultSettings);
      showToast("Settings reset to defaults!");
    } catch (error) {
      showToast("Failed to reset settings");
    }
  };

  const startKeyCapture = (keyType: 'activation' | 'end') => {
    setCapturingKey(keyType);
    
    const keyCapture = new KeyCapture({
      onKeyCaptured: (key) => {
        if (keyType === 'activation') {
          setSettings(prev => ({ ...prev, activationKey: key }));
        } else {
          setSettings(prev => ({ ...prev, endKey: key }));
        }
        setCapturingKey(null);
        showToast(`Key captured: ${getKeyDisplayName(key)}`);
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
    showToast(`Copied ${links.length} link${links.length > 1 ? "s" : ""}`);
  };

  const downloadAll = async () => {
    if (!links.length) return;
    try {
      await browserAPI.sendMessage({ type: "DOWNLOAD_URLS", payload: { urls: links.map(l => l.normalized) } });
      showToast("Download started");
    } catch {
      showToast("Download failed");
    }
  };

  const copyOne = async (url: string) => {
    await navigator.clipboard.writeText(url);
    showToast("Copied");
  };

  const downloadOne = async (url: string) => {
    try {
      await browserAPI.sendMessage({ type: "DOWNLOAD_URLS", payload: { urls: [url] } });
      showToast("Downloading...");
    } catch {
      showToast("Download failed");
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
        <button onClick={downloadAll} className="px-3 py-1 bg-red-600 rounded hover:bg-red-700">
          Download All
        </button>
      </div>

      <div className="space-y-4 max-h-[420px] overflow-auto pr-1">
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
          <div className="text-zinc-500 mb-3">No links captured yet.</div>
          <div className="text-zinc-400 text-sm mb-3">
            Hold {getKeyDisplayName(settings.activationKey)} to capture links, then {getKeyDisplayName(settings.activationKey)}+{getKeyDisplayName(settings.endKey)} to save them here.
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
            <label className="block text-sm text-zinc-400 mb-2">End Key (open popup)</label>
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

        <div className="flex gap-2 pt-4">
          <button 
            className="flex-1 px-3 py-2 bg-red-600 rounded hover:bg-red-700"
            onClick={saveSettings}
          >
            Save
          </button>
          <button 
            className="flex-1 px-3 py-2 bg-zinc-700 rounded hover:bg-zinc-600"
            onClick={resetSettings}
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
      <h2 className="text-lg text-red-500 mb-3 font-semibold">MagnoGrabr</h2>

      {toast && (
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-zinc-800 text-sm px-3 py-1 rounded shadow-lg animate-fadeIn">
          {toast}
        </div>
      )}

      {loading && <div className="text-zinc-400">Loading…</div>}

      {!loading && (showSettings ? renderSettings() : renderMainContent())}
    </div>
  );
}
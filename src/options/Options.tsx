import React, { useEffect, useState } from "react";
import { browserAPI, type ExtensionSettings } from "../utils/browser-api";

declare const chrome: any;

const DEFAULT_SETTINGS: ExtensionSettings = {
  activationKey: "ShiftLeft",
  endKey: "ControlLeft",
  toggleMode: false,
  dedupe: true,
  deepResolve: false,
  grabDelay: 250,
  effects: true,
  highlightColor: "#4CAF50",
  notifyDuration: 2000,
};

export default function Options() {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);

  // Load settings from storage on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await browserAPI.getSettings();
        setSettings(stored);
      } catch {
        // fallback silently
      }
    })();
  }, []);

  const saveSettings = async () => {
    try {
      await browserAPI.setSettings(settings);
      alert("Settings saved!");
    } catch {
      alert("Failed to save settings");
    }
  };

  const resetSettings = async () => {
    setSettings(DEFAULT_SETTINGS);
    try {
      await browserAPI.setSettings(DEFAULT_SETTINGS);
    } catch {
      // silent fail
    }
  };

  return (
    <div className="p-6 bg-zinc-900 min-h-screen text-white font-mono flex flex-col items-center">
      <h1 className="text-2xl text-red-500 mb-6 font-semibold">MagnoGrabr Settings</h1>

      {/* Text Inputs */}
      <div className="w-full max-w-md flex flex-col gap-4">
        <div className="flex flex-col">
          <label htmlFor="activationKey" className="mb-1 text-sm">Activation Key</label>
          <input
            id="activationKey"
            type="text"
            placeholder="e.g ShiftLeft"
            title="Activation key code"
            className="p-2 bg-zinc-800 rounded w-full"
            value={settings.activationKey}
            onChange={(e) => setSettings({ ...settings, activationKey: e.target.value })}
          />
        </div>

        <div className="flex flex-col">
          <label htmlFor="endKey" className="mb-1 text-sm">End Key (open popup)</label>
          <input
            id="endKey"
            type="text"
            placeholder="e.g ControlLeft"
            title="End key code"
            className="p-2 bg-zinc-800 rounded w-full"
            value={settings.endKey}
            onChange={(e) => setSettings({ ...settings, endKey: e.target.value })}
          />
        </div>

        {/* Buttons */}
        <div className="flex justify-center gap-4 mt-4">
          <button className="px-4 py-2 rounded bg-red-600 hover:bg-red-700" onClick={saveSettings}>
            Save
          </button>
          <button className="px-4 py-2 rounded bg-zinc-700 hover:bg-zinc-600" onClick={resetSettings}>
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
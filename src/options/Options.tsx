import React, { useEffect, useState } from "react";
import { browserAPI, type ExtensionSettings } from "../utils/browser-api";

const DEFAULT_SETTINGS: Readonly<ExtensionSettings> = {
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
export async function loadSettings(): Promise<ExtensionSettings> {
  const stored = await browserAPI.getSettings();
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await browserAPI.setSettings(settings);
}


export async function resetSettings(): Promise<ExtensionSettings> {
  await browserAPI.setSettings(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}


export async function updateSetting<K extends keyof ExtensionSettings>(
  key: K,
  value: ExtensionSettings[K]
): Promise<void> {
  const current = await browserAPI.getSettings();
  const merged: ExtensionSettings = { ...DEFAULT_SETTINGS, ...(current ?? {}), [key]: value };
  await browserAPI.setSettings(merged);
}


export function clickSave(settings: ExtensionSettings): React.MouseEventHandler<HTMLButtonElement> {
  return async () => {
    await saveSettings(settings);
  };
}

export function clickReset(
  setSettings: React.Dispatch<React.SetStateAction<ExtensionSettings>>
): React.MouseEventHandler<HTMLButtonElement> {
  return async () => {
    const defaults = await resetSettings();
    setSettings(defaults);
  };
}

export default function Options() {
  return<></>
}
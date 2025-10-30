import React, { useEffect, useState } from "react";
import { browserAPI, type ExtensionSettings, DEFAULT_SETTINGS } from "../utils/browser-api";
import { showToast } from "../utils/toastHelper";
import '../styles/tailwind.css';



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
  const merged: ExtensionSettings = { ...(current ?? {}), [key]: value };
  await browserAPI.setSettings(merged);
}


export async function toggleMode(
  setSettings: React.Dispatch<React.SetStateAction<ExtensionSettings>>
) {
  const current = await browserAPI.getSettings();
  const newStat = !current.toggleMode; // invert current stored value
  const merged = { ...current, toggleMode: newStat };

  await browserAPI.setSettings(merged);
  setSettings(merged); // sync React state
  showToast(newStat ? "Toggle mode enabled" : "Toggle mode disabled", "success");
}

export async function grabDelay(value: number) {
  await updateSetting("grabDelay", value);
  showToast(`Grab delay set to ${value}ms`, "success");
}


export function clickSave(settings: ExtensionSettings): React.MouseEventHandler<HTMLButtonElement> {
  return async () => {
    await saveSettings(settings);
     showToast("Settings saved!", "success");
  };
}

export function clickReset(
  setSettings: React.Dispatch<React.SetStateAction<ExtensionSettings>>
): React.MouseEventHandler<HTMLButtonElement> {
  return async (event) => {
    event.preventDefault();
    const defaults = await resetSettings();
    setSettings(defaults);
    showToast("Settings reset to defaults!", "success");
  };
}






export default function Options() {
  return<></>
}
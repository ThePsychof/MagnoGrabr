// MessageTypes only needed by content script
export const MessageTypes = {
  TOGGLE_GRABBER: 'TOGGLE_GRABBER',
  STORE_SESSION: 'STORE_SESSION'
} as const;

export type MessageType = typeof MessageTypes[keyof typeof MessageTypes];

export interface ExtensionSettings {
  activationKey: string;
  endKey: string;
  toggleMode: boolean;
  dedupe: boolean;
  deepResolve: boolean;
  grabDelay: number;
  effects: boolean;
  highlightColor: string;
  notifyDuration: number;
}

import type { LinkCategory } from "./linkCategorizer";
export type { LinkCategory };

export interface GrabbedLink {
  id: string;
  url: string;
  text?: string;
  timestamp: number;
  category: LinkCategory;
}
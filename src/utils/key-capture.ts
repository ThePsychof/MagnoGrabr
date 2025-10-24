/**
 * Key capture utility for browser extension hotkeys
 * Only allows keys compatible with browser extension shortcuts
 */

// Valid keys for browser extension shortcuts
// Conservative list focusing on keys that are definitely compatible across browsers
const VALID_KEYS = [
  // Modifier keys (required for browser extensions)
  'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight',
  'MetaLeft', 'MetaRight', // Cmd on Mac
  
  // Function keys (commonly used and safe)
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
  
  // Letter keys (A-Z) - most commonly used in extensions
  'KeyA', 'KeyB', 'KeyC', 'KeyD', 'KeyE', 'KeyF', 'KeyG', 'KeyH', 'KeyI', 'KeyJ',
  'KeyK', 'KeyL', 'KeyM', 'KeyN', 'KeyO', 'KeyP', 'KeyQ', 'KeyR', 'KeyS', 'KeyT',
  'KeyU', 'KeyV', 'KeyW', 'KeyX', 'KeyY', 'KeyZ',
  
  // Number keys (0-9)
  'Digit0', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9',
  
  // Arrow keys
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'
] as const;

export type ValidKey = typeof VALID_KEYS[number];

export function isValidKey(key: string): key is ValidKey {
  return VALID_KEYS.includes(key as ValidKey);
}

export function getKeyDisplayName(key: string): string {
  const displayNames: Record<string, string> = {
    'ShiftLeft': 'Left Shift',
    'ShiftRight': 'Right Shift',
    'ControlLeft': 'Left Ctrl',
    'ControlRight': 'Right Ctrl',
    'AltLeft': 'Left Alt',
    'AltRight': 'Right Alt',
    'MetaLeft': 'Left Cmd',
    'MetaRight': 'Right Cmd',
    'ArrowUp': '↑',
    'ArrowDown': '↓',
    'ArrowLeft': '←',
    'ArrowRight': '→'
  };
  
  if (displayNames[key]) {
    return displayNames[key];
  }
  
  // Handle function keys
  if (key.startsWith('F') && key.length <= 3) {
    return key;
  }
  
  // Handle letter keys
  if (key.startsWith('Key')) {
    return key.slice(3);
  }
  
  // Handle digit keys
  if (key.startsWith('Digit')) {
    return key.slice(5);
  }
  
  return key;
}

export interface KeyCaptureOptions {
  onKeyCaptured: (key: string) => void;
  onCancel?: () => void;
  timeout?: number; // milliseconds
}

export class KeyCapture {
  private isCapturing = false;
  private timeoutId: number | null = null;
  private options: KeyCaptureOptions;

  constructor(options: KeyCaptureOptions) {
    this.options = options;
  }

  startCapture(): void {
    if (this.isCapturing) return;
    
    this.isCapturing = true;
    
    // Set timeout if specified
    if (this.options.timeout) {
      this.timeoutId = window.setTimeout(() => {
        this.cancelCapture();
      }, this.options.timeout);
    }
    
    // Add event listener
    document.addEventListener('keydown', this.handleKeyDown, true);
    
    // Prevent default behavior during capture
    document.addEventListener('keydown', this.preventDefault, true);
  }

  cancelCapture(): void {
    if (!this.isCapturing) return;
    
    this.isCapturing = false;
    
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    
    document.removeEventListener('keydown', this.handleKeyDown, true);
    document.removeEventListener('keydown', this.preventDefault, true);
    
    this.options.onCancel?.();
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.isCapturing) return;
    
    const key = event.code;
    
    // Only capture valid keys
    if (isValidKey(key)) {
      this.cancelCapture();
      this.options.onKeyCaptured(key);
    }
  };

  private preventDefault = (event: KeyboardEvent): void => {
    if (this.isCapturing) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
}

MagnoGrabr — local developer notes

What's new (Oct 22, 2025):
- Rebuilt popup with Home and Settings tabs.
- Regex page-scanning preview that queries active tab and returns matches (respects ignore list).
- Restore Previous session support (uses MagnoGrabr_links_prev_v1 and MagnoGrabr_links_session_v1 keys in storage).
- Options page: upload custom mouse icon (stored as cursorDataUrl in settings), key remapping (accepts any key), toggle mode, visual/sound toggles, ignore list, default download manager selection (placeholder detection via background).

How to test locally (dev build):
1. Build and load the extension in the browser via your normal dev workflow (Vite-based builds included in project).
2. Open the popup and Options pages to interact with new controls.

Notes and limitations:
- Native download manager detection is a placeholder: real detection requires a native messaging host or installer-side helper. The UI and background endpoint are prepared to be wired to a native host later.
- Regex page scanning requires content script injected on the active tab. If the page doesn't allow content scripts (chrome:// pages), the scan will return no matches.
- Uploaded cursor icon is stored as a data URL inside the settings; large images will increase extension storage usage. Consider limiting file size / scaling client-side if desired.

Next improvements you may want:
- Wire ignore list behavior to a preview UI that shows which links were ignored during a scan.
- Add a native messaging host for robust detection and integration with local download managers.

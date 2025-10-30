# 🧲 MagnoGrabr
### _Hover. Snatch. Rule the Web._

> Because why *click* when you can grab everything like a digital raccoon?

---

MagnoGrabr is a sleek browser extension that lets you hover over links and collect them all — no clicking, no pain, no chaos.

It’s your ultimate link-hoarding sidekick. Activate it, glide over the internet, and it’ll quietly store all those URLs in your browser’s local storage.

---

## 🎮 Features

- 🧲 Hover to Grab – Just hover your mouse over links. That’s it. MagnoGrabr does the rest.  
- ⚙️ Customizable Hotkeys – Choose your own activation/deactivation keys. No more fighting your muscle memory.  
- 🧠 Smart Storage – Uses local browser storage, no servers, no spying, no cookies, no nonsense.  
- 🪄 Dedupe – Removes duplicate links like.
- 🧬 Cross-Browser Support – Chrome, Firefox, Edge… MagnoGrabr bows to none.  

---


### 🤠 For Users


1. Download the MagnoGrabr.zip file from latest Release<br>[https://github.com/ThePsychof/MagnoGrabr/releases/download/v0.2.0/MagnoGrabr.zip]

3. Go to your browser and open extension menu

4. Activate the **dev mode**

5. uplouad unpacked

6. choose MagnoGrabr.zip from your pc<br>⚡Some browsers require unzipping. Right-click => click **`Extract to "MagnoGrabr/"`** => upload the folder

7. done!



### 🧑‍💻 For Devs

```bash
git clone https://github.com/yourusername/MagnoGrabr.git
cd MagnoGrabr
npm install
npm run build
```
Then:

1. Open chrome://extensions (or your browser’s equivalent).

2. Enable Developer Mode.

3. Click Load unpacked → Select the /dist folder.

4. You’re ready to grab.

---

🎛 Settings

Open the popup and hit ⚙️ Settings to:

Change activation keys


All updates happen in real time — no reloads, no rebuilds, no tears.


---

💾 Data Privacy

> Zero tracking. Zero ads. Zero BS.
Everything lives locally in your browser — you own your data, not some random server farm.

---

🧠 How It Works (Simplified)

1. Activation: User presses the configured activation key.

2. Hover Detection: Content script detects hovered links and sends them to the background script.

3. Storage: Links are stored in browser local storage via a unified browserAPI wrapper.

4. Popup Display: Popup UI fetches and shows grabbed links with filters and actions.

5. Session Finalization: On command, session data can be finalized.


---

🧰 browser-api Wrapper

A compatibility layer that abstracts differences between browser APIs.
  
This ensures smooth behavior across Chromium-based and Firefox browsers.


Example:

import { browserAPI } from "./utils/browser-api";

await browserAPI.storage.set("links", grabbedLinks);
  
const links = await browserAPI.storage.get("links");


---

  💡 Future updates are comming!

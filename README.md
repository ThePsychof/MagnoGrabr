# 🧲 MagnoGrabr
### _Hover. Snatch. Rule the Web._

> Because why *click* when you can grab everything like a digital raccoon?

---

MagnoGrabr is a sleek browser extension that lets you hover over links and collect them all — no clicking, no pain, no chaos.

It's your ultimate link-hoarding sidekick. Activate it, glide over the internet, and it'll quietly store all those URLs in your browser's local storage.

---

## 🎮 Features

- 🖱️ **Hover to Grab** – Just hover your mouse over links. That's it. MagnoGrabr does the rest.
- 🔘 **Toggle Mode** – Press once to start grabbing, press again to stop. Or hold the key — your call.
- ⚙️ **One Key Mode** – The activation key both starts and finalizes the session. One press, done.
- 🐢 **Adjustable Grab Delay** – Fine-tune how long you need to hover before a link is captured.
- 🖱️ **Custom Cursor** – Swap in your own cursor while the grabber is active.
- 🧠 **Smart Storage** – Uses local browser storage. No servers, no spying, no cookies, no nonsense.
- 🪄 **Dedupe** – Automatically removes duplicate links.
- 🔍 **Filtering** – Filter grabbed links by category, name, and size.
- 🏷️ **Link Preview** – Shows filename and file size inline for each captured link.
- 📌 **Counter Badge** – Live count of grabbed links, right next to your cursor.
- 📥 **Extract All** – One-click extraction of every link on the page.
- 📤 **Export** – Dump your haul as `.txt`, `.csv`, or `.json`.
- 🎨 **Themes** – Multiple themes including Pink and Blue.
- 🧬 **Cross-Browser** – Chrome, Firefox (MV3), Edge, Brave, Opera.

---


### 🤠 For Users

1. Download `MagnoGrabr.zip` from the [latest release](https://github.com/ThePsychof/MagnoGrabr/releases/latest).

2. Go to your browser and open the extensions menu.

3. Enable **Developer Mode**.

4. Choose **Load unpacked**.

5. Select the `MagnoGrabr.zip` file from your PC.
   ⚡ Some browsers require unzipping first. Right-click → **Extract to "MagnoGrabr/"** → upload the *folder*.

6. Done!

---

### 🧑‍💻 For Devs

```bash
git clone https://github.com/ThePsychof/MagnoGrabr.git
cd MagnoGrabr
npm install
npm run build
```

Then:

1. Open `chrome://extensions` (or your browser's equivalent).
2. Enable **Developer Mode**.
3. Click **Load unpacked** → select the `/dist` folder.
4. You're ready to grab.

**Firefox note:** Firefox uses the `background.scripts` fallback declared in the manifest. No extra build step is needed — the same `dist/` folder works in both browsers.

---

### 🎛 Settings

Open the popup and hit ⚙️ **Settings** to:

- Change activation and end keys
- Toggle Toggle Mode / One Key Mode
- Adjust grab delay
- Enable or disable dedupe
- Set a custom cursor
- Pick a theme

All updates happen in real time — no reloads, no rebuilds, no tears.

---

### 💾 Data Privacy

> Zero tracking. Zero ads. Zero BS.

Everything lives locally in your browser — you own your data, not some random server farm.

MagnoGrabr does **not** collect, transmit, or share any user data. The only network requests it makes are direct `HEAD`/`GET` probes to the target link's own URL to read `Content-Length` and `Content-Disposition` headers (for size and filename preview). No third-party servers, no analytics, no telemetry.

---

### 🧠 How It Works (Simplified)

1. **Activation** – User presses the configured activation key.
2. **Hover Detection** – Content script detects hovered links and captures them.
3. **Metadata** – A lightweight probe reads the link's own headers for filename and size.
4. **Storage** – Links are stored in browser local storage via a unified `browserAPI` wrapper.
5. **Popup Display** – Popup UI fetches and shows grabbed links with filters, sorting, and export actions.
6. **Session Finalization** – On command, session data is committed to storage.

---

### 🧰 `browser-api` Wrapper

A compatibility layer that abstracts differences between `chrome.*` and `browser.*` APIs, ensuring smooth behavior across Chromium-based and Firefox browsers.

**Example:**

```ts
import { browserAPI } from "./utils/browser-api";

await browserAPI.storeGrabbedLinks(grabbedLinks);
const links = await browserAPI.getGrabbedLinks();
```

---

### 📄 License

See [LICENSE](./LICENSE).

---

👾 **Pro tip:** Don't just grab links… grab the internet. 💀
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Recreate __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log("📦 Copied", src, "→", dest);
}

try {
  // Copy root manifest.json to dist if src manifest is empty
  const rootManifest = path.join(root, "manifest.json");
  const distManifest = path.join(dist, "manifest.json");
  if (fs.existsSync(rootManifest)) {
    const cont = fs.readFileSync(rootManifest, "utf8");
    if (cont && cont.trim().length) {
      fs.writeFileSync(distManifest, cont, "utf8");
      console.log("🧩 Wrote dist manifest from root manifest");
    }
  }

  // Move popup/options html from dist/src → dist root
  const popupSrc = path.join(dist, "src", "popup", "index.html");
  const optionsSrc = path.join(dist, "src", "options", "index.html");
  if (fs.existsSync(popupSrc)) copyFile(popupSrc, path.join(dist, "popup.html"));
  if (fs.existsSync(optionsSrc)) copyFile(optionsSrc, path.join(dist, "options.html"));

  // Copy public assets (cursor.png + icons)
  const publicDir = path.join(root, "public");
  const cursor = path.join(publicDir, "cursor.png");
  if (fs.existsSync(cursor)) copyFile(cursor, path.join(dist, "cursor.png"));

  const iconsDir = path.join(publicDir, "icons");
  const distIconsDir = path.join(dist, "icons");
  if (fs.existsSync(iconsDir)) {
    fs.mkdirSync(distIconsDir, { recursive: true });
    const files = fs.readdirSync(iconsDir);
    // Only copy the single extension logo (MagnoGrabr.png)
    for (const f of files) {
      if (f !== 'MagnoGrabr.png') continue;
      copyFile(path.join(iconsDir, f), path.join(distIconsDir, f));
    }
  }

  // We no longer copy compiled files from dist-ts as we use Vite's output

  console.log("✨ prepare-dist-for-chrome completed successfully");
} catch (err) {
  console.error("❌ Error preparing dist:", err?.message || err);
  process.exit(1);
}
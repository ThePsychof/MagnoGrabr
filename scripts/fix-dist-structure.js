import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Recreate __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

try {
  // move popup
  const popupSrc = path.join(dist, "src", "popup", "index.html");
  const popupDest = path.join(dist, "popup.html");
  if (fs.existsSync(popupSrc) && !fs.existsSync(popupDest)) {
    fs.copyFileSync(popupSrc, popupDest);
    console.log("✅ Copied popup.html to dist root");
  }

  console.log("✨ fix-dist-structure completed successfully");
} catch (err) {
  console.error("❌ Error fixing dist structure:", err?.message || err);
  process.exit(1);
}
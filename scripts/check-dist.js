import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");

const exists = (p) => fs.existsSync(path.join(dist, p));

const required = [
  "manifest.json",
  "popup.html",
  "background.js",
  "content.js",
  "popup.js",
  "icons/MagnoGrabr.png",
];

let ok = true;
for (const r of required) {
  if (!exists(r)) {
    console.error("❌ Missing required dist file:", r);
    ok = false;
  }
}

if (!ok) {
  console.error("dist validation failed");
  process.exit(1);
}

console.log("✅ dist validation passed");
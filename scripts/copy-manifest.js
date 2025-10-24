import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Recreate __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcCandidates = [
  path.join(__dirname, "../manifest.json"),
  path.join(__dirname, "../src/manifest.json"),
];

const destDir = path.join(__dirname, "../dist");
const dest = path.join(destDir, "manifest.json");

// Ensure dist directory exists
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// Pick the first existing, non-empty manifest
let picked = null;
for (const p of srcCandidates) {
  if (fs.existsSync(p)) {
    const stat = fs.statSync(p);
    if (stat.size > 10) {
      picked = p;
      break;
    }
  }
}

if (!picked) {
  console.error("❌ No valid manifest found in root or src. Aborting copy.");
  process.exit(1);
}

// Copy manifest
fs.copyFileSync(picked, dest);
console.log(`✅ Manifest copied to dist/ from: ${picked}`);

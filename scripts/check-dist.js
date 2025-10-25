import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");

const log = {
  ok: (msg) => console.log(`✅ ${msg}`),
  warn: (msg) => console.warn(`⚠️ ${msg}`),
  err: (msg) => console.error(`❌ ${msg}`)
};

const exists = (p) => fs.existsSync(path.join(dist, p));

const required = [
  "manifest.json",
  "popup.html",
  "background.js",
  "content.js",
  "popup.js",
  "popup.css",
  "style.css",
  "cursor.png",
  "icons/MagnoGrabr16.png",
  "icons/MagnoGrabr32.png",
  "icons/MagnoGrabr48.png",
  "icons/MagnoGrabr128.png",
  "icons/MagnoGrabr.png",
  "icons/MagnoGrabrCursor.svg"
];

// Check for unwanted files
const unwanted = [
  "assets/browser-api.css",
  "tests/",
  "test-results/",
  ".playwright-profile/"
];

let ok = true;

console.log("🔍 Validating dist folder...\n");

// Check required files
for (const r of required) {
  if (!exists(r)) {
    log.err(`Missing required file: ${r}`);
    ok = false;
  } else {
    log.ok(`Found: ${r}`);
  }
}

// Check for unwanted files
for (const u of unwanted) {
  if (exists(u)) {
    log.err(`Unwanted file found: ${u}`);
    ok = false;
  }
}

// Validate manifest.json
if (exists("manifest.json")) {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(dist, "manifest.json"), "utf8"));
    if (!manifest.name || !manifest.version || !manifest.manifest_version) {
      log.err("Invalid manifest.json structure");
      ok = false;
    } else {
      log.ok(`Manifest valid: ${manifest.name} v${manifest.version}`);
    }
  } catch (err) {
    log.err(`Invalid manifest.json: ${err.message}`);
    ok = false;
  }
}

// Check file sizes (ensure they're not empty)
const criticalFiles = ["background.js", "content.js", "popup.js", "options.js"];
for (const file of criticalFiles) {
  if (exists(file)) {
    const stats = fs.statSync(path.join(dist, file));
    if (stats.size < 100) {
      log.warn(`File ${file} is suspiciously small (${stats.size} bytes)`);
    }
  }
}

console.log("\n📁 Dist structure:");
function walk(dir, depth = 0) {
  const prefix = " ".repeat(depth * 2);
  try {
    for (const item of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, item);
      const stats = fs.statSync(fullPath);
      console.log(prefix + (stats.isDirectory() ? "📂 " : "📄 ") + item);
      if (stats.isDirectory()) walk(fullPath, depth + 1);
    }
  } catch (err) {
    // Directory might not exist
  }
}
walk(dist);

if (!ok) {
  log.err("Dist validation failed");
  process.exit(1);
}

log.ok("Dist validation passed - ready for distribution!");
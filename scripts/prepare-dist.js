// scripts/prepare-dist.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(__filename);

const root = path.resolve(dirname, "..");
const dist = path.join(root, "dist");

const log = {
  ok: (msg) => console.log(`✅ ${msg}`),
  warn: (msg) => console.warn(`⚠️ ${msg}`),
  err: (msg) => console.error(`❌ ${msg}`)
};

function copyFile(src, dest) {
  try {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    console.log(`📦 Copied ${src.replace(root, ".")} → ${dest.replace(root, ".")}`);
  } catch (err) {
    log.err(`Failed to copy ${src}: ${err.message}`);
  }
}

function exists(relPath) {
  return fs.existsSync(path.join(dist, relPath));
}

try {
  console.log("🚀 Preparing dist folder for Chrome extension...\n");

  // 1️⃣ Copy manifest.json
  const manifestCandidates = [
    path.join(root, "manifest.json"),
    path.join(root, "src/manifest.json")
  ];
  let manifestCopied = false;
  for (const m of manifestCandidates) {
    if (fs.existsSync(m) && fs.statSync(m).size > 10) {
      copyFile(m, path.join(dist, "manifest.json"));
      manifestCopied = true;
      break;
    }
  }
  if (!manifestCopied) log.warn("manifest.json not found in root or src");

  // 2️⃣ Copy popup.html and options.html from dist/src → dist root
  const popupSrc = path.join(dist, "src", "popup", "index.html");
  if (fs.existsSync(popupSrc)) {
    copyFile(popupSrc, path.join(dist, "popup.html"));
  } else {
    log.warn("popup HTML not found in dist/src/popup/");
  }

  const optionsSrc = path.join(dist, "src", "options", "index.html");
  if (fs.existsSync(optionsSrc)) {
    copyFile(optionsSrc, path.join(dist, "options.html"));
  } else {
    log.warn("options HTML not found in dist/src/options/");
  }

  // 2.5️⃣ Remove the src folder after copying
  const srcFolder = path.join(dist, "src");
  if (fs.existsSync(srcFolder)) {
    try {
      fs.rmSync(srcFolder, { recursive: true, force: true });
      console.log("🗑️  Removed dist/src folder");
    } catch (err) {
      log.warn(`Failed to remove src folder: ${err.message}`);
    }
  }

  // 3️⃣ Copy icons files
  const iconsFiles = ["MagnoGrabr16.png", "MagnoGrabr32.png", "MagnoGrabr48.png", "MagnoGrabr128.png"];
  for (const iconsFile of iconsFiles) {
    const iconsSrc = path.join(root, "public", "icons", iconsFile);
    const iconsDest = path.join(dist, "icons", iconsFile);
    if (fs.existsSync(iconsSrc)) {
      copyFile(iconsSrc, iconsDest);
    } else {
      log.warn(`public/icons/${iconsFile} missing`);
    }
  }

  // 3.5️⃣ Copy cursor.png
  const cursorSrc = path.join(root, "public", "cursor.png");
  const cursorDest = path.join(dist, "cursor.png");
  if (fs.existsSync(cursorSrc)) {
    copyFile(cursorSrc, cursorDest);
  } else {
    log.warn("public/cursor.png missing");
  }

  // 3.6️⃣ Remove unwanted browser-api.css file
  const browserApiCss = path.join(dist, "assets", "browser-api.css");
  if (fs.existsSync(browserApiCss)) {
    try {
      fs.unlinkSync(browserApiCss);
      console.log("🗑️  Removed unwanted browser-api.css");
    } catch (err) {
      log.warn(`Failed to remove browser-api.css: ${err.message}`);
    }
  }

  console.log("\n✨ prepare-dist completed successfully!\n");
} catch (err) {
  log.err("prepare-dist crashed: " + err.message);
  process.exit(1);
}
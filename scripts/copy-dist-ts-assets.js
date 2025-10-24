import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Recreate __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const distTs = path.join(root, "dist-ts");
const assets = path.join(dist, "assets");

try {
  if (!fs.existsSync(assets)) {
    fs.mkdirSync(assets, { recursive: true });
  }

  const bg = path.join(distTs, "background.js");
  const content = path.join(distTs, "content.js");

  if (fs.existsSync(bg)) {
    fs.copyFileSync(bg, path.join(assets, "background.js"));
    console.log("✅ Copied background.js");
  }

  if (fs.existsSync(content)) {
    fs.copyFileSync(content, path.join(assets, "content.js"));
    console.log("✅ Copied content.js");
  }

  // Copy utils folder (ext.js, helpers.js)
  const utilsSrc = path.join(distTs, "utils");
  const utilsDest = path.join(assets, "utils");

  if (fs.existsSync(utilsSrc)) {
    fs.mkdirSync(utilsDest, { recursive: true });
    const files = fs.readdirSync(utilsSrc);
    for (const f of files) {
      fs.copyFileSync(path.join(utilsSrc, f), path.join(utilsDest, f));
      console.log(`✅ Copied ${f} → assets/utils`);
    }
  }

  console.log("✨ copy-dist-ts-assets completed successfully");
} catch (err) {
  console.error("❌ Error copying dist-ts assets:", err?.message || err);
  process.exit(1);
}
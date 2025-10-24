// scripts/fix-html-css.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(__filename);
const root = path.resolve(dirname, "..");
const dist = path.join(root, "dist");

console.log("🔧 Fixing HTML CSS references...\n");

// Fix popup.html
const popupHtml = path.join(dist, "popup.html");
if (fs.existsSync(popupHtml)) {
  let content = fs.readFileSync(popupHtml, "utf8");
  // Replace any CSS references with popup.css
  content = content.replace(/href="[^"]*browser-api\.css"/g, 'href="popup.css"');
  content = content.replace(/href="\/assets\/[^"]*\.css"/g, 'href="popup.css"');
  fs.writeFileSync(popupHtml, content);
  console.log("✅ Fixed popup.html");
} else {
  console.warn("⚠️ popup.html not found");
}

// Fix options.html
const optionsHtml = path.join(dist, "options.html");
if (fs.existsSync(optionsHtml)) {
  let content = fs.readFileSync(optionsHtml, "utf8");
  // Replace any CSS references with options.css
  content = content.replace(/href="[^"]*browser-api\.css"/g, 'href="options.css"');
  content = content.replace(/href="\/assets\/[^"]*\.css"/g, 'href="options.css"');
  fs.writeFileSync(optionsHtml, content);
  console.log("✅ Fixed options.html");
} else {
  console.warn("⚠️ options.html not found");
}

console.log("\n✨ HTML CSS references fixed!\n");


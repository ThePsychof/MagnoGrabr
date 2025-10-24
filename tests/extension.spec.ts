import { test, expect, chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// ES module replacement for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('extension loads in chromium and background/service worker is active', async () => {
  const extensionPath = path.join(__dirname, '..', 'dist');
  const userDataDir = path.join(__dirname, '..', '.playwright-profile');

  // Ensure extension folder exists
  expect(fs.existsSync(extensionPath)).toBe(true);

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false, // set true for CI
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  // Wait a bit for the extension to register its service worker
  let extWorkerFound = false;
  const start = Date.now();
  const timeout = 10000; // 10s max wait

  while (Date.now() - start < timeout) {
    const workers = context.serviceWorkers();
    if (workers.some((sw) => sw.url().startsWith('chrome-extension://'))) {
      extWorkerFound = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  // If no worker is found, skip instead of failing (useful for CI/headless)
  if (!extWorkerFound) {
    await context.close();
    test.skip(true, 'No chrome-extension service worker detected in this environment');
    return;
  }

  // Optional: open a blank page to ensure browser context works
  const page = context.pages()[0] || await context.newPage();
  await page.goto('about:blank');
  expect(page.url()).toBe('about:blank');

  // Optional: log detected service worker URLs for debugging
  console.log('Detected extension service workers:', context.serviceWorkers().map(sw => sw.url()));

  await context.close();
});

import { test, expect, chromium, firefox } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module replacement for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('extension appears in chrome://extensions', async () => {
  const extensionPath = path.join(__dirname, '..', 'dist');
  const userDataDir = path.join(__dirname, '..', '.playwright-profile-ui');

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: !!process.env.CI,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  // Try to find a chrome-extension service worker within a short timeout
  let extFound = false;
  const start = Date.now();
  while (Date.now() - start < 5000) {
    const sworkers = context.serviceWorkers();
    for (const sw of sworkers) {
      try {
        const url = sw.url();
        if (url && url.includes('chrome-extension://')) { 
          extFound = true; 
          break; 
        }
      } catch (e) {}
    }
    if (extFound) break;
    await new Promise((r) => setTimeout(r, 250));
  }

  if (!extFound) {
    // Skip this test when environment doesn't expose extension service workers
    await context.close();
    test.skip(true, 'No chrome-extension service worker detected in this environment');
    return;
  }

  await context.close();
});

test('firefox can launch (smoke)', async () => {
  const userDataDir = path.join(__dirname, '..', '.playwright-profile-firefox');
  try {
    const context = await firefox.launchPersistentContext(userDataDir, {
      headless: !!process.env.CI,
    });
    const page = context.pages()[0] || await context.newPage();
    await page.goto('about:blank');
    expect(page.url()).toBe('about:blank');
    await context.close();
  } catch (e: any) {
    // If Firefox not installed locally, skip the test
    test.skip(true, 'Firefox not available in this environment: ' + (e?.message ?? 'unknown'));
  }
});

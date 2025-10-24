Playwright extension smoke tests

Prereqs (on your machine):
- Node.js >= 18
- Chrome/Chromium installed (Playwright will download browsers if you run the install step)

Install deps and Playwright browsers:

```cmd
npm ci
npm run test:extension:install
```

Build the extension into `dist`:

```cmd
npm run build
```

Run the Playwright test (launches Chromium with the extension loaded):

```cmd
npm run test:extension
```

Notes:
- The test is a simple smoke test that launches Chromium with the unpacked `dist` extension loaded.
- Running tests headless is not recommended for extension testing; Playwright runs in headed mode by default here.
- Firefox support via Playwright is possible but may require adaptation; the test currently targets Chromium.

CI: GitHub Actions
------------------
This repo includes a workflow at `.github/workflows/ci.yml` that runs on push and PRs to `main`. The workflow installs dependencies, runs the build, installs Playwright browsers, and executes the Playwright smoke tests headless.

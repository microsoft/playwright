# @playwright/browser-chromium

This package automatically installs [Chromium](https://www.chromium.org/) browser for [Playwright](http://github.com/microsoft/playwright) library. If you want to write end-to-end tests, we recommend [@playwright/test](https://playwright.dev/docs/intro).

## Browser download and install scripts

This package downloads the browser using an `install` script that runs during `npm install`. Some package managers (pnpm, Yarn Berry, Bun, Deno, and npm following [RFC #868](https://github.com/npm/rfcs/pull/868)) block dependency install scripts by default. If your package manager skips the script, allow it explicitly (for example via the `allowScripts` field in `package.json` or `npm approve-scripts`), or download the browser with `npx playwright install chromium` instead.

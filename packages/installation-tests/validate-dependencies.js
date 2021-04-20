const playwright = require('playwright');

process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = 1;

(async () => {
  const browser = await playwright.chromium.launch();
  await browser.close();
})();
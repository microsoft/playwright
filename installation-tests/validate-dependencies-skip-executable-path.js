const playwright = require('playwright');

process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = 1;

(async () => {
  const browser = await playwright.chromium.launch({
    executablePath: playwright.chromium.executablePath()
  });
  await browser.close();
})();
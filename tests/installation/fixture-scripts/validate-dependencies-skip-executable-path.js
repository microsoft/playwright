const playwright = require('playwright');

process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = 1;

(async () => {
  const browser = await playwright.firefox.launch({
    executablePath: playwright.firefox.executablePath()
  });
  await browser.close();
})();
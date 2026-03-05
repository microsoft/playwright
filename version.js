const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  console.log(chromium.executablePath());
  await browser.close();
})().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});

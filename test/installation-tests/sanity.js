const requireName = process.argv[2];
const browsers = process.argv.slice(3);

const playwright = require(requireName);

(async () => {
  for (const browserType of browsers) {
    const browser = await playwright[browserType].launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.evaluate(() => navigator.userAgent);
    await browser.close();
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});

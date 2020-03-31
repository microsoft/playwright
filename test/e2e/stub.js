const playwright = require(process.cwd());

if (process.argv.length === 2) {
  console.error("Usage stub.js <browser-types-space-separated>");
  process.exit(1);
}

const browsers = process.argv.slice(2, process.argv.length);

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

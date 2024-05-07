const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const packageJSON = require('./package.json');
  for (const dep of Object.keys(packageJSON.dependencies)) {
    await page.waitForTimeout(3000);
    console.log('Processing ', dep);
    await page.goto(`https://www.npmjs.com/package/${dep}`);
    const title = await page.getByText('Public').locator('..').textContent();
    if (!title.startsWith(dep))
      throw new Error('Malformed title: ', title);
    const i = title.indexOf(' • Public');
    if (i === -1)
      throw new Error('Malformed title: ' + title);
    const version = title.slice(dep.length, i);
    console.log(version);
    packageJSON.dependencies[dep] = '^' + version;
  }
  await browser.close();
  console.log(JSON.stringify(packageJSON, null, 2));
})();
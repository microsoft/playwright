// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

(async () => {
  const browserName = process.argv[2];
  const playwright = require('playwright')(browserName);

  console.log('downloading ' + browserName + '...');
  const revisionInfo = await playwright.downloadBrowser();
  console.log('downloaded to ' + revisionInfo.folderPath);

  console.log('checking user agent...');
  const browser = await playwright.launch();
  const page = await browser.newPage();
  console.log(await page.evaluate('navigator.userAgent'));
  await browser.close();
})()

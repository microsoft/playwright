(async() => {
  const [, , playwrightRoot, options] = process.argv;
  const browser = await require(playwrightRoot).launch(JSON.parse(options));
  const page = await browser.defaultContext().newPage();
  await page.evaluate(() => console.error('message from dumpio'));
  await page.close();
  await browser.close();
})();

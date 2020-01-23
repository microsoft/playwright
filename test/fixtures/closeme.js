(async() => {
  const [, , playwrightRoot, product, options] = process.argv;
  const browserApp = await require(playwrightRoot)[product.toLowerCase()].launchBrowserApp(JSON.parse(options));
  console.log(browserApp.wsEndpoint());
})();

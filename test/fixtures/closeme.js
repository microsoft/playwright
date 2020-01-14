(async() => {
  const [, , playwrightRoot, product, options] = process.argv;
  const browserServer = await require(playwrightRoot)[product.toLowerCase()].launchServer(JSON.parse(options));
  console.log(browserServer.wsEndpoint());
})();

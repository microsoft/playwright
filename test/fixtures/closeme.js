(async() => {
  const [, , playwrightRoot, options] = process.argv;
  const browserServer = await require(playwrightRoot).launchServer(JSON.parse(options));
  console.log(browserServer.wsEndpoint());
})();

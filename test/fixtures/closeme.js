(async() => {
  const [, , playwrightRoot, product, options] = process.argv;
  const browserApp = await require(playwrightRoot)[product.toLowerCase()].launchBrowserApp(JSON.parse(options));
  browserApp.on('close', (exitCode, signal) => {
    console.log(`browserClose:${exitCode}:${signal}:browserClose`);
  });
  console.log(`browserPid:${browserApp.process().pid}:browserPid`);
  console.log(`browserWS:${browserApp.wsEndpoint()}:browserWS`);
})();

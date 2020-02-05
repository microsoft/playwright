(async() => {
  const [, , playwrightRoot, product, options] = process.argv;
  const browserServer = await require(playwrightRoot)[product.toLowerCase()].launchServer(JSON.parse(options));
  browserServer.on('close', (exitCode, signal) => {
    console.log(`browserClose:${exitCode}:${signal}:browserClose`);
  });
  console.log(`browserPid:${browserServer.process().pid}:browserPid`);
  console.log(`browserWS:${browserServer.wsEndpoint()}:browserWS`);
})();

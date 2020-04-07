(async() => {
  const [, , playwrightRoot, browserType, options, exitOnClose] = process.argv;
  const browserServer = await require(playwrightRoot)[browserType].launchServer(JSON.parse(options));
  browserServer.on('close', (exitCode, signal) => {
    console.log(`browserClose:${exitCode}:${signal}:browserClose`);
    if (exitOnClose)
      process.exit(0);
  });
  console.log(`browserPid:${browserServer.process().pid}:browserPid`);
  console.log(`browserWS:${browserServer.wsEndpoint()}:browserWS`);
})();

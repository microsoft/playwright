(async() => {
  const { playwrightPath, browserTypeName, launchOptions, stallOnClose } = JSON.parse(process.argv[2]);
  if (stallOnClose) {
    launchOptions.__testHookGracefullyClose = () => {
      console.log(`(stalled=>true)`);
      return new Promise(() => {});
    };
  }

  const playwright = require(require('path').join(playwrightPath, 'index'));

  const browserServer = await playwright[browserTypeName].launchServer(launchOptions);
  browserServer.on('close', (exitCode, signal) => {
    console.log(`(exitCode=>${exitCode})`);
    console.log(`(signal=>${signal})`);
  });
  console.log(`(pid=>${browserServer.process().pid})`);
  console.log(`(wsEndpoint=>${browserServer.wsEndpoint()})`);
})();

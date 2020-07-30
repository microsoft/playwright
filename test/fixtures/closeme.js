(async() => {
  const { playwrightPath, browserTypeName, launchOptions, stallOnClose, launchTwo } = JSON.parse(process.argv[2]);
  if (stallOnClose) {
    launchOptions.__testHookGracefullyClose = () => {
      console.log(`(stalled=>true)`);
      return new Promise(() => {});
    };
  }

  const path = require('path');
  const { setUnderTest } = require(path.join(playwrightPath, 'lib', 'helper'));
  const { setupInProcess } = require(path.join(playwrightPath, 'lib', 'rpc', 'inprocess'));
  setUnderTest();
  const playwrightImpl = require(path.join(playwrightPath, 'index'));
  const playwright = process.env.PWCHANNEL ? setupInProcess(playwrightImpl) : playwrightImpl;

  const browserServer = await playwright[browserTypeName].launchServer(launchOptions);
  browserServer.on('close', (exitCode, signal) => {
    console.log(`(exitCode=>${exitCode})`);
    console.log(`(signal=>${signal})`);
  });
  console.log(`(pid=>${browserServer.process().pid})`);
  console.log(`(wsEndpoint=>${browserServer.wsEndpoint()})`);

  if (launchTwo) {
    const browserServer2 = await playwright[browserTypeName].launchServer(launchOptions);
    browserServer2.on('close', (exitCode, signal) => {
      console.log(`(exitCode2=>${exitCode})`);
      console.log(`(signal2=>${signal})`);
    });
    console.log(`(pid2=>${browserServer2.process().pid})`);
    console.log(`(wsEndpoint2=>${browserServer2.wsEndpoint()})`);
  }
})();

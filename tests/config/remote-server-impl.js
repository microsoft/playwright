const fs = require('fs');
const cluster = require('cluster');

async function start() {
  const { browserTypeName, launchOptions, stallOnClose, disconnectOnSIGHUP, exitOnFile, exitOnWarning, startStopAndRunHttp } = JSON.parse(process.argv[2]);
  if (stallOnClose) {
    launchOptions.__testHookGracefullyClose = () => {
      console.log(`(stalled=>true)`);
      return new Promise(() => { });
    };
  }
  if (exitOnWarning)
    process.on('warning', () => process.exit(43));
  if (disconnectOnSIGHUP)
    launchOptions.handleSIGHUP = false;

  const playwright = require('playwright-core');

  if (startStopAndRunHttp) {
    const browser = await playwright[browserTypeName].launch(launchOptions);
    await browser.close();
    console.log(`(wsEndpoint=>none)`);
    console.log(`(closed=>success)`);
    require('http').createServer(() => {}).listen();
    return;
  }

  const browserServer = await playwright[browserTypeName].launchServer(launchOptions);
  if (disconnectOnSIGHUP)
    process.on('SIGHUP', () => browserServer._disconnectForTest());

  if (exitOnFile) {
    (async function waitForFileAndExit() {
      while (true) {
        if (fs.existsSync(exitOnFile))
          break;
        await new Promise(f => setTimeout(f, 100));
      }
      process.exit(42);
    })();
  }

  browserServer.on('close', (exitCode, signal) => {
    console.log(`(exitCode=>${exitCode})`);
    console.log(`(signal=>${signal})`);
  });
  console.log(`(tempDir=>${browserServer._userDataDirForTest})`);
  console.log(`(pid=>${browserServer.process().pid})`);
  console.log(`(wsEndpoint=>${browserServer.wsEndpoint()})`);
}

process.on('uncaughtException', error => console.log(error));
process.on('unhandledRejection', reason => console.log(reason));

if (cluster.isWorker || !JSON.parse(process.argv[2]).inCluster) {
  start();
} else {
  cluster.fork();
  cluster.on('exit', (worker, code, signal) => {
    process.exit(0);
  });
}

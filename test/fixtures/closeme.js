const cluster = require('cluster');

async function start() {
  const { playwrightPath, browserTypeName, launchOptions } = JSON.parse(process.argv[2]);

  // We expose the real browser pid for testing purposes.
  let pidReadyCallback;
  const pidReady = new Promise(f => pidReadyCallback = f);
  const debug = require('debug');
  const wasEnabled = debug('pw:browser').enabled;
  if (!wasEnabled) {
    const namespaces = debug.disable();
    debug.enable(namespaces ? namespaces + ',pw:browser' : 'pw:browser');
  }
  debug.log = s => {
    const match = s.match(/browser pid: (\d+)/);
    if (match)
      pidReadyCallback(+match[1]);
    if (!s.includes('pw:browser') || wasEnabled)
      process.stderr.write(s);
  };

  const playwright = require(require('path').join(playwrightPath, 'index'));

  const browserServer = await playwright[browserTypeName].launchServer(launchOptions);
  browserServer.on('close', (exitCode, signal) => {
    console.log(`(exitCode=>${exitCode})`);
    console.log(`(signal=>${signal})`);
  });
  console.log(`(watchdogPid=>${browserServer.process().pid})`);
  console.log(`(pid=>${await pidReady})`);
  console.log(`(wsEndpoint=>${browserServer.wsEndpoint()})`);
}

process.on('SIGHUP', () => {
  process.exit(123);
});

if (cluster.isWorker || !JSON.parse(process.argv[2]).inCluster) {
  start();
} else {
  cluster.fork();
  cluster.on('exit', (worker, code, signal) => {
    process.exit(0);
  });
}

const { _android } = require('playwright');  // Or 'webkit' or 'firefox'.
(async () => {
  const browserServer = await _android.launchServer({
    deviceSerialNumber: "<deviceSerialNumber>",
    logger: {
        // isEnabled: (name, severity) => name === 'browser',
        isEnabled: () => true,
        log: (name, severity, message, args) => console.log(`${name} ${message}`)
    }
});
  const wsEndpoint = browserServer.wsEndpoint();
  console.log(wsEndpoint);
  // Use web socket endpoint later to establish a connection.
//   const browser = await _android.connect(wsEndpoint);
  // Close browser instance.
//   await _android.close();
})();
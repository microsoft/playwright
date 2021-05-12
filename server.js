// @ts-check
const { chromium } = require('.');

(async () => {
  const browserServer = await chromium.launchServer({
    port: 80,
    _acceptForwardedPorts: true
  });
  const wsEndpoint = browserServer.wsEndpoint();
  console.log(wsEndpoint)
})();

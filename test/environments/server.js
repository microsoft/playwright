const path = require('path');
const { TestServer } = require('../../utils/testserver/');

beforeAll(async () => {
  const assetsPath = path.join(__dirname, '..', 'assets');
  const cachedPath = path.join(__dirname, '..', 'assets', 'cached');

  const port = 8907 + (process.env.JEST_WORKER_ID - 1) * 2;
  global.server = await TestServer.create(assetsPath, port);
  server.enableHTTPCache(cachedPath);
  server.PORT = port;
  server.PREFIX = `http://localhost:${port}`;
  server.CROSS_PROCESS_PREFIX = `http://127.0.0.1:${port}`;
  server.EMPTY_PAGE = `http://localhost:${port}/empty.html`;

  const httpsPort = port + 1;
  global.httpsServer = await TestServer.createHTTPS(assetsPath, httpsPort);
  httpsServer.enableHTTPCache(cachedPath);
  httpsServer.PORT = httpsPort;
  httpsServer.PREFIX = `https://localhost:${httpsPort}`;
  httpsServer.CROSS_PROCESS_PREFIX = `https://127.0.0.1:${httpsPort}`;
  httpsServer.EMPTY_PAGE = `https://localhost:${httpsPort}/empty.html`;
});

afterAll(async () => {
  await Promise.all([
    global.server.stop(),
    global.httpsServer.stop(),
  ]);
});

beforeEach(async () => {
  global.server.reset();
  global.httpsServer.reset();
});

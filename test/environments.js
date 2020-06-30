const utils = require('./utils');
const fs = require('fs');
const path = require('path');
const rm = require('rimraf').sync;
const {TestServer} = require('../utils/testserver/');

class ServerEnvironment {
  name() { return 'TestServer'; }

  async beforeAll(state) {
    const assetsPath = path.join(__dirname, 'assets');
    const cachedPath = path.join(__dirname, 'assets', 'cached');

    const port = 8907 + state.parallelIndex * 2;
    state.server = await TestServer.create(assetsPath, port);
    state.server.enableHTTPCache(cachedPath);
    state.server.PORT = port;
    state.server.PREFIX = `http://localhost:${port}`;
    state.server.CROSS_PROCESS_PREFIX = `http://127.0.0.1:${port}`;
    state.server.EMPTY_PAGE = `http://localhost:${port}/empty.html`;

    const httpsPort = port + 1;
    state.httpsServer = await TestServer.createHTTPS(assetsPath, httpsPort);
    state.httpsServer.enableHTTPCache(cachedPath);
    state.httpsServer.PORT = httpsPort;
    state.httpsServer.PREFIX = `https://localhost:${httpsPort}`;
    state.httpsServer.CROSS_PROCESS_PREFIX = `https://127.0.0.1:${httpsPort}`;
    state.httpsServer.EMPTY_PAGE = `https://localhost:${httpsPort}/empty.html`;
  }

  async afterAll({server, httpsServer}) {
    await Promise.all([
      server.stop(),
      httpsServer.stop(),
    ]);
  }

  async beforeEach(state) {
    state.server.reset();
    state.httpsServer.reset();
  }
}

class DefaultBrowserOptionsEnvironment {
  constructor(defaultBrowserOptions, logger, playwrightPath) {
    this._defaultBrowserOptions = defaultBrowserOptions;
    this._logger = logger;
    this._playwrightPath = playwrightPath;
  }

  async beforeAll(state) {
    state.defaultBrowserOptions = {
      ...this._defaultBrowserOptions,
      logger: this._logger,
    };
    state.playwrightPath = this._playwrightPath;
  }

  async beforeEach(state, testRun) {
    this._logger.setTestRun(testRun);
  }

  async afterEach(state) {
    this._logger.setTestRun(null);
  }
}

// simulate globalSetup per browserType that happens only once regardless of TestWorker.
const hasBeenCleaned = new Set();

class GoldenEnvironment {
  name() { return 'Golden+CheckContexts'; }

  async beforeAll(state) {
    const { OUTPUT_DIR, GOLDEN_DIR } = utils.testOptions(state.browserType);
    if (!hasBeenCleaned.has(state.browserType)) {
      hasBeenCleaned.add(state.browserType);
      if (fs.existsSync(OUTPUT_DIR))
        rm(OUTPUT_DIR);
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    state.golden = goldenName => ({ goldenPath: GOLDEN_DIR, outputPath: OUTPUT_DIR, goldenName });
  }

  async afterAll(state) {
    delete state.golden;
  }

  async afterEach(state, testRun) {
    if (state.browser && state.browser.contexts().length !== 0) {
      if (testRun.ok())
        console.warn(`\nWARNING: test "${testRun.test().fullName()}" (${testRun.test().location()}) did not close all created contexts!\n`);
      await Promise.all(state.browser.contexts().map(context => context.close()));
    }
  }
}

class TraceTestEnvironment {
  static enableForTest(test) {
    test.setTimeout(100000000);
    test.addEnvironment(new TraceTestEnvironment());
  }

  constructor() {
    this._session = null;
  }

  name() { return 'TraceTestEnvironment'; }

  async beforeEach() {
    const inspector = require('inspector');
    const fs = require('fs');
    const util = require('util');
    const url = require('url');
    const readFileAsync = util.promisify(fs.readFile.bind(fs));
    this._session = new inspector.Session();
    this._session.connect();
    const postAsync = util.promisify(this._session.post.bind(this._session));
    await postAsync('Debugger.enable');
    const setBreakpointCommands = [];
    const N = t.body().toString().split('\n').length;
    const location = t.location();
    const lines = (await readFileAsync(location.filePath(), 'utf8')).split('\n');
    for (let line = 0; line < N; ++line) {
      const lineNumber = line + location.lineNumber();
      setBreakpointCommands.push(postAsync('Debugger.setBreakpointByUrl', {
        url: url.pathToFileURL(location.filePath()),
        lineNumber,
        condition: `console.log('${String(lineNumber + 1).padStart(6, ' ')} | ' + ${JSON.stringify(lines[lineNumber])})`,
      }).catch(e => {}));
    }
    await Promise.all(setBreakpointCommands);
  }

  async afterEach() {
    this._session.disconnect();
  }
}

class PlaywrightEnvironment {
  constructor(playwright) {
    this._playwright = playwright;
  }

  name() { return 'Playwright'; };
  beforeAll(state) { state.playwright = this._playwright; }
  afterAll(state) { delete state.playwright; }
}

class BrowserTypeEnvironment {
  constructor(browserType) {
    this._browserType = browserType;
  }

  name() { return 'BrowserType'; }

  async beforeAll(state) {
    // Channel substitute
    let overridenBrowserType = this._browserType;
    if (process.env.PWCHANNEL) {
      const dispatcherScope = new DispatcherScope();
      const connection = new Connection();
      dispatcherScope.onmessage = async message => {
        setImmediate(() => connection.send(message));
      };
      connection.onmessage = async message => {
        const result = await dispatcherScope.send(message);
        await new Promise(f => setImmediate(f));
        return result;
      };
      BrowserTypeDispatcher.from(dispatcherScope, this._browserType);
      overridenBrowserType = await connection.waitForObjectWithKnownName(this._browserType.name());
    }
    state.browserType = overridenBrowserType;
  }

  async afterAll(state) {
    delete state.browserType;
  }
}

class BrowserEnvironment {
  constructor(browserType, launchOptions, logger) {
    this._browserType = browserType;
    this._launchOptions = launchOptions;
    this._logger = logger;
  }

  name() { return this._browserType.name(); }

  async beforeAll(state) {
    state.browser = await this._browserType.launch({...this._launchOptions, logger: this._logger});
  }

  async afterAll(state) {
    await state.browser.close();
    delete state.browser;
  }

  async beforeEach(state, testRun) {
    this._logger.setTestRun(testRun);
  }

  async afterEach(state, testRun) {
    this._logger.setTestRun(null);
  }
}

class PageEnvironment {
  name() { return 'Page'; }

  async beforeEach(state) {
    state.context = await state.browser.newContext();
    state.page = await state.context.newPage();
  }

  async afterEach(state) {
    await state.context.close();
    state.context = null;
    state.page = null;
  }
}

module.exports = {
  ServerEnvironment,
  GoldenEnvironment,
  TraceTestEnvironment,
  DefaultBrowserOptionsEnvironment,
  PlaywrightEnvironment,
  BrowserTypeEnvironment,
  BrowserEnvironment,
  PageEnvironment,
};

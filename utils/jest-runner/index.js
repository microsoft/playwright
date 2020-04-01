const os = require('os');
const {TestRunner, Matchers} = require('../testrunner/index');
const {formatExecError} = require('jest-message-util');
const path = require('path');
const GoldenUtils = require('../../test/golden-utils');

class PlaywrightRunner {
    /**
     * 
     * @param {import('@jest/types').Config.GlobalConfig} globalConfig 
     * @param {import('jest-runner').TestRunnerContext=} context 
     */
    constructor(globalConfig, context) {
        this._globalConfig = globalConfig;
        this._globalContext = context;
    }
    /**
     * 
     * @param {import('jest-runner').Test[]} tests 
     * @param {import('jest-runner').TestWatcher} watcher 
     * @param {import('jest-runner').OnTestStart} onStart 
     * @param {import('jest-runner').OnTestSuccess} onResult 
     * @param {import('jest-runner').OnTestFailure} onFailure 
     * @param {import('jest-runner').TestRunnerOptions} options 
     */
    async runTests(tests, watcher, onStart, onResult, onFailure, options) {
        // console.log(tests[0].context.config.cwd, watcher.isWatchMode(), options.serial);
        const testRunner = new TestRunner({
            parallel: options.serial ? 1 : this._globalConfig.maxWorkers,
            timeout: this._globalConfig.testTimeout
        });
        const state = setupTests(path.join(this._globalConfig.rootDir, 'test'), testRunner);
        // const test = tests[22];
        for (const test of tests.slice(0, 23)) {
            // const transform = new ScriptTransformer(test.context.config);
            // console.log(test.path);
            const testSuite = require(test.path);
            for (const attempt of [testSuite, testSuite.default, testSuite.describe, testSuite.fdescribe, testSuite.addTests]) {
                if (attempt instanceof Function)
                    attempt(state);
            }
        }
        testRunner.on(TestRunner.Events.Started, (pptrTests) => {
            for (const run of pptrTests) {
                // what is this used for?
                // try {
                //     onStart({
                //         path: run.test().location().filePath(),
                //         context: tests[0].context
                //     })
                // } catch(e) {
                //     console.error(e);
                // }
            }
        });
        testRunner.on(TestRunner.Events.TestFinished, run => {
            const error = run.error();
            const failureMessage = run.result() === 'failed' ? formatExecError(error, {
                rootDir: path.join(__dirname, '..', '..'),
                testMatch: null
            }, {
                noStackTrace: false
            }, run.test().location().filePath(), true) : undefined;
            
            try {
                onResult({
                    path: run.test().location().filePath(),
                    context: tests[0].context
                }, {
                    leaks: false,
                    numFailingTests: run.isFailure() ? 1 : 0,
                    numPassingTests: run.isFailure() ? 0 : 1,
                    numPendingTests: 0,
                    numTodoTests: 0,
                    openHandles: [],
                    perfStats: {
                        end: run.startTimestamp,
                        start: run.endTimestamp,
                    },
                    skipped: false,
                    snapshot: {
                        added: 0,
                        fileDeleted: false,
                        matched: 0,
                        unchecked: 0,
                        uncheckedKeys: [],
                        unmatched: 0,
                        updated: 0
                    },
                    failureMessage,
                    testFilePath: run.test().location().filePath(),
                    testResults: [{                    
                        ancestorTitles: ancestorTitles(run.test()),
                        duration: run.duration(),
                        failureMessages: error ? [String(error)] : [],
                        fullName: run.test().fullName(),
                        numPassingAsserts: 0,
                        status: run.isFailure() ? 'failed' : 'passed',
                        location: {
                            column: 1,
                            line: 1
                        },
                        title: run.test().name(),
                    }],
                });
            } catch(e) {
                console.error(e);
            }
        });

        Promise.resolve().then(testRunner.run());
        const finished = await new Promise(x => testRunner.once(TestRunner.Events.Finished, x));
        if (!finished.ok()) {
            for (const run of finished.runs) {
                if (run.ok() || run.result() === 'failed' || run.result() === 'skipped' || run.result() === 'markedAsFailing')
                    continue;
                onFailure({
                    path: run.test().location().filePath(),
                    context: tests[0].context
                }, run.error())
            }
        }

        function ancestorTitles(test) {
            if (!test)
                return [];
            return [...ancestorTitles(test._suite), test.name()];
        }
    }
}

module.exports = PlaywrightRunner;

function setupTests(rootDir, testRunner) {
    const fs = require('fs');
    const readline = require('readline');
    const {TestServer} = require('../testserver');
    const product = 'Chromium';
    const GOLDEN_DIR = path.join(rootDir, 'golden-' + product.toLowerCase());
    const OUTPUT_DIR = path.join(rootDir, 'output-' + product.toLowerCase());
    const ASSETS_DIR = path.join(rootDir, 'assets');
    if (fs.existsSync(OUTPUT_DIR))
      rm(OUTPUT_DIR);
      const {expect} = new Matchers({
        toBeGolden: GoldenUtils.compare.bind(null, GOLDEN_DIR, OUTPUT_DIR)
    });
    testRunner.testModifier('skip', (t, condition) => condition && t.setSkipped(true));
    testRunner.suiteModifier('skip', (s, condition) => condition && s.setSkipped(true));
    testRunner.testModifier('fail', (t, condition) => condition && t.setExpectation(t.Expectations.Fail));
    testRunner.suiteModifier('fail', (s, condition) => condition && s.setExpectation(s.Expectations.Fail));
    testRunner.testModifier('slow', (t, condition) => condition && t.setTimeout(t.timeout() * 3));
    testRunner.testModifier('repeat', (t, count) => t.setRepeat(count));
    testRunner.suiteModifier('repeat', (s, count) => s.setRepeat(count));
    testRunner.testAttribute('focus', t => t.setFocused(true));
    testRunner.suiteAttribute('focus', s => s.setFocused(true));
    const CHROMIUM = product === 'Chromium';
    const FFOX = product === 'Firefox';
    const WEBKIT = product === 'WebKit';
    const MAC = os.platform() === 'darwin';
    const LINUX = os.platform() === 'linux';
    const WIN = os.platform() === 'win32';
    const playwrightPath = path.join(rootDir, '..');
    const playwright = require(playwrightPath);
    const browserType = playwright[product.toLowerCase()];
    const defaultBrowserOptions = {};
    const dumpProtocolOnFailure = false;


    testRunner.beforeAll(async state => {
        const assetsPath = path.join(rootDir, 'assets');
        const cachedPath = path.join(rootDir, 'assets', 'cached');
      
        const port = 8907 + state.parallelIndex * 3;
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
      
        const sourcePort = port + 2;
        state.sourceServer = await TestServer.create(path.join(rootDir, '..'), sourcePort);
        state.sourceServer.PORT = sourcePort;
        state.sourceServer.PREFIX = `http://localhost:${sourcePort}`;

        state.browser = await browserType.launch(defaultBrowserOptions);
        state.browserServer = state.browser.__server__;
        state._stdout = readline.createInterface({ input: state.browserServer.process().stdout });
        state._stderr = readline.createInterface({ input: state.browserServer.process().stderr });
    });

    testRunner.afterAll(async state => {
        await state.browserServer.close();
        state.browser = null;
        state.browserServer = null;
        state._stdout.close();
        state._stderr.close();
        await Promise.all([
            state.server.stop(),
            state.httpsServer.stop(),
            state.sourceServer.stop(),
          ]);
      });

    testRunner.beforeEach(async(state, test) => {
        test.output = [];
        const dumpout = data => test.output.push(`\x1b[33m[pw:stdio:out]\x1b[0m ${data}`);
        const dumperr = data => test.output.push(`\x1b[31m[pw:stdio:err]\x1b[0m ${data}`);
        state._stdout.on('line', dumpout);
        state._stderr.on('line', dumperr);
        if (dumpProtocolOnFailure)
            state.browser._setDebugFunction(data => test.output.push(`\x1b[32m[pw:protocol]\x1b[0m ${data}`));
        state.tearDown = async () => {
            state._stdout.off('line', dumpout);
            state._stderr.off('line', dumperr);
            if (dumpProtocolOnFailure)
                state.browser._setDebugFunction(() => void 0);
        };
        state.context = await state.browser.newContext();
        state.page = await state.context.newPage();
        state.server.reset();
        state.httpsServer.reset();
    });

    testRunner.afterEach(async (state, test) => {
        await state.context.close();
        state.context = null;
        state.page = null;
        if (state.browser.contexts().length !== 0) {
            if (test.result === 'ok')
            console.warn(`\nWARNING: test "${test.fullName()}" (${test.location()}) did not close all created contexts!\n`);
            await Promise.all(state.browser.contexts().map(context => context.close()));
        }
        await state.tearDown();
    });

    return {testRunner, expect, playwright, playwrightPath, browserType, product, defaultBrowserOptions, playwrightPath, MAC, WIN, LINUX, FFOX, CHROMIUM, WEBKIT, ASSETS_DIR};
}

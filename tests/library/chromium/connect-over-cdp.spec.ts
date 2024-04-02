/**
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { playwrightTest as test, expect } from '../../config/browserTest';
import http from 'http';
import fs from 'fs';
import { getUserAgent } from '../../../packages/playwright-core/lib/utils/userAgent';
import { suppressCertificateWarning } from '../../config/utils';

test.skip(({ mode }) => mode === 'service2');

test('should connect to an existing cdp session', async ({ browserType, mode }, testInfo) => {
  const port = 9339 + testInfo.workerIndex;
  const browserServer = await browserType.launch({
    args: ['--remote-debugging-port=' + port]
  });
  try {
    const cdpBrowser = await browserType.connectOverCDP({
      endpointURL: `http://127.0.0.1:${port}/`,
    });
    const contexts = cdpBrowser.contexts();
    expect(contexts.length).toBe(1);
    await cdpBrowser.close();
  } finally {
    await browserServer.close();
  }
});

test('should use logger in default context', async ({ browserType }, testInfo) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/28813' });
  const port = 9339 + testInfo.workerIndex;
  const browserServer = await browserType.launch({
    args: ['--remote-debugging-port=' + port]
  });
  try {
    const log = [];
    const browser = await browserType.connectOverCDP({
      endpointURL: `http://127.0.0.1:${port}/`,
      logger: {
        log: (name, severity, message) => log.push({ name, severity, message }),
        isEnabled: (name, severity) => severity !== 'verbose'
      }
    });
    const page = await browser.contexts()[0].newPage();
    await page.setContent('<button>Button</button>');
    await page.click('button');
    await browser.close();
    expect(log.length > 0).toBeTruthy();
    expect(log.filter(item => item.message.includes('page.setContent')).length > 0).toBeTruthy();
    expect(log.filter(item => item.message.includes('page.click')).length > 0).toBeTruthy();
  } finally {
    await browserServer.close();
  }
});

test('should cleanup artifacts dir after connectOverCDP disconnects due to ws close', async ({ browserType, toImpl, mode }, testInfo) => {
  const port = 9339 + testInfo.workerIndex;
  const browserServer = await browserType.launch({
    args: ['--remote-debugging-port=' + port]
  });
  const cdpBrowser = await browserType.connectOverCDP({
    endpointURL: `http://127.0.0.1:${port}/`,
  });
  const dir = toImpl(cdpBrowser).options.artifactsDir;
  const exists1 = fs.existsSync(dir);
  await Promise.all([
    new Promise(f => cdpBrowser.on('disconnected', f)),
    browserServer.close()
  ]);
  const exists2 = fs.existsSync(dir);
  expect(exists1).toBe(true);
  expect(exists2).toBe(false);
});

test('should connectOverCDP and manage downloads in default context', async ({ browserType, mode, server }, testInfo) => {
  server.setRoute('/downloadWithFilename', (req, res) => {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename=file.txt');
    res.end(`Hello world`);
  });

  const port = 9339 + testInfo.workerIndex;
  const browserServer = await browserType.launch({
    args: ['--remote-debugging-port=' + port]
  });

  try {
    const browser = await browserType.connectOverCDP({
      endpointURL: `http://127.0.0.1:${port}/`,
    });
    const page = await browser.contexts()[0].newPage();
    await page.setContent(`<a href="${server.PREFIX}/downloadWithFilename">download</a>`);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    expect(download.page()).toBe(page);
    expect(download.url()).toBe(`${server.PREFIX}/downloadWithFilename`);
    expect(download.suggestedFilename()).toBe(`file.txt`);

    const userPath = testInfo.outputPath('download.txt');
    await download.saveAs(userPath);
    expect(fs.existsSync(userPath)).toBeTruthy();
    expect(fs.readFileSync(userPath).toString()).toBe('Hello world');
  } finally {
    await browserServer.close();
  }
});

test('should connect to an existing cdp session twice', async ({ browserType, mode, server }, testInfo) => {
  const port = 9339 + testInfo.workerIndex;
  const browserServer = await browserType.launch({
    args: ['--remote-debugging-port=' + port]
  });
  try {
    const cdpBrowser1 = await browserType.connectOverCDP({
      endpointURL: `http://127.0.0.1:${port}/`,
    });
    const cdpBrowser2 = await browserType.connectOverCDP({
      endpointURL: `http://127.0.0.1:${port}/`,
    });
    const contexts1 = cdpBrowser1.contexts();
    expect(contexts1.length).toBe(1);
    const [context1] = contexts1;
    const page1 = await context1.newPage();
    await page1.goto(server.EMPTY_PAGE);

    const contexts2 = cdpBrowser2.contexts();
    expect(contexts2.length).toBe(1);
    const [context2] = contexts2;
    const page2 = await context2.newPage();
    await page2.goto(server.EMPTY_PAGE);

    expect(context1.pages().length).toBe(2);
    expect(context2.pages().length).toBe(2);

    await cdpBrowser1.close();
    await cdpBrowser2.close();
  } finally {
    await browserServer.close();
  }
});

test('should connect to existing page with iframe and navigate', async ({ browserType, mode, server }, testInfo) => {
  const port = 9339 + testInfo.workerIndex;
  const browserServer = await browserType.launch({
    args: ['--remote-debugging-port=' + port]
  });
  try {
    {
      const context1 = await browserServer.newContext();
      const page = await context1.newPage();
      await page.goto(server.PREFIX + '/frames/one-frame.html');
    }
    const cdpBrowser = await browserType.connectOverCDP(`http://127.0.0.1:${port}/`);
    const contexts = cdpBrowser.contexts();
    expect(contexts.length).toBe(1);
    await contexts[0].pages()[0].goto(server.EMPTY_PAGE);
    await cdpBrowser.close();
  } finally {
    await browserServer.close();
  }
});

test('should connect to existing service workers', async ({ browserType, mode, server }, testInfo) => {
  const port = 9339 + testInfo.workerIndex;
  const browserServer = await browserType.launch({
    args: ['--remote-debugging-port=' + port]
  });
  try {
    const cdpBrowser1 = await browserType.connectOverCDP({
      endpointURL: `http://127.0.0.1:${port}`,
    });
    const context = cdpBrowser1.contexts()[0];
    const page = await cdpBrowser1.contexts()[0].newPage();
    const [worker] = await Promise.all([
      context.waitForEvent('serviceworker'),
      page.goto(server.PREFIX + '/serviceworkers/empty/sw.html')
    ]);
    expect(await worker.evaluate(() => self.toString())).toBe('[object ServiceWorkerGlobalScope]');
    await cdpBrowser1.close();

    const cdpBrowser2 = await browserType.connectOverCDP({
      endpointURL: `http://127.0.0.1:${port}`,
    });
    const context2 = cdpBrowser2.contexts()[0];
    expect(context2.serviceWorkers().length).toBe(1);
    await cdpBrowser2.close();
  } finally {
    await browserServer.close();
  }
});

test('should connect over a ws endpoint', async ({ browserType, server }, testInfo) => {
  const port = 9339 + testInfo.workerIndex;
  const browserServer = await browserType.launch({
    args: ['--remote-debugging-port=' + port]
  });
  try {
    const json = await new Promise<string>((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}/json/version/`, resp => {
        let data = '';
        resp.on('data', chunk => data += chunk);
        resp.on('end', () => resolve(data));
      }).on('error', reject);
    });
    const cdpBrowser = await browserType.connectOverCDP({
      endpointURL: JSON.parse(json).webSocketDebuggerUrl,
    });
    const contexts = cdpBrowser.contexts();
    expect(contexts.length).toBe(1);
    await cdpBrowser.close();

    // also connect with the deprecated wsEndpoint option
    const cdpBrowser2 = await browserType.connectOverCDP({
      wsEndpoint: JSON.parse(json).webSocketDebuggerUrl,
    });
    const contexts2 = cdpBrowser2.contexts();
    expect(contexts2.length).toBe(1);
    await cdpBrowser2.close();
  } finally {
    await browserServer.close();
  }
});

test('should send extra headers with connect request', async ({ browserType, server }, testInfo) => {
  {
    const [request] = await Promise.all([
      server.waitForWebSocketConnectionRequest(),
      browserType.connectOverCDP({
        wsEndpoint: `ws://localhost:${server.PORT}/ws`,
        headers: {
          'User-Agent': 'Playwright',
          'foo': 'bar',
        },
        timeout: 100,
      }).catch(() => {})
    ]);
    expect(request.headers['user-agent']).toBe('Playwright');
    expect(request.headers['foo']).toBe('bar');
  }
  {
    const [request] = await Promise.all([
      server.waitForRequest('/json/version/'),
      browserType.connectOverCDP({
        endpointURL: `http://localhost:${server.PORT}`,
        headers: {
          'User-Agent': 'Playwright',
          'foo': 'bar',
        },
        timeout: 100,
      }).catch(() => {})
    ]);
    expect(request.headers['user-agent']).toBe('Playwright');
    expect(request.headers['foo']).toBe('bar');
  }
});

test('should send default User-Agent header with connect request', async ({ browserType, server }, testInfo) => {
  {
    const [request] = await Promise.all([
      server.waitForWebSocketConnectionRequest(),
      browserType.connectOverCDP({
        wsEndpoint: `ws://localhost:${server.PORT}/ws`,
        headers: {
          'foo': 'bar',
        },
        timeout: 100,
      }).catch(() => {})
    ]);
    expect(request.headers['user-agent']).toBe(getUserAgent());
    expect(request.headers['foo']).toBe('bar');
  }
});

test('should report all pages in an existing browser', async ({ browserType }, testInfo) => {
  const port = 9339 + testInfo.workerIndex;
  const browserServer = await browserType.launch({
    args: ['--remote-debugging-port=' + port]
  });
  try {
    const cdpBrowser = await browserType.connectOverCDP({
      endpointURL: `http://127.0.0.1:${port}/`,
    });
    const contexts = cdpBrowser.contexts();
    expect(contexts.length).toBe(1);
    for (let i = 0; i < 3; i++)
      await contexts[0].newPage();
    await cdpBrowser.close();

    const cdpBrowser2 = await browserType.connectOverCDP({
      endpointURL: `http://127.0.0.1:${port}/`,
    });
    expect(cdpBrowser2.contexts()[0].pages().length).toBe(3);

    await cdpBrowser2.close();
  } finally {
    await browserServer.close();
  }
});

test('should connect via https', async ({ browserType, httpsServer, mode }, testInfo) => {
  test.skip(mode !== 'default'); // Out of process transport does not allow us to set env vars dynamically.

  const port = 9339 + testInfo.workerIndex;
  const browserServer = await browserType.launch({
    args: ['--remote-debugging-port=' + port]
  });
  const json = await new Promise<string>((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/json/version/`, resp => {
      let data = '';
      resp.on('data', chunk => data += chunk);
      resp.on('end', () => resolve(data));
    }).on('error', reject);
  });
  httpsServer.setRoute('/json/version/', (req, res) => {
    res.writeHead(200);
    res.end(json);
  });
  const oldValue = process.env['NODE_TLS_REJECT_UNAUTHORIZED'];
  // https://stackoverflow.com/a/21961005/552185
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
  suppressCertificateWarning();
  try {
    const cdpBrowser = await browserType.connectOverCDP(`https://localhost:${httpsServer.PORT}/`);
    const contexts = cdpBrowser.contexts();
    expect(contexts.length).toBe(1);
    for (let i = 0; i < 3; i++)
      await contexts[0].newPage();
    await cdpBrowser.close();
  } finally {
    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = oldValue;
    await browserServer.close();
  }
});

test('should return valid browser from context.browser()', async ({ browserType }, testInfo) => {
  const port = 9339 + testInfo.workerIndex;
  const browserServer = await browserType.launch({
    args: ['--remote-debugging-port=' + port]
  });
  try {
    const cdpBrowser = await browserType.connectOverCDP({
      endpointURL: `http://127.0.0.1:${port}/`,
    });
    const contexts = cdpBrowser.contexts();
    expect(contexts.length).toBe(1);
    expect(contexts[0].browser()).toBe(cdpBrowser);

    const context2 = await cdpBrowser.newContext();
    expect(context2.browser()).toBe(cdpBrowser);

    await cdpBrowser.close();
  } finally {
    await browserServer.close();
  }
});

test('should report an expected error when the endpointURL returns a non-expected status code', async ({ browserType, server }) => {
  server.setRoute('/json/version/', (req, resp) => {
    resp.statusCode = 404;
    resp.end(JSON.stringify({
      webSocketDebuggerUrl: 'dont-use-me',
    }));
  });
  await expect(browserType.connectOverCDP({
    endpointURL: server.PREFIX,
  })).rejects.toThrowError(`browserType.connectOverCDP: Unexpected status 404 when connecting to ${server.PREFIX}/json/version/`);
});

test('should report an expected error when the endpoint URL JSON webSocketDebuggerUrl is undefined', async ({ browserType, server }) => {
  server.setRoute('/json/version/', (req, resp) => {
    resp.end(JSON.stringify({
      webSocketDebuggerUrl: undefined,
    }));
  });
  await expect(browserType.connectOverCDP({
    endpointURL: server.PREFIX,
  })).rejects.toThrowError('browserType.connectOverCDP: Invalid URL');
});

test('should connect to an existing cdp session when passed as a first argument', async ({ browserType }, testInfo) => {
  const port = 9339 + testInfo.workerIndex;
  const browserServer = await browserType.launch({
    args: ['--remote-debugging-port=' + port]
  });
  try {
    const cdpBrowser = await browserType.connectOverCDP(`http://127.0.0.1:${port}/`);
    const contexts = cdpBrowser.contexts();
    expect(contexts.length).toBe(1);
    await cdpBrowser.close();
  } finally {
    await browserServer.close();
  }
});

test('should use proxy with connectOverCDP', async ({ browserType, server, mode }, testInfo) => {
  server.setRoute('/target.html', async (req, res) => {
    res.end('<html><title>Served by the proxy</title></html>');
  });
  const port = 9339 + testInfo.workerIndex;
  const browserServer = await browserType.launch({
    args: ['--remote-debugging-port=' + port, ...(process.platform === 'win32' ? ['--proxy-server=some-value'] : [])]
  });
  try {
    const cdpBrowser = await browserType.connectOverCDP(`http://127.0.0.1:${port}/`);
    const context = await cdpBrowser.newContext({
      proxy: { server: `localhost:${server.PORT}` }
    });
    const page = await context.newPage();
    await page.goto('http://non-existent.com/target.html');
    expect(await page.title()).toBe('Served by the proxy');
    await cdpBrowser.close();
  } finally {
    await browserServer.close();
  }
});

test('should be able to connect via localhost', async ({ browserType }, testInfo) => {
  const port = 9339 + testInfo.workerIndex;
  const browserServer = await browserType.launch({
    args: ['--remote-debugging-port=' + port]
  });
  try {
    const cdpBrowser = await browserType.connectOverCDP(`http://localhost:${port}`);
    const contexts = cdpBrowser.contexts();
    expect(contexts.length).toBe(1);
    await cdpBrowser.close();
  } finally {
    await browserServer.close();
  }
});

test('emulate media should not be affected by second connectOverCDP', async ({ browserType }, testInfo) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/24109' });
  test.fixme();
  const port = 9339 + testInfo.workerIndex;
  const browserServer = await browserType.launch({
    args: ['--remote-debugging-port=' + port]
  });
  try {
    async function isPrint(page) {
      return await page.evaluate(() => matchMedia('print').matches);
    }

    const browser1 = await browserType.connectOverCDP(`http://localhost:${port}`);
    const context1 = await browser1.newContext();
    const page1 = await context1.newPage();
    await page1.emulateMedia({ media: 'print' });
    expect(await isPrint(page1)).toBe(true);
    const browser2 = await browserType.connectOverCDP(`http://localhost:${port}`);
    expect(await isPrint(page1)).toBe(true);
    await Promise.all([
      browser1.close(),
      browser2.close()
    ]);
  } finally {
    await browserServer.close();
  }
});

test('should allow tracing over cdp session', async ({ browserType, trace }, testInfo) => {
  test.skip(trace === 'on');

  const port = 9339 + testInfo.workerIndex;
  const browserServer = await browserType.launch({
    args: ['--remote-debugging-port=' + port]
  });
  try {
    const cdpBrowser = await browserType.connectOverCDP({
      endpointURL: `http://127.0.0.1:${port}/`,
    });
    const [context] = cdpBrowser.contexts();
    await context.tracing.start({ screenshots: true, snapshots: true });
    const page = await context.newPage();
    await page.evaluate(() => 2 + 2);
    const traceZip = testInfo.outputPath('trace.zip');
    await context.tracing.stop({ path: traceZip });
    await cdpBrowser.close();
    expect(fs.existsSync(traceZip)).toBe(true);
  } finally {
    await browserServer.close();
  }
});

test('setInputFiles should preserve lastModified timestamp', async ({ browserType, asset }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/27452' });

  const port = 9339 + test.info().workerIndex;
  const browserServer = await browserType.launch({
    args: ['--remote-debugging-port=' + port]
  });
  try {
    const cdpBrowser = await browserType.connectOverCDP({
      endpointURL: `http://127.0.0.1:${port}/`,
    });
    const [context] = cdpBrowser.contexts();
    const page = await context.newPage();
    await page.setContent(`<input type=file multiple=true/>`);
    const input = page.locator('input');
    const files = ['file-to-upload.txt', 'file-to-upload-2.txt'];
    await input.setInputFiles(files.map(f => asset(f)));
    expect(await input.evaluate(e => [...(e as HTMLInputElement).files].map(f => f.name))).toEqual(files);
    const timestamps = await input.evaluate(e => [...(e as HTMLInputElement).files].map(f => f.lastModified));
    const expectedTimestamps = files.map(file => Math.round(fs.statSync(asset(file)).mtimeMs));
    // On Linux browser sometimes reduces the timestamp by 1ms: 1696272058110.0715  -> 1696272058109 or even
    // rounds it to seconds in WebKit: 1696272058110 -> 1696272058000.
    for (let i = 0; i < timestamps.length; i++)
      expect(Math.abs(timestamps[i] - expectedTimestamps[i]), `expected: ${expectedTimestamps}; actual: ${timestamps}`).toBeLessThan(1000);
    await cdpBrowser.close();
  } finally {
    await browserServer.close();
  }
});

test('should print custom ws close error', async ({ browserType, server }) => {
  server.onceWebSocketConnection((ws, request) => {
    ws.on('message', message => {
      ws.close(4123, 'Oh my!');
    });
  });
  const error = await browserType.connectOverCDP(`ws://localhost:${server.PORT}/ws`).catch(e => e);
  expect(error.message).toContain(`Browser logs:\n\nOh my!\n`);
});

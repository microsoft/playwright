/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from 'fs';
import path from 'path';
import { test, expect } from './cli-fixtures';

const BLOCK_MESSAGE = /Blocked by Web Inspector|NS_ERROR_FAILURE|net::ERR_BLOCKED_BY_CLIENT/;

test('--proxy routes browser traffic through the proxy', async ({ cli, server }) => {
  server.setRoute('/target.html', (_req, res) => {
    res.end('<html><title>Served by the proxy</title></html>');
  });
  await cli('open', `--proxy=${server.HOST}`);
  const { output } = await cli('goto', 'http://non-existent.com/target.html');
  expect(output).toContain('Served by the proxy');
});

test('--proxy sends credentials embedded in the URL', async ({ cli, server }) => {
  server.setRoute('/target.html', (req, res) => {
    const auth = req.headers['proxy-authorization'];
    if (!auth) {
      res.writeHead(407, { 'Proxy-Authenticate': 'Basic realm="proxy"' });
      res.end();
      return;
    }
    const [user, password] = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
    res.end(`<html><title>Proxy user ${user} password ${password}</title></html>`);
  });
  await cli('open', `--proxy=http://alice:s3cret@${server.HOST}`);
  const { output } = await cli('goto', 'http://non-existent.com/target.html');
  expect(output).toContain('Proxy user alice password s3cret');
});

test('HTTPS_PROXY from the environment is used without flags', async ({ cli, server }) => {
  server.setRoute('/target.html', (_req, res) => {
    res.end('<html><title>Served by the environment proxy</title></html>');
  });
  const env = { HTTPS_PROXY: `http://${server.HOST}`, HTTP_PROXY: `http://${server.HOST}` };
  await cli('open', { env });
  const { output } = await cli('goto', 'http://non-existent.com/target.html');
  expect(output).toContain('Served by the environment proxy');
});

test('--ignore-https-errors accepts a self-signed certificate', async ({ cli, httpsServer }) => {
  await cli('open', '--ignore-https-errors', httpsServer.EMPTY_PAGE);
  const { output } = await cli('eval', 'location.href');
  expect(output).toContain(httpsServer.EMPTY_PAGE);
});

test('self-signed certificate is rejected by default', async ({ cli, httpsServer }) => {
  await cli('open');
  const { output, error } = await cli('goto', httpsServer.EMPTY_PAGE);
  expect(output + error).toMatch(/ERR_CERT|SSL|certificate|SEC_ERROR/i);
});

test('--user-agent sets the user agent', async ({ cli, server }) => {
  await cli('open', '--user-agent=Agent/1.0', server.HELLO_WORLD);
  const { output } = await cli('eval', 'navigator.userAgent');
  expect(output).toContain('Agent/1.0');
});

test('--state loads cookies and storage from a file relative to cwd', async ({ cli, server }, testInfo) => {
  await fs.promises.writeFile(testInfo.outputPath('state.json'), JSON.stringify({
    origins: [{ origin: server.PREFIX, localStorage: [{ name: 'test', value: 'session-value' }] }],
  }));
  server.setContent('/', `
    <body></body>
    <script>document.body.textContent = 'Storage: ' + localStorage.getItem('test');</script>
  `, 'text/html');
  await cli('open', '--state=state.json', server.PREFIX);
  const { output } = await cli('eval', 'document.body.textContent');
  expect(output).toContain('Storage: session-value');
});

test('--init-script runs in every page before its scripts', async ({ cli, server }, testInfo) => {
  await fs.promises.writeFile(testInfo.outputPath('init.js'), 'window.injected = "from-init-script";');
  await cli('open', '--init-script=init.js', server.HELLO_WORLD);
  const { output } = await cli('eval', 'window.injected');
  expect(output).toContain('from-init-script');
  await cli('goto', server.EMPTY_PAGE);
  const { output: afterNavigation } = await cli('eval', 'window.injected');
  expect(afterNavigation).toContain('from-init-script');
});

test('--init-script can be repeated', async ({ cli, server }, testInfo) => {
  await fs.promises.writeFile(testInfo.outputPath('a.js'), 'window.a = 1;');
  await fs.promises.writeFile(testInfo.outputPath('b.js'), 'window.b = window.a + 1;');
  await cli('open', '--init-script=a.js', '--init-script=b.js', server.HELLO_WORLD);
  const { output } = await cli('eval', 'window.a + "," + window.b');
  expect(output).toContain('1,2');
});

test('--allowed-origins blocks everything else', async ({ cli, server }) => {
  server.setContent('/ppp', 'content:PPP', 'text/html');
  await cli('open', `--allowed-origins=${new URL(server.PREFIX).origin}`, server.PREFIX + '/ppp');
  const { output } = await cli('eval', 'document.body.textContent');
  expect(output).toContain('content:PPP');
  const { output: blocked, error } = await cli('goto', 'https://example.com/');
  expect(blocked + error).toMatch(BLOCK_MESSAGE);
});

test('--blocked-origins blocks the listed origins', async ({ cli, server }) => {
  server.setContent('/ppp', 'content:PPP', 'text/html');
  await cli('open', '--blocked-origins=example.com', server.PREFIX + '/ppp');
  const { output } = await cli('eval', 'document.body.textContent');
  expect(output).toContain('content:PPP');
  const { output: blocked, error } = await cli('goto', 'https://example.com/');
  expect(blocked + error).toMatch(BLOCK_MESSAGE);
});

test('--executable-path reports a missing binary', async ({ cli }) => {
  const { exitCode, output, error } = await cli('open', '--executable-path=bogus');
  expect(exitCode).not.toBe(0);
  expect(output + error).toMatch(/executable doesn't exist/i);
});

async function writeExtension(dir: string) {
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(path.join(dir, 'manifest.json'), JSON.stringify({
    name: 'Marker extension',
    version: '1.0',
    manifest_version: 3,
    content_scripts: [{ matches: ['<all_urls>'], js: ['content.js'], run_at: 'document_start' }],
  }));
  await fs.promises.writeFile(path.join(dir, 'content.js'), `document.documentElement.setAttribute('data-extension', 'loaded');`);
}

test('--extension loads an unpacked extension into the bundled chromium', async ({ cli, server, mcpBrowser }, testInfo) => {
  test.skip(mcpBrowser !== 'chrome' && mcpBrowser !== 'chromium', 'Unpacked extensions are a Chromium feature.');
  await writeExtension(testInfo.outputPath('ext'));
  await cli('open', '--browser=chromium', '--extension=ext', server.HELLO_WORLD);
  const { output } = await cli('eval', 'document.documentElement.getAttribute("data-extension")');
  expect(output).toContain('loaded');
  const { output: list } = await cli('list');
  expect(list).toContain('browser-type: chrome-for-testing');
});

test('--extension picks the bundled chromium when no browser is configured', async ({ cli, server, mcpBrowser }, testInfo) => {
  test.skip(mcpBrowser !== 'chrome' && mcpBrowser !== 'chromium', 'Unpacked extensions are a Chromium feature.');
  await writeExtension(testInfo.outputPath('ext'));
  // The fixture pins the browser through PLAYWRIGHT_MCP_BROWSER, drop it to exercise the default.
  await cli('open', '--extension=ext', server.HELLO_WORLD, { env: { PLAYWRIGHT_MCP_BROWSER: '' } });
  const { output } = await cli('eval', 'document.documentElement.getAttribute("data-extension")');
  expect(output).toContain('loaded');
  const { output: list } = await cli('list');
  expect(list).toContain('browser-type: chromium');
});

test('--extension is rejected with chrome', async ({ cli, mcpBrowser }, testInfo) => {
  test.skip(mcpBrowser !== 'chrome', 'Only Google Chrome refuses unpacked extensions.');
  await writeExtension(testInfo.outputPath('ext'));
  const { exitCode, output, error } = await cli('open', '--extension=ext');
  expect(exitCode).not.toBe(0);
  expect(output + error).toContain('Google Chrome does not load unpacked extensions, use --browser=chromium instead of chrome.');
});

test('--extension reports a missing directory', async ({ cli }) => {
  const { exitCode, output, error } = await cli('open', '--browser=chromium', '--extension=missing');
  expect(exitCode).not.toBe(0);
  expect(output + error).toContain('Extension directory does not exist');
});

test('a value flag without a value is rejected', async ({ cli }) => {
  const { exitCode, output, error } = await cli('open', '--extension');
  expect(exitCode).not.toBe(0);
  expect(output + error).toContain(`'--extension' option requires a value`);
  const { output: list } = await cli('list');
  expect(list).toContain('(no browsers)');
});

test('open help lists the launch options', async ({ cli }) => {
  const { output } = await cli('open', '--help');
  for (const flag of ['--proxy', '--proxy-bypass', '--ignore-https-errors', '--user-agent', '--executable-path', '--init-script', '--extension', '--state', '--allowed-origins', '--blocked-origins'])
    expect(output).toContain(flag);
});

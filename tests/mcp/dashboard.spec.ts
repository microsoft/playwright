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
import os from 'os';
import path from 'path';

import { test, expect } from './cli-fixtures';
import { inheritAndCleanEnv } from '../config/utils';

function displayPath(p: string): string {
  const home = os.homedir();
  if (p === home)
    return '~';
  if (p.startsWith(home + path.sep))
    return '~' + p.slice(home.length);
  return p;
}

test.beforeEach(({}, testInfo) => {
  process.env.PLAYWRIGHT_SERVER_REGISTRY = testInfo.outputPath('registry');
});

test('should show browser session chip', async ({ cli, server, startDashboardServer }) => {
  await cli('open', server.EMPTY_PAGE);

  const dashboard = await startDashboardServer();
  const chips = dashboard.locator('.session-chip');
  await expect(chips).toHaveCount(1);
});

test('should show placeholder chip for browser with no contexts', async ({ boundBrowser, startDashboardServer }) => {
  expect(boundBrowser.contexts()).toHaveLength(0);

  const dashboard = await startDashboardServer();
  const chips = dashboard.locator('.session-chip');
  await expect(chips).toHaveCount(1);
  await expect(chips.locator('.sidebar-tabs-empty')).toHaveText('No tabs open.');
  await expect(chips.locator('.sidebar-session-new-tab')).toHaveCount(0);
});

test('should show one row per context for a single browser', async ({ boundBrowser, server, startDashboardServer }) => {
  const contextA = await boundBrowser.newContext();
  const pageA = await contextA.newPage();
  await pageA.goto(server.EMPTY_PAGE);

  const dashboard = await startDashboardServer();
  const chips = dashboard.locator('.session-chip');
  await expect(chips).toHaveCount(1);

  const contextB = await boundBrowser.newContext();
  const pageB = await contextB.newPage();
  await pageB.goto(server.EMPTY_PAGE);
  await expect(chips).toHaveCount(2);
});

test('should show current workspace sessions first', async ({ cli, server, startDashboardServer }) => {
  const wsA = test.info().outputPath('workspace-a');
  const wsB = test.info().outputPath('workspace-b');

  await fs.promises.mkdir(path.join(wsA, '.playwright'), { recursive: true });
  await fs.promises.mkdir(path.join(wsB, '.playwright'), { recursive: true });

  await cli('open', server.EMPTY_PAGE, { cwd: wsA });
  await cli('open', server.EMPTY_PAGE, { cwd: wsB });

  const checkOrder = async (first: string, second: string) => {
    const dashboard = await startDashboardServer({ cwd: first });
    const workspaceGroups = dashboard.locator('.workspace-group');
    await expect(workspaceGroups).toHaveCount(2);

    // Current workspace (first) should be first.
    await expect(workspaceGroups.nth(0).locator('.workspace-path-full')).toHaveText(displayPath(first));
    await expect(workspaceGroups.nth(0).locator('.session-chip')).toHaveCount(1);

    // Other workspace (second) should be second.
    await expect(workspaceGroups.nth(1).locator('.workspace-path-full')).toHaveText(displayPath(second));
    await expect(workspaceGroups.nth(1).locator('.session-chip')).toHaveCount(1);
  };

  await test.step('open dashboard in workspace A', async () => {
    await checkOrder(wsA, wsB);
  });

  await test.step('open dashboard in workspace B', async () => {
    await checkOrder(wsB, wsA);
  });
});

test('should activate session when show is called with -s', async ({ cli, server, startDashboardServer }) => {
  await cli('-s=sessA', 'open', server.EMPTY_PAGE);
  await cli('-s=sessB', 'open', server.EMPTY_PAGE);

  const dashboard = await startDashboardServer({ session: 'sessB' });
  const activeSession = dashboard.locator('.sidebar-session:has(.sidebar-tab.active)');
  await expect(activeSession.locator('.session-chip-name')).toHaveText('sessB');
});

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

test('daemon show: closing page exits the process', async ({ cli, connectToDashboard }) => {
  const bindTitle = `--playwright-internal--${crypto.randomUUID()}`;
  const { exitCode, dashboardPid } = await cli('show', { bindTitle });
  expect(exitCode).toBe(0);
  expect(dashboardPid).toBeDefined();
  expect(isAlive(dashboardPid)).toBe(true);

  const browser = await connectToDashboard(bindTitle);
  const page = browser.contexts()[0].pages()[0];
  await page.close();

  await expect(() => expect(isAlive(dashboardPid)).toBe(false)).toPass();
});

async function drawAndSubmitAnnotation(dashboard: import('playwright-core').Page, text: string) {
  await expect(dashboard.locator('div.dashboard-view.annotate')).toBeVisible();
  const box = await dashboard.locator('img#display').boundingBox();
  const x0 = box!.x + box!.width * 0.3;
  const y0 = box!.y + box!.height * 0.3;
  const x1 = box!.x + box!.width * 0.6;
  const y1 = box!.y + box!.height * 0.6;
  await dashboard.mouse.move(x0, y0);
  await dashboard.mouse.down();
  await dashboard.mouse.move(x1, y1);
  await dashboard.mouse.up();
  await dashboard.locator('.annotation-textarea').fill(text);
  await dashboard.locator('.annotation-textarea').press('Enter');
  await dashboard.getByRole('button', { name: 'Submit annotation' }).click();
}

function verifyAnnotateOutput(output: string, expectedText: string, outputDir: string) {
  const lines = output.trim().split('\n');
  expect(lines[0]).toMatch(new RegExp(`^\\{ x: \\d+, y: \\d+, width: \\d+, height: \\d+ \\}: ${expectedText}$`));
  expect(lines[lines.length - 1]).toMatch(/^image: \.playwright-cli[\\/]annotations-.*\.png$/);
  const pngRel = lines[lines.length - 1].replace(/^image: /, '');
  const pngPath = path.resolve(outputDir, pngRel);
  expect(fs.existsSync(pngPath)).toBe(true);
  expect(fs.statSync(pngPath).size).toBeGreaterThan(0);
}

test('should capture annotations via show --annotate', async ({ connectToDashboard, cli, server }) => {
  await cli('open', server.EMPTY_PAGE);
  const bindTitle = `--playwright-internal--${crypto.randomUUID()}`;
  await cli('show', { bindTitle });
  const browser = await connectToDashboard(bindTitle);

  const dashboard = browser.contexts()[0].pages()[0];
  await dashboard.locator('.sidebar-tab').first().click();

  const annotatePromise = cli('show', '--annotate');
  let done = false;
  void annotatePromise.finally(() => { done = true; });

  await drawAndSubmitAnnotation(dashboard, 'hello');

  const { output, exitCode } = await annotatePromise;
  expect(done).toBe(true);
  expect(exitCode).toBe(0);
  verifyAnnotateOutput(output, 'hello', test.info().outputDir);
});

test('should start dashboard and annotate when no dashboard is running', async ({ connectToDashboard, cli, server }) => {
  await cli('open', server.EMPTY_PAGE);

  const bindTitle = `--playwright-internal--${crypto.randomUUID()}`;
  const annotatePromise = cli('show', '--annotate', { bindTitle });
  let done = false;
  void annotatePromise.finally(() => { done = true; });

  const browser = await connectToDashboard(bindTitle);
  try {
    const dashboard = browser.contexts()[0].pages()[0];
    await drawAndSubmitAnnotation(dashboard, 'hi');
  } finally {
    await browser.close().catch(() => {});
  }

  const { output, exitCode } = await annotatePromise;
  expect(done).toBe(true);
  expect(exitCode).toBe(0);
  verifyAnnotateOutput(output, 'hi', test.info().outputDir);
});

test('should enter annotate mode on fresh dashboard.tsx mount with -s --annotate', async ({ connectToDashboard, cli, server }) => {
  await cli('-s=first', 'open', server.EMPTY_PAGE);
  await cli('-s=second', 'open', server.EMPTY_PAGE);

  const bindTitle = `--playwright-internal--${crypto.randomUUID()}`;
  const annotatePromise = cli('-s=second', 'show', '--annotate', { bindTitle });
  let done = false;
  void annotatePromise.finally(() => { done = true; });

  const browser = await connectToDashboard(bindTitle);
  try {
    const dashboard = browser.contexts()[0].pages()[0];
    await expect(dashboard.locator('div.dashboard-view.annotate')).toBeVisible();
    const activeSession = dashboard.locator('.sidebar-session:has(.sidebar-tab.active)');
    await expect(activeSession.locator('.session-chip-name')).toHaveText('second');
    await drawAndSubmitAnnotation(dashboard, 'fresh');
  } finally {
    await browser.close().catch(() => {});
  }

  const { exitCode } = await annotatePromise;
  expect(done).toBe(true);
  expect(exitCode).toBe(0);
});

test('should switch screencast to -s session on show --annotate', async ({ connectToDashboard, cli, server }) => {
  server.setContent('/red', '<html><head><style>html,body{margin:0;height:100vh;background:#ff0000}</style></head><body></body></html>', 'text/html');
  server.setContent('/green', '<html><head><style>html,body{margin:0;height:100vh;background:#00ff00}</style></head><body></body></html>', 'text/html');

  await cli('-s=first', 'open', server.PREFIX + '/red');
  await cli('-s=second', 'open', server.PREFIX + '/green');

  const bindTitle = `--playwright-internal--${crypto.randomUUID()}`;
  await cli('-s=first', 'show', { bindTitle });
  const browser = await connectToDashboard(bindTitle);
  const dashboard = browser.contexts()[0].pages()[0];

  const sampleCenter = () => dashboard.locator('#display').evaluate((img: HTMLImageElement) => {
    if (!img.naturalWidth)
      return null;
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, img.naturalWidth / 2, img.naturalHeight / 2, 1, 1, 0, 0, 1, 1);
    const [r, g] = ctx.getImageData(0, 0, 1, 1).data;
    return { r, g };
  });

  await expect(async () => {
    const c = await sampleCenter();
    expect(c?.r).toBeGreaterThan(200);
    expect(c?.g).toBeLessThan(50);
  }).toPass({ timeout: 15000 });

  const annotatePromise = cli('-s=second', 'show', '--annotate');
  let done = false;
  void annotatePromise.finally(() => { done = true; });

  await expect(dashboard.locator('div.dashboard-view.annotate')).toBeVisible({ timeout: 15000 });
  const activeSession = dashboard.locator('.sidebar-session:has(.sidebar-tab.active)');
  await expect(activeSession.locator('.session-chip-name')).toHaveText('second');

  await expect(async () => {
    const c = await sampleCenter();
    expect(c?.g).toBeGreaterThan(200);
    expect(c?.r).toBeLessThan(50);
  }).toPass({ timeout: 15000 });

  await drawAndSubmitAnnotation(dashboard, 'session switch');
  const { exitCode } = await annotatePromise;
  expect(done).toBe(true);
  expect(exitCode).toBe(0);
});

test('should disengage annotate mode when --annotate client disconnects', async ({ connectToDashboard, cli, childProcess, cliEnv, mcpBrowser, mcpHeadless, server }) => {
  await cli('open', server.EMPTY_PAGE);
  const bindTitle = `--playwright-internal--${crypto.randomUUID()}`;
  await cli('show', { bindTitle });
  const browser = await connectToDashboard(bindTitle);

  const dashboard = browser.contexts()[0].pages()[0];
  await dashboard.locator('.sidebar-tab').first().click();

  const annotateClient = childProcess({
    command: [process.execPath, require.resolve('../../packages/playwright-core/lib/tools/cli-client/cli.js'), 'show', '--annotate'],
    cwd: test.info().outputPath(),
    env: inheritAndCleanEnv({
      ...cliEnv,
      PLAYWRIGHT_MCP_BROWSER: mcpBrowser,
      PLAYWRIGHT_MCP_HEADLESS: String(mcpHeadless),
    }),
  });

  await expect(dashboard.locator('div.dashboard-view.annotate')).toBeVisible();

  await annotateClient.kill();

  await expect(dashboard.locator('div.dashboard-view')).not.toHaveClass(/annotate/);
});

async function installSaveFilePickerMock(page: import('playwright-core').Page): Promise<() => Promise<Buffer>> {
  let captured: string | undefined;
  let resolveCaptured: ((b64: string) => void) | undefined;
  const waitForCapture = new Promise<string>(resolve => {
    resolveCaptured = resolve;
  });
  await page.exposeBinding('__testCaptureBytes', (_, b64: string) => {
    captured = b64;
    resolveCaptured!(b64);
  });
  await page.addInitScript(() => {
    (window as any).showSaveFilePicker = async () => ({
      createWritable: async () => {
        const chunks: Uint8Array[] = [];
        return {
          write: async (chunk: Blob | BufferSource) => {
            const buf = chunk instanceof Blob
              ? new Uint8Array(await chunk.arrayBuffer())
              : new Uint8Array(chunk instanceof ArrayBuffer ? chunk : (chunk as ArrayBufferView).buffer);
            chunks.push(buf);
          },
          close: async () => {
            const total = chunks.reduce((n, c) => n + c.byteLength, 0);
            const merged = new Uint8Array(total);
            let offset = 0;
            for (const c of chunks) {
              merged.set(c, offset);
              offset += c.byteLength;
            }
            await (window as any).__testCaptureBytes((merged as any).toBase64());
          },
        };
      },
    });
  });
  return async () => {
    const b64 = captured ?? await waitForCapture;
    return Buffer.from(b64, 'base64');
  };
}

test('save recording streams WebM bytes to the chosen file', async ({ cli, server, page, startDashboardServer }) => {
  await cli('open', server.EMPTY_PAGE);
  const awaitBytes = await installSaveFilePickerMock(page);

  const dashboard = await startDashboardServer();
  await dashboard.locator('.sidebar-tab').first().click();
  await expect(dashboard.locator('img#display')).toBeVisible();

  // Enter recording mode from the normal toolbar.
  await dashboard.getByRole('button', { name: 'Record video' }).click();
  await expect(dashboard.locator('.recording-label')).toBeVisible();

  // Click the toggled record button again to transition to the 'stopped' phase.
  await dashboard.getByRole('button', { name: 'Stop recording' }).click();

  // Save the recording.
  await dashboard.getByRole('button', { name: 'Save recording' }).click();

  const bytes = await awaitBytes();
  // WebM files start with the EBML magic bytes.
  expect(bytes.subarray(0, 4)).toEqual(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
});

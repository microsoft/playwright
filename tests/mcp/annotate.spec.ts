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

import * as zipjs from '@zip.js/zip.js';

import { test, expect, installSaveFilePickerMock, mockAbortingFilePicker } from './cli-fixtures';
import { inheritAndCleanEnv } from '../config/utils';

function activeSession(dashboard: import('playwright-core').Page) {
  return dashboard.getByRole('region', { name: /^Session / }).filter({ has: dashboard.getByRole('option', { selected: true }) });
}

async function drawAndSubmitAnnotation(dashboard: import('playwright-core').Page, text: string) {
  await expect(dashboard.getByRole('main', { name: 'Dashboard: annotate' })).toBeVisible();
  await expect(dashboard.locator('.annotate-modal-image')).toBeVisible();
  const box = await dashboard.locator('.annotate-modal-image').boundingBox();
  const x0 = box!.x + box!.width * 0.3;
  const y0 = box!.y + box!.height * 0.3;
  const x1 = box!.x + box!.width * 0.6;
  const y1 = box!.y + box!.height * 0.6;
  await dashboard.mouse.move(x0, y0);
  await dashboard.mouse.down();
  await dashboard.mouse.move(x1, y1);
  await dashboard.mouse.up();
  await dashboard.locator('.annotations-textarea').fill(text);
  await dashboard.locator('.annotations-textarea').press('Enter');
  await dashboard.getByRole('button', { name: 'Done annotating' }).click();
  await dashboard.getByRole('button', { name: 'Submit' }).click();
}

function verifyAnnotateOutput(output: string, expectedText: string, outputDir: string) {
  expect(output).toMatch(/.* @ .* \(\d+x\d+\)/);
  expect(output).toMatch(new RegExp(`\\{ x: \\d+, y: \\d+, width: \\d+, height: \\d+ \\}: ${expectedText}`));
  const imageMatch = output.match(/- \[Annotation image\]\((\.playwright-cli[\\/]annotations-.*\.png)\)/);
  expect(imageMatch).not.toBeNull();
  const pngPath = path.resolve(outputDir, imageMatch![1]);
  expect(fs.existsSync(pngPath)).toBe(true);
  expect(fs.statSync(pngPath).size).toBeGreaterThan(0);
}

test('should capture multiple screenshots in one annotation', async ({ connectToDashboard, cli, server }) => {
  await cli('open', server.PREFIX + '/title.html');
  const bindTitle = `--playwright-internal--${crypto.randomUUID()}`;
  await cli('show', { bindTitle });
  const browser = await connectToDashboard(bindTitle);

  const dashboard = browser.contexts()[0].pages()[0];
  await dashboard.getByRole('navigation', { name: 'Sessions' }).getByRole('option').first().click();

  const annotatePromise = cli('show', '--annotate');
  let done = false;
  void annotatePromise.finally(() => { done = true; });

  await expect(dashboard.locator('.annotate-modal-image')).toBeVisible();
  // First annotation on initial frame.
  let box = await dashboard.locator('.annotate-modal-image').boundingBox();
  await dashboard.mouse.move(box!.x + box!.width * 0.2, box!.y + box!.height * 0.2);
  await dashboard.mouse.down();
  await dashboard.mouse.move(box!.x + box!.width * 0.4, box!.y + box!.height * 0.4);
  await dashboard.mouse.up();
  await dashboard.locator('.annotations-textarea').fill('first');
  await dashboard.locator('.annotations-textarea').press('Enter');

  // Deselect overlay (sidebar stays), then capture a second frame via the toolbar button.
  await dashboard.getByRole('button', { name: 'Done annotating' }).click();
  await expect(dashboard.locator('.annotate-overlay')).toHaveCount(0);
  await dashboard.getByRole('button', { name: /^(Take|Add) screenshot$/ }).click();

  // New frame auto-selected; draw + label.
  await expect(dashboard.locator('.annotate-sidebar-thumb')).toHaveCount(2);
  await expect(dashboard.locator('.annotate-overlay')).toBeVisible();
  box = await dashboard.locator('.annotate-modal-image').boundingBox();
  await dashboard.mouse.move(box!.x + box!.width * 0.5, box!.y + box!.height * 0.5);
  await dashboard.mouse.down();
  await dashboard.mouse.move(box!.x + box!.width * 0.7, box!.y + box!.height * 0.7);
  await dashboard.mouse.up();
  await dashboard.locator('.annotations-textarea').fill('second');
  await dashboard.locator('.annotations-textarea').press('Enter');

  await dashboard.getByRole('button', { name: 'Done annotating' }).click();
  await dashboard.getByRole('button', { name: 'Submit' }).click();

  const { output, exitCode } = await annotatePromise;
  expect(done).toBe(true);
  expect(exitCode).toBe(0);
  expect(output).toMatch(/## Screenshot 1/);
  expect(output).toMatch(/## Screenshot 2/);
  expect(output).toMatch(/\{ x: \d+, y: \d+, width: \d+, height: \d+ \}: first/);
  expect(output).toMatch(/\{ x: \d+, y: \d+, width: \d+, height: \d+ \}: second/);
  expect(output).toMatch(/- \[Annotation image 1\]\(.*annotations-1-.*\.png\)/);
  expect(output).toMatch(/- \[Annotation image 2\]\(.*annotations-2-.*\.png\)/);
});

test('should abort annotation when last screenshot is removed', async ({ connectToDashboard, cli, server }) => {
  await cli('open', server.EMPTY_PAGE);
  const bindTitle = `--playwright-internal--${crypto.randomUUID()}`;
  await cli('show', { bindTitle });
  const browser = await connectToDashboard(bindTitle);

  const dashboard = browser.contexts()[0].pages()[0];
  await dashboard.getByRole('navigation', { name: 'Sessions' }).getByRole('option').first().click();

  const annotatePromise = cli('show', '--annotate');
  let done = false;
  void annotatePromise.finally(() => { done = true; });

  await expect(dashboard.locator('.annotate-sidebar-thumb')).toHaveCount(1);

  // Close the fullscreen overlay first so the sidebar remove button is accessible.
  await dashboard.getByRole('button', { name: 'Done annotating' }).click();

  // Remove the only screenshot — should abort the annotation
  await dashboard.locator('.annotate-sidebar-thumb-remove').click();

  const { output, exitCode } = await annotatePromise;
  expect(done).toBe(true);
  expect(exitCode).toBe(0);
  expect(output).toContain('No annotations were submitted');
});

test('should abort MCP annotation when last screenshot is removed', async ({ connectToDashboard, boundBrowser, startClient, cliEnv }) => {
  await boundBrowser.newPage();

  const bindTitle = `--playwright-internal--${crypto.randomUUID()}`;
  const { client } = await startClient({
    args: ['--endpoint=default', '--caps=devtools'],
    env: {
      ...cliEnv,
      PWTEST_DASHBOARD_APP_BIND_TITLE: bindTitle,
    },
  });

  const annotatePromise = client.callTool({ name: 'browser_annotate' });
  let done = false;
  void annotatePromise.then(() => { done = true; });

  const browser = await connectToDashboard(bindTitle);
  try {
    const dashboard = browser.contexts()[0].pages()[0];
    await expect(dashboard.locator('.annotate-sidebar-thumb')).toHaveCount(1);

    // Close the fullscreen overlay first so the sidebar remove button is accessible.
    await dashboard.getByRole('button', { name: 'Done annotating' }).click();

    // Remove the only screenshot — should abort
    await dashboard.locator('.annotate-sidebar-thumb-remove').click();
  } finally {
    await browser.close().catch(() => {});
  }

  const result = await annotatePromise;
  expect(done).toBe(true);
  const text = (result.content as any).map((c: any) => c.text ?? '').join('\n');
  expect(text).toContain('No annotations were submitted');
});

test('user-initiated annotate downloads zip with feedback.md', async ({ connectToDashboard, cli, server }) => {
  await cli('open', server.EMPTY_PAGE);
  const bindTitle = `--playwright-internal--${crypto.randomUUID()}`;
  await cli('show', { bindTitle });
  const browser = await connectToDashboard(bindTitle);

  const dashboard = browser.contexts()[0].pages()[0];
  await dashboard.getByRole('navigation', { name: 'Sessions' }).getByRole('option').first().click();

  // Start with an aborting picker to verify cancellation keeps the session intact.
  await mockAbortingFilePicker(dashboard);

  // Enter annotate via toolbar (user-initiated).
  await dashboard.getByRole('button', { name: /^(Take|Add) screenshot$/ }).click();
  await expect(dashboard.locator('.annotate-modal-image')).toBeVisible();

  // Draw an annotation.
  const box = await dashboard.locator('.annotate-modal-image').boundingBox();
  await dashboard.mouse.move(box!.x + box!.width * 0.2, box!.y + box!.height * 0.2);
  await dashboard.mouse.down();
  await dashboard.mouse.move(box!.x + box!.width * 0.5, box!.y + box!.height * 0.5);
  await dashboard.mouse.up();
  await dashboard.locator('.annotations-textarea').fill('zip-test');
  await dashboard.locator('.annotations-textarea').press('Enter');

  // Close overlay, type feedback, submit → picker aborts.
  await dashboard.getByRole('button', { name: 'Done annotating' }).click();
  await dashboard.locator('.annotate-sidebar-feedback').fill('My feedback');
  await dashboard.getByRole('button', { name: 'Submit', exact: true }).click();

  // Session must still be open with data intact.
  await expect(dashboard.locator('.annotate-sidebar')).toBeVisible();
  await expect(dashboard.locator('.annotate-sidebar-thumb')).toHaveCount(1);
  // Wait until the in-flight (aborted) submit fully resolves and the button is re-enabled,
  // otherwise installing the next picker mid-flight would race.
  await expect(dashboard.getByRole('button', { name: 'Submit', exact: true })).toBeEnabled();

  // Now install a capturing picker and submit for real.
  const awaitZipBytes = await installSaveFilePickerMock(dashboard);
  await dashboard.getByRole('button', { name: 'Submit', exact: true }).click();

  const zipBytes = await awaitZipBytes();

  zipjs.configure({ useWebWorkers: false });
  const entries = await new zipjs.ZipReader(new zipjs.Uint8ArrayReader(zipBytes)).getEntries();
  const names = entries.map(e => e.filename);
  expect(names).toContain('feedback.md');
  expect(names).toContain('annotations-1.png');

  const mdEntry = entries.find(e => e.filename === 'feedback.md')!;
  const mdText = await mdEntry.getData!(new zipjs.TextWriter());
  expect(mdText).toContain('My feedback');
  expect(mdText).toContain('Screenshot 1');
  expect(mdText).toContain('[Screenshot 1](annotations-1.png)');
  expect(mdText).toMatch(/\d+x\d+/);
});

test('should capture annotations via show --annotate', async ({ connectToDashboard, cli, server }) => {
  await cli('open', server.EMPTY_PAGE);
  const bindTitle = `--playwright-internal--${crypto.randomUUID()}`;
  await cli('show', { bindTitle });
  const browser = await connectToDashboard(bindTitle);

  const dashboard = browser.contexts()[0].pages()[0];
  await dashboard.getByRole('navigation', { name: 'Sessions' }).getByRole('option').first().click();

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
  const bindTitle = `--playwright-internal--${crypto.randomUUID()}`;
  await cli('open', server.EMPTY_PAGE, { bindTitle });

  const annotatePromise = cli('show', '--annotate');
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
  const bindTitle = `--playwright-internal--${crypto.randomUUID()}`;
  await cli('-s=first', 'open', server.EMPTY_PAGE, { bindTitle });
  await cli('-s=second', 'open', server.EMPTY_PAGE, { bindTitle });

  const annotatePromise = cli('-s=second', 'show', '--annotate');
  let done = false;
  void annotatePromise.finally(() => { done = true; });

  const browser = await connectToDashboard(bindTitle);
  try {
    const dashboard = browser.contexts()[0].pages()[0];
    await expect(dashboard.getByRole('main', { name: 'Dashboard: annotate' })).toBeVisible();
    await expect(activeSession(dashboard)).toHaveAccessibleName('Session second');
    await drawAndSubmitAnnotation(dashboard, 'fresh');
  } finally {
    await browser.close().catch(() => {});
  }

  const { exitCode } = await annotatePromise;
  expect(done).toBe(true);
  expect(exitCode).toBe(0);
});

test('should annotate via direct browser_annotate MCP call', async ({ connectToDashboard, boundBrowser, startClient, cliEnv, server }) => {
  const page = await boundBrowser.newPage();
  await page.goto(server.EMPTY_PAGE);

  const bindTitle = `--playwright-internal--${crypto.randomUUID()}`;
  const { client } = await startClient({
    args: ['--endpoint=default', '--caps=devtools'],
    env: {
      ...cliEnv,
      PWTEST_DASHBOARD_APP_BIND_TITLE: bindTitle,
    },
  });

  const annotatePromise = client.callTool({ name: 'browser_annotate' });
  let done = false;
  void annotatePromise.then(() => { done = true; });

  const browser = await connectToDashboard(bindTitle);
  try {
    const dashboard = browser.contexts()[0].pages()[0];
    await expect(dashboard.getByRole('main', { name: 'Dashboard: annotate' })).toBeVisible();
    await drawAndSubmitAnnotation(dashboard, 'direct-mcp');
  } finally {
    await browser.close().catch(() => {});
  }

  const result = await annotatePromise;
  expect(done).toBe(true);
  const text = (result.content as any).map(c => c.text ?? '').join('\n');
  expect(text).toMatch(/\{ x: \d+, y: \d+, width: \d+, height: \d+ \}: direct-mcp/);
  expect(text).toMatch(/- \[Annotation image\]\(.*\.png\)/);
});

test('should annotate when context has no fixed viewport', async ({ connectToDashboard, boundBrowser, startClient, cliEnv, server }) => {
  // Simulates headed `playwright-cli open --headed`, which launches with viewport: null
  // so that the browser window controls the page size. https://github.com/microsoft/playwright/issues/40565
  const context = await boundBrowser.newContext({ viewport: null });
  const page = await context.newPage();
  expect(page.viewportSize()).toBe(null);
  await page.goto(server.EMPTY_PAGE);

  const bindTitle = `--playwright-internal--${crypto.randomUUID()}`;
  const { client } = await startClient({
    args: ['--endpoint=default', '--caps=devtools'],
    env: {
      ...cliEnv,
      PWTEST_DASHBOARD_APP_BIND_TITLE: bindTitle,
    },
  });

  const annotatePromise = client.callTool({ name: 'browser_annotate' });
  let done = false;
  void annotatePromise.then(() => { done = true; });

  const browser = await connectToDashboard(bindTitle);
  try {
    const dashboard = browser.contexts()[0].pages()[0];
    await expect(dashboard.getByRole('main', { name: 'Dashboard: annotate' })).toBeVisible();
    await drawAndSubmitAnnotation(dashboard, 'no-viewport');
  } finally {
    await browser.close().catch(() => {});
  }

  const result = await annotatePromise;
  expect(done).toBe(true);
  const text = (result.content as any).map(c => c.text ?? '').join('\n');
  expect(text).toMatch(/\{ x: \d+, y: \d+, width: \d+, height: \d+ \}: no-viewport/);
  expect(text).toMatch(/- \[Annotation image\]\(.*\.png\)/);
});

test('should cancel browser_annotate when the MCP request is aborted', async ({ connectToDashboard, boundBrowser, startClient, cliEnv, server }) => {
  const page = await boundBrowser.newPage();
  await page.goto(server.EMPTY_PAGE);

  const bindTitle = `--playwright-internal--${crypto.randomUUID()}`;
  const { client } = await startClient({
    args: ['--endpoint=default', '--caps=devtools'],
    env: {
      ...cliEnv,
      PWTEST_DASHBOARD_APP_BIND_TITLE: bindTitle,
    },
  });

  const controller = new AbortController();
  const annotatePromise = client.callTool({ name: 'browser_annotate' }, undefined, { signal: controller.signal }).catch(() => {});

  const browser = await connectToDashboard(bindTitle);
  try {
    const dashboard = browser.contexts()[0].pages()[0];
    await expect(dashboard.getByRole('main', { name: 'Dashboard: annotate' })).toBeVisible();

    controller.abort();

    await expect(dashboard.getByRole('main', { name: 'Dashboard', exact: true })).toBeVisible();
  } finally {
    await browser.close().catch(() => {});
  }

  await annotatePromise;
});

test('should cancel browser_annotate when the MCP client disconnects', async ({ connectToDashboard, boundBrowser, startClient, cliEnv, server }) => {
  const page = await boundBrowser.newPage();
  await page.goto(server.EMPTY_PAGE);

  const bindTitle = `--playwright-internal--${crypto.randomUUID()}`;
  const { client } = await startClient({
    args: ['--endpoint=default', '--caps=devtools'],
    env: {
      ...cliEnv,
      PWTEST_DASHBOARD_APP_BIND_TITLE: bindTitle,
    },
  });

  void client.callTool({ name: 'browser_annotate' }).catch(() => {});

  const browser = await connectToDashboard(bindTitle);
  try {
    const dashboard = browser.contexts()[0].pages()[0];
    await expect(dashboard.getByRole('main', { name: 'Dashboard: annotate' })).toBeVisible();

    await client.close();

    await expect(dashboard.getByRole('main', { name: 'Dashboard', exact: true })).toBeVisible();
  } finally {
    await browser.close().catch(() => {});
  }
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
  await expect(dashboard.locator('#display')).toBeVisible();

  const sampleCenter = () => dashboard.evaluate(() => {
    const img = document.querySelector('#display') as HTMLImageElement | null;
    if (!img || !img.naturalWidth)
      return null;
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, img.naturalWidth / 2, img.naturalHeight / 2, 1, 1, 0, 0, 1, 1);
    const [r, g] = ctx.getImageData(0, 0, 1, 1).data;
    return { r, g };
  });

  await expect.poll(async () => {
    const c = await sampleCenter();
    return !!(c && c.r > 200 && c.g < 50);
  }, { timeout: 15000 }).toBe(true);

  const annotatePromise = cli('-s=second', 'show', '--annotate');
  let done = false;
  void annotatePromise.finally(() => { done = true; });

  await expect(dashboard.getByRole('main', { name: 'Dashboard: annotate' })).toBeVisible();
  await expect(activeSession(dashboard)).toHaveAccessibleName('Session second');

  await expect.poll(async () => {
    const c = await sampleCenter();
    return !!(c && c.g > 200 && c.r < 50);
  }, { timeout: 15000 }).toBe(true);

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
  await dashboard.getByRole('navigation', { name: 'Sessions' }).getByRole('option').first().click();

  const annotateClient = childProcess({
    command: [process.execPath, require.resolve('../../packages/playwright-core/lib/tools/cli-client/cli.js'), 'show', '--annotate'],
    cwd: test.info().outputPath(),
    env: inheritAndCleanEnv({
      ...cliEnv,
      PLAYWRIGHT_MCP_BROWSER: mcpBrowser,
      PLAYWRIGHT_MCP_HEADLESS: String(mcpHeadless),
    }),
  });

  await expect(dashboard.getByRole('main', { name: 'Dashboard: annotate' })).toBeVisible();

  await annotateClient.kill();

  await expect(dashboard.getByRole('main', { name: 'Dashboard', exact: true })).toBeVisible();
});

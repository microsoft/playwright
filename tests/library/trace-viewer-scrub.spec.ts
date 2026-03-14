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

import type { TraceViewerFixtures } from '../config/traceViewerFixtures';
import { traceViewerFixtures } from '../config/traceViewerFixtures';
import { expect, playwrightTest } from '../config/browserTest';

const test = playwrightTest.extend<TraceViewerFixtures>(traceViewerFixtures);

test.skip(({ trace }) => trace === 'on');
test.skip(({ mode }) => mode.startsWith('service'));
test.skip(process.env.PW_CLOCK === 'frozen');
test.slow();

test('should show playback controls', async ({ runAndTrace, page: actionPage }) => {
  const traceViewer = await runAndTrace(async () => {
    await actionPage.setContent('<button>Click me</button>');
    await actionPage.click('button');
  });
  const page = traceViewer.page;
  await expect(page.getByRole('slider', { name: 'Playback position' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Previous action' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next action' })).toBeVisible();
  await expect(page.locator('.playback-speed')).toBeVisible();
});

test('should navigate with next and previous buttons', async ({ runAndTrace, page: actionPage }) => {
  const traceViewer = await runAndTrace(async () => {
    await actionPage.setContent('<button>Click me</button>');
    await actionPage.click('button');
    await actionPage.setContent('<input/>');
  });
  const page = traceViewer.page;

  // Select the first action.
  await traceViewer.selectAction('Set content');

  // Click next to advance.
  await page.getByRole('button', { name: 'Next action' }).click();
  await expect(traceViewer.actionsTree.getByRole('treeitem', { selected: true })).toHaveText(/Click/);

  // Click next again.
  await page.getByRole('button', { name: 'Next action' }).click();
  await expect(traceViewer.actionsTree.getByRole('treeitem', { selected: true })).toHaveText(/Set content/);

  // Click previous to go back.
  await page.getByRole('button', { name: 'Previous action' }).click();
  await expect(traceViewer.actionsTree.getByRole('treeitem', { selected: true })).toHaveText(/Click/);
});

test('should cycle playback speed', async ({ runAndTrace, page: actionPage }) => {
  const traceViewer = await runAndTrace(async () => {
    await actionPage.setContent('<button>Click me</button>');
    await actionPage.click('button');
  });
  const page = traceViewer.page;
  const speedButton = page.locator('.playback-speed');

  await expect(speedButton).toHaveText('1x');
  await speedButton.click();
  await expect(speedButton).toHaveText('2x');
  await speedButton.click();
  await expect(speedButton).toHaveText('0.5x');
  await speedButton.click();
  await expect(speedButton).toHaveText('1x');
});

test('should stop and reset to first action', async ({ runAndTrace, page: actionPage }) => {
  const traceViewer = await runAndTrace(async () => {
    await actionPage.setContent('<button>Click me</button>');
    await actionPage.click('button');
    await actionPage.setContent('<input/>');
  });
  const page = traceViewer.page;

  // Navigate to a later action.
  await traceViewer.selectAction('Click');

  // Click stop — should reset to first action.
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(traceViewer.actionsTree.getByRole('treeitem', { selected: true })).toHaveText(/Set content/);
});

test('should support keyboard navigation on scrubber', async ({ runAndTrace, page: actionPage }) => {
  const traceViewer = await runAndTrace(async () => {
    await actionPage.setContent('<button>Click me</button>');
    await actionPage.click('button');
    await actionPage.setContent('<input/>');
  });
  const page = traceViewer.page;
  const scrubber = page.getByRole('slider', { name: 'Playback position' });

  // Select first action and focus scrubber.
  await traceViewer.selectAction('Set content');
  await scrubber.focus();

  // ArrowRight should go to next action.
  await page.keyboard.press('ArrowRight');
  await expect(traceViewer.actionsTree.getByRole('treeitem', { selected: true })).toHaveText(/Click/);

  // ArrowRight again.
  await page.keyboard.press('ArrowRight');
  await expect(traceViewer.actionsTree.getByRole('treeitem', { selected: true })).toHaveText(/Set content/);

  // ArrowLeft should go back.
  await page.keyboard.press('ArrowLeft');
  await expect(traceViewer.actionsTree.getByRole('treeitem', { selected: true })).toHaveText(/Click/);
});

test('should have tick marks on scrubber', async ({ runAndTrace, page: actionPage }) => {
  const traceViewer = await runAndTrace(async () => {
    await actionPage.setContent('<button>Click me</button>');
    await actionPage.click('button');
    await actionPage.setContent('<input/>');
  });
  const page = traceViewer.page;

  // There should be tick marks for each action.
  const ticks = page.locator('.playback-tick');
  await expect(ticks).toHaveCount(3);
});

test('should play and auto-stop at end', async ({ runAndTrace, page: actionPage }) => {
  const traceViewer = await runAndTrace(async () => {
    await actionPage.setContent('<button>Click me</button>');
    await actionPage.click('button');
  });
  const page = traceViewer.page;

  // Select first action.
  await traceViewer.selectAction('Set content');

  // Hit play.
  await page.getByRole('button', { name: 'Play' }).click();

  // Should auto-stop — play button should reappear (not pause).
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible({ timeout: 10000 });

  // Should have advanced to last action.
  await expect(traceViewer.actionsTree.getByRole('treeitem', { selected: true })).toHaveText(/Click/);
});

test('should update scrubber aria-valuenow', async ({ runAndTrace, page: actionPage }) => {
  const traceViewer = await runAndTrace(async () => {
    await actionPage.setContent('<button>Click me</button>');
    await actionPage.click('button');
    await actionPage.setContent('<input/>');
  });
  const page = traceViewer.page;
  const scrubber = page.getByRole('slider', { name: 'Playback position' });

  // Select first action - should have low value.
  await traceViewer.selectAction('Set content');
  const val1 = await scrubber.getAttribute('aria-valuenow');

  // Select last action - should have higher value.
  await traceViewer.selectAction('Set content', 1);
  const val2 = await scrubber.getAttribute('aria-valuenow');

  expect(Number(val2)).toBeGreaterThan(Number(val1));
});

test('should drag scrubber to select action', async ({ runAndTrace, page: actionPage }) => {
  const traceViewer = await runAndTrace(async () => {
    await actionPage.setContent('<button>Click me</button>');
    await actionPage.click('button');
    await actionPage.setContent('<input/>');
  });
  const page = traceViewer.page;
  const scrubber = page.getByRole('slider', { name: 'Playback position' });

  // Click near the end of the scrubber to select a later action.
  const box = await scrubber.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.click(box!.x + box!.width * 0.95, box!.y + box!.height / 2);

  // Should have selected a later action (not the first one).
  const scrubberValue = await scrubber.getAttribute('aria-valuenow');
  expect(Number(scrubberValue)).toBeGreaterThan(50);
});

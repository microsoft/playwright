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
import type { Page, TestInfo } from '@playwright/test';
import { iso } from '../../packages/playwright-core/lib/coreBundle';
import type { iso as isoType } from '../../packages/playwright-core/lib/coreBundle';
import type { TraceEvent } from '@isomorphic/trace/trace';
import { traceViewerFixtures } from '../config/traceViewerFixtures';
import type { TraceViewerFixtures } from '../config/traceViewerFixtures';
import { expect, playwrightTest } from '../config/browserTest';
import { parseTrace, parseTraceRaw } from '../config/utils';

const { formatWallTime, TraceLoader, TraceModel, wallTimeForMonotonicTime } = iso;
type TraceModel = InstanceType<typeof TraceModel>;
type TraceLoaderBackend = isoType.TraceLoaderBackend;

const test = playwrightTest.extend<TraceViewerFixtures>(traceViewerFixtures);
test.skip(({ trace }) => trace === 'on');
test.skip(process.env.PW_CLOCK === 'frozen');
test.slow();
const wallTime = Date.UTC(2024, 0, 2, 21, 42, 18);

function modernTrace(name: string, anchorWallTime: number, anchorMonotonicTime: number, frameWallTimes?: [number, number]): TraceEvent[] {
  const callId = `call-${name}`;
  const pageId = `page-${name}`;
  return [
    { type: 'context-options', version: 10, origin: 'library', browserName: 'chromium', platform: 'test', wallTime: anchorWallTime, monotonicTime: anchorMonotonicTime, options: {} },
    { type: 'before', callId, startTime: anchorMonotonicTime + 50, title: `Click ${name}`, class: 'Page', method: 'click', params: {} },
    { type: 'screenshot', callId, pageId, phase: 'action', timestamp: anchorMonotonicTime + 100, file: 'screenshots/action.png' },
    { type: 'screencast-frame', pageId, timestamp: anchorMonotonicTime + 100, frameSwapWallTime: frameWallTimes?.[0], file: 'screencast/frame.png', width: 192, height: 192 },
    { type: 'screencast-frame', pageId, timestamp: anchorMonotonicTime + 450, frameSwapWallTime: frameWallTimes?.[1], file: 'screencast/frame2.png', width: 192, height: 192 },
    { type: 'after', callId, endTime: anchorMonotonicTime + 600 },
  ];
}

function legacyTrace(version: 3 | 4, actionWallTime?: number): object[] {
  const context = { type: 'context-options', version, browserName: 'chromium', platform: 'test', wallTime, options: {} };
  const frame = { type: 'screencast-frame', pageId: 'old-page', sha1: 'frame.png', timestamp: 1100, width: 192, height: 192 };
  if (version === 3) {
    return [
      context,
      { type: 'action', metadata: { id: 'old-call', type: 'Page', method: 'click', params: {}, startTime: 1050, endTime: 1600, wallTime: actionWallTime, log: [], snapshots: [] } },
      frame,
    ];
  }
  return [
    context,
    { type: 'before', callId: 'old-call', startTime: 1050, apiName: 'page.click', class: 'Page', method: 'click', params: {}, wallTime: actionWallTime },
    frame,
    { type: 'after', callId: 'old-call', endTime: 1600, log: [] },
  ];
}

async function loadModel(files: Record<string, object[]>): Promise<TraceModel> {
  const contents = new Map(Object.entries(files).map(([name, events]) => [name, events.map(event => JSON.stringify(event)).join('\n')]));
  const backend: TraceLoaderBackend = {
    entryNames: async () => [...contents.keys()],
    hasEntry: async name => contents.has(name),
    readText: async name => contents.get(name),
    readBlob: async () => undefined,
    isLive: () => false,
  };
  const loader = new TraceLoader();
  await loader.load(backend);
  return new TraceModel('trace', loader.contextEntries);
}

async function writeViewerTrace(testInfo: TestInfo, events: object[]): Promise<string> {
  const dir = testInfo.outputPath('trace');
  await Promise.all(['resources', 'screenshots', 'screencast'].map(name => fs.promises.mkdir(path.join(dir, name), { recursive: true })));
  const image = path.join(__dirname, '..', 'assets', 'stress', 'logo192.png');
  await Promise.all([
    fs.promises.writeFile(path.join(dir, 'trace.trace'), events.map(event => JSON.stringify(event)).join('\n')),
    ...[['resources', 'frame.png'], ['screenshots', 'action.png'], ['screencast', 'frame.png'], ['screencast', 'frame2.png']]
        .map(parts => fs.promises.copyFile(image, path.join(dir, ...parts))),
  ]);
  return dir;
}

async function writeTraceWithBriefFrame(testInfo: TestInfo): Promise<string> {
  const events = modernTrace('first', wallTime, 1000, [wallTime + 73, wallTime + 420]);
  const firstFrameIndex = events.findIndex(event => event.type === 'screencast-frame');
  events.splice(firstFrameIndex + 1, 0,
      { type: 'screencast-frame', pageId: 'page-first', timestamp: 1110, frameSwapWallTime: wallTime + 111, file: 'screencast/pending.png', width: 192, height: 192 },
      { type: 'screencast-frame', pageId: 'page-first', timestamp: 1120, frameSwapWallTime: wallTime + 112, file: 'screencast/frame.png', width: 192, height: 192 });
  const trace = await writeViewerTrace(testInfo, events);
  await fs.promises.copyFile(path.join(trace, 'screencast', 'frame.png'), path.join(trace, 'screencast', 'pending.png'));
  return trace;
}

async function delayImage(page: Page, fileName: string) {
  const delayed = { requested: false, release: () => {} };
  const release = new Promise<void>(resolve => delayed.release = resolve);
  await page.context().route(url => url.searchParams.get('path')?.endsWith(fileName) ?? false, async route => {
    delayed.requested = true;
    await release;
    await route.continue();
  });
  return delayed;
}

test('TV-138 maps events using their own context clocks', async () => {
  const model = await loadModel({
    'first.trace': modernTrace('first', wallTime, 1000, [wallTime + 73, wallTime + 420]),
    'second.trace': modernTrace('second', wallTime + 5000, 4000),
  });
  const firstFrame = model.pages.find(page => page.pageId === 'page-first')!.screencastFrames[0];
  const secondFrame = model.pages.find(page => page.pageId === 'page-second')!.screencastFrames[0];

  expect(model.frameWallTime(firstFrame)).toBe(wallTime + 73);
  expect(model.frameWallTime(secondFrame)).toBe(wallTime + 5100);
  expect(model.screenshotWallTime(model.screenshotForCall('call-first', 'action')!)).toBe(wallTime + 100);
  expect(model.screenshotWallTime(model.screenshotForCall('call-second', 'action')!)).toBe(wallTime + 5100);
  expect(model.timelineWallTime(1100)).toBeUndefined();
});

test('TV-139 preserves timestamps when runner and library clocks are aligned', async () => {
  const runnerEvents: TraceEvent[] = [
    { type: 'context-options', version: 10, origin: 'testRunner', browserName: '', platform: 'test', wallTime: wallTime + 300, monotonicTime: 20000, options: {} },
    { type: 'before', callId: 'call-first', startTime: 20050, title: 'Click first', class: 'Page', method: 'click', params: {} },
    { type: 'after', callId: 'call-first', endTime: 20600 },
  ];
  const model = await loadModel({
    'library.trace': modernTrace('first', wallTime, 1000),
    'runner.trace': runnerEvents,
  });
  const frame = model.pages[0].screencastFrames[0];

  expect(model.frameWallTime(frame)).toBe(wallTime + 100);
  expect(model.screenshotWallTime(model.screenshotForCall('call-first', 'action')!)).toBe(wallTime + 100);
  expect(model.actionWallTime(model.actions[0])).toBe(wallTime + 350);
  expect(model.timelineWallTime(frame.timestamp)).toBe(wallTime + 100);
});

test('TV-140 uses an action clock anchor in older traces', async () => {
  for (const version of [3, 4] as const) {
    const model = await loadModel({ 'old.trace': legacyTrace(version, wallTime + 50) });
    expect(model.frameWallTime(model.pages[0].screencastFrames[0])).toBe(wallTime + 100);
    expect(model.actionWallTime(model.actions[0])).toBe(wallTime + 50);
  }
});

test('TV-141 does not use a synthesized clock for older traces', async () => {
  const model = await loadModel({ 'old.trace': legacyTrace(3) });
  expect(model.frameWallTime(model.pages[0].screencastFrames[0])).toBeUndefined();
  expect(model.actionWallTime(model.actions[0])).toBeUndefined();
  expect(model.timelineWallTime(1100)).toBeUndefined();
  expect(model.traceStartWallTime).toBe(wallTime);

  const [context, ...events] = legacyTrace(3);
  const withoutRecordedTime = await loadModel({ 'old.trace': [{ ...context, wallTime: undefined }, ...events] });
  expect(withoutRecordedTime.traceStartWallTime).toBeUndefined();
});

test('TV-142 uses an actual frame wall time without a context anchor', async () => {
  const [context, ...events] = modernTrace('first', wallTime, 1000, [wallTime + 73, wallTime + 420]);
  const model = await loadModel({ 'trace.trace': [{ ...context, monotonicTime: undefined }, ...events] });
  expect(model.frameWallTime(model.pages[0].screencastFrames[0])).toBe(wallTime + 73);
  expect(model.screenshotWallTime(model.screenshotForCall('call-first', 'action')!)).toBeUndefined();
  expect(model.timelineWallTime(1100)).toBeUndefined();
});

test('TV-143 formats UTC wall times with millisecond precision', () => {
  expect(formatWallTime(wallTime + 372, 'utc')).toBe('21:42:18.372Z');
  expect(formatWallTime(Date.UTC(100000, 0, 1, 0, 0, 0, 1), 'utc')).toBe('00:00:00.001Z');
  expect(formatWallTime(NaN, 'utc')).toBeUndefined();
});

test('TV-144 formats local wall times with millisecond precision', () => {
  const previousTimeZone = process.env.TZ;
  process.env.TZ = 'America/Los_Angeles';
  try {
    expect(formatWallTime(wallTime + 372, 'local')).toBe('13:42:18.372 PST');
  } finally {
    if (previousTimeZone === undefined)
      delete process.env.TZ;
    else
      process.env.TZ = previousTimeZone;
  }
});

test('TV-145 switches independent timestamp settings and time zones without reloading', async ({ showTraceViewer }, testInfo) => {
  const trace = await writeViewerTrace(testInfo, modernTrace('first', wallTime, 1000, [wallTime + 73, wallTime + 420]));
  const viewer = await showTraceViewer(trace);
  const cdp = await viewer.page.context().newCDPSession(viewer.page);
  await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'America/Los_Angeles' });
  await expect(viewer.page.locator('.aria-mode-screenshot img')).toBeVisible();
  await viewer.showSettings();
  const screenshotSetting = viewer.settingsDialog.getByLabel('Display snapshot timestamp');
  const timelineSetting = viewer.settingsDialog.getByLabel('Display timeline timestamp');
  const zoneSetting = viewer.settingsDialog.getByLabel('Time zone');
  const screenshot = viewer.page.locator('.aria-mode-screenshot').getByTestId('snapshot-timestamp');
  const timeline = viewer.page.getByTestId('timeline-timestamp');

  await expect(screenshotSetting).not.toBeChecked();
  await expect(timelineSetting).not.toBeChecked();
  await expect(zoneSetting).toHaveValue('local');
  await zoneSetting.selectOption('utc');
  await expect(screenshot).toHaveCount(0);
  await expect(timeline).toHaveCount(0);
  await screenshotSetting.check();
  await expect(screenshot).toHaveText('21:42:18.100Z');
  await expect(timeline).toHaveCount(0);
  await timelineSetting.check();
  await expect(timeline).toHaveText('21:42:18.050Z');
  await screenshotSetting.uncheck();
  await expect(screenshot).toHaveCount(0);
  await expect(timeline).toHaveText('21:42:18.050Z');
  await screenshotSetting.check();

  let navigations = 0;
  viewer.page.on('framenavigated', frame => {
    if (frame === viewer.page.mainFrame())
      ++navigations;
  });
  await zoneSetting.selectOption('local');
  await expect(screenshot).toHaveText('13:42:18.100 PST');
  await expect(timeline).toHaveText('13:42:18.050 PST');
  expect(navigations).toBe(0);

  await viewer.page.reload();
  await expect(viewer.page.locator('.aria-mode-screenshot').getByTestId('snapshot-timestamp')).toHaveText('13:42:18.100 PST');
  await expect(viewer.page.getByTestId('timeline-timestamp')).toHaveText('13:42:18.050 PST');
});

test('TV-146 uses the displayed frame time while scrubbing', async ({ showTraceViewer }, testInfo) => {
  const trace = await writeViewerTrace(testInfo, modernTrace('first', wallTime, 1000, [wallTime + 73, wallTime + 420]));
  const viewer = await showTraceViewer(trace);
  await viewer.showSettings();
  await viewer.settingsDialog.getByLabel('Time zone').selectOption('utc');
  await viewer.settingsDialog.getByLabel('Display snapshot timestamp').check();
  await viewer.settingsDialog.getByLabel('Display timeline timestamp').check();
  await viewer.showSettings();

  const slider = viewer.page.getByRole('slider', { name: 'Playback position' });
  const rect = (await slider.boundingBox())!;
  await viewer.page.mouse.move(rect.x + rect.width * 0.3, rect.y + rect.height / 2);
  await viewer.page.mouse.down();
  const screenshot = viewer.page.locator('.aria-mode-screenshot').getByTestId('snapshot-timestamp');
  const timeline = viewer.page.getByTestId('timeline-timestamp');
  await expect(screenshot).toHaveText('21:42:18.073Z');
  await expect(timeline).toHaveText('21:42:18.073Z');

  await viewer.page.mouse.move(rect.x + rect.width * 0.85, rect.y + rect.height / 2);
  await expect(screenshot).toHaveText('21:42:18.420Z');
  await expect(timeline).toHaveText('21:42:18.420Z');
  await viewer.page.mouse.up();
  await expect(screenshot).toHaveText('21:42:18.100Z');
  await expect(timeline).toHaveText('21:42:18.050Z');
});

test('TV-147 shows the hovered film strip frame time', async ({ showTraceViewer }, testInfo) => {
  const trace = await writeViewerTrace(testInfo, modernTrace('first', wallTime, 1000, [wallTime + 73, wallTime + 420]));
  const viewer = await showTraceViewer(trace);
  await viewer.showSettings();
  await viewer.settingsDialog.getByLabel('Time zone').selectOption('utc');
  await viewer.settingsDialog.getByLabel('Display snapshot timestamp').check();
  await viewer.showSettings();
  const strip = (await viewer.page.locator('.film-strip').boundingBox())!;
  const lane = (await viewer.page.locator('.film-strip-lane').boundingBox())!;
  await viewer.page.mouse.move(strip.x + strip.width * 0.3, lane.y + lane.height / 2);
  await expect(viewer.page.locator('.film-strip-hover').getByTestId('snapshot-timestamp')).toHaveText('21:42:18.073Z');
});

test('TV-148 keeps old traces usable without an absolute clock', async ({ showTraceViewer }, testInfo) => {
  const trace = await writeViewerTrace(testInfo, legacyTrace(3));
  const viewer = await showTraceViewer(trace);
  await expect(viewer.actionTitles).toContainText(['Page.click']);
  await viewer.showSettings();
  await viewer.settingsDialog.getByLabel('Display snapshot timestamp').check();
  await viewer.settingsDialog.getByLabel('Display timeline timestamp').check();
  await expect(viewer.page.getByTestId('timeline-timestamp')).toHaveCount(0);
  await viewer.showSettings();
  const slider = viewer.page.getByRole('slider', { name: 'Playback position' });
  const rect = (await slider.boundingBox())!;
  await viewer.page.mouse.move(rect.x + rect.width * 0.85, rect.y + rect.height / 2);
  await viewer.page.mouse.down();
  await expect(viewer.page.getByAltText('Screencast frame')).toBeVisible();
  await expect(viewer.page.getByTestId('snapshot-timestamp')).toHaveCount(0);
  await expect(viewer.page.locator('.timeline-time').first()).not.toBeEmpty();
  await viewer.page.mouse.up();
});

test('TV-149 displays screenshot timestamps from a recorded trace zip', async ({ runAndTrace, page }, testInfo) => {
  const viewer = await runAndTrace(async () => {
    await page.setContent('<button>Click me</button>');
    await page.locator('button').click();
  }, { snapshots: { dom: true, aria: true, screen: true } });
  await viewer.selectAction('Click');
  await viewer.showSettings();
  await viewer.displayAriaSetting.click();
  const image = viewer.page.locator('.aria-mode-screenshot img');
  await expect(image).toBeVisible();
  const imageBox = await image.boundingBox();
  await viewer.settingsDialog.getByLabel('Time zone').selectOption('utc');
  await viewer.settingsDialog.getByLabel('Display snapshot timestamp').check();

  const { model } = await parseTrace(testInfo.outputPath('trace.zip'));
  const action = model.actions.find(action => action.method === 'click')!;
  const screenshot = model.screenshotForCall(action.callId, 'action')!;
  const expected = formatWallTime(model.screenshotWallTime(screenshot), 'utc');
  expect(expected).toBeDefined();
  const overlay = viewer.page.locator('.aria-mode-screenshot').getByTestId('snapshot-timestamp');
  await expect(overlay).toHaveText(expected!);
  expect(await image.boundingBox()).toEqual(imageBox);
  const overlayBox = (await overlay.boundingBox())!;
  expect(overlayBox.x + overlayBox.width).toBeLessThanOrEqual(imageBox!.x + imageBox!.width + 1);
  expect(overlayBox.y + overlayBox.height).toBeLessThanOrEqual(imageBox!.y + imageBox!.height + 1);
});

test('TV-150 preserves millisecond precision in clock conversion', () => {
  const anchor = { wallTime, monotonicTime: 1000000.123456 };
  const converted = wallTimeForMonotonicTime(anchor, 1000001.123413);
  expect(formatWallTime(converted, 'utc')).toBe('21:42:18.001Z');
});

test('TV-151 keeps frame timestamps readable in a scaled snapshot', async ({ showTraceViewer }, testInfo) => {
  const events = modernTrace('first', wallTime, 1000, [wallTime + 73, wallTime + 420]).filter(event => event.type !== 'screenshot');
  const trace = await writeViewerTrace(testInfo, events);
  const viewer = await showTraceViewer(trace);
  await viewer.page.setViewportSize({ width: 900, height: 600 });
  await viewer.showSettings();
  await viewer.settingsDialog.getByLabel('Time zone').selectOption('utc');
  await viewer.settingsDialog.getByLabel('Display snapshot timestamp').check();
  await viewer.showSettings();
  const slider = viewer.page.getByRole('slider', { name: 'Playback position' });
  const rect = (await slider.boundingBox())!;
  await viewer.page.mouse.move(rect.x + rect.width * 0.3, rect.y + rect.height / 2);
  await viewer.page.mouse.down();
  const overlay = viewer.page.locator('.snapshot-switcher').getByTestId('snapshot-timestamp');
  await expect(overlay).toHaveText('21:42:18.073Z');
  expect((await overlay.boundingBox())!.height).toBeGreaterThanOrEqual(18);
  await viewer.page.mouse.up();
});

test('TV-152 switches metadata start time between local and UTC', async ({ showTraceViewer }, testInfo) => {
  const trace = await writeViewerTrace(testInfo, modernTrace('first', wallTime, 1000));
  const viewer = await showTraceViewer(trace);
  const cdp = await viewer.page.context().newCDPSession(viewer.page);
  await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'America/Los_Angeles' });
  await viewer.showMetadataTab();
  const startTime = viewer.metadataTab.locator('.datetime');
  await expect(startTime).toHaveText('1/2/2024, 1:42:18 PM PST');

  await viewer.showSettings();
  const zoneSetting = viewer.settingsDialog.getByLabel('Time zone');
  await zoneSetting.selectOption('utc');
  await expect(startTime).toHaveText('2024-01-02T21:42:18.000Z');
  await expect(startTime).toHaveAttribute('title', '2024-01-02T21:42:18.000Z');
  await zoneSetting.selectOption('local');
  await expect(startTime).toHaveText('1/2/2024, 1:42:18 PM PST');
});

test('TV-153 hides the timestamp while a replacement screenshot loads', async ({ showTraceViewer }, testInfo) => {
  const events: TraceEvent[] = [
    ...modernTrace('second', wallTime, 1000).map(event => event.type === 'screenshot' ? { ...event, file: 'screenshots/second.png' } : event),
    { type: 'before', callId: 'call-first', startTime: 1700, title: 'Click first', class: 'Page', method: 'click', params: {} },
    { type: 'screenshot', callId: 'call-first', pageId: 'page-second', phase: 'action', timestamp: 1800, file: 'screenshots/action.png' },
    { type: 'after', callId: 'call-first', endTime: 1900 },
  ];
  const trace = await writeViewerTrace(testInfo, events);
  await fs.promises.copyFile(path.join(trace, 'screenshots', 'action.png'), path.join(trace, 'screenshots', 'second.png'));
  const viewer = await showTraceViewer(trace);
  await viewer.selectAction('Click first');
  await viewer.showSettings();
  await viewer.settingsDialog.getByLabel('Time zone').selectOption('utc');
  await viewer.settingsDialog.getByLabel('Display snapshot timestamp').check();
  await viewer.showSettings();

  const screenshot = viewer.page.locator('.aria-mode-screenshot');
  const overlay = screenshot.getByTestId('snapshot-timestamp');
  await expect(overlay).toHaveText('21:42:18.800Z');
  const delayed = await delayImage(viewer.page, 'second.png');
  try {
    await viewer.selectAction('Click second');
    await expect.poll(() => delayed.requested).toBe(true);
    await expect(screenshot.getByAltText('Screenshot')).toHaveJSProperty('complete', false);
    await expect(overlay).toHaveCount(0);
  } finally {
    delayed.release();
  }
  await expect(overlay).toHaveText('21:42:18.100Z');
});

test('TV-154 hides the timestamp while a replacement screencast frame loads', async ({ showTraceViewer }, testInfo) => {
  const viewer = await showTraceViewer(await writeTraceWithBriefFrame(testInfo));
  await viewer.page.setViewportSize({ width: 900, height: 600 });
  await viewer.showSettings();
  await viewer.settingsDialog.getByLabel('Time zone').selectOption('utc');
  await viewer.settingsDialog.getByLabel('Display snapshot timestamp').check();
  await viewer.showSettings();

  const slider = viewer.page.getByRole('slider', { name: 'Playback position' });
  const rect = (await slider.boundingBox())!;
  await viewer.page.mouse.move(rect.x + rect.width * 0.17, rect.y + rect.height / 2);
  await viewer.page.mouse.down();
  const overlay = viewer.page.locator('.aria-mode-screenshot').getByTestId('snapshot-timestamp');
  await expect(overlay).toHaveText('21:42:18.073Z');
  const delayed = await delayImage(viewer.page, 'pending.png');
  try {
    await viewer.page.mouse.move(rect.x + rect.width * 0.183, rect.y + rect.height / 2);
    await expect.poll(() => delayed.requested).toBe(true);
    await expect(viewer.page.getByAltText('Screencast frame')).toHaveJSProperty('complete', false);
    await expect(overlay).toHaveCount(0);
  } finally {
    delayed.release();
  }
  await expect(overlay).toHaveText('21:42:18.111Z');
  await viewer.page.mouse.up();
});

test('TV-155 hides the timestamp while a film strip preview loads', async ({ showTraceViewer }, testInfo) => {
  const viewer = await showTraceViewer(await writeTraceWithBriefFrame(testInfo));
  await viewer.page.setViewportSize({ width: 900, height: 600 });
  await viewer.showSettings();
  await viewer.settingsDialog.getByLabel('Time zone').selectOption('utc');
  await viewer.settingsDialog.getByLabel('Display snapshot timestamp').check();
  await viewer.showSettings();

  const strip = (await viewer.page.locator('.film-strip').boundingBox())!;
  const lane = (await viewer.page.locator('.film-strip-lane').boundingBox())!;
  await viewer.page.mouse.move(strip.x + strip.width * 0.17, lane.y + lane.height / 2);
  const preview = viewer.page.locator('.film-strip-hover');
  const overlay = preview.getByTestId('snapshot-timestamp');
  await expect(overlay).toHaveText('21:42:18.073Z');
  const delayed = await delayImage(viewer.page, 'pending.png');
  try {
    await viewer.page.mouse.move(strip.x + strip.width * 0.183, lane.y + lane.height / 2);
    await expect.poll(() => delayed.requested).toBe(true);
    await expect(preview.locator('img')).toHaveJSProperty('complete', false);
    await expect(overlay).toHaveCount(0);
  } finally {
    delayed.release();
  }
  await expect(overlay).toHaveText('21:42:18.111Z');
});

test('TV-158 keeps the frame timestamp on a downscaled aria mode screencast frame', async ({ showTraceViewer }, testInfo) => {
  const events = modernTrace('first', wallTime, 1000, [wallTime + 73, wallTime + 420])
      .map(event => event.type === 'screencast-frame' ? { ...event, width: 384, height: 384 } : event);
  const viewer = await showTraceViewer(await writeViewerTrace(testInfo, events));
  await viewer.page.setViewportSize({ width: 1400, height: 1000 });
  await viewer.showSettings();
  await viewer.settingsDialog.getByLabel('Time zone').selectOption('utc');
  await viewer.settingsDialog.getByLabel('Display snapshot timestamp').check();
  await viewer.showSettings();

  const slider = viewer.page.getByRole('slider', { name: 'Playback position' });
  const rect = (await slider.boundingBox())!;
  await viewer.page.mouse.move(rect.x + rect.width * 0.3, rect.y + rect.height / 2);
  await viewer.page.mouse.down();
  const image = viewer.page.locator('.aria-mode-screenshot').getByAltText('Screencast frame');
  const overlay = viewer.page.locator('.aria-mode-screenshot').getByTestId('snapshot-timestamp');
  await expect(overlay).toHaveText('21:42:18.073Z');
  const imageBox = (await image.boundingBox())!;
  const overlayBox = (await overlay.boundingBox())!;
  expect(overlayBox.x + overlayBox.width).toBeLessThanOrEqual(imageBox.x + imageBox.width + 1);
  expect(overlayBox.y + overlayBox.height).toBeLessThanOrEqual(imageBox.y + imageBox.height + 1);
  await viewer.page.mouse.up();
});

test('TV-156 maps DOM snapshot timestamps with the recorded clock', async () => {
  const runnerEvents: TraceEvent[] = [
    { type: 'context-options', version: 10, origin: 'testRunner', browserName: '', platform: 'test', wallTime: wallTime + 300, monotonicTime: 20000, options: {} },
    { type: 'before', callId: 'call-first', startTime: 20050, title: 'Click first', class: 'Page', method: 'click', params: {} },
    { type: 'after', callId: 'call-first', endTime: 20600 },
  ];
  const libraryEvents: object[] = modernTrace('first', wallTime, 1000);
  libraryEvents.push({ type: 'frame-snapshot', snapshot: { callId: 'call-first', snapshotName: 'before@call-first', pageId: 'page-first', frameId: 'frame', frameUrl: 'about:blank', timestamp: 1075, wallTime: 0, collectionTime: 0, doctype: 'html', html: ['HTML', {}], resourceOverrides: [], viewport: { width: 800, height: 600 }, isMainFrame: true, phase: 'before' } });
  const model = await loadModel({ 'library.trace': libraryEvents, 'runner.trace': runnerEvents });

  expect(model.domSnapshotWallTime('call-first', 'before', 1075)).toBe(wallTime + 75);
  expect(model.domSnapshotWallTime('call-first', 'after', 1075)).toBeUndefined();
});

test('TV-157 displays DOM snapshot timestamps for each snapshot tab', async ({ runAndTrace, page }, testInfo) => {
  const viewer = await runAndTrace(async () => {
    await page.setContent('<button>Click me</button>');
    await page.locator('button').click();
  }, { snapshots: { dom: true } });
  await viewer.selectAction('Click');
  await viewer.showSettings();
  await viewer.settingsDialog.getByLabel('Time zone').selectOption('utc');
  await viewer.settingsDialog.getByLabel('Display snapshot timestamp').check();
  await viewer.showSettings();

  const { model } = await parseTrace(testInfo.outputPath('trace.zip'));
  const { events } = await parseTraceRaw(testInfo.outputPath('trace.zip'));
  const action = model.actions.find(action => action.method === 'click')!;
  const overlay = viewer.page.locator('.snapshot-switcher').getByTestId('snapshot-timestamp');
  for (const [tab, phase] of [['Before', 'before'], ['Action', 'action'], ['After', 'after']] as const) {
    const snapshot = events.find(event => event.type === 'frame-snapshot' && event.snapshot.callId === action.callId && event.snapshot.phase === phase && event.snapshot.isMainFrame).snapshot;
    const expected = formatWallTime(model.domSnapshotWallTime(action.callId, phase, snapshot.timestamp), 'utc');
    expect(expected).toBeDefined();
    await viewer.page.getByRole('tab', { name: tab, exact: true }).click();
    await expect(overlay).toHaveText(expected!);
  }
});

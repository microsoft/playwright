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
import { test, expect } from './crxTest';

type Tab = chrome.tabs.Tab;

test.skip(({ isCrx }) => !isCrx);

test('should work @smoke', async ({ crx }) => {
  const numPages = crx.pages().length;
  const newPage = await crx.newPage();
  expect(crx.pages()).toHaveLength(numPages + 1);
  let closed = false;
  newPage.once('close', () => {
    closed = true;
  });
  await newPage.close();
  expect(crx.pages()).toHaveLength(numPages);
  expect(closed).toBeTruthy();
});

test('should add attached page to context', async ({ crx }) => {
  const tab = await chrome.tabs.create({ url: 'about:blank' });
  const page = await crx.attach(tab.id!);
  expect(crx.pages()).toContain(page);
});

test('should remove detached page from context', async ({ crx }) => {
  const tab = await chrome.tabs.create({ url: 'about:blank' });
  const page = await crx.attach(tab.id!);
  await crx.detach(tab.id!);
  expect(crx.pages()).not.toContain(page);
});

test('should detach with page', async ({ crx }) => {
  const page = await crx.newPage();
  expect(crx.pages()).toContain(page);
  await crx.detach(page);
  expect(crx.pages()).not.toContain(page);
});

test('should create new page', async ({ crx, server }) => {
  const windowTabPromise = new Promise<Tab>(x => chrome.tabs.onCreated.addListener(x));
  const window = await chrome.windows.create();
  // wait for the default tab of the window to be created
  await windowTabPromise;

  // this will catch the tab created via crx
  const tabPromise = new Promise<Tab>(x => chrome.tabs.onCreated.addListener(x));
  const page = await crx.newPage({
    windowId: window.id,
    url: server.EMPTY_PAGE,
  });
  expect(crx.pages()).toContain(page);
  expect(page.url()).toBe(server.EMPTY_PAGE);

  const { id: tabId } = await tabPromise;
  const tab = await chrome.tabs.get(tabId);
  expect(tab.url).toBe(server.EMPTY_PAGE);
  expect(tab.windowId).toBe(window.id);
});

test('should attach with query url as string', async ({ crx, server }) => {
  await chrome.tabs.create({ url: server.EMPTY_PAGE });
  const [p1] = await crx.attachAll({
    url: server.EMPTY_PAGE
  });
  expect(p1).toBeTruthy();
});

test('should attach with query url as array of strings', async ({ crx, server }) => {
  await Promise.all([
    chrome.tabs.create({ url: server.EMPTY_PAGE }),
    chrome.tabs.create({ url: server.PREFIX + '/input/button.html' }),
    chrome.tabs.create({ url: 'about:blank' }),
  ]);
  const pages = await crx.attachAll({
    url: [server.EMPTY_PAGE, server.PREFIX + '/input/button.html'],
  });
  expect(pages).toHaveLength(2);
  const urls = pages.map(p => p.url());
  expect(urls).toContain(server.EMPTY_PAGE);
  expect(urls).toContain(server.PREFIX + '/input/button.html');
});

test('should attach matching pages', async ({ crx, server }) => {
  const { id: windowId } = await chrome.windows.create();
  await Promise.all([
    chrome.tabs.create({ url: server.EMPTY_PAGE }),
    chrome.tabs.create({ url: server.EMPTY_PAGE, windowId }),
    chrome.tabs.create({ url: 'about:blank', windowId }),
  ]);
  const pages = await crx.attachAll({
    url: server.EMPTY_PAGE
  });
  expect(pages).toHaveLength(2);
  const [p1, p2] = pages;
  expect(p1).toBeTruthy();
  expect(p2).toBeTruthy();
  expect(crx.pages()).toContain(p1);
  expect(crx.pages()).toContain(p2);
  expect(p1.url()).toBe(server.EMPTY_PAGE);
  expect(p2.url()).toBe(server.EMPTY_PAGE);
});

test('should attach popup pages', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(url => { window.open(url); }, server.EMPTY_PAGE),
  ]);
  expect(popup.url()).toBe(server.EMPTY_PAGE);
});

// if detached manually by the user (with canceled_by_user), it works.
// aparently, a chrome.debugger.onDetached event is not triggered if
// chrome.debugger.detached is called
test.fixme('should remove page if tab is externally detached', async ({ crx }) => {
  test.skip(true, '');
  const { id: tabId } = await chrome.tabs.create({ url: 'about:blank' });
  const page = await crx.attach(tabId!);
  expect(await page.evaluate(() => 42)).toBe(42);
  await new Promise<void>(x => chrome.debugger.detach({ tabId }, x));
  expect(crx.pages()).not.toContain(page);
});

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

import { contextTest } from '../../config/browserTest';
import type { Page, Worker } from 'playwright-core';
import * as path from 'path';
import type { CallLog, EventData, Source } from '../../../packages/recorder/src/recorderTypes';
import { expect } from '@playwright/test';
import { TimeoutError } from '../../../packages/playwright-core/src/common/errors';
export { expect } from '@playwright/test';

type Port = chrome.runtime.Port;
type PortDisconnectEvent = chrome.runtime.PortDisconnectEvent;
type PortMessageEvent = chrome.runtime.PortMessageEvent;

interface PortMock extends Port {
  emit(data: EventData): void;
  getMessage(method: RecorderMessage['method']): RecorderMessage;
}

type RecorderMessage = { type: 'recorder' } & (
  | { method: 'updateCallLogs', callLogs: CallLog[] }
  | { method: 'setPaused', paused: boolean }
  | { method: 'setMode', mode: 'none' | 'recording' | 'inspecting' }
  | { method: 'setSources', sources: Source[] }
  | { method: 'setFileIfNeeded', file: string }
  | { method: 'setSelector', selector: string, focus?: boolean }
);

declare global {
  let _mockPort: PortMock;
  function getPage(tabId: number): Promise<Page>;
  function _onAttach(tabId: number, port: Port, underTest?: boolean): Promise<void>;
}

type CrxTestArgs = {
  extensionServiceWorker: Worker;
  closeRecorder: () => Promise<void>;
  openRecorder: (options?: { testIdAttributeName: string }) => Promise<Recorder>;
};

async function waitFor<T>(f: () => Promise<T>, options?: { interval?: number, timeout?: number }) {
  const { interval, timeout } = { interval: 100, timeout: 5000, ...options };
  let result: T;
  let isTimeout = false;
  new Promise<void>(resolve => setTimeout(() => {
    isTimeout = true;
    resolve();
  }, timeout)).catch(() => {});
  while (!isTimeout && !(result = await f()))
    await new Promise(resolve => setTimeout(resolve, interval));

  if (isTimeout)
    throw new TimeoutError(`Timeout${timeout} ms.`);

  return result;
}

const codegenLang2Id: Map<string, string> = new Map([
  ['JSON', 'jsonl'],
  ['JavaScript', 'javascript'],
  ['Java', 'java'],
  ['Python', 'python'],
  ['Python Async', 'python-async'],
  ['Pytest', 'python-pytest'],
  ['C#', 'csharp'],
  ['C# NUnit', 'csharp-nunit'],
  ['C# MSTest', 'csharp-mstest'],
  ['Playwright Test', 'playwright-test'],
]);
const codegenLangId2lang = new Map([...codegenLang2Id.entries()].map(([lang, langId]) => [langId, lang]));

export const test = contextTest.extend<CrxTestArgs>({

  context: async ({ launchPersistent, headless }, run) => {
    const pathToExtension = path.join(__dirname, '../../../packages/playwright-core/lib/webpack/crx');
    const { context } = await launchPersistent({
      headless,
      args: [
        headless ? `--headless=new` : '',
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ]
    });

    await run(context);

    if (context)
      await context.close();
  },

  page: async ({ context }, use) => {
    // First time we are reusing the context, we should create the page.
    const [page] = context.pages();
    await use(page);
  },

  extensionServiceWorker: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');

    // wait for initialization
    await waitFor(() => worker.evaluate(() => !!chrome?.tabs?.query));

    await use(worker);
  },

  closeRecorder: async ({ context }, run) => {
    await run(async () => {
      // await toImpl(context).recorderAppForTest.close();
    });
  },

  openRecorder: async ({ page, extensionServiceWorker }, run) => {
    const tabId = await extensionServiceWorker.evaluate(async () => {
      // @ts-ignore
      const [{ id: tabId }] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });

      class EventMock<T extends (...args: any) => any> {
        listeners: Set<T> = new Set();
        addListener(callback: T) { this.listeners.add(callback); }
        removeListener(callback: T) { this.listeners.delete(callback); }
      }

      class PortMock implements Port {
        name: string;
        onMessage: PortMessageEvent & EventMock<(message: any, port: Port)  => void>;
        onDisconnect: PortDisconnectEvent & EventMock<(port: Port) => void>;
        disconnect: () => void;
        _messages: Map<RecorderMessage['method'], RecorderMessage> = new Map();

        constructor() {
          this.name = `playwright-devtools-page-${tabId}`;
          // @ts-ignore
          this.onMessage = new EventMock<(message: any, port: Port) => void>();
          // @ts-ignore
          this.onDisconnect = new EventMock<(port: Port) => void>();
        }

        postMessage(message: RecorderMessage) {
          this._messages.set(message.method, message);
        }

        emit(data: EventData) {
          this.onMessage.listeners.forEach(l => l({ type: 'recorderEvent', ...data }, this));
        }

        getMessage(method: RecorderMessage['method']): RecorderMessage {
          // @ts-ignore
          return this._messages.get(method);
        }
      }

      const port = new PortMock();
      await _onAttach(tabId, port, true);
      port.emit({ event: 'setMode', params: { mode: 'recording' } });

      _mockPort = port;

      return tabId;
    });
    expect(typeof tabId).toBe('number');

    await run(async (options?: { testIdAttributeName: string }) => {
      await extensionServiceWorker.evaluate(async ({ tabId, ...options }) => {
        const page = await getPage(tabId);
        await (page.context() as any)._enableRecorder({ language: 'javascript', mode: 'recording', ...options });
      }, { tabId, ...options });
      return new Recorder(page, extensionServiceWorker, tabId);
    });
  },
});

class Recorder {
  page: Page;
  extensionServiceWorker: Worker;
  tabId: number;
  _highlightCallback: Function;
  _highlightInstalled: boolean;
  _actionReporterInstalled: boolean;
  _actionPerformedCallback: Function;
  private _sources = new Map<string, Source>();

  constructor(page: Page, extensionServiceWorker: Worker, tabId: number) {
    this.page = page;
    this.tabId = tabId;
    this.extensionServiceWorker = extensionServiceWorker;
    this._highlightCallback = () => { };
    this._highlightInstalled = false;
    this._actionReporterInstalled = false;
    this._actionPerformedCallback = () => { };
  }

  async setContentAndWait(content: string, url: string = 'about:blank', frameCount: number = 1) {
    await this.setPageContentAndWait(this.page, content, url, frameCount);
  }

  async setPageContentAndWait(page: Page, content: string, url: string = 'about:blank', frameCount: number = 1) {
    let callback;
    const result = new Promise(f => callback = f);
    await page.goto(url);
    let msgCount = 0;
    const listener = msg => {
      if (msg.text() === 'Recorder script ready for test') {
        ++msgCount;
        if (msgCount === frameCount) {
          page.off('console', listener);
          callback();
        }
      }
    };
    page.on('console', listener);
    await Promise.all([
      result,
      page.setContent(content)
    ]);
  }

  async waitForOutput(file: string, text: string): Promise<Map<string, Source>> {
    if (!codegenLang2Id.has(file))
      throw new Error(`Unknown language: ${file}`);
    const sources = await waitFor(async () => {
      return await this.extensionServiceWorker.evaluate(params => {
        const msg = _mockPort.getMessage('setSources');
        const sources = msg?.method === 'setSources' ? msg.sources : undefined;
        const source = sources?.find(s => s.id === params.languageId);
        return source && source.text.includes(params.text) ? sources : null;
      }, { text, languageId: codegenLang2Id.get(file) });
    });
    for (const source of sources) {
      if (!codegenLangId2lang.has(source.id))
        throw new Error(`Unknown language: ${source.id}`);
      this._sources.set(codegenLangId2lang.get(source.id), source);
    }
    return this._sources;
  }

  sources(): Map<string, Source> {
    return this._sources;
  }

  async waitForHighlight(action: () => Promise<void>): Promise<string> {
    await this.page.$$eval('x-pw-highlight', els => els.forEach(e => e.remove()));
    await this.page.$$eval('x-pw-tooltip', els => els.forEach(e => e.remove()));
    await action();
    await this.page.locator('x-pw-highlight').waitFor();
    await this.page.locator('x-pw-tooltip').waitFor();
    await expect(this.page.locator('x-pw-tooltip')).not.toHaveText('');
    await expect(this.page.locator('x-pw-tooltip')).not.toHaveText(`locator('body')`);
    return this.page.locator('x-pw-tooltip').textContent();
  }

  async waitForActionPerformed(): Promise<{ hovered: string | null, active: string | null }> {
    let callback;
    const listener = async msg => {
      const prefix = 'Action performed for test: ';
      if (msg.text().startsWith(prefix)) {
        this.page.off('console', listener);
        const arg = JSON.parse(msg.text().substr(prefix.length));
        callback(arg);
      }
    };
    this.page.on('console', listener);
    return new Promise(f => callback = f);
  }

  async hoverOverElement(selector: string, options?: { position?: { x: number, y: number }}): Promise<string> {
    return await this.waitForHighlight(async () => {
      const box = await this.page.locator(selector).first().boundingBox();
      const offset = options?.position || { x: box.width / 2, y: box.height / 2 };
      await this.page.mouse.move(box.x + offset.x, box.y + offset.y);
    });
  }

  async trustedMove(selector: string) {
    const box = await this.page.locator(selector).first().boundingBox();
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  }

  async trustedClick() {
    await this.page.mouse.down();
    await this.page.mouse.up();
  }

  async focusElement(selector: string): Promise<string> {
    return this.waitForHighlight(() => this.page.focus(selector));
  }
}

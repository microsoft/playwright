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
import type { Page } from 'playwright-core';
import * as path from 'path';
import type { Source } from '../../../packages/recorder/src/recorderTypes';
import type { CommonFixtures, TestChildProcess } from '../../config/commonFixtures';
import { expect } from '@playwright/test';
export { expect } from '@playwright/test';

type CLITestArgs = {
  recorderPageGetter: () => Promise<Page>;
  closeRecorder: () => Promise<void>;
  openRecorder: () => Promise<Recorder>;
  runCLI: (args: string[], options?: { noAutoExit?: boolean }) => CLIMock;
};

const codegenLang2Id: Map<string, string> = new Map([
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

const playwrightToAutomateInspector = require('../../../packages/playwright-core/lib/inProcessFactory').createInProcessPlaywright();

export const test = contextTest.extend<CLITestArgs>({
  recorderPageGetter: async ({ context, toImpl, mode }, run, testInfo) => {
    process.env.PWTEST_RECORDER_PORT = String(10907 + testInfo.workerIndex);
    testInfo.skip(mode === 'service');
    await run(async () => {
      while (!toImpl(context).recorderAppForTest)
        await new Promise(f => setTimeout(f, 100));
      const wsEndpoint = toImpl(context).recorderAppForTest.wsEndpoint;
      const browser = await playwrightToAutomateInspector.chromium.connectOverCDP({ wsEndpoint });
      const c = browser.contexts()[0];
      return c.pages()[0] || await c.waitForEvent('page');
    });
  },

  closeRecorder: async ({ context, toImpl }, run) => {
    await run(async () => {
      await toImpl(context).recorderAppForTest.close();
    });
  },

  runCLI: async ({ childProcess, browserName, channel, headless, mode, launchOptions }, run, testInfo) => {
    process.env.PWTEST_RECORDER_PORT = String(10907 + testInfo.workerIndex);
    testInfo.skip(mode === 'service');

    let cli: CLIMock | undefined;
    await run((cliArgs, { noAutoExit } = {}) => {
      cli = new CLIMock(childProcess, browserName, channel, headless, cliArgs, launchOptions.executablePath, noAutoExit);
      return cli;
    });
    if (cli)
      await cli.exited.catch(() => {});
  },

  openRecorder: async ({ page, recorderPageGetter }, run) => {
    await run(async () => {
      await (page.context() as any)._enableRecorder({ language: 'javascript', mode: 'recording' });
      return new Recorder(page, await recorderPageGetter());
    });
  },
});

class Recorder {
  page: Page;
  _highlightCallback: Function;
  _highlightInstalled: boolean;
  _actionReporterInstalled: boolean;
  _actionPerformedCallback: Function;
  recorderPage: Page;
  private _sources = new Map<string, Source>();

  constructor(page: Page, recorderPage: Page) {
    this.page = page;
    this.recorderPage = recorderPage;
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
    const handle = await this.recorderPage.waitForFunction((params: { text: string, languageId: string }) => {
      const w = window as any;
      const source = (w.playwrightSourcesEchoForTest || []).find((s: Source) => s.id === params.languageId);
      return source && source.text.includes(params.text) ? w.playwrightSourcesEchoForTest : null;
    }, { text, languageId: codegenLang2Id.get(file) }, { timeout: 8000, polling: 300 });
    const sources: Source[] = await handle.jsonValue();
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
    return this.waitForHighlight(async () => {
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

class CLIMock {
  process: TestChildProcess;
  private waitForText: string;
  private waitForCallback: () => void;
  exited: Promise<void>;

  constructor(childProcess: CommonFixtures['childProcess'], browserName: string, channel: string | undefined, headless: boolean | undefined, args: string[], executablePath: string | undefined, noAutoExit: boolean | undefined) {
    const nodeArgs = [
      'node',
      path.join(__dirname, '..', '..', '..', 'packages', 'playwright-core', 'lib', 'cli', 'cli.js'),
      'codegen',
      ...args,
      `--browser=${browserName}`,
    ];
    if (channel)
      nodeArgs.push(`--channel=${channel}`);
    this.process = childProcess({
      command: nodeArgs,
      env: {
        PWTEST_CLI_IS_UNDER_TEST: '1',
        PWTEST_CLI_EXIT: !noAutoExit ? '1' : undefined,
        PWTEST_CLI_HEADLESS: headless ? '1' : undefined,
        PWTEST_CLI_EXECUTABLE_PATH: executablePath,
        DEBUG: (process.env.DEBUG ?? '') + ',pw:browser*',
      },
    });
    this.process.onOutput = () => {
      if (this.waitForCallback && this.process.output.includes(this.waitForText))
        this.waitForCallback();
    };
    this.exited = this.process.cleanExit();
  }

  async waitFor(text: string, timeout = 10_000): Promise<void> {
    if (this.process.output.includes(text))
      return Promise.resolve();
    this.waitForText = text;
    return new Promise((f, r) => {
      this.waitForCallback = f;
      if (timeout) {
        setTimeout(() => {
          r(new Error('Timed out waiting for text:\n' + text + '\n\nReceived:\n' + this.text()));
        }, timeout);
      }
    });
  }

  text() {
    return removeAnsiColors(this.process.output);
  }

  exit(signal: NodeJS.Signals | number) {
    this.process.process.kill(signal);
  }
}

function removeAnsiColors(input: string): string {
  const pattern = [
    '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
    '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))'
  ].join('|');
  return input.replace(new RegExp(pattern, 'g'), '');
}

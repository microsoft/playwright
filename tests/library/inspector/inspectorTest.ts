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
import type { Locator, Page } from 'playwright-core';
import { step } from '../../config/baseTest';
import * as path from 'path';
import type { Source } from '../../../packages/recorder/src/recorderTypes';
import type { CommonFixtures, TestChildProcess } from '../../config/commonFixtures';
import { stripAnsi } from '../../config/utils';
import { expect } from '@playwright/test';
import { nodePlatform } from '../../../packages/playwright-core/lib/server/utils/nodePlatform';
export { expect } from '@playwright/test';

type CLITestArgs = {
  recorderPageGetter: () => Promise<Page>;
  closeRecorder: () => Promise<void>;
  openRecorder: (options?: { testIdAttributeName: string }) => Promise<{ recorder: Recorder, page: Page }>;
  runCLI: (args: string[], options?: { autoExitWhen?: string }) => CLIMock;
};

const codegenLang2Id: Map<string, string> = new Map([
  ['JSON', 'jsonl'],
  ['JavaScript', 'javascript'],
  ['Java', 'java'],
  ['Java JUnit', 'java-junit'],
  ['Python', 'python'],
  ['Python Async', 'python-async'],
  ['Pytest', 'python-pytest'],
  ['C#', 'csharp'],
  ['C# NUnit', 'csharp-nunit'],
  ['C# MSTest', 'csharp-mstest'],
  ['Playwright Test', 'playwright-test'],
]);
const codegenLangId2lang = new Map([...codegenLang2Id.entries()].map(([lang, langId]) => [langId, lang]));

const playwrightToAutomateInspector = require('../../../packages/playwright-core/lib/inProcessFactory').createInProcessPlaywright(nodePlatform);

export const test = contextTest.extend<CLITestArgs>({
  recorderPageGetter: async ({ context, toImpl, mode }, run, testInfo) => {
    testInfo.skip(mode.startsWith('service'));
    await run(async () => {
      while (!toImpl(context).recorderAppForTest)
        await new Promise(f => setTimeout(f, 100));
      const wsEndpoint = toImpl(context).recorderAppForTest.wsEndpointForTest;
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
    testInfo.slow();
    testInfo.skip(mode.startsWith('service'));

    await run((cliArgs, { autoExitWhen } = {}) => {
      return new CLIMock(childProcess, {
        browserName,
        channel,
        headless,
        args: cliArgs,
        executablePath: launchOptions.executablePath,
        autoExitWhen,
      });
    });
  },

  openRecorder: async ({ context, recorderPageGetter }, use) => {
    await use(async options => {
      await (context as any)._enableRecorder({
        language: 'javascript',
        mode: 'recording',
        ...options
      });
      const page = await context.newPage();
      return { page, recorder: new Recorder(page, await recorderPageGetter()) };
    });
  },
});

export class Recorder {
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
    await page.goto(url);
    await Promise.all([
      result,
      page.setContent(content)
    ]);
  }

  async waitForOutput(file: string, text: string): Promise<Map<string, Source>> {
    return await test.step('waitForOutput', async () => {
      if (!codegenLang2Id.has(file))
        throw new Error(`Unknown language: ${file}`);
      await expect.poll(() => this.recorderPage.evaluate(languageId => {
        const sources = ((window as any).playwrightSourcesEchoForTest || []) as Source[];
        return sources.find(s => s.id === languageId)?.text || '';
      }, codegenLang2Id.get(file)), { timeout: 0 }).toContain(text);
      const sources: Source[] = await this.recorderPage.evaluate(() => (window as any).playwrightSourcesEchoForTest || []);
      for (const source of sources) {
        if (!codegenLangId2lang.has(source.id))
          throw new Error(`Unknown language: ${source.id}`);
        this._sources.set(codegenLangId2lang.get(source.id), source);
      }
      return this._sources;
    }, { box: true });
  }

  sources(): Map<string, Source> {
    return this._sources;
  }

  async text(file: string): Promise<string> {
    const sources: Source[] = await this.recorderPage.evaluate(() => (window as any).playwrightSourcesEchoForTest || []);
    for (const source of sources) {
      if (codegenLangId2lang.get(source.id) === file)
        return source.text;
    }
    return '';
  }

  async waitForHighlight(action: () => Promise<void>): Promise<string> {
    return await test.step('waitForHighlight', async () => {
      await this.page.$$eval('x-pw-highlight', els => els.forEach(e => e.remove()));
      await this.page.$$eval('x-pw-tooltip', els => els.forEach(e => e.remove()));
      await action();
      await this.page.locator('x-pw-highlight').waitFor();
      await this.page.locator('x-pw-tooltip').waitFor();
      await expect(this.page.locator('x-pw-tooltip')).not.toHaveText('');
      await expect(this.page.locator('x-pw-tooltip')).not.toHaveText(`locator('body')`);
      return this.page.locator('x-pw-tooltip').textContent();
    }, { box: true });
  }

  async waitForHighlightNoTooltip(action: () => Promise<void>): Promise<string> {
    await this.page.$$eval('x-pw-highlight', els => els.forEach(e => e.remove()));
    await action();
    await this.page.locator('x-pw-highlight').waitFor();
    return '';
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

  async hoverOverElement(selector: string, options?: { position?: { x: number, y: number }, omitTooltip?: boolean }): Promise<string> {
    return (options?.omitTooltip ? this.waitForHighlightNoTooltip : this.waitForHighlight).call(this, async () => {
      const box = await this.page.locator(selector).first().boundingBox();
      const offset = options?.position || { x: box.width / 2, y: box.height / 2 };
      await this.page.mouse.move(box.x + offset.x, box.y + offset.y);
    });
  }

  async trustedMove(selector: string | Locator) {
    const locator = typeof selector === 'string' ? this.page.locator(selector).first() : selector;
    const box = await locator.boundingBox();
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  }

  async trustedClick(options?: { button?: 'left' | 'right' | 'middle' }) {
    await this.page.mouse.down(options);
    await this.page.mouse.up(options);
  }

  async trustedPress(text: string) {
    await this.page.keyboard.press(text);
  }

  async trustedDblclick() {
    await this.page.mouse.down();
    await this.page.mouse.up();
    await this.page.mouse.down({ clickCount: 2 });
    await this.page.mouse.up();
  }

  async focusElement(selector: string): Promise<string> {
    return this.waitForHighlight(() => this.page.focus(selector));
  }
}

class CLIMock {
  process: TestChildProcess;

  constructor(childProcess: CommonFixtures['childProcess'], options: { browserName: string, channel: string | undefined, headless: boolean | undefined, args: string[], executablePath: string | undefined, autoExitWhen: string | undefined}) {
    const nodeArgs = [
      'node',
      path.join(__dirname, '..', '..', '..', 'packages', 'playwright-core', 'cli.js'),
      'codegen',
      ...options.args,
      `--browser=${options.browserName}`,
    ];
    if (options.channel)
      nodeArgs.push(`--channel=${options.channel}`);
    this.process = childProcess({
      command: nodeArgs,
      env: {
        PWTEST_CLI_AUTO_EXIT_WHEN: options.autoExitWhen,
        PWTEST_CLI_IS_UNDER_TEST: '1',
        PWTEST_CLI_HEADLESS: options.headless ? '1' : undefined,
        PWTEST_CLI_EXECUTABLE_PATH: options.executablePath,
        DEBUG: (process.env.DEBUG ?? '') + ',pw:browser*',
      },
    });
  }

  @step
  async waitFor(text: string): Promise<void> {
    await expect(() => {
      expect(this.text()).toContain(text);
    }).toPass();
  }

  @step
  async waitForCleanExit() {
    return this.process.cleanExit();
  }

  text() {
    return stripAnsi(this.process.output);
  }
}

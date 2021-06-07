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

import { contextTest } from '../config/browserTest';
import type { Page } from '../../index';
import * as path from 'path';
import type { Source } from '../../src/server/supplements/recorder/recorderTypes';
import { ChildProcess, spawn } from 'child_process';
import { chromium } from '../../index';
export { expect } from '../config/test-runner';

type CLITestArgs = {
  recorderPageGetter: () => Promise<Page>;
  closeRecorder: () => Promise<void>;
  openRecorder: () => Promise<Recorder>;
  runCLI: (args: string[]) => CLIMock;
};

export const test = contextTest.extend<CLITestArgs>({
  recorderPageGetter: async ({ context, toImpl, mode }, run, testInfo) => {
    process.env.PWTEST_RECORDER_PORT = String(10907 + testInfo.workerIndex);
    testInfo.skip(mode === 'service');
    await run(async () => {
      while (!toImpl(context).recorderAppForTest)
        await new Promise(f => setTimeout(f, 100));
      const wsEndpoint = toImpl(context).recorderAppForTest.wsEndpoint;
      const browser = await chromium.connectOverCDP({ wsEndpoint });
      const c = browser.contexts()[0];
      return c.pages()[0] || await c.waitForEvent('page');
    });
  },

  closeRecorder: async ({ context, toImpl }, run) => {
    await run(async () => {
      await toImpl(context).recorderAppForTest.close();
    });
  },

  runCLI: async ({ browserName, channel, headless, mode, executablePath }, run, testInfo) => {
    process.env.PWTEST_RECORDER_PORT = String(10907 + testInfo.workerIndex);
    testInfo.skip(mode === 'service');

    let cli: CLIMock | undefined;
    await run(cliArgs => {
      cli = new CLIMock(browserName, channel, headless, cliArgs, executablePath);
      return cli;
    });
    if (cli)
      await cli.exited;
  },

  openRecorder: async ({ page, recorderPageGetter }, run) => {
    await run(async () => {
      await (page.context() as any)._enableRecorder({ language: 'javascript', startRecording: true });
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
    const sources: Source[] = await this.recorderPage.evaluate((params: { text: string, file: string }) => {
      const w = window as any;
      return new Promise(f => {
        const poll = () => {
          const source = (w.playwrightSourcesEchoForTest || []).find((s: Source) => s.file === params.file);
          if (source && source.text.includes(params.text))
            f(w.playwrightSourcesEchoForTest);
          setTimeout(poll, 300);
        };
        poll();
      });
    }, { text, file });
    for (const source of sources)
      this._sources.set(source.file, source);
    return this._sources;
  }

  sources(): Map<string, Source> {
    return this._sources;
  }

  async waitForHighlight(action: () => Promise<void>): Promise<string> {
    let callback;
    const result = new Promise<string>(f => callback = f);
    const listener = async msg => {
      const prefix = 'Highlight updated for test: ';
      if (msg.text().startsWith(prefix)) {
        this.page.off('console', listener);
        callback(msg.text().substr(prefix.length));
      }
    };
    this.page.on('console', listener);
    const [ generatedSelector ] = await Promise.all([
      result,
      action()
    ]);
    return generatedSelector;
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

  async hoverOverElement(selector: string): Promise<string> {
    return this.waitForHighlight(() => this.page.dispatchEvent(selector, 'mousemove', { detail: 1 }));
  }

  async focusElement(selector: string): Promise<string> {
    return this.waitForHighlight(() => this.page.focus(selector));
  }
}

class CLIMock {
  private process: ChildProcess;
  private data: string;
  private waitForText: string;
  private waitForCallback: () => void;
  exited: Promise<void>;

  constructor(browserName: string, channel: string | undefined, headless: boolean | undefined, args: string[], executablePath: string | undefined) {
    this.data = '';
    const nodeArgs = [
      path.join(__dirname, '..', '..', 'lib', 'cli', 'cli.js'),
      'codegen',
      ...args,
      `--browser=${browserName}`,
    ];
    if (channel)
      nodeArgs.push(`--channel=${channel}`);
    this.process = spawn('node', nodeArgs, {
      env: {
        ...process.env,
        PWTEST_CLI_EXIT: '1',
        PWTEST_CLI_HEADLESS: headless ? '1' : undefined,
        PWTEST_CLI_EXECUTABLE_PATH: executablePath,
      },
      stdio: 'pipe'
    });
    this.process.stdout.on('data', data => {
      this.data = data.toString();
      if (this.waitForCallback && this.data.includes(this.waitForText))
        this.waitForCallback();
    });
    this.exited = new Promise((f, r) => {
      this.process.stderr.on('data', data => {
        console.error(data.toString());
      });
      this.process.on('exit', (exitCode, signal) => {
        if (exitCode)
          r(new Error(`Process failed with exit code ${exitCode}`));
        if (signal)
          r(new Error(`Process recieved signal: ${signal}`));
        f();
      });
    });
  }

  async waitFor(text: string): Promise<void> {
    if (this.data.includes(text))
      return Promise.resolve();
    this.waitForText = text;
    return new Promise(f => this.waitForCallback = f);
  }

  text() {
    return removeAnsiColors(this.data);
  }
}

function removeAnsiColors(input: string): string {
  const pattern = [
    '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
    '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))'
  ].join('|');
  return input.replace(new RegExp(pattern, 'g'), '');
}

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

import * as http from 'http';
import path from 'path';
import { ChildProcess, spawn } from 'child_process';
import { folio as baseFolio } from '../recorder.fixtures';
import type { BrowserType, Browser, Page } from '../..';
export { config } from 'folio';
import type { Source } from '../../src/server/supplements/recorder/recorderTypes';

type WorkerFixtures = {
  browserType: BrowserType<Browser>;
  browser: Browser;
  httpServer: httpServer;
};

type TestFixtures = {
  recorder: Recorder;
  runCLI: (args: string[]) => CLIMock;
};

export const fixtures = baseFolio.extend<TestFixtures, WorkerFixtures>();

fixtures.recorder.init(async ({ page, recorderPageGetter }, runTest) => {
  await (page.context() as any)._enableRecorder({ language: 'javascript', startRecording: true });
  const recorderPage = await recorderPageGetter();
  await runTest(new Recorder(page, recorderPage));
});

fixtures.httpServer.init(async ({testWorkerIndex}, runTest) => {
  let handler = (req: http.IncomingMessage, res: http.ServerResponse) => res.end();
  const port = 9907 + testWorkerIndex;
  const server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => handler(req, res)).listen(port);
  await runTest({
    setHandler: newHandler => handler = newHandler,
    PREFIX: `http://127.0.0.1:${port}`,
  });
  server.close();
}, { scope: 'worker' });

function removeAnsiColors(input: string): string {
  const pattern = [
    '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
    '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))'
  ].join('|');
  return input.replace(new RegExp(pattern, 'g'), '');
}

class Recorder {
  page: Page;
  _highlightCallback: Function
  _highlightInstalled: boolean
  _actionReporterInstalled: boolean
  _actionPerformedCallback: Function
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
    const frames = new Set<any>();
    await page.exposeBinding('_recorderScriptReadyForTest', (source, arg) => {
      frames.add(source.frame);
      if (frames.size === frameCount)
        callback(arg);
    });
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
    if (!this._highlightInstalled) {
      this._highlightInstalled = true;
      await this.page.exposeBinding('_highlightUpdatedForTest', (source, arg) => this._highlightCallback(arg));
    }
    const [ generatedSelector ] = await Promise.all([
      new Promise<string>(f => this._highlightCallback = f),
      action()
    ]);
    return generatedSelector;
  }

  async waitForActionPerformed(): Promise<{ hovered: string | null, active: string | null }> {
    if (!this._actionReporterInstalled) {
      this._actionReporterInstalled = true;
      await this.page.exposeBinding('_actionPerformedForTest', (source, arg) => this._actionPerformedCallback(arg));
    }
    return await new Promise(f => this._actionPerformedCallback = f);
  }

  async hoverOverElement(selector: string): Promise<string> {
    return this.waitForHighlight(() => this.page.dispatchEvent(selector, 'mousemove', { detail: 1 }));
  }

  async focusElement(selector: string): Promise<string> {
    return this.waitForHighlight(() => this.page.focus(selector));
  }
}

fixtures.runCLI.init(async ({ browserName, headful }, runTest) => {
  let cli: CLIMock;
  const cliFactory = (args: string[]) => {
    cli = new CLIMock(browserName, !headful, args);
    return cli;
  };
  await runTest(cliFactory);
  await cli.exited;
});

class CLIMock {
  private process: ChildProcess;
  private data: string;
  private waitForText: string;
  private waitForCallback: () => void;
  exited: Promise<void>;

  constructor(browserName: string, headless: boolean, args: string[]) {
    this.data = '';
    this.process = spawn('node', [
      path.join(__dirname, '..', '..', 'lib', 'cli', 'cli.js'),
      `--browser=${browserName}`,
      ...args
    ], {
      env: {
        ...process.env,
        PWCLI_EXIT_FOR_TEST: '1',
        PWCLI_HEADLESS_FOR_TEST: headless ? '1' : undefined,
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
        r(new Error(data));
      });
      this.process.on('exit', f);
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

interface httpServer {
  setHandler: (handler: http.RequestListener) => void
  PREFIX: string
}

export const folio = fixtures.build();

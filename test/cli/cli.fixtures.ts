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
import { Writable } from 'stream';
import * as path from 'path';
import { ChildProcess, spawn } from 'child_process';
import { folio as baseFolio } from '../fixtures';
import type { Page, BrowserType, Browser, BrowserContext } from '../..';
export { config } from 'folio';
import { RecorderController } from '../../src/cli/codegen/recorderController';
import { TerminalOutput } from '../../src/cli/codegen/outputs';
import { JavaScriptLanguageGenerator } from '../../src/cli/codegen/languages';
import { CodeGenerator } from '../../src/cli/codegen/codeGenerator';

type WorkerFixtures = {
  browserType: BrowserType<Browser>;
  browser: Browser;
  httpServer: httpServer;
};

type TestFixtures = {
  contextWrapper: { context: BrowserContext, output: WritableBuffer };
  recorder: Recorder;
  runCLI: (args: string[]) => CLIMock;
};

export const fixtures = baseFolio.extend<TestFixtures, WorkerFixtures>();

fixtures.contextWrapper.init(async ({ browser }, runTest) => {
  const context = await browser.newContext();
  const outputBuffer = new WritableBuffer();
  const output = new TerminalOutput(outputBuffer as any as Writable, 'javascript');
  const languageGenerator = new JavaScriptLanguageGenerator();
  const generator = new CodeGenerator('chromium', {}, {}, output, languageGenerator, undefined, undefined);
  new RecorderController(context, generator);
  await runTest({ context, output: outputBuffer });
  await context.close();
});

fixtures.recorder.init(async ({ contextWrapper }, runTest) => {
  const page = await contextWrapper.context.newPage();
  if (process.env.PWCONSOLE)
    page.on('console', console.log);
  await runTest(new Recorder(page, contextWrapper.output));
  await page.close();
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


fixtures.page.override(async ({ recorder }, runTest) => {
  await runTest(recorder.page);
});

function removeAnsiColors(input: string): string {
  const pattern = [
    '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
    '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))'
  ].join('|');
  return input.replace(new RegExp(pattern, 'g'), '');
}

class WritableBuffer {
  _data: string;
  private _callback: () => void;
  _text: string;

  constructor() {
    this._data = '';
  }

  write(chunk: string) {
    if (!chunk)
      return;
    if (chunk === '\u001B[F\u001B[2K') {
      const index = this._data.lastIndexOf('\n');
      this._data = this._data.substring(0, index);
      return;
    }
    this._data += chunk;
    if (this._callback && chunk.includes(this._text))
      this._callback();
  }

  _waitFor(text: string): Promise<void> {
    if (this._data.includes(text))
      return Promise.resolve();
    this._text = text;
    return new Promise(f => this._callback = f);
  }

  data() {
    return this._data;
  }

  text() {
    return removeAnsiColors(this.data());
  }
}

class Recorder {
  page: Page;
  _output: WritableBuffer;
  _highlightCallback: Function
  _highlightInstalled: boolean
  _actionReporterInstalled: boolean
  _actionPerformedCallback: Function

  constructor(page: Page, output: WritableBuffer) {
    this.page = page;
    this._output = output;
    this._highlightCallback = () => { };
    this._highlightInstalled = false;
    this._actionReporterInstalled = false;
    this._actionPerformedCallback = () => { };
  }

  async setContentAndWait(content: string, url: string = 'about:blank') {
    await this.setPageContentAndWait(this.page, content, url);
  }

  async setPageContentAndWait(page: Page, content: string, url: string = 'about:blank') {
    let callback;
    const result = new Promise(f => callback = f);
    await page.goto(url);
    await page.exposeBinding('_recorderScriptReadyForTest', (source, arg) => callback(arg));
    await Promise.all([
      result,
      page.setContent(content)
    ]);
  }

  async waitForOutput(text: string): Promise<void> {
    await this._output._waitFor(text);
  }

  output(): string {
    return this._output.text();
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

fixtures.runCLI.init(async ({  }, runTest) => {
  let cli: CLIMock;
  const cliFactory = (args: string[]) => {
    cli = new CLIMock(args);
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

  constructor(args: string[]) {
    this.data = '';
    this.process = spawn('node', [
      path.join(__dirname, '..', '..', 'lib', 'cli', 'cli.js'),
      ...args
    ], {
      env: {
        ...process.env,
        PWCLI_EXIT_FOR_TEST: '1'
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

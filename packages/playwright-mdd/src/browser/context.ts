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

import * as playwright from 'playwright';

import { callOnPageNoTrace, waitForCompletion } from './utils';
import { ManualPromise } from '../manualPromise';
import { tools } from './tools';
import { runTasks } from '../loop';

import type { ModalState, Tool, ToolActionResult } from './tool';

type PendingAction = {
  dialogShown: ManualPromise<void>;
};

type PageEx = playwright.Page & {
  _snapshotForAI: () => Promise<string>;
};

export class Context {
  readonly browser: playwright.Browser;
  readonly page: playwright.Page;
  readonly tools = tools;
  private _modalStates: ModalState[] = [];
  private _pendingAction: PendingAction | undefined;
  private _downloads: { download: playwright.Download, finished: boolean, outputFile: string }[] = [];
  private _codeCollector: string[] = [];

  constructor(browser: playwright.Browser, page: playwright.Page) {
    this.browser = browser;
    this.page = page;
  }

  static async create(): Promise<Context> {
    const browser = await playwright.chromium.launch({
      headless: false,
    });
    const context = await browser.newContext();
    const page = await context.newPage();
    return new Context(browser, page);
  }

  async close() {
    await this.browser.close();
  }

  modalStates(): ModalState[] {
    return this._modalStates;
  }

  setModalState(modalState: ModalState) {
    this._modalStates.push(modalState);
  }

  clearModalState(modalState: ModalState) {
    this._modalStates = this._modalStates.filter(state => state !== modalState);
  }

  modalStatesMarkdown(): string[] {
    const result: string[] = ['### Modal state'];
    if (this._modalStates.length === 0)
      result.push('- There is no modal state present');
    for (const state of this._modalStates) {
      const tool = this.tools.find(tool => tool.clearsModalState === state.type);
      result.push(`- [${state.description}]: can be handled by the "${tool?.schema.name}" tool`);
    }
    return result;
  }

  async runScript(tasks: string[]): Promise<{ code: string[] }> {
    await runTasks(this, tasks);
    return { code: this._codeCollector };
  }

  async beforeTask(task: string) {
    this._codeCollector.push('');
    this._codeCollector.push(`// ${task}`);
  }

  async runTool(tool: Tool, params: Record<string, unknown> | undefined): Promise<{ content: string }> {
    const toolResult = await tool.handle(this, tool.schema.inputSchema.parse(params || {}));
    const { code, action, waitForNetwork, captureSnapshot } = toolResult;
    const racingAction = action ? () => this._raceAgainstModalDialogs(action) : undefined;

    if (waitForNetwork)
      await waitForCompletion(this, async () => racingAction?.());
    else
      await racingAction?.();

    const result: string[] = [];

    if (this.modalStates().length) {
      result.push(...this.modalStatesMarkdown());
      return {
        content: result.join('\n'),
      };
    }

    if (this._downloads.length) {
      result.push('', '### Downloads');
      for (const entry of this._downloads) {
        if (entry.finished)
          result.push(`- Downloaded file ${entry.download.suggestedFilename()} to ${entry.outputFile}`);
        else
          result.push(`- Downloading file ${entry.download.suggestedFilename()} ...`);
      }
      result.push('');
    }

    result.push(
        `- Page URL: ${this.page.url()}`,
        `- Page Title: ${await this.title()}`
    );

    if (captureSnapshot && !this._javaScriptBlocked())
      result.push(await this._snapshot());

    this._codeCollector.push(...code);
    return { content: result.join('\n') };
  }

  async title(): Promise<string> {
    return await callOnPageNoTrace(this.page, page => page.title());
  }

  async waitForTimeout(time: number) {
    if (this._javaScriptBlocked()) {
      await new Promise(f => setTimeout(f, time));
      return;
    }

    await callOnPageNoTrace(this.page, page => {
      return page.evaluate(() => new Promise(f => setTimeout(f, 1000)));
    });
  }

  async waitForLoadState(state: 'load', options?: { timeout?: number }): Promise<void> {
    await callOnPageNoTrace(this.page, page => page.waitForLoadState(state, options).catch(() => {}));
  }

  async navigate(url: string) {
    const downloadEvent = callOnPageNoTrace(this.page, page => page.waitForEvent('download').catch(() => {}));
    try {
      await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    } catch (_e: unknown) {
      const e = _e as Error;
      const mightBeDownload =
        e.message.includes('net::ERR_ABORTED') // chromium
        || e.message.includes('Download is starting'); // firefox + webkit
      if (!mightBeDownload)
        throw e;
      // on chromium, the download event is fired *after* page.goto rejects, so we wait a lil bit
      const download = await Promise.race([
        downloadEvent,
        new Promise(resolve => setTimeout(resolve, 1000)),
      ]);
      if (!download)
        throw e;
    }

    // Cap load event to 5 seconds, the page is operational at this point.
    await this.waitForLoadState('load', { timeout: 5000 });
  }

  refLocator(params: { element: string, ref: string }): playwright.Locator {
    return this.page.locator(`aria-ref=${params.ref}`).describe(params.element);
  }

  private async _raceAgainstModalDialogs(action: () => Promise<ToolActionResult>): Promise<ToolActionResult> {
    this._pendingAction = {
      dialogShown: new ManualPromise(),
    };

    let result: ToolActionResult | undefined;
    try {
      await Promise.race([
        action().then(r => result = r),
        this._pendingAction.dialogShown,
      ]);
    } finally {
      this._pendingAction = undefined;
    }
    return result;
  }

  private _javaScriptBlocked(): boolean {
    return this._modalStates.some(state => state.type === 'dialog');
  }

  dialogShown(dialog: playwright.Dialog) {
    this.setModalState({
      type: 'dialog',
      description: `"${dialog.type()}" dialog with message "${dialog.message()}"`,
      dialog,
    });
    this._pendingAction?.dialogShown.resolve();
  }

  async downloadStarted(download: playwright.Download) {
    const entry = {
      download,
      finished: false,
      outputFile: this._outputFile(download.suggestedFilename())
    };
    this._downloads.push(entry);
    await download.saveAs(entry.outputFile);
    entry.finished = true;
  }

  private async _snapshot() {
    const snapshot = await callOnPageNoTrace(this.page, page => (page as PageEx)._snapshotForAI());
    return [
      `- Page Snapshot`,
      '```yaml',
      snapshot,
      '```',
    ].join('\n');
  }

  private _outputFile(filename: string) {
    return filename;
  }
}

/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as playwright from '../../..';
import * as util from 'util';
import { SnapshotRouter } from './snapshotRouter';
import { actionById, ActionEntry, ContextEntry, TraceModel } from './traceModel';
import type { PageSnapshot } from '../../trace/traceTypes';

const fsReadFileAsync = util.promisify(fs.readFile.bind(fs));
const fsWriteFileAsync = util.promisify(fs.writeFile.bind(fs));

export class ScreenshotGenerator {
  private _traceStorageDir: string;
  private _browserPromise: Promise<playwright.Browser>;
  private _traceModel: TraceModel;
  private _rendering = new Map<ActionEntry, Promise<Buffer | undefined>>();
  private _lock = new Lock(3);

  constructor(traceStorageDir: string, traceModel: TraceModel) {
    this._traceStorageDir = traceStorageDir;
    this._traceModel = traceModel;
    this._browserPromise = playwright.chromium.launch();
  }

  generateScreenshot(actionId: string): Promise<Buffer | undefined> {
    const { context, action } = actionById(this._traceModel, actionId);
    if (!action.action.snapshot)
      return Promise.resolve(undefined);
    if (!this._rendering.has(action)) {
      this._rendering.set(action, this._render(context, action).then(body => {
        this._rendering.delete(action);
        return body;
      }));
    }
    return this._rendering.get(action)!;
  }

  private async _render(contextEntry: ContextEntry, actionEntry: ActionEntry): Promise<Buffer | undefined> {
    const imageFileName = path.join(this._traceStorageDir, actionEntry.action.snapshot!.sha1 + '-screenshot.png');
    try {
      return await fsReadFileAsync(imageFileName);
    } catch (e) {
      // fall through
    }

    const { action } = actionEntry;
    const browser = await this._browserPromise;

    await this._lock.obtain();

    const page = await browser.newPage({
      viewport: contextEntry.created.viewportSize,
      deviceScaleFactor: contextEntry.created.deviceScaleFactor
    });

    try {
      const snapshotPath = path.join(this._traceStorageDir, action.snapshot!.sha1);
      let snapshot;
      try {
        snapshot = await fsReadFileAsync(snapshotPath, 'utf8');
      } catch (e) {
        console.log(`Unable to read snapshot at ${snapshotPath}`); // eslint-disable-line no-console
        return;
      }
      const snapshotObject = JSON.parse(snapshot) as PageSnapshot;
      const snapshotRouter = new SnapshotRouter(this._traceStorageDir);
      snapshotRouter.selectSnapshot(snapshotObject, contextEntry);
      page.route('**/*', route => snapshotRouter.route(route));
      const url = snapshotObject.frames[0].url;
      console.log('Generating screenshot for ' + action.action, snapshotObject.frames[0].url); // eslint-disable-line no-console
      await page.goto(url);

      const element = await page.$(action.selector || '*[__playwright_target__]');
      if (element) {
        await element.evaluate(e => {
          e.style.backgroundColor = '#ff69b460';
        });
      }
      const imageData = await page.screenshot();
      await fsWriteFileAsync(imageFileName, imageData);
      return imageData;
    } catch (e) {
      console.log(e); // eslint-disable-line no-console
    } finally {
      await page.close();
      this._lock.release();
    }
  }
}

class Lock {
  private _maxWorkers: number;
  private _callbacks: (() => void)[] = [];
  private _workers = 0;

  constructor(maxWorkers: number) {
    this._maxWorkers = maxWorkers;
  }

  async obtain() {
    while (this._workers === this._maxWorkers)
      await new Promise(f => this._callbacks.push(f));
    ++this._workers;
  }

  release() {
    --this._workers;
    const callbacks = this._callbacks;
    this._callbacks = [];
    for (const callback of callbacks)
      callback();
  }
}

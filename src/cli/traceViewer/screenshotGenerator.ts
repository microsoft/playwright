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
import * as util from 'util';
import { SnapshotRouter } from './snapshotRouter';
import { actionById, ActionEntry, ContextEntry, TraceModel } from './traceModel';
import type { PageSnapshot } from '../../trace/traceTypes';
import type { Browser } from '../../..';

import * as inprocess from '../../inprocess';
const playwright = inprocess as typeof import('../../..');

const fsReadFileAsync = util.promisify(fs.readFile.bind(fs));
const fsWriteFileAsync = util.promisify(fs.writeFile.bind(fs));

export class ScreenshotGenerator {
  private _traceStorageDir: string;
  private _browserPromise: Promise<Browser> | undefined;
  private _traceModel: TraceModel;
  private _rendering = new Map<ActionEntry, Promise<Buffer | undefined>>();

  constructor(traceStorageDir: string, traceModel: TraceModel) {
    this._traceStorageDir = traceStorageDir;
    this._traceModel = traceModel;
  }

  async generateScreenshot(actionId: string): Promise<Buffer | undefined> {
    const { context, action } = actionById(this._traceModel, actionId);
    if (!action.action.snapshot)
      return;
    const imageFileName = path.join(this._traceStorageDir, action.action.snapshot.sha1 + '-thumbnail.png');

    let body: Buffer | undefined;
    try {
      body = await fsReadFileAsync(imageFileName);
    } catch (e) {
      if (!this._rendering.has(action)) {
        this._rendering.set(action, this._render(context, action, imageFileName).then(body => {
          this._rendering.delete(action);
          return body;
        }));
      }
      body = await this._rendering.get(action)!;
    }
    return body;
  }

  private _browser() {
    if (!this._browserPromise)
      this._browserPromise = playwright.chromium.launch();
    return this._browserPromise;
  }

  private async _render(contextEntry: ContextEntry, actionEntry: ActionEntry, imageFileName: string): Promise<Buffer | undefined> {
    const { action } = actionEntry;
    const browser = await this._browser();
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

      let clip: any = undefined;
      const element = await page.$(action.selector || '*[__playwright_target__]');
      if (element) {
        await element.evaluate(e => {
          e.style.backgroundColor = '#ff69b460';
        });

        clip = await element.boundingBox() || undefined;
        if (clip) {
          const thumbnailSize = {
            width: 400,
            height: 200
          };
          const insets = {
            width: 60,
            height: 30
          };
          clip.width = Math.min(thumbnailSize.width, clip.width);
          clip.height = Math.min(thumbnailSize.height, clip.height);
          if (clip.width < thumbnailSize.width) {
            clip.x -= (thumbnailSize.width - clip.width) / 2;
            clip.x = Math.max(0, clip.x);
            clip.width = thumbnailSize.width;
          } else {
            clip.x = Math.max(0, clip.x - insets.width);
          }
          if (clip.height < thumbnailSize.height) {
            clip.y -= (thumbnailSize.height - clip.height) / 2;
            clip.y = Math.max(0, clip.y);
            clip.height = thumbnailSize.height;
          } else {
            clip.y = Math.max(0, clip.y - insets.height);
          }
        }
      }

      const imageData = await page.screenshot({ clip });
      await fsWriteFileAsync(imageFileName, imageData);
      return imageData;
    } catch (e) {
      console.log(e); // eslint-disable-line no-console
    } finally {
      await page.close();
    }
  }
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as fs from 'fs';
import { Page } from './Page';
import { assert, helper, debugError } from '../helper';
import { Protocol } from './protocol';
import * as dom from '../dom';
import * as types from '../types';

const writeFileAsync = helper.promisify(fs.writeFile);

export class Screenshotter {
  private _queue = new TaskQueue();

  async screenshotPage(page: Page, options: types.ScreenshotOptions = {}): Promise<Buffer | string> {
    const format = helper.validateScreeshotOptions(options);
    assert(format === 'png', 'Only png format is supported');
    return this._queue.postTask(async () => {
      const params: Protocol.Page.snapshotRectParameters = { x: 0, y: 0, width: 800, height: 600, coordinateSystem: 'Page' };
      if (options.fullPage) {
        const pageSize = await page.evaluate(() =>
          ({
            width: document.body.scrollWidth,
            height: document.body.scrollHeight
          }));
        Object.assign(params, pageSize);
      } else if (options.clip) {
        Object.assign(params, options.clip);
      } else if (page.viewport()) {
        Object.assign(params, page.viewport());
      }
      const [, result] = await Promise.all([
        page.browser()._activatePage(page),
        page._session.send('Page.snapshotRect', params),
      ]).catch(e => {
        debugError('Failed to take screenshot: ' + e);
        throw e;
      });
      const prefix = 'data:image/png;base64,';
      const buffer = Buffer.from(result.dataURL.substr(prefix.length), 'base64');
      if (options.path)
        await writeFileAsync(options.path, buffer);
      return buffer;
    });
  }

  async screenshotElement(page: Page, handle: dom.ElementHandle, options: types.ScreenshotOptions = {}): Promise<string | Buffer> {
    const format = helper.validateScreeshotOptions(options);
    assert(format === 'png', 'Only png format is supported');
    return this._queue.postTask(async () => {
      const objectId = (handle._remoteObject as Protocol.Runtime.RemoteObject).objectId;
      page._session.send('DOM.getDocument');
      const {nodeId} = await page._session.send('DOM.requestNode', {objectId});
      const [, result] = await Promise.all([
        page.browser()._activatePage(page),
        page._session.send('Page.snapshotNode', {nodeId})
      ]).catch(e => {
        debugError('Failed to take screenshot: ' + e);
        throw e;
      });
      const prefix = 'data:image/png;base64,';
      const buffer = Buffer.from(result.dataURL.substr(prefix.length), 'base64');
      if (options.path)
        await writeFileAsync(options.path, buffer);
      return buffer;
    });
  }
}

class TaskQueue {
  private _chain: Promise<any>;

  constructor() {
    this._chain = Promise.resolve();
  }

  postTask(task: () => any): Promise<any> {
    const result = this._chain.then(task);
    this._chain = result.catch(() => {});
    return result;
  }
}

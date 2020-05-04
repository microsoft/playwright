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

import { BrowserContextBase } from '../browserContext';
import { Page } from '../page';
import { Events } from '../events';
import * as network from '../network';
import * as types from '../types';
import { helper, RegisteredListener } from '../helper';
import { TraceController } from './traceController';
import { SavedResource, resourceReferences, captureSnapshot } from './snapshotter';
import { Progress } from '../progress';

export type ContextCreatedTraceEvent = {
  type: 'context-created',
  browserId: string,
  contextId: string,
  deviceScaleFactor: number,
  isMobile: boolean,
  viewportSize?: types.Size,
};

export type ContextDestroyedTraceEvent = {
  type: 'context-destroyed',
  contextId: string,
};

export type NetworkResponseTraceEvent = {
  type: 'resource',
  contextId: string,
  resourceId: string,
  url: string,
  contentType: string,
  responseHeaders: types.Headers,
  sha1: string,
};

export type SnapshotTraceEvent = {
  type: 'snapshot',
  contextId: string,
  label: string,
  sha1: string,
};

let contextCounter = 0;
let resourceCounter = 0;

export class BrowserContextTracer {
  private _controller: TraceController;
  private _context: BrowserContextBase;
  private _contextId: string;
  private _contextEventPromise: Promise<void>;
  private _eventListeners: RegisteredListener[];
  private _resources = new Set<SavedResource>();

  constructor(controller: TraceController, browserId: string, context: BrowserContextBase) {
    this._controller = controller;
    this._context = context;
    this._contextId = 'context' + (++contextCounter);
    this._eventListeners = [
      helper.addEventListener(this._context, Events.BrowserContext.Page, this._onPage.bind(this)),
    ];

    const event: ContextCreatedTraceEvent = {
      type: 'context-created',
      browserId,
      contextId: this._contextId,
      isMobile: !!this._context._options.isMobile,
      deviceScaleFactor: this._context._options.deviceScaleFactor || 1,
      viewportSize: this._context._options.viewport || undefined,
    };
    this._contextEventPromise = controller.appendTraceEvent(event);
  }

  async dispose() {
    helper.removeEventListeners(this._eventListeners);
    this._resources.clear();

    const event: ContextDestroyedTraceEvent = {
      type: 'context-destroyed',
      contextId: this._contextId,
    };
    await this.appendTraceEvent(event);
  }

  async captureSnapshot(progress: Progress, page: Page, label: string): Promise<void> {
    const snapshot = await captureSnapshot(
        progress,
        () => this._resources,
        async (buffer: Buffer) => {
          const sha1 = helper.sha1(buffer);
          await this._controller.writeArtifact(sha1, buffer);
          return sha1;
        },
        page);
    if (!snapshot)
      return;
    const buffer = Buffer.from(JSON.stringify(snapshot));
    const sha1 = helper.sha1(buffer);
    await this._controller.writeArtifact(sha1, buffer);
    const snapshotEvent: SnapshotTraceEvent = {
      type: 'snapshot',
      contextId: this._contextId,
      label,
      sha1,
    };
    await this.appendTraceEvent(snapshotEvent);
  }

  private _onPage(page: Page) {
    this._eventListeners.push(helper.addEventListener(page, Events.Page.Response, (response: network.Response) => {
      this._saveResource(response).catch(e => {
        this._controller.logError(e, `save "${response.url()}"`);
      });
    }));
  }

  private async _saveResource(response: network.Response) {
    const isRedirect = response.status() >= 300 && response.status() <= 399;
    if (isRedirect)
      return;

    // Shortcut all redirects - we cannot intercept them properly.
    let original = response.request();
    while (original.redirectedFrom())
      original = original.redirectedFrom()!;
    const url = original.url();

    const resourceId = 'resource' + (++resourceCounter);
    let referencesCallback: (references: string[]) => void = () => {};
    this._resources.add({
      frameId: response.frame()._id,
      url,
      resourceId,
      references: new Promise(fulfill => referencesCallback = fulfill),
    });

    let contentType = '';
    for (const [name, value] of Object.entries(response.headers())) {
      if (name.toLowerCase() === 'content-type')
        contentType = value;
    }

    const body = await response.body().catch(e => this._controller.logError(e, `body for "${url}"`));
    const responseEvent: NetworkResponseTraceEvent = {
      type: 'resource',
      contextId: this._contextId,
      resourceId,
      url,
      contentType,
      responseHeaders: response.headers(),
      sha1: body ? helper.sha1(body) : 'none',
    };
    await this.appendTraceEvent(responseEvent);
    if (body)
      await this._controller.writeArtifact(responseEvent.sha1, body);

    const references = body ? resourceReferences(response.url(), body, response.request().resourceType()) : [];
    referencesCallback(references);
  }

  private async appendTraceEvent(event: any) {
    await this._contextEventPromise;
    await this._controller.appendTraceEvent(event);
  }
}

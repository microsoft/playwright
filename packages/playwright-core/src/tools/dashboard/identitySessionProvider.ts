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

import { EventEmitter } from 'events';
import { Disposable } from '@isomorphic/disposable';
import { eventsHelper } from '@utils/eventsHelper';
import { packageJSON, packageRoot } from '../../package';
import { SessionProviderEvent } from './sessionProvider';

import type * as api from '../../../types/types';
import type { BrowserDescriptor, BrowserInfo } from '../../serverRegistry';
import type { ContextEntry, SessionProvider, SessionProviderEventMap } from './sessionProvider';

export class IdentitySessionProvider extends EventEmitter<SessionProviderEventMap> implements SessionProvider {
  private _context: api.BrowserContext;
  private _browser: api.Browser;
  private _descriptor: BrowserDescriptor;
  private _listeners: Disposable[] = [];
  private _closed = false;

  constructor(context: api.BrowserContext) {
    super();
    const browser = context.browser();
    if (!browser)
      throw new Error('SingleContextDashboardProvider requires a context with an attached browser');
    this._context = context;
    this._browser = browser;
    this._descriptor = synthesiseDescriptor(browser);
  }

  start(): void {
    const emitTabsChanged = () => this.emit(SessionProviderEvent.TabsChanged);
    this._listeners.push(
        eventsHelper.addEventListener(this._context, 'page', emitTabsChanged),
        eventsHelper.addEventListener(this._context, 'pageload', emitTabsChanged),
        eventsHelper.addEventListener(this._context, 'pageclose', emitTabsChanged),
        eventsHelper.addEventListener(this._context, 'framenavigated', (frame: api.Frame) => {
          if (frame === frame.page().mainFrame())
            this.emit(SessionProviderEvent.TabsChanged);
        }),
        eventsHelper.addEventListener(this._context, 'close', () => {
          this._closed = true;
          this.emit(SessionProviderEvent.ContextClosed, this._context);
          this.emit(SessionProviderEvent.TabsChanged);
        }),
    );
    this.emit(SessionProviderEvent.SessionsChanged);
    this.emit(SessionProviderEvent.TabsChanged);
    const firstPage = this._context.pages()[0];
    if (firstPage)
      this.emit(SessionProviderEvent.AttachRequested, firstPage);
  }

  dispose(): void {
    this._listeners.forEach(d => d.dispose());
    this._listeners = [];
    this.removeAllListeners();
  }

  async sessions(): Promise<BrowserDescriptor[]> {
    return this._closed ? [] : [this._descriptor];
  }

  contextEntries(): ContextEntry[] {
    if (this._closed)
      return [];
    return [{ browser: this._browser, context: this._context, descriptor: this._descriptor }];
  }

  findContext(params: { browser: string; context: string }): api.BrowserContext | undefined {
    if (this._closed)
      return undefined;
    if (params.browser !== this._descriptor.browser.guid)
      return undefined;
    if (contextId(this._context) !== params.context)
      return undefined;
    return this._context;
  }

  findPage(params: { browser: string; context: string; page: string }): api.Page | undefined {
    const context = this.findContext(params);
    return context?.pages().find(p => pageId(p) === params.page);
  }

  async closeSession(): Promise<void> {
    // No-op: lifecycle of the user-provided context is managed by the caller.
  }
}

function synthesiseDescriptor(browser: api.Browser): BrowserDescriptor {
  const browserName = browser.browserType().name() as BrowserInfo['browserName'];
  const browserInfo: BrowserInfo = {
    // eslint-disable-next-line no-restricted-syntax -- _guid is very conservative.
    guid: (browser as any)._guid,
    browserName,
    launchOptions: {},
  };
  return {
    title: 'Playwright',
    playwrightVersion: packageJSON.version,
    playwrightLib: packageRoot,
    browser: browserInfo,
  };
}

function pageId(p: api.Page): string {
  // eslint-disable-next-line no-restricted-syntax -- _guid is very conservative.
  return (p as any)._guid;
}

function contextId(c: api.BrowserContext): string {
  // eslint-disable-next-line no-restricted-syntax -- _guid is very conservative.
  return (c as any)._guid;
}

/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

import * as childProcess from 'child_process';
import { EventEmitter } from 'events';
import { assert, helper, RegisteredListener, debugError } from '../helper';
import { filterCookies, NetworkCookie, rewriteCookies, SetNetworkCookieParam } from '../network';
import { Connection } from './Connection';
import { Page, Viewport } from './Page';
import { Target } from './Target';
import { TaskQueue } from './TaskQueue';
import { Protocol } from './protocol';

export class Browser extends EventEmitter {
  _defaultViewport: Viewport;
  private _process: childProcess.ChildProcess;
  _screenshotTaskQueue = new TaskQueue();
  _connection: Connection;
  private _closeCallback: () => Promise<void>;
  private _defaultContext: BrowserContext;
  private _contexts = new Map<string, BrowserContext>();
  _targets = new Map<string, Target>();
  private _eventListeners: RegisteredListener[];
  private _privateEvents = new EventEmitter();

  constructor(
    connection: Connection,
    defaultViewport: Viewport | null,
    process: childProcess.ChildProcess | null,
    closeCallback?: (() => Promise<void>)) {
    super();
    this._defaultViewport = defaultViewport;
    this._process = process;
    this._connection = connection;
    this._closeCallback = closeCallback || (() => Promise.resolve());

    /** @type {!Map<string, !Target>} */
    this._targets = new Map();

    this._defaultContext = new BrowserContext(this);
    /** @type {!Map<string, !BrowserContext>} */
    this._contexts = new Map();

    this._eventListeners = [
      helper.addEventListener(this._connection, 'Target.targetCreated', this._onTargetCreated.bind(this)),
      helper.addEventListener(this._connection, 'Target.targetDestroyed', this._onTargetDestroyed.bind(this)),
      helper.addEventListener(this._connection, 'Target.didCommitProvisionalTarget', this._onProvisionalTargetCommitted.bind(this)),
    ];

    // Taking multiple screenshots in parallel doesn't work well, so we serialize them.
    this._screenshotTaskQueue = new TaskQueue();
  }

  async userAgent(): Promise<string> {
    const context = await this.createIncognitoBrowserContext();
    const page = await context.newPage();
    const userAgent = await page.evaluate(() => navigator.userAgent);
    context.close();
    return userAgent;
  }

  async version(): Promise<string> {
    const userAgent = await this.userAgent();
    return userAgent.split(' ').pop();
  }

  process(): childProcess.ChildProcess | null {
    return this._process;
  }

  async createIncognitoBrowserContext(): Promise<BrowserContext> {
    const {browserContextId} = await this._connection.send('Browser.createContext');
    const context = new BrowserContext(this, browserContextId);
    this._contexts.set(browserContextId, context);
    return context;
  }

  browserContexts(): BrowserContext[] {
    return [this._defaultContext, ...Array.from(this._contexts.values())];
  }

  defaultBrowserContext(): BrowserContext {
    return this._defaultContext;
  }

  async _disposeContext(browserContextId: string | null) {
    await this._connection.send('Browser.deleteContext', {browserContextId});
    this._contexts.delete(browserContextId);
  }

  async newPage(): Promise<Page> {
    return this._createPageInContext(this._defaultContext._id);
  }

  async _createPageInContext(browserContextId?: string): Promise<Page> {
    const { targetId } = await this._connection.send('Browser.createPage', { browserContextId });
    const target = this._targets.get(targetId);
    return await target.page();
  }

  targets(): Target[] {
    return Array.from(this._targets.values());
  }

  async _waitForTarget(predicate: (arg0: Target) => boolean, options: { timeout?: number; } | undefined = {}): Promise<Target> {
    const {
      timeout = 30000
    } = options;
    const existingTarget = this.targets().find(predicate);
    if (existingTarget)
      return existingTarget;
    let resolve;
    const targetPromise = new Promise<Target>(x => resolve = x);
    this._privateEvents.on(BrowserEvents.TargetCreated, check);
    try {
      if (!timeout)
        return await targetPromise;
      return await helper.waitWithTimeout(targetPromise, 'target', timeout);
    } finally {
      this._privateEvents.removeListener(BrowserEvents.TargetCreated, check);
    }

    function check(target: Target) {
      if (predicate(target))
        resolve(target);
    }
  }

  async pages(): Promise<Page[]> {
    const contextPages = await Promise.all(this.browserContexts().map(context => context.pages()));
    // Flatten array.
    return contextPages.reduce((acc, x) => acc.concat(x), []);
  }

  async _onTargetCreated({targetInfo}) {
    let context = null;
    if (targetInfo.browserContextId) {
      // FIXME: we don't know about the default context id, so assume that all targets from
      // unknown contexts are created in the 'default' context which can in practice be represented
      // by multiple actual contexts in WebKit. Solving this properly will require adding context
      // lifecycle events.
      context = this._contexts.get(targetInfo.browserContextId);
      // if (!context)
      //   throw new Error(`Target ${targetId} created in unknown browser context ${browserContextId}.`);
    }
    if (!context)
      context =  this._defaultContext;
    const target = new Target(targetInfo, context);
    this._targets.set(targetInfo.targetId, target);
    this._privateEvents.emit(BrowserEvents.TargetCreated, target);
  }

  _onTargetDestroyed({targetId}) {
    const target = this._targets.get(targetId);
    this._targets.delete(targetId);
    target._didClose();
  }

  _closePage(page: Page) {
    this._connection.send('Target.close', {
      targetId: Target.fromPage(page)._targetId
    }).catch(debugError);
  }

  async _pages(context: BrowserContext): Promise<Page[]> {
    const targets = this.targets().filter(target => target.browserContext() === context && target.type() === 'page');
    const pages = await Promise.all(targets.map(target => target.page()));
    return pages.filter(page => !!page);
  }

  async _activatePage(page: Page): Promise<void> {
    await this._connection.send('Target.activate', { targetId: Target.fromPage(page)._targetId });
  }

  async _onProvisionalTargetCommitted({oldTargetId, newTargetId}) {
    const oldTarget = this._targets.get(oldTargetId);
    if (!oldTarget._pagePromise)
      return;
    const page = await oldTarget._pagePromise;
    const newTarget = this._targets.get(newTargetId);
    const newSession = this._connection.session(newTargetId);
    page._swapSessionOnNavigation(newSession);
    newTarget._pagePromise = oldTarget._pagePromise;
    newTarget._adoptPage(page);
    // Old target should not be accessed by anyone. Reset page promise so that
    // old target does not close the page on connection reset.
    oldTarget._pagePromise = null;
  }

  disconnect() {
    throw new Error('Unsupported operation');
  }

  isConnected(): boolean {
    return true;
  }

  async close() {
    helper.removeEventListeners(this._eventListeners);
    await this._closeCallback.call(null);
  }
}

export class BrowserContext {
  private _browser: Browser;
  _id: string;

  constructor(browser: Browser, contextId?: string) {
    this._browser = browser;
    this._id = contextId;
  }

  pages(): Promise<Page[]> {
    return this._browser._pages(this);
  }

  isIncognito(): boolean {
    return !!this._id;
  }

  newPage(): Promise<Page> {
    return this._browser._createPageInContext(this._id);
  }

  browser(): Browser {
    return this._browser;
  }

  async close() {
    assert(this._id, 'Non-incognito profiles cannot be closed!');
    await this._browser._disposeContext(this._id);
  }

  async cookies(...urls: string[]): Promise<NetworkCookie[]> {
    const { cookies } = await this._browser._connection.send('Browser.getAllCookies', { browserContextId: this._id });
    return filterCookies(cookies.map((c: NetworkCookie) => ({
      ...c,
      expires: c.expires === 0 ? -1 : c.expires
    })), urls);
  }

  async setCookies(cookies: SetNetworkCookieParam[]) {
    cookies = rewriteCookies(cookies);
    const cc = cookies.map(c => ({ ...c, session: c.expires === -1 || c.expires === undefined })) as Protocol.Browser.SetCookieParam[];
    await this._browser._connection.send('Browser.setCookies', { cookies: cc, browserContextId: this._id });
  }

  async clearCookies() {
    await this._browser._connection.send('Browser.deleteAllCookies', { browserContextId: this._id });
  }
}

const BrowserEvents = {
  TargetCreated: Symbol('BrowserEvents.TargetCreated'),
  TargetDestroyed: Symbol('BrowserEvents.TargetDestroyed'),
};

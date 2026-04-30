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
import { connectToBrowserAcrossVersions } from '../utils/connect';
import { serverRegistry } from '../../serverRegistry';
import { SessionProviderEvent } from './sessionProvider';

import type * as api from '../../../types/types';
import type { BrowserDescriptor } from '../../serverRegistry';
import type { ContextEntry, SessionProvider, SessionProviderEventMap } from './sessionProvider';

type BrowserTrackerCallbacks = {
  onTabsChanged: () => void;
  onContextClosed: (context: api.BrowserContext) => void;
};

class BrowserTracker {
  readonly descriptor: BrowserDescriptor;
  readonly browser: api.Browser;
  private _callbacks: BrowserTrackerCallbacks;
  private _contextListeners = new Map<api.BrowserContext, Disposable[]>();
  private _browserListeners: Disposable[] = [];

  static async create(descriptor: BrowserDescriptor, callbacks: BrowserTrackerCallbacks): Promise<BrowserTracker | undefined> {
    try {
      const browser = await connectToBrowserAcrossVersions(descriptor);
      const slot = new BrowserTracker(descriptor, browser, callbacks);
      for (const context of browser.contexts())
        slot._wireContext(context);
      slot._browserListeners.push(eventsHelper.addEventListener(browser, 'context', (context: api.BrowserContext) => {
        slot._wireContext(context);
      }));
      return slot;
    } catch {
      return undefined;
    }
  }

  private constructor(descriptor: BrowserDescriptor, browser: api.Browser, callbacks: BrowserTrackerCallbacks) {
    this.descriptor = descriptor;
    this.browser = browser;
    this._callbacks = callbacks;
  }

  contexts(): api.BrowserContext[] {
    return this.browser.contexts();
  }

  dispose() {
    this._browserListeners.forEach(d => d.dispose());
    this._browserListeners = [];
    for (const listeners of this._contextListeners.values())
      listeners.forEach(d => d.dispose());
    this._contextListeners.clear();
  }

  private _wireContext(context: api.BrowserContext) {
    if (this._contextListeners.has(context))
      return;
    const onTabsChanged = () => this._callbacks.onTabsChanged();
    const listeners: Disposable[] = [
      eventsHelper.addEventListener(context, 'page', onTabsChanged),
      eventsHelper.addEventListener(context, 'pageload', onTabsChanged),
      eventsHelper.addEventListener(context, 'pageclose', onTabsChanged),
      eventsHelper.addEventListener(context, 'framenavigated', (frame: api.Frame) => {
        if (frame === frame.page().mainFrame())
          this._callbacks.onTabsChanged();
      }),
      eventsHelper.addEventListener(context, 'close', () => {
        const ls = this._contextListeners.get(context);
        if (ls) {
          ls.forEach(d => d.dispose());
          this._contextListeners.delete(context);
        }
        this._callbacks.onContextClosed(context);
        this._callbacks.onTabsChanged();
      }),
    ];
    this._contextListeners.set(context, listeners);
    this._callbacks.onTabsChanged();
  }
}

export class RegistrySessionProvider extends EventEmitter<SessionProviderEventMap> implements SessionProvider {
  private _trackers = new Map<string, BrowserTracker>();
  private _serverRegistryDispose?: () => void;
  private _pushSessionsScheduled = false;

  start(): void {
    this._serverRegistryDispose = serverRegistry.watch();
    serverRegistry.on('added', this._scheduleSessions);
    serverRegistry.on('removed', this._scheduleSessions);
    serverRegistry.on('changed', this._scheduleSessions);
    this._scheduleSessions();
  }

  dispose(): void {
    serverRegistry.off('added', this._scheduleSessions);
    serverRegistry.off('removed', this._scheduleSessions);
    serverRegistry.off('changed', this._scheduleSessions);
    this._serverRegistryDispose?.();
    this._serverRegistryDispose = undefined;
    for (const tracker of this._trackers.values())
      tracker.dispose();
    this._trackers.clear();
    this.removeAllListeners();
  }

  async sessions(): Promise<BrowserDescriptor[]> {
    const byWs = await serverRegistry.list();
    const sessions: BrowserDescriptor[] = [];
    for (const list of byWs.values()) {
      for (const status of list) {
        if (status.title.startsWith('--playwright-internal'))
          continue;
        sessions.push(status);
      }
    }
    return sessions;
  }

  contextEntries(): ContextEntry[] {
    const entries: ContextEntry[] = [];
    for (const tracker of this._trackers.values()) {
      for (const context of tracker.contexts())
        entries.push({ browser: tracker.browser, context, descriptor: tracker.descriptor });
    }
    return entries;
  }

  findContext(params: { browser: string; context: string }): api.BrowserContext | undefined {
    const tracker = this._trackers.get(params.browser);
    if (!tracker)
      return undefined;
    return tracker.contexts().find(c => contextId(c) === params.context);
  }

  findPage(params: { browser: string; context: string; page: string }): api.Page | undefined {
    const context = this.findContext(params);
    return context?.pages().find(p => pageId(p) === params.page);
  }

  async closeSession(browserId: string): Promise<void> {
    const descriptor = serverRegistry.readDescriptor(browserId);
    const browser = await connectToBrowserAcrossVersions(descriptor);
    try {
      await Promise.all(browser.contexts().map(context => context.close()));
      await browser.close();
    } catch {
      // best-effort
    }
  }

  private _scheduleSessions = () => {
    if (this._pushSessionsScheduled)
      return;
    this._pushSessionsScheduled = true;
    queueMicrotask(async () => {
      this._pushSessionsScheduled = false;
      try {
        const sessions = await this.sessions();
        await this._reconcile(sessions);
        this.emit(SessionProviderEvent.SessionsChanged);
        this.emit(SessionProviderEvent.TabsChanged);
      } catch {
        // best-effort
      }
    });
  };

  private async _reconcile(sessions: BrowserDescriptor[]) {
    const connectable = new Map<string, BrowserDescriptor>();
    for (const status of sessions)
      connectable.set(status.browser.guid, status);

    for (const [guid, tracker] of this._trackers) {
      if (connectable.has(guid))
        continue;
      tracker.dispose();
      this._trackers.delete(guid);
    }

    for (const [guid, status] of connectable) {
      if (this._trackers.has(guid))
        continue;
      const tracker = await BrowserTracker.create(status, {
        onTabsChanged: () => this.emit(SessionProviderEvent.TabsChanged),
        onContextClosed: context => this.emit(SessionProviderEvent.ContextClosed, context),
      });
      if (!tracker)
        continue;
      if (this._trackers.has(guid)) {
        tracker.dispose();
        continue;
      }
      this._trackers.set(guid, tracker);
    }
  }

}

function pageId(p: api.Page): string {
  // eslint-disable-next-line no-restricted-syntax -- _guid is very conservative.
  return (p as any)._guid;
}

function contextId(c: api.BrowserContext): string {
  // eslint-disable-next-line no-restricted-syntax -- _guid is very conservative.
  return (c as any)._guid;
}

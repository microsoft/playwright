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

import type { BrowserWindow } from 'electron';
import type * as childProcess from 'child_process';
import type * as structs from '../../types/structs';
import type * as api from '../../types/types';
import type * as channels from '@protocol/channels';
import { TimeoutSettings } from '../common/timeoutSettings';
import { BrowserContext, prepareBrowserContextParams } from './browserContext';
import { ChannelOwner } from './channelOwner';
import { envObjectToArray } from './clientHelper';
import { Events } from './events';
import { JSHandle, parseResult, serializeArgument } from './jsHandle';
import type { Page } from './page';
import { ConsoleMessage } from './consoleMessage';
import type { Env, WaitForEventOptions, Headers, BrowserContextOptions } from './types';
import { Waiter } from './waiter';
import { TargetClosedError } from './errors';

type ElectronOptions = Omit<channels.ElectronLaunchOptions, 'env'|'extraHTTPHeaders'|'recordHar'|'colorScheme'|'acceptDownloads'> & {
  env?: Env,
  extraHTTPHeaders?: Headers,
  recordHar?: BrowserContextOptions['recordHar'],
  colorScheme?: 'dark' | 'light' | 'no-preference' | null,
  acceptDownloads?: boolean,
};

type ElectronAppType = typeof import('electron');

export class Electron extends ChannelOwner<channels.ElectronChannel> implements api.Electron {
  static from(electron: channels.ElectronChannel): Electron {
    return (electron as any)._object;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.ElectronInitializer) {
    super(parent, type, guid, initializer);
  }

  async launch(options: ElectronOptions = {}): Promise<ElectronApplication> {
    const params: channels.ElectronLaunchParams = {
      ...await prepareBrowserContextParams(options),
      env: envObjectToArray(options.env ? options.env : process.env),
      tracesDir: options.tracesDir,
    };
    const app = ElectronApplication.from((await this._channel.launch(params)).electronApplication);
    app._context._setOptions(params, options);
    return app;
  }
}

export class ElectronApplication extends ChannelOwner<channels.ElectronApplicationChannel> implements api.ElectronApplication {
  readonly _context: BrowserContext;
  private _windows = new Set<Page>();
  private _timeoutSettings = new TimeoutSettings();

  static from(electronApplication: channels.ElectronApplicationChannel): ElectronApplication {
    return (electronApplication as any)._object;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.ElectronApplicationInitializer) {
    super(parent, type, guid, initializer);
    this._context = BrowserContext.from(initializer.context);
    for (const page of this._context._pages)
      this._onPage(page);
    this._context.on(Events.BrowserContext.Page, page => this._onPage(page));
    this._channel.on('close', () => {
      this.emit(Events.ElectronApplication.Close);
    });
    this._channel.on('console', event => this.emit(Events.ElectronApplication.Console, new ConsoleMessage(event)));
    this._setEventToSubscriptionMapping(new Map<string, channels.ElectronApplicationUpdateSubscriptionParams['event']>([
      [Events.ElectronApplication.Console, 'console'],
    ]));
  }

  process(): childProcess.ChildProcess {
    return this._toImpl().process();
  }

  _onPage(page: Page) {
    this._windows.add(page);
    this.emit(Events.ElectronApplication.Window, page);
    page.once(Events.Page.Close, () => this._windows.delete(page));
  }

  windows(): Page[] {
    // TODO: add ElectronPage class inheriting from Page.
    return [...this._windows];
  }

  async firstWindow(options?: { timeout?: number }): Promise<Page> {
    if (this._windows.size)
      return this._windows.values().next().value;
    return await this.waitForEvent('window', options);
  }

  context(): BrowserContext {
    return this._context;
  }

  async [Symbol.asyncDispose]() {
    await this.close();
  }

  async close() {
    await this._context.close().catch(() => {});
  }

  async waitForEvent(event: string, optionsOrPredicate: WaitForEventOptions = {}): Promise<any> {
    return await this._wrapApiCall(async () => {
      const timeout = this._timeoutSettings.timeout(typeof optionsOrPredicate === 'function' ? {} : optionsOrPredicate);
      const predicate = typeof optionsOrPredicate === 'function' ? optionsOrPredicate : optionsOrPredicate.predicate;
      const waiter = Waiter.createForEvent(this, event);
      waiter.rejectOnTimeout(timeout, `Timeout ${timeout}ms exceeded while waiting for event "${event}"`);
      if (event !== Events.ElectronApplication.Close)
        waiter.rejectOnEvent(this, Events.ElectronApplication.Close, () => new TargetClosedError());
      const result = await waiter.waitForEvent(this, event, predicate as any);
      waiter.dispose();
      return result;
    });
  }

  async browserWindow(page: Page): Promise<JSHandle<BrowserWindow>> {
    const result = await this._channel.browserWindow({ page: page._channel });
    return JSHandle.from(result.handle);
  }

  async evaluate<R, Arg>(pageFunction: structs.PageFunctionOn<ElectronAppType, Arg, R>, arg: Arg): Promise<R> {
    const result = await this._channel.evaluateExpression({ expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializeArgument(arg) });
    return parseResult(result.value);
  }

  async evaluateHandle<R, Arg>(pageFunction: structs.PageFunctionOn<ElectronAppType, Arg, R>, arg: Arg): Promise<structs.SmartHandle<R>> {
    const result = await this._channel.evaluateExpressionHandle({ expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializeArgument(arg) });
    return JSHandle.from(result.handle) as any as structs.SmartHandle<R>;
  }
}

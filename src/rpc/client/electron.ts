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

import * as types from '../../types';
import { ElectronChannel, ElectronInitializer, ElectronLaunchOptions, ElectronApplicationChannel, ElectronApplicationInitializer } from '../channels';
import { BrowserContext } from './browserContext';
import { ChannelOwner } from './channelOwner';
import { Page } from './page';
import { serializeArgument, FuncOn, parseResult, SmartHandle, JSHandle } from './jsHandle';
import { ElectronEvents } from '../../server/electron';
import { TimeoutSettings } from '../../timeoutSettings';
import { Waiter } from './waiter';
import { TimeoutError } from '../../errors';
import { Events } from '../../events';
import { LoggerSink } from '../../loggerSink';

export class Electron extends ChannelOwner<ElectronChannel, ElectronInitializer> {
  static from(electron: ElectronChannel): Electron {
    return (electron as any)._object;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: ElectronInitializer) {
    super(parent, type, guid, initializer, true);
  }

  async launch(executablePath: string, options: ElectronLaunchOptions & { logger?: LoggerSink } = {}): Promise<ElectronApplication> {
    const logger = options.logger;
    options = { ...options, logger: undefined };
    return this._wrapApiCall('electron.launch', async () => {
      return ElectronApplication.from((await this._channel.launch({ executablePath, ...options })).electronApplication);
    }, logger);
  }
}

export class ElectronApplication extends ChannelOwner<ElectronApplicationChannel, ElectronApplicationInitializer> {
  private _context: BrowserContext;
  private _windows = new Set<Page>();
  private _timeoutSettings = new TimeoutSettings();

  static from(electronApplication: ElectronApplicationChannel): ElectronApplication {
    return (electronApplication as any)._object;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: ElectronApplicationInitializer) {
    super(parent, type, guid, initializer);
    this._context = BrowserContext.from(initializer.context);
    this._channel.on('window', ({ page, browserWindow }) => {
      const window = Page.from(page);
      (window as any).browserWindow = JSHandle.from(browserWindow);
      this._windows.add(window);
      this.emit(ElectronEvents.ElectronApplication.Window, window);
      window.once(Events.Page.Close, () => this._windows.delete(window));
    });
    this._channel.on('close', () => {
      this.emit(ElectronEvents.ElectronApplication.Close);
    });
  }

  windows(): Page[] {
    return [...this._windows];
  }

  async firstWindow(): Promise<Page> {
    if (this._windows.size)
      return this._windows.values().next().value;
    return this.waitForEvent('window');
  }

  async newBrowserWindow(options: any): Promise<Page> {
    const result = await this._channel.newBrowserWindow({ arg: serializeArgument(options) });
    return Page.from(result.page);
  }

  context(): BrowserContext {
    return this._context;
  }

  async close() {
    await this._channel.close();
  }

  async waitForEvent(event: string, optionsOrPredicate: types.WaitForEventOptions = {}): Promise<any> {
    const timeout = this._timeoutSettings.timeout(optionsOrPredicate instanceof Function ? {} : optionsOrPredicate);
    const predicate = optionsOrPredicate instanceof Function ? optionsOrPredicate : optionsOrPredicate.predicate;
    const waiter = new Waiter();
    waiter.rejectOnTimeout(timeout, new TimeoutError(`Timeout while waiting for event "${event}"`));
    if (event !== ElectronEvents.ElectronApplication.Close)
      waiter.rejectOnEvent(this, ElectronEvents.ElectronApplication.Close, new Error('Electron application closed'));
    const result = await waiter.waitForEvent(this, event, predicate as any);
    waiter.dispose();
    return result;
  }

  async evaluate<R, Arg>(pageFunction: FuncOn<any, Arg, R>, arg: Arg): Promise<R>;
  async evaluate<R>(pageFunction: FuncOn<any, void, R>, arg?: any): Promise<R>;
  async evaluate<R, Arg>(pageFunction: FuncOn<any, Arg, R>, arg: Arg): Promise<R> {
    const result = await this._channel.evaluateExpression({ expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializeArgument(arg) });
    return parseResult(result.value);
  }

  async evaluateHandle<R, Arg>(pageFunction: FuncOn<any, Arg, R>, arg: Arg): Promise<SmartHandle<R>>;
  async evaluateHandle<R>(pageFunction: FuncOn<any, void, R>, arg?: any): Promise<SmartHandle<R>>;
  async evaluateHandle<R, Arg>(pageFunction: FuncOn<any, Arg, R>, arg: Arg): Promise<SmartHandle<R>> {
    const result = await this._channel.evaluateExpressionHandle({ expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializeArgument(arg) });
    return JSHandle.from(result.handle) as SmartHandle<R>;
  }
}

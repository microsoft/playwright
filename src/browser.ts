// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { BrowserContext, BrowserContextOptions } from './browserContext';
import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export class Browser extends EventEmitter {
  newContext(options?: BrowserContextOptions): Promise<BrowserContext> { throw new Error('Not implemented'); }
  browserContexts(): BrowserContext[] { throw new Error('Not implemented'); }
  defaultContext(): BrowserContext { throw new Error('Not implemented'); }

  disconnect(): void { throw new Error('Not implemented'); }
  isConnected(): boolean { throw new Error('Not implemented'); }
  close(): Promise<void> { throw new Error('Not implemented'); }
}

export class BrowserServer<T extends Browser> {
  private _browser: T;
  private _process: ChildProcess;
  private _wsEndpoint: string;

  constructor(browser: T, process: ChildProcess, wsEndpoint: string) {
    this._browser = browser;
    this._process = process;
    this._wsEndpoint = wsEndpoint;
  }

  async connect(): Promise<T> {
    return this._browser;
  }

  process(): ChildProcess {
    return this._process;
  }

  wsEndpoint(): string {
    return this._wsEndpoint;
  }

  async close(): Promise<void> {
    await this._browser.close();
  }
}

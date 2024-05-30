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

import type * as channels from '@protocol/channels';
import type { BrowserContext } from './browserContext';
import * as fakeTimersSource from '../generated/fakeTimersSource';

export class Clock {
  private _browserContext: BrowserContext;
  private _installed = false;

  constructor(browserContext: BrowserContext) {
    this._browserContext = browserContext;
  }

  async install(params: channels.BrowserContextClockInstallOptions) {
    if (this._installed)
      throw new Error('Cannot install more than one clock per context');
    this._installed = true;
    const script = `(() => {
      const module = {};
      ${fakeTimersSource.source}
      globalThis.__pwFakeTimers = (module.exports.install())(${JSON.stringify(params)});
    })();`;
    await this._addAndEvaluate(script);
  }

  async jump(time: number | string) {
    this._assertInstalled();
    await this._addAndEvaluate(`globalThis.__pwFakeTimers.jump(${JSON.stringify(time)}); 0`);
  }

  async runAll(): Promise<number> {
    this._assertInstalled();
    await this._browserContext.addInitScript(`globalThis.__pwFakeTimers.runAll()`);
    return await this._evaluateInFrames(`globalThis.__pwFakeTimers.runAllAsync()`);
  }

  async runToLast(): Promise<number> {
    this._assertInstalled();
    await this._browserContext.addInitScript(`globalThis.__pwFakeTimers.runToLast()`);
    return await this._evaluateInFrames(`globalThis.__pwFakeTimers.runToLastAsync()`);
  }

  async tick(time: number | string): Promise<number> {
    this._assertInstalled();
    await this._browserContext.addInitScript(`globalThis.__pwFakeTimers.tick(${JSON.stringify(time)})`);
    return await this._evaluateInFrames(`globalThis.__pwFakeTimers.tickAsync(${JSON.stringify(time)})`);
  }

  private async _addAndEvaluate(script: string) {
    await this._browserContext.addInitScript(script);
    return await this._evaluateInFrames(script);
  }

  private async _evaluateInFrames(script: string) {
    const frames = this._browserContext.pages().map(page => page.frames()).flat();
    const results = await Promise.all(frames.map(frame => frame.evaluateExpression(script)));
    return results[0];
  }

  private _assertInstalled() {
    if (!this._installed)
      throw new Error('Clock is not installed');
  }
}

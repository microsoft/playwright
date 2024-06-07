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

import type { BrowserContext } from './browserContext';
import * as clockSource from '../generated/clockSource';

export class Clock {
  private _browserContext: BrowserContext;
  private _scriptInjected = false;
  private _clockInstalled = false;
  private _now = 0;

  constructor(browserContext: BrowserContext) {
    this._browserContext = browserContext;
  }

  async installFakeTimers(time: number, loopLimit: number | undefined) {
    await this._injectScriptIfNeeded();
    await this._addAndEvaluate(`(() => {
      globalThis.__pwClock.clock?.uninstall();
      globalThis.__pwClock.clock = globalThis.__pwClock.install(${JSON.stringify({ now: time, loopLimit })});
    })();`);
    this._now = time;
    this._clockInstalled = true;
  }

  async runToNextTimer(): Promise<number> {
    this._assertInstalled();
    this._now = await this._evaluateInFrames(`globalThis.__pwClock.clock.next()`);
    return this._now;
  }

  async runAllTimers(): Promise<number> {
    this._assertInstalled();
    this._now = await this._evaluateInFrames(`globalThis.__pwClock.clock.runAll()`);
    return this._now;
  }

  async runToLastTimer(): Promise<number> {
    this._assertInstalled();
    this._now = await this._evaluateInFrames(`globalThis.__pwClock.clock.runToLast()`);
    return this._now;
  }

  async setTime(time: number) {
    if (this._clockInstalled) {
      const jump = time - this._now;
      if (jump < 0)
        throw new Error('Unable to set time into the past when fake timers are installed');
      await this._addAndEvaluate(`globalThis.__pwClock.clock.jump(${jump})`);
      this._now = time;
      return this._now;
    }

    await this._injectScriptIfNeeded();
    await this._addAndEvaluate(`(() => {
      globalThis.__pwClock.clock?.uninstall();
      globalThis.__pwClock.clock = globalThis.__pwClock.install(${JSON.stringify({ now: time, toFake: ['Date'] })});
    })();`);
    this._now = time;
    return this._now;
  }

  async skipTime(time: number | string) {
    const delta = parseTime(time);
    await this.setTime(this._now + delta);
    return this._now;
  }

  async runFor(time: number | string): Promise<number> {
    this._assertInstalled();
    await this._browserContext.addInitScript(`globalThis.__pwClock.clock.recordTick(${JSON.stringify(time)})`);
    this._now = await this._evaluateInFrames(`globalThis.__pwClock.clock.tick(${JSON.stringify(time)})`);
    return this._now;
  }

  private async _injectScriptIfNeeded() {
    if (this._scriptInjected)
      return;
    this._scriptInjected = true;
    const script = `(() => {
      const module = {};
      ${clockSource.source}
      globalThis.__pwClock = (module.exports.inject())(globalThis);
    })();`;
    await this._addAndEvaluate(script);
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
    if (!this._clockInstalled)
      throw new Error('Clock is not installed');
  }
}

// Taken from sinonjs/fake-timerss-src.
function parseTime(time: string | number): number {
  if (typeof time === 'number')
    return time;
  if (!time)
    return 0;

  const strings = time.split(':');
  const l = strings.length;
  let i = l;
  let ms = 0;
  let parsed;

  if (l > 3 || !/^(\d\d:){0,2}\d\d?$/.test(time))
    throw new Error(`tick only understands numbers, 'm:s' and 'h:m:s'. Each part must be two digits`);

  while (i--) {
    parsed = parseInt(strings[i], 10);
    if (parsed >= 60)
      throw new Error(`Invalid time ${time}`);
    ms += parsed * Math.pow(60, l - i - 1);
  }
  return ms * 1000;
}

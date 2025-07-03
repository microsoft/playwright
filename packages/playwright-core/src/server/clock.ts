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

import * as rawClockSource from '../generated/clockSource';

import type { BrowserContext } from './browserContext';
import type { InitScript } from './page';
import type { Progress } from '@protocol/progress';

export class Clock {
  private _browserContext: BrowserContext;
  private _initScripts: InitScript[] = [];

  constructor(browserContext: BrowserContext) {
    this._browserContext = browserContext;
  }

  async resetForReuse() {
    await this._browserContext.removeInitScripts(this._initScripts);
    this._initScripts = [];
  }

  async fastForward(progress: Progress, ticks: number | string) {
    await this._installIfNeeded(progress);
    const ticksMillis = parseTicks(ticks);
    this._initScripts.push(await this._browserContext.addInitScript(progress, `globalThis.__pwClock.controller.log('fastForward', ${Date.now()}, ${ticksMillis})`));
    await progress.race(this._evaluateInFrames(`globalThis.__pwClock.controller.fastForward(${ticksMillis})`));
  }

  async install(progress: Progress, time: number | string | undefined) {
    await this._installIfNeeded(progress);
    const timeMillis = time !== undefined ? parseTime(time) : Date.now();
    this._initScripts.push(await this._browserContext.addInitScript(progress, `globalThis.__pwClock.controller.log('install', ${Date.now()}, ${timeMillis})`));
    await progress.race(this._evaluateInFrames(`globalThis.__pwClock.controller.install(${timeMillis})`));
  }

  async pauseAt(progress: Progress, ticks: number | string) {
    await this._installIfNeeded(progress);
    const timeMillis = parseTime(ticks);
    this._initScripts.push(await this._browserContext.addInitScript(progress, `globalThis.__pwClock.controller.log('pauseAt', ${Date.now()}, ${timeMillis})`));
    await progress.race(this._evaluateInFrames(`globalThis.__pwClock.controller.pauseAt(${timeMillis})`));
  }

  resumeNoReply() {
    if (!this._initScripts.length)
      return;
    const doResume = async () => {
      this._initScripts.push(await this._browserContext.addInitScript(undefined, `globalThis.__pwClock.controller.log('resume', ${Date.now()})`));
      await this._evaluateInFrames(`globalThis.__pwClock.controller.resume()`);
    };
    doResume().catch(() => {});
  }

  async resume(progress: Progress) {
    await this._installIfNeeded(progress);
    this._initScripts.push(await this._browserContext.addInitScript(progress, `globalThis.__pwClock.controller.log('resume', ${Date.now()})`));
    await progress.race(this._evaluateInFrames(`globalThis.__pwClock.controller.resume()`));
  }

  async setFixedTime(progress: Progress, time: string | number) {
    await this._installIfNeeded(progress);
    const timeMillis = parseTime(time);
    this._initScripts.push(await this._browserContext.addInitScript(progress, `globalThis.__pwClock.controller.log('setFixedTime', ${Date.now()}, ${timeMillis})`));
    await progress.race(this._evaluateInFrames(`globalThis.__pwClock.controller.setFixedTime(${timeMillis})`));
  }

  async setSystemTime(progress: Progress, time: string | number) {
    await this._installIfNeeded(progress);
    const timeMillis = parseTime(time);
    this._initScripts.push(await this._browserContext.addInitScript(progress, `globalThis.__pwClock.controller.log('setSystemTime', ${Date.now()}, ${timeMillis})`));
    await progress.race(this._evaluateInFrames(`globalThis.__pwClock.controller.setSystemTime(${timeMillis})`));
  }

  async runFor(progress: Progress, ticks: number | string) {
    await this._installIfNeeded(progress);
    const ticksMillis = parseTicks(ticks);
    this._initScripts.push(await this._browserContext.addInitScript(progress, `globalThis.__pwClock.controller.log('runFor', ${Date.now()}, ${ticksMillis})`));
    await progress.race(this._evaluateInFrames(`globalThis.__pwClock.controller.runFor(${ticksMillis})`));
  }

  private async _installIfNeeded(progress: Progress) {
    if (this._initScripts.length)
      return;
    const script = `(() => {
      const module = {};
      ${rawClockSource.source}
      if (!globalThis.__pwClock)
        globalThis.__pwClock = (module.exports.inject())(globalThis);
    })();`;
    const initScript = await this._browserContext.addInitScript(progress, script);
    await progress.race(this._evaluateInFrames(script));
    this._initScripts.push(initScript);
  }

  private async _evaluateInFrames(script: string) {
    await this._browserContext.safeNonStallingEvaluateInAllFrames(script, 'main', { throwOnJSErrors: true });
  }
}

/**
 * Parse strings like '01:10:00' (meaning 1 hour, 10 minutes, 0 seconds) into
 * number of milliseconds. This is used to support human-readable strings passed
 * to clock.tick()
 */
function parseTicks(value: number | string): number {
  if (typeof value === 'number')
    return value;
  if (!value)
    return 0;
  const str = value;

  const strings = str.split(':');
  const l = strings.length;
  let i = l;
  let ms = 0;
  let parsed;

  if (l > 3 || !/^(\d\d:){0,2}\d\d?$/.test(str)) {
    throw new Error(
        `Clock only understands numbers, 'mm:ss' and 'hh:mm:ss'`,
    );
  }

  while (i--) {
    parsed = parseInt(strings[i], 10);
    if (parsed >= 60)
      throw new Error(`Invalid time ${str}`);
    ms += parsed * Math.pow(60, l - i - 1);
  }

  return ms * 1000;
}

function parseTime(epoch: string | number | undefined): number {
  if (!epoch)
    return 0;
  if (typeof epoch === 'number')
    return epoch;
  const parsed = new Date(epoch);
  if (!isFinite(parsed.getTime()))
    throw new Error(`Invalid date: ${epoch}`);
  return parsed.getTime();
}

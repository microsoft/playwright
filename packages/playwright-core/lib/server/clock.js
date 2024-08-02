"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Clock = void 0;
var clockSource = _interopRequireWildcard(require("../generated/clockSource"));
var _javascript = require("./javascript");
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && Object.prototype.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
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

class Clock {
  constructor(browserContext) {
    this._browserContext = void 0;
    this._scriptInstalled = false;
    this._browserContext = browserContext;
  }
  markAsUninstalled() {
    this._scriptInstalled = false;
  }
  async fastForward(ticks) {
    await this._installIfNeeded();
    const ticksMillis = parseTicks(ticks);
    await this._browserContext.addInitScript(`globalThis.__pwClock.controller.log('fastForward', ${Date.now()}, ${ticksMillis})`);
    await this._evaluateInFrames(`globalThis.__pwClock.controller.fastForward(${ticksMillis})`);
  }
  async install(time) {
    await this._installIfNeeded();
    const timeMillis = time !== undefined ? parseTime(time) : Date.now();
    await this._browserContext.addInitScript(`globalThis.__pwClock.controller.log('install', ${Date.now()}, ${timeMillis})`);
    await this._evaluateInFrames(`globalThis.__pwClock.controller.install(${timeMillis})`);
  }
  async pauseAt(ticks) {
    await this._installIfNeeded();
    const timeMillis = parseTime(ticks);
    await this._browserContext.addInitScript(`globalThis.__pwClock.controller.log('pauseAt', ${Date.now()}, ${timeMillis})`);
    await this._evaluateInFrames(`globalThis.__pwClock.controller.pauseAt(${timeMillis})`);
  }
  async resume() {
    await this._installIfNeeded();
    await this._browserContext.addInitScript(`globalThis.__pwClock.controller.log('resume', ${Date.now()})`);
    await this._evaluateInFrames(`globalThis.__pwClock.controller.resume()`);
  }
  async setFixedTime(time) {
    await this._installIfNeeded();
    const timeMillis = parseTime(time);
    await this._browserContext.addInitScript(`globalThis.__pwClock.controller.log('setFixedTime', ${Date.now()}, ${timeMillis})`);
    await this._evaluateInFrames(`globalThis.__pwClock.controller.setFixedTime(${timeMillis})`);
  }
  async setSystemTime(time) {
    await this._installIfNeeded();
    const timeMillis = parseTime(time);
    await this._browserContext.addInitScript(`globalThis.__pwClock.controller.log('setSystemTime', ${Date.now()}, ${timeMillis})`);
    await this._evaluateInFrames(`globalThis.__pwClock.controller.setSystemTime(${timeMillis})`);
  }
  async runFor(ticks) {
    await this._installIfNeeded();
    const ticksMillis = parseTicks(ticks);
    await this._browserContext.addInitScript(`globalThis.__pwClock.controller.log('runFor', ${Date.now()}, ${ticksMillis})`);
    await this._evaluateInFrames(`globalThis.__pwClock.controller.runFor(${ticksMillis})`);
  }
  async _installIfNeeded() {
    if (this._scriptInstalled) return;
    this._scriptInstalled = true;
    const script = `(() => {
      const module = {};
      ${clockSource.source}
      globalThis.__pwClock = (module.exports.inject())(globalThis);
    })();`;
    await this._addAndEvaluate(script);
  }
  async _addAndEvaluate(script) {
    await this._browserContext.addInitScript(script);
    return await this._evaluateInFrames(script);
  }
  async _evaluateInFrames(script) {
    const frames = this._browserContext.pages().map(page => page.frames()).flat();
    const results = await Promise.all(frames.map(async frame => {
      try {
        await frame.nonStallingEvaluateInExistingContext(script, false, 'main');
      } catch (e) {
        if ((0, _javascript.isJavaScriptErrorInEvaluate)(e)) throw e;
      }
    }));
    return results[0];
  }
}

/**
 * Parse strings like '01:10:00' (meaning 1 hour, 10 minutes, 0 seconds) into
 * number of milliseconds. This is used to support human-readable strings passed
 * to clock.tick()
 */
exports.Clock = Clock;
function parseTicks(value) {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const str = value;
  const strings = str.split(':');
  const l = strings.length;
  let i = l;
  let ms = 0;
  let parsed;
  if (l > 3 || !/^(\d\d:){0,2}\d\d?$/.test(str)) {
    throw new Error(`Clock only understands numbers, 'mm:ss' and 'hh:mm:ss'`);
  }
  while (i--) {
    parsed = parseInt(strings[i], 10);
    if (parsed >= 60) throw new Error(`Invalid time ${str}`);
    ms += parsed * Math.pow(60, l - i - 1);
  }
  return ms * 1000;
}
function parseTime(epoch) {
  if (!epoch) return 0;
  if (typeof epoch === 'number') return epoch;
  const parsed = new Date(epoch);
  if (!isFinite(parsed.getTime())) throw new Error(`Invalid date: ${epoch}`);
  return parsed.getTime();
}
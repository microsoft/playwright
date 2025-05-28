/**
 * Copyright (c) 2010-2014, Christian Johansen, christian@cjohansen.no. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * 1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * 3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import type { Builtins } from './utilityScript';

export type ClockConfig = {
  now?: number;
};

export type InstallConfig = ClockConfig & {
  toFake?: (keyof Builtins)[];
};

enum TimerType {
  Timeout = 'Timeout',
  Interval = 'Interval',
  Immediate = 'Immediate',
  AnimationFrame = 'AnimationFrame',
  IdleCallback = 'IdleCallback',
}

type Timer = {
  type: TimerType;
  func: TimerHandler;
  args: any[];
  delay: number;
  callAt: Ticks;
  createdAt: Ticks;
  id: number;
  error?: Error;
};

interface Embedder {
  dateNow(): number;
  performanceNow(): EmbedderTicks;
  setTimeout(task: () => void, timeout?: number): () => void;
  setInterval(task: () => void, delay: number): () => void;
}

type Ticks = number & { readonly __brand: 'Ticks' };
type EmbedderTicks = number & { readonly __brand: 'EmbedderTicks' };
type WallTime = number & { readonly __brand: 'WallTime' };

type Time = {
  time: WallTime;
  ticks: Ticks;
  isFixedTime: boolean;
  origin: WallTime;
};

type LogEntryType = 'fastForward' |'install' | 'pauseAt' | 'resume' | 'runFor' | 'setFixedTime' | 'setSystemTime';

export class ClockController {
  readonly _now: Time;
  private _duringTick = false;
  private _timers: Map<number, Timer>;
  private _uniqueTimerId = idCounterStart;
  private _embedder: Embedder;
  readonly disposables: (() => void)[] = [];
  private _log: { type: LogEntryType, time: number, param?: number }[] = [];
  private _realTime: { startTicks: EmbedderTicks, lastSyncTicks: EmbedderTicks } | undefined;
  private _currentRealTimeTimer: { callAt: Ticks, dispose: () => void } | undefined;

  constructor(embedder: Embedder) {
    this._timers = new Map();
    this._now = { time: asWallTime(0), isFixedTime: false, ticks: 0 as Ticks, origin: asWallTime(-1) };
    this._embedder = embedder;
  }

  uninstall() {
    this.disposables.forEach(dispose => dispose());
    this.disposables.length = 0;
  }

  now(): number {
    this._replayLogOnce();
    this._syncRealTime();
    return this._now.time;
  }

  install(time: number) {
    this._replayLogOnce();
    this._innerSetTime(asWallTime(time));
  }

  setSystemTime(time: number) {
    this._replayLogOnce();
    this._innerSetTime(asWallTime(time));
  }

  setFixedTime(time: number) {
    this._replayLogOnce();
    this._innerSetFixedTime(asWallTime(time));
  }

  performanceNow(): DOMHighResTimeStamp {
    this._replayLogOnce();
    this._syncRealTime();
    return this._now.ticks;
  }

  private _syncRealTime() {
    if (!this._realTime)
      return;
    const now = this._embedder.performanceNow();
    const sinceLastSync = now - this._realTime.lastSyncTicks;
    if (sinceLastSync > 0) {
      this._advanceNow(shiftTicks(this._now.ticks, sinceLastSync));
      this._realTime.lastSyncTicks = now;
    }
  }

  private _innerSetTime(time: WallTime) {
    this._now.time  = time;
    this._now.isFixedTime = false;
    if (this._now.origin < 0)
      this._now.origin = this._now.time;
  }

  private _innerSetFixedTime(time: WallTime) {
    this._innerSetTime(time);
    this._now.isFixedTime = true;
  }

  private _advanceNow(to: Ticks) {
    if (!this._now.isFixedTime)
      this._now.time = asWallTime(this._now.time + to - this._now.ticks);
    this._now.ticks = to;
  }

  async log(type: LogEntryType, time: number, param?: number) {
    this._log.push({ type, time, param });
  }

  async runFor(ticks: number) {
    this._replayLogOnce();
    if (ticks < 0)
      throw new TypeError('Negative ticks are not supported');
    await this._runTo(shiftTicks(this._now.ticks, ticks));
  }

  private async _runTo(to: Ticks) {
    to = Math.ceil(to) as Ticks;

    if (this._now.ticks > to)
      return;

    let firstException: Error | undefined;
    while (true) {
      const result = await this._callFirstTimer(to);
      if (!result.timerFound)
        break;
      firstException = firstException || result.error;
    }

    this._advanceNow(to);
    if (firstException)
      throw firstException;
  }

  async pauseAt(time: number): Promise<number> {
    this._replayLogOnce();
    this._innerPause();
    const toConsume = time - this._now.time;
    await this._innerFastForwardTo(shiftTicks(this._now.ticks, toConsume));
    return toConsume;
  }

  private _innerPause() {
    this._realTime = undefined;
    this._updateRealTimeTimer();
  }

  resume() {
    this._replayLogOnce();
    this._innerResume();
  }

  private _innerResume() {
    const now = this._embedder.performanceNow();
    this._realTime = { startTicks: now, lastSyncTicks: now };
    this._updateRealTimeTimer();
  }

  private _updateRealTimeTimer() {
    if (!this._realTime) {
      this._currentRealTimeTimer?.dispose();
      this._currentRealTimeTimer = undefined;
      return;
    }

    const firstTimer = this._firstTimer();

    // Either run the next timer or move time in 100ms chunks.
    const callAt = Math.min(firstTimer ? firstTimer.callAt : this._now.ticks + maxTimeout, this._now.ticks + 100) as Ticks;
    if (this._currentRealTimeTimer && this._currentRealTimeTimer.callAt < callAt)
      return;

    if (this._currentRealTimeTimer) {
      this._currentRealTimeTimer.dispose();
      this._currentRealTimeTimer = undefined;
    }

    this._currentRealTimeTimer = {
      callAt,
      dispose: this._embedder.setTimeout(() => {
        this._currentRealTimeTimer = undefined;
        this._syncRealTime();
        // eslint-disable-next-line no-console
        void this._runTo(this._now.ticks).catch(e => console.error(e)).then(() => this._updateRealTimeTimer());
      }, callAt - this._now.ticks),
    };
  }

  async fastForward(ticks: number) {
    this._replayLogOnce();
    await this._innerFastForwardTo(shiftTicks(this._now.ticks, ticks | 0));
  }

  private async _innerFastForwardTo(to: Ticks) {
    if (to < this._now.ticks)
      throw new Error('Cannot fast-forward to the past');
    for (const timer of this._timers.values()) {
      if (to > timer.callAt)
        timer.callAt = to;
    }
    await this._runTo(to);
  }

  addTimer(options: { func: TimerHandler, type: TimerType, delay?: number | string, args?: any[] }): number {
    this._replayLogOnce();

    if (options.type === TimerType.AnimationFrame && !options.func)
      throw new Error('Callback must be provided to requestAnimationFrame calls');
    if (options.type === TimerType.IdleCallback && !options.func)
      throw new Error('Callback must be provided to requestIdleCallback calls');
    if ([TimerType.Timeout, TimerType.Interval].includes(options.type) && !options.func && options.delay === undefined)
      throw new Error('Callback must be provided to timer calls');

    let delay = options.delay ? +options.delay : 0;
    if (!Number.isFinite(delay))
      delay = 0;
    delay = delay > maxTimeout ? 1 : delay;
    delay = Math.max(0, delay);

    const timer: Timer = {
      type: options.type,
      func: options.func,
      args: options.args || [],
      delay,
      callAt: shiftTicks(this._now.ticks, (delay || (this._duringTick ? 1 : 0))),
      createdAt: this._now.ticks,
      id: this._uniqueTimerId++,
      error: new Error(),
    };
    this._timers.set(timer.id, timer);
    if (this._realTime)
      this._updateRealTimeTimer();
    return timer.id;
  }

  countTimers() {
    return this._timers.size;
  }

  private _firstTimer(beforeTick?: number): Timer | null {
    let firstTimer: Timer | null = null;

    for (const timer of this._timers.values()) {
      const isInRange = beforeTick === undefined || timer.callAt <= beforeTick;
      if (isInRange && (!firstTimer || compareTimers(firstTimer, timer) === 1))
        firstTimer = timer;
    }
    return firstTimer;
  }

  private _takeFirstTimer(beforeTick?: number): Timer | null {
    const timer = this._firstTimer(beforeTick);
    if (!timer)
      return null;

    this._advanceNow(timer.callAt);

    if (timer.type === TimerType.Interval)
      timer.callAt = shiftTicks(timer.callAt, timer.delay);
    else
      this._timers.delete(timer.id);
    return timer;
  }

  private async _callFirstTimer(beforeTick: number): Promise<{ timerFound: boolean, error?: Error }> {
    const timer = this._takeFirstTimer(beforeTick);
    if (!timer)
      return { timerFound: false };

    this._duringTick = true;
    try {
      if (typeof timer.func !== 'function') {
        let error: Error | undefined;
        try {
          // Using global this is not correct here,
          // but it is already broken since the eval scope is different from the one
          // on the original call site.
          // eslint-disable-next-line no-restricted-globals
          (() => { globalThis.eval(timer.func); })();
        } catch (e) {
          error = e;
        }
        await new Promise<void>(f => this._embedder.setTimeout(f));
        return { timerFound: true, error };
      }

      let args = timer.args;
      if (timer.type === TimerType.AnimationFrame)
        args = [this._now.ticks];
      else if (timer.type === TimerType.IdleCallback)
        args = [{ didTimeout: false, timeRemaining: () => 0 }];

      let error: Error | undefined;
      try {
        timer.func.apply(null, args);
      } catch (e) {
        error = e;
      }
      await new Promise<void>(f => this._embedder.setTimeout(f));
      return { timerFound: true, error };
    } finally {
      this._duringTick = false;
    }
  }

  getTimeToNextFrame() {
    return 16 - this._now.ticks % 16;
  }

  clearTimer(timerId: number, type: TimerType) {
    this._replayLogOnce();

    if (!timerId) {
      // null appears to be allowed in most browsers, and appears to be
      // relied upon by some libraries, like Bootstrap carousel
      return;
    }

    // in Node, the ID is stored as the primitive value for `Timeout` objects
    // for `Immediate` objects, no ID exists, so it gets coerced to NaN
    const id = Number(timerId);

    if (Number.isNaN(id) || id < idCounterStart) {
      const handlerName = getClearHandler(type);
      new Error(`Clock: ${handlerName} was invoked to clear a native timer instead of one created by the clock library.`);
    }

    const timer = this._timers.get(id);
    if (timer) {
      if (
        timer.type === type ||
        (timer.type === 'Timeout' && type === 'Interval') ||
        (timer.type === 'Interval' && type === 'Timeout')
      ) {
        this._timers.delete(id);
      } else {
        const clear = getClearHandler(type);
        const schedule = getScheduleHandler(timer.type);
        throw new Error(
            `Cannot clear timer: timer created with ${schedule}() but cleared with ${clear}()`,
        );
      }
    }
  }

  private _replayLogOnce() {
    if (!this._log.length)
      return;

    let lastLogTime = -1;
    let isPaused = false;

    for (const { type, time, param } of this._log) {
      if (!isPaused && lastLogTime !== -1)
        this._advanceNow(shiftTicks(this._now.ticks, time - lastLogTime));
      lastLogTime = time;

      if (type === 'install') {
        this._innerSetTime(asWallTime(param!));
      } else if (type === 'fastForward' || type === 'runFor') {
        this._advanceNow(shiftTicks(this._now.ticks, param!));
      } else if (type === 'pauseAt') {
        isPaused = true;
        this._innerPause();
        this._innerSetTime(asWallTime(param!));
      } else if (type === 'resume') {
        this._innerResume();
        isPaused = false;
      } else if (type === 'setFixedTime') {
        this._innerSetFixedTime(asWallTime(param!));
      } else if (type === 'setSystemTime') {
        this._innerSetTime(asWallTime(param!));
      }
    }

    if (!isPaused && lastLogTime > 0)
      this._advanceNow(shiftTicks(this._now.ticks, this._embedder.dateNow() - lastLogTime));

    this._log.length = 0;
  }
}

function mirrorDateProperties(target: any, source: Builtins['Date']): Builtins['Date'] {
  for (const prop in source) {
    if (source.hasOwnProperty(prop))
      target[prop] = (source as any)[prop];
  }
  target.toString = () => source.toString();
  target.prototype = source.prototype;
  target.parse = source.parse;
  target.UTC = source.UTC;
  target.prototype.toUTCString = source.prototype.toUTCString;
  target.isFake = true;
  return target;
}

function createDate(clock: ClockController, NativeDate: Builtins['Date']): Builtins['Date'] {
  // eslint-disable-next-line no-restricted-globals
  function ClockDate(this: typeof ClockDate, year: number, month: number, date: number, hour: number, minute: number, second: number, ms: number): Date | string {
    // the Date constructor called as a function, ref Ecma-262 Edition 5.1, section 15.9.2.
    // This remains so in the 10th edition of 2019 as well.
    if (!(this instanceof ClockDate))
      return new NativeDate(clock.now()).toString();

    // if Date is called as a constructor with 'new' keyword
    // Defensive and verbose to avoid potential harm in passing
    // explicit undefined when user does not pass argument
    switch (arguments.length) {
      case 0:
        return new NativeDate(clock.now());
      case 1:
        return new NativeDate(year);
      case 2:
        return new NativeDate(year, month);
      case 3:
        return new NativeDate(year, month, date);
      case 4:
        return new NativeDate(year, month, date, hour);
      case 5:
        return new NativeDate(year, month, date, hour, minute);
      case 6:
        return new NativeDate(
            year,
            month,
            date,
            hour,
            minute,
            second,
        );
      default:
        return new NativeDate(
            year,
            month,
            date,
            hour,
            minute,
            second,
            ms,
        );
    }
  }

  ClockDate.now = () => clock.now();
  return mirrorDateProperties(ClockDate, NativeDate);
}

/**
 * Mirror Intl by default on our fake implementation
 *
 * Most of the properties are the original native ones,
 * but we need to take control of those that have a
 * dependency on the current clock.
 */
function createIntl(clock: ClockController, NativeIntl: Builtins['Intl']): Builtins['Intl'] {
  const ClockIntl: any = {};
  /*
    * All properties of Intl are non-enumerable, so we need
    * to do a bit of work to get them out.
    */
  for (const key of Object.getOwnPropertyNames(NativeIntl) as (keyof Builtins['Intl'])[])
    ClockIntl[key] = NativeIntl[key];

  ClockIntl.DateTimeFormat = function(...args: any[]) {
    const realFormatter = new NativeIntl.DateTimeFormat(...args);
    // eslint-disable-next-line no-restricted-globals
    const formatter: Intl.DateTimeFormat = {
      formatRange: realFormatter.formatRange.bind(realFormatter),
      formatRangeToParts: realFormatter.formatRangeToParts.bind(realFormatter),
      resolvedOptions: realFormatter.resolvedOptions.bind(realFormatter),
      format: date => realFormatter.format(date || clock.now()),
      formatToParts: date => realFormatter.formatToParts(date || clock.now()),
    };

    return formatter;
  };

  ClockIntl.DateTimeFormat.prototype = Object.create(
      NativeIntl.DateTimeFormat.prototype,
  );

  ClockIntl.DateTimeFormat.supportedLocalesOf =
    NativeIntl.DateTimeFormat.supportedLocalesOf;

  return ClockIntl;
}

function compareTimers(a: Timer, b: Timer) {
  // Sort first by absolute timing
  if (a.callAt < b.callAt)
    return -1;
  if (a.callAt > b.callAt)
    return 1;

  // Sort next by immediate, immediate timers take precedence
  if (a.type === TimerType.Immediate && b.type !== TimerType.Immediate)
    return -1;
  if (a.type !== TimerType.Immediate && b.type === TimerType.Immediate)
    return 1;

  // Sort next by creation time, earlier-created timers take precedence
  if (a.createdAt < b.createdAt)
    return -1;
  if (a.createdAt > b.createdAt)
    return 1;

  // Sort next by id, lower-id timers take precedence
  if (a.id < b.id)
    return -1;
  if (a.id > b.id)
    return 1;

  // As timer ids are unique, no fallback `0` is necessary
}

const maxTimeout = Math.pow(2, 31) - 1;  // see https://heycam.github.io/webidl/#abstract-opdef-converttoint
const idCounterStart = 1e12; // arbitrarily large number to avoid collisions with native timer IDs

function platformOriginals(globalObject: WindowOrWorkerGlobalScope): { raw: Builtins, bound: Builtins } {
  const raw: Builtins = {
    setTimeout: globalObject.setTimeout,
    clearTimeout: globalObject.clearTimeout,
    setInterval: globalObject.setInterval,
    clearInterval: globalObject.clearInterval,
    requestAnimationFrame: (globalObject as any).requestAnimationFrame ? (globalObject as any).requestAnimationFrame : undefined,
    cancelAnimationFrame: (globalObject as any).cancelAnimationFrame ? (globalObject as any).cancelAnimationFrame : undefined,
    requestIdleCallback: (globalObject as any).requestIdleCallback ? (globalObject as any).requestIdleCallback : undefined,
    cancelIdleCallback: (globalObject as any).cancelIdleCallback ? (globalObject as any).cancelIdleCallback : undefined,
    Date: (globalObject as any).Date,
    performance: globalObject.performance,
    Intl: (globalObject as any).Intl,
  };
  const bound = { ...raw };
  for (const key of Object.keys(bound) as (keyof Builtins)[]) {
    if (key !== 'Date' && typeof bound[key] === 'function')
      bound[key] = (bound[key] as any).bind(globalObject);
  }
  return { raw, bound };
}

/**
 * Gets schedule handler name for a given timer type
 */
function getScheduleHandler(type: TimerType) {
  if (type === 'IdleCallback' || type === 'AnimationFrame')
    return `request${type}`;

  return `set${type}`;
}

function createApi(clock: ClockController, originals: Builtins): Builtins {
  return {
    setTimeout: (func: TimerHandler, timeout?: number | undefined, ...args: any[]) => {
      const delay = timeout ? +timeout : timeout;
      return clock.addTimer({
        type: TimerType.Timeout,
        func,
        args,
        delay
      });
    },
    clearTimeout: (timerId: number | undefined): void => {
      if (timerId)
        clock.clearTimer(timerId, TimerType.Timeout);
    },
    setInterval: (func: TimerHandler, timeout?: number | undefined, ...args: any[]): number => {
      const delay = timeout ? +timeout : timeout;
      return clock.addTimer({
        type: TimerType.Interval,
        func,
        args,
        delay,
      });
    },
    clearInterval: (timerId: number | undefined): void => {
      if (timerId)
        return clock.clearTimer(timerId, TimerType.Interval);
    },
    requestAnimationFrame: (callback: FrameRequestCallback): number => {
      return clock.addTimer({
        type: TimerType.AnimationFrame,
        func: callback,
        delay: clock.getTimeToNextFrame(),
      });
    },
    cancelAnimationFrame: (timerId: number): void => {
      if (timerId)
        return clock.clearTimer(timerId, TimerType.AnimationFrame);
    },
    requestIdleCallback: (callback: IdleRequestCallback, options?: IdleRequestOptions | undefined): number => {
      let timeToNextIdlePeriod = 0;

      if (clock.countTimers() > 0)
        timeToNextIdlePeriod = 50; // const for now
      return clock.addTimer({
        type: TimerType.IdleCallback,
        func: callback,
        delay: options?.timeout ? Math.min(options?.timeout, timeToNextIdlePeriod) : timeToNextIdlePeriod,
      });
    },
    cancelIdleCallback: (timerId: number): void => {
      if (timerId)
        return clock.clearTimer(timerId, TimerType.IdleCallback);
    },
    Intl: originals.Intl ? createIntl(clock, originals.Intl) : (undefined as unknown as Builtins['Intl']),
    Date: createDate(clock, originals.Date),
    performance: originals.performance ? fakePerformance(clock, originals.performance) : (undefined as unknown as Builtins['performance']),
  };
}

function getClearHandler(type: TimerType) {
  if (type === 'IdleCallback' || type === 'AnimationFrame')
    return `cancel${type}`;

  return `clear${type}`;
}

function fakePerformance(clock: ClockController, performance: Builtins['performance']): Builtins['performance'] {
  const result: any = {
    now: () => clock.performanceNow(),
  };
  result.__defineGetter__('timeOrigin', () => clock._now.origin || 0);
  // eslint-disable-next-line no-proto
  for (const key of Object.keys((performance as any).__proto__)) {
    if (key === 'now' || key === 'timeOrigin')
      continue;
    if (key === 'getEntries' || key === 'getEntriesByName' || key === 'getEntriesByType')
      result[key] = () => [];
    else
      result[key] = () => {};
  }
  return result;
}

export function createClock(globalObject: WindowOrWorkerGlobalScope): { clock: ClockController, api: Builtins, originals: Builtins } {
  const originals = platformOriginals(globalObject);
  const embedder: Embedder = {
    dateNow: () => originals.raw.Date.now(),
    performanceNow: () => Math.ceil(originals.raw.performance!.now()) as EmbedderTicks,
    setTimeout: (task: () => void, timeout?: number) => {
      const timerId = originals.bound.setTimeout(task, timeout);
      return () => originals.bound.clearTimeout(timerId);
    },
    setInterval: (task: () => void, delay: number) => {
      const intervalId = originals.bound.setInterval(task, delay);
      return () => originals.bound.clearInterval(intervalId);
    },
  };

  const clock = new ClockController(embedder);
  const api = createApi(clock, originals.bound);
  return { clock, api, originals: originals.raw };
}

export function install(globalObject: WindowOrWorkerGlobalScope, config: InstallConfig = {}): { clock: ClockController, api: Builtins, originals: Builtins } {
  if ((globalObject as any).Date?.isFake) {
    // Timers are already faked; this is a problem.
    // Make the user reset timers before continuing.
    throw new TypeError(`Can't install fake timers twice on the same global object.`);
  }

  const { clock, api, originals } = createClock(globalObject);
  const toFake = config.toFake?.length ? config.toFake : Object.keys(originals) as (keyof Builtins)[];

  for (const method of toFake) {
    if (method === 'Date') {
      (globalObject as any).Date = mirrorDateProperties(api.Date, (globalObject as any).Date);
    } else if (method === 'Intl') {
      (globalObject as any).Intl = api[method]!;
    } else if (method === 'performance') {
      (globalObject as any).performance = api[method]!;
      const kEventTimeStamp = Symbol('playwrightEventTimeStamp');
      Object.defineProperty(Event.prototype, 'timeStamp', {
        get() {
          if (!this[kEventTimeStamp])
            this[kEventTimeStamp] = api.performance?.now();
          return this[kEventTimeStamp];
        }
      });
    } else {
      (globalObject as any)[method] = (...args: any[]) => {
        return (api[method] as any).apply(api, args);
      };
    }
    clock.disposables.push(() => {
      (globalObject as any)[method] = originals[method];
    });
  }

  return { clock, api, originals };
}

export function inject(globalObject: WindowOrWorkerGlobalScope) {
  const builtins = platformOriginals(globalObject).bound;
  const { clock: controller } = install(globalObject);
  controller.resume();
  return {
    controller,
    builtins,
  };
}

function asWallTime(n: number): WallTime {
  return n as WallTime;
}

function shiftTicks(ticks: Ticks, ms: number): Ticks {
  return ticks + ms as Ticks;
}

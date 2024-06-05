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

type ClockMethods = {
  Date: DateConstructor;
  setTimeout: Window['setTimeout'];
  clearTimeout: Window['clearTimeout'];
  setInterval: Window['setInterval'];
  clearInterval: Window['clearInterval'];
  requestAnimationFrame?: Window['requestAnimationFrame'];
  cancelAnimationFrame?: (id: number) => void;
  requestIdleCallback?: Window['requestIdleCallback'];
  cancelIdleCallback?: (id: number) => void;
  Intl?: typeof Intl;
  performance?: Window['performance'];
};

type ClockConfig = {
  now?: number | Date;
  loopLimit?: number;
};

type InstallConfig = ClockConfig & {
  toFake?: (keyof ClockMethods)[];
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
  callAt: number;
  createdAt: number;
  id: number;
  error?: Error;
};

interface Embedder {
  postTask(task: () => void): void;
  postTaskPeriodically(task: () => void, delay: number): () => void;
}

class Clock {
  readonly start: number;
  private _now: number;
  private _loopLimit: number;
  private _jobs: Timer[] = [];
  private _adjustedSystemTime = 0;
  private _duringTick = false;
  private _timers = new Map<number, Timer>();
  private _isNearInfiniteLimit = false;
  private _uniqueTimerId = idCounterStart;
  private _embedder: Embedder;
  readonly disposables: (() => void)[] = [];

  constructor(embedder: Embedder, startDate: Date | number | undefined, loopLimit: number = 1000) {
    const start = Math.floor(getEpoch(startDate));
    this.start = start;
    this._now = start;
    this._embedder = embedder;
    this._loopLimit = loopLimit;
  }

  uninstall() {
    this.disposables.forEach(dispose => dispose());
    this.disposables.length = 0;
  }

  now(): number {
    return this._now;
  }

  performanceNow(): DOMHighResTimeStamp {
    const millisSinceStart = this._now - this._adjustedSystemTime - this.start;
    const secsSinceStart = Math.floor(millisSinceStart / 1000);
    const millis = secsSinceStart * 1000;
    return millis;
  }

  private _doTick(tickValue: number | string, isAsync: boolean, resolve?: (time: number) => void, reject?: (error: Error) => void): number | undefined {
    const msFloat =
      typeof tickValue === 'number'
        ? tickValue
        : parseTime(tickValue);
    const ms = Math.floor(msFloat);
    let tickTo = this._now + ms;

    if (msFloat < 0)
      throw new TypeError('Negative ticks are not supported');

    let tickFrom = this._now;
    let previous = this._now;
    // ESLint fails to detect this correctly
    /* eslint-disable prefer-const */
    let timer;
    let firstException: Error;
    let oldNow: number;
    let nextPromiseTick: (() => void) | null;
    let compensationCheck: () => void;
    let postTimerCall: () => void;

    /* eslint-enable prefer-const */

    this._duringTick = true;

    // perform microtasks
    oldNow = this._now;
    this._runJobs();
    if (oldNow !== this._now) {
      // compensate for any setSystemTime() call during microtask callback
      tickFrom += this._now - oldNow;
      tickTo += this._now - oldNow;
    }

    const doTickInner = (): number | undefined => {
      // perform each timer in the requested range
      timer = this._firstTimerInRange(tickFrom, tickTo);
      while (timer && tickFrom <= tickTo) {
        if (this._timers.has(timer.id)) {
          tickFrom = timer.callAt;
          this._now = timer.callAt;
          oldNow = this._now;
          try {
            this._runJobs();
            this._callTimer(timer);
          } catch (e) {
            firstException = firstException || e;
          }

          if (isAsync) {
            // finish up after native setImmediate callback to allow
            // all native es6 promises to process their callbacks after
            // each timer fires.
            this._embedder.postTask(nextPromiseTick!);
            return;
          }
          compensationCheck();
        }
        postTimerCall();
      }

      // perform process.nextTick()s again
      oldNow = this._now;
      this._runJobs();
      if (oldNow !== this._now) {
        // compensate for any setSystemTime() call during process.nextTick() callback
        tickFrom += this._now - oldNow;
        tickTo += this._now - oldNow;
      }
      this._duringTick = false;

      // corner case: during runJobs new timers were scheduled which could be in the range [clock.now, tickTo]
      timer = this._firstTimerInRange(tickFrom, tickTo);
      if (timer) {
        try {
          this.tick(tickTo - this._now); // do it all again - for the remainder of the requested range
        } catch (e) {
          firstException = firstException || e;
        }
      } else {
        // no timers remaining in the requested range: move the clock all the way to the end
        this._now = tickTo;
      }
      if (firstException)
        throw firstException;

      if (isAsync)
        resolve!(this._now);
      else
        return this._now;
    };

    nextPromiseTick =
      isAsync ?
        () => {
          try {
            compensationCheck();
            postTimerCall();
            doTickInner();
          } catch (e) {
            reject!(e);
          }
        } : null;

    compensationCheck = () => {
      // compensate for any setSystemTime() call during timer callback
      if (oldNow !== this._now) {
        tickFrom += this._now - oldNow;
        tickTo += this._now - oldNow;
        previous += this._now - oldNow;
      }
    };

    postTimerCall = () => {
      timer = this._firstTimerInRange(previous, tickTo);
      previous = tickFrom;
    };

    return doTickInner();
  }

  tick(tickValue: string | number): number {
    return this._doTick(tickValue, false)!;
  }

  tickAsync(tickValue: string | number): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      this._embedder.postTask(() => {
        try {
          this._doTick(tickValue, true, resolve, reject);
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  next() {
    this._runJobs();
    const timer = this._firstTimer();
    if (!timer)
      return this._now;

    this._duringTick = true;
    try {
      this._now = timer.callAt;
      this._callTimer(timer);
      this._runJobs();
      return this._now;
    } finally {
      this._duringTick = false;
    }
  }

  nextAsync() {
    return new Promise<number>((resolve, reject) => {
      this._embedder.postTask(() => {
        try {
          const timer = this._firstTimer();
          if (!timer) {
            resolve(this._now);
            return;
          }

          let err: Error;
          this._duringTick = true;
          this._now = timer.callAt;
          try {
            this._callTimer(timer);
          } catch (e) {
            err = e;
          }
          this._duringTick = false;

          this._embedder.postTask(() => {
            if (err)
              reject(err);
            else
              resolve(this._now);
          });
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  runAll() {
    this._runJobs();
    for (let i = 0; i < this._loopLimit; i++) {
      const numTimers = this._timers.size;
      if (numTimers === 0) {
        this._resetIsNearInfiniteLimit();
        return this._now;
      }

      this.next();
      this._checkIsNearInfiniteLimit(i);
    }

    const excessJob = this._firstTimer();
    throw this._getInfiniteLoopError(excessJob!);
  }

  runToFrame() {
    return this.tick(this.getTimeToNextFrame());
  }

  runAllAsync() {
    return new Promise<number>((resolve, reject) => {
      let i = 0;
      /**
       *
       */
      const doRun = () => {
        this._embedder.postTask(() => {
          try {
            this._runJobs();

            let numTimers;
            if (i < this._loopLimit) {
              if (!this._timers) {
                this._resetIsNearInfiniteLimit();
                resolve(this._now);
                return;
              }

              numTimers = this._timers.size;
              if (numTimers === 0) {
                this._resetIsNearInfiniteLimit();
                resolve(this._now);
                return;
              }

              this.next();
              i++;
              doRun();
              this._checkIsNearInfiniteLimit(i);
              return;
            }

            const excessJob = this._firstTimer();
            reject(this._getInfiniteLoopError(excessJob!));
          } catch (e) {
            reject(e);
          }
        });
      };
      doRun();
    });
  }

  runToLast() {
    const timer = this._lastTimer();
    if (!timer) {
      this._runJobs();
      return this._now;
    }
    return this.tick(timer.callAt - this._now);
  }

  runToLastAsync() {
    return new Promise<number>((resolve, reject) => {
      this._embedder.postTask(() => {
        try {
          const timer = this._lastTimer();
          if (!timer) {
            this._runJobs();
            resolve(this._now);
            return;
          }
          this.tickAsync(timer.callAt - this._now).then(resolve);
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  reset() {
    this._timers.clear();
    this._jobs = [];
    this._now = this.start;
  }

  setSystemTime(systemTime: Date | number) {
    // determine time difference
    const newNow = getEpoch(systemTime);
    const difference = newNow - this._now;

    this._adjustedSystemTime = this._adjustedSystemTime + difference;
    // update 'system clock'
    this._now = newNow;

    // update timers and intervals to keep them stable
    for (const timer of this._timers.values()) {
      timer.createdAt += difference;
      timer.callAt += difference;
    }
  }

  jump(tickValue: string | number): number {
    const msFloat =
      typeof tickValue === 'number'
        ? tickValue
        : parseTime(tickValue);
    const ms = Math.floor(msFloat);

    for (const timer of this._timers.values()) {
      if (this._now + ms > timer.callAt)
        timer.callAt = this._now + ms;
    }
    return this.tick(ms);
  }

  private _checkIsNearInfiniteLimit(i: number): void {
    if (this._loopLimit && i === this._loopLimit - 1)
      this._isNearInfiniteLimit = true;

  }

  private _resetIsNearInfiniteLimit() {
    this._isNearInfiniteLimit = false;
  }

  private _runJobs() {
    // runs all microtick-deferred tasks - ecma262/#sec-runjobs
    if (!this._jobs)
      return;
    for (let i = 0; i < this._jobs.length; i++) {
      const job = this._jobs[i];
      callFunction(job.func, job.args);

      this._checkIsNearInfiniteLimit(i);
      if (this._loopLimit && i > this._loopLimit)
        throw this._getInfiniteLoopError(job);

    }
    this._resetIsNearInfiniteLimit();
    this._jobs = [];
  }

  addTimer(options: { func: TimerHandler, type: TimerType, delay?: number | string, args?: any[] }): number {
    if (options.func === undefined)
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
      callAt: this._now + (delay || (this._duringTick ? 1 : 0)),
      createdAt: this._now,
      id: this._uniqueTimerId++,
      error: this._isNearInfiniteLimit ? new Error() : undefined,
    };
    this._timers.set(timer.id, timer);
    return timer.id;
  }

  private _firstTimerInRange(from: number, to: number): Timer | null {
    let firstTimer: Timer | null = null;
    for (const timer of this._timers.values()) {
      const isInRange = inRange(from, to, timer);
      if (isInRange && (!firstTimer || compareTimers(firstTimer, timer) === 1))
        firstTimer = timer;
    }
    return firstTimer;
  }

  countTimers() {
    return this._timers.size + this._jobs.length;
  }

  private _firstTimer(): Timer | null {
    let firstTimer: Timer | null = null;

    for (const timer of this._timers.values()) {
      if (!firstTimer || compareTimers(firstTimer, timer) === 1)
        firstTimer = timer;
    }
    return firstTimer;
  }

  private _lastTimer(): Timer | null {
    let lastTimer: Timer | null = null;

    for (const timer of this._timers.values()) {
      if (!lastTimer || compareTimers(lastTimer, timer) === -1)
        lastTimer = timer;
    }
    return lastTimer;
  }

  private _callTimer(timer: Timer) {
    if (timer.type === TimerType.Interval)
      this._timers.get(timer.id)!.callAt += timer.delay;
    else
      this._timers.delete(timer.id);
    callFunction(timer.func, timer.args);
  }

  private _getInfiniteLoopError(job: Timer) {
    const infiniteLoopError = new Error(
        `Aborting after running ${this._loopLimit} timers, assuming an infinite loop!`,
    );

    if (!job.error)
      return infiniteLoopError;

    // pattern never matched in Node
    const computedTargetPattern = /target\.*[<|(|[].*?[>|\]|)]\s*/;
    const clockMethodPattern = new RegExp(
        String(Object.keys(this).join('|')),
    );

    let matchedLineIndex = -1;
    job.error.stack!.split('\n').some((line, i) => {
      // If we've matched a computed target line (e.g. setTimeout) then we
      // don't need to look any further. Return true to stop iterating.
      const matchedComputedTarget = line.match(computedTargetPattern);
      /* istanbul ignore if */
      if (matchedComputedTarget) {
        matchedLineIndex = i;
        return true;
      }

      // If we've matched a clock method line, then there may still be
      // others further down the trace. Return false to keep iterating.
      const matchedClockMethod = line.match(clockMethodPattern);
      if (matchedClockMethod) {
        matchedLineIndex = i;
        return false;
      }

      // If we haven't matched anything on this line, but we matched
      // previously and set the matched line index, then we can stop.
      // If we haven't matched previously, then we should keep iterating.
      return matchedLineIndex >= 0;
    });

    const funcName = typeof job.func === 'function' ? job.func.name : 'anonymous';
    const stack = `${infiniteLoopError}\n${job.type || 'Microtask'} - ${funcName}\n${job.error.stack!
        .split('\n')
        .slice(matchedLineIndex + 1)
        .join('\n')}`;

    try {
      Object.defineProperty(infiniteLoopError, 'stack', {
        value: stack,
      });
    } catch (e) {
      // noop
    }

    return infiniteLoopError;
  }

  getTimeToNextFrame() {
    return 16 - ((this._now - this.start) % 16);
  }

  clearTimer(timerId: number, type: TimerType) {
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

  advanceAutomatically(advanceTimeDelta: number = 20): () => void {
    return this._embedder.postTaskPeriodically(
        () => this.tick(advanceTimeDelta!),
        advanceTimeDelta,
    );
  }
}

function getEpoch(epoch: Date | number | undefined): number {
  if (!epoch)
    return 0;
  if (typeof epoch !== 'number')
    return epoch.getTime();
  return epoch;
}

function inRange(from: number, to: number, timer: Timer): boolean {
  return timer && timer.callAt >= from && timer.callAt <= to;
}

/**
 * Parse strings like '01:10:00' (meaning 1 hour, 10 minutes, 0 seconds) into
 * number of milliseconds. This is used to support human-readable strings passed
 * to clock.tick()
 */
function parseTime(str: string): number {
  if (!str)
    return 0;

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

function mirrorDateProperties(target: any, source: typeof Date): DateConstructor & Date {
  let prop;
  for (prop of Object.keys(source) as (keyof DateConstructor)[])
    target[prop] = source[prop];
  target.toString = () => source.toString();
  target.prototype = source.prototype;
  target.parse = source.parse;
  target.UTC = source.UTC;
  target.prototype.toUTCString = source.prototype.toUTCString;
  target.isFake = true;
  return target;
}

function createDate(clock: Clock, NativeDate: typeof Date): DateConstructor & Date {
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
function createIntl(clock: Clock, NativeIntl: typeof Intl): typeof Intl {
  const ClockIntl: any = {};
  /*
    * All properties of Intl are non-enumerable, so we need
    * to do a bit of work to get them out.
    */
  for (const key of Object.keys(NativeIntl) as (keyof typeof Intl)[])
    ClockIntl[key] = NativeIntl[key];

  ClockIntl.DateTimeFormat = (...args: any[]) => {
    const realFormatter = new NativeIntl.DateTimeFormat(...args);
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

function callFunction(func: TimerHandler, args: any[]) {
  if (typeof func === 'function')
    func.apply(null, args);
  else
    (() => { eval(func); })();
}

const maxTimeout = Math.pow(2, 31) - 1;  // see https://heycam.github.io/webidl/#abstract-opdef-converttoint
const idCounterStart = 1e12; // arbitrarily large number to avoid collisions with native timer IDs

function platformOriginals(globalObject: WindowOrWorkerGlobalScope): ClockMethods {
  return {
    setTimeout: globalObject.setTimeout.bind(globalObject),
    clearTimeout: globalObject.clearTimeout.bind(globalObject),
    setInterval: globalObject.setInterval.bind(globalObject),
    clearInterval: globalObject.clearInterval.bind(globalObject),
    requestAnimationFrame: (globalObject as any).requestAnimationFrame ? (globalObject as any).requestAnimationFrame.bind(globalObject) : undefined,
    cancelAnimationFrame: (globalObject as any).cancelAnimationFrame ? (globalObject as any).cancelAnimationFrame.bind(globalObject) : undefined,
    requestIdleCallback: (globalObject as any).requestIdleCallback ? (globalObject as any).requestIdleCallback.bind(globalObject) : undefined,
    cancelIdleCallback: (globalObject as any).cancelIdleCallback ? (globalObject as any).cancelIdleCallback.bind(globalObject) : undefined,
    Date: (globalObject as any).Date,
    performance: globalObject.performance,
    Intl: (globalObject as any).Intl,
  };
}

/**
 * Gets schedule handler name for a given timer type
 */
function getScheduleHandler(type: TimerType) {
  if (type === 'IdleCallback' || type === 'AnimationFrame')
    return `request${type}`;

  return `set${type}`;
}

function createApi(clock: Clock, originals: ClockMethods): ClockMethods {
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
        get args() {
          return [clock.performanceNow()];
        },
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
        args: [],
        delay: options?.timeout ? Math.min(options?.timeout, timeToNextIdlePeriod) : timeToNextIdlePeriod,
      });
    },
    cancelIdleCallback: (timerId: number): void => {
      if (timerId)
        return clock.clearTimer(timerId, TimerType.IdleCallback);
    },
    Intl: originals.Intl ? createIntl(clock, originals.Intl) : undefined,
    Date: createDate(clock, originals.Date),
    performance: originals.performance ? fakePerformance(clock, originals.performance) : undefined,
  };
}

function getClearHandler(type: TimerType) {
  if (type === 'IdleCallback' || type === 'AnimationFrame')
    return `cancel${type}`;

  return `clear${type}`;
}

function fakePerformance(clock: Clock, performance: Performance): Performance {
  const result: any = {
    now: () => clock.performanceNow(),
    timeOrigin: clock.start,
    __proto__: performance,
  };
  return result;
}

export function createClock(globalObject: WindowOrWorkerGlobalScope, config: ClockConfig = {}): { clock: Clock, api: Partial<ClockMethods>, originals: Partial<ClockMethods> } {
  const originals = platformOriginals(globalObject);
  const embedder = {
    postTask: (task: () => void) => {
      originals.setTimeout!(task, 0);
    },
    postTaskPeriodically: (task: () => void, delay: number) => {
      const intervalId = globalObject.setInterval(task, delay);
      return () => originals.clearInterval!(intervalId);
    },
  };

  const clock = new Clock(embedder, config.now, config.loopLimit);
  const api = createApi(clock, originals);
  return { clock, api, originals };
}

export function install(globalObject: WindowOrWorkerGlobalScope, config: InstallConfig = {}): { clock: Clock, api: Partial<ClockMethods>, originals: Partial<ClockMethods> } {
  if ((globalObject as any).Date?.isFake) {
    // Timers are already faked; this is a problem.
    // Make the user reset timers before continuing.
    throw new TypeError(`Can't install fake timers twice on the same global object.`);
  }

  const { clock, api, originals } = createClock(globalObject, config);
  const toFake = config.toFake?.length ? config.toFake : Object.keys(originals) as (keyof ClockMethods)[];

  for (const method of toFake) {
    if (method === 'Date') {
      (globalObject as any).Date = mirrorDateProperties(api.Date, (globalObject as any).Date);
    } else if (method === 'Intl') {
      (globalObject as any).Intl = api[method]!;
    } else if (method === 'performance') {
      (globalObject as any).performance = api[method]!;
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
  return {
    install: (config: InstallConfig) => {
      const { clock } = install(globalObject, config);
      return clock;
    },
    builtin: platformOriginals(globalObject),
  };
}

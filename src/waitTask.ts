// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { assert, helper } from './helper';
import * as js from './javascript';
import { TimeoutError } from './Errors';
import Injected from './injected/injected';

export type WaitTaskParams = {
  // TODO: ensure types.
  predicateBody: Function | string;
  title: string;
  polling: string | number;
  timeout: number;
  args: any[];
  passInjected?: boolean;
};

export class WaitTask {
  readonly promise: Promise<js.JSHandle>;
  private _cleanup: () => void;
  private _params: WaitTaskParams & { predicateBody: string };
  private _runCount: number;
  private _resolve: (result: js.JSHandle) => void;
  private _reject: (reason: Error) => void;
  private _timeoutTimer: NodeJS.Timer;
  private _terminated: boolean;

  constructor(params: WaitTaskParams, cleanup: () => void) {
    if (helper.isString(params.polling))
      assert(params.polling === 'raf' || params.polling === 'mutation', 'Unknown polling option: ' + params.polling);
    else if (helper.isNumber(params.polling))
      assert(params.polling > 0, 'Cannot poll with non-positive interval: ' + params.polling);
    else
      throw new Error('Unknown polling options: ' + params.polling);

    this._params = {
      ...params,
      predicateBody: helper.isString(params.predicateBody) ? 'return (' + params.predicateBody + ')' : 'return (' + params.predicateBody + ')(...args)'
    };
    this._cleanup = cleanup;
    this._runCount = 0;
    this.promise = new Promise<js.JSHandle>((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
    // Since page navigation requires us to re-install the pageScript, we should track
    // timeout on our end.
    if (params.timeout) {
      const timeoutError = new TimeoutError(`waiting for ${params.title} failed: timeout ${params.timeout}ms exceeded`);
      this._timeoutTimer = setTimeout(() => this.terminate(timeoutError), params.timeout);
    }
  }

  terminate(error: Error) {
    this._terminated = true;
    this._reject(error);
    this._doCleanup();
  }

  async rerun(context: js.ExecutionContext) {
    const runCount = ++this._runCount;
    let success: js.JSHandle | null = null;
    let error = null;
    try {
      assert(context._domWorld, 'Wait task requires a dom world');
      success = await context.evaluateHandle(waitForPredicatePageFunction, await context._domWorld.injected(), this._params.predicateBody, this._params.polling, this._params.timeout, !!this._params.passInjected, ...this._params.args);
    } catch (e) {
      error = e;
    }

    if (this._terminated || runCount !== this._runCount) {
      if (success)
        await success.dispose();
      return;
    }

    // Ignore timeouts in pageScript - we track timeouts ourselves.
    // If execution context has been already destroyed, `context.evaluate` will
    // throw an error - ignore this predicate run altogether.
    if (!error && await context.evaluate(s => !s, success).catch(e => true)) {
      await success.dispose();
      return;
    }

    // When the page is navigated, the promise is rejected.
    // We will try again in the new execution context.
    if (error && error.message.includes('Execution context was destroyed'))
      return;

    // We could have tried to evaluate in a context which was already
    // destroyed.
    if (error && error.message.includes('Cannot find context with specified id'))
      return;

    if (error)
      this._reject(error);
    else
      this._resolve(success);

    this._doCleanup();
  }

  _doCleanup() {
    clearTimeout(this._timeoutTimer);
    this._cleanup();
  }
}

async function waitForPredicatePageFunction(injected: Injected, predicateBody: string, polling: string | number, timeout: number, passInjected: boolean, ...args): Promise<any> {
  if (passInjected)
    args = [injected, ...args];
  const predicate = new Function('...args', predicateBody);
  let timedOut = false;
  if (timeout)
    setTimeout(() => timedOut = true, timeout);
  if (polling === 'raf')
    return await pollRaf();
  if (polling === 'mutation')
    return await pollMutation();
  if (typeof polling === 'number')
    return await pollInterval(polling);

  function pollMutation(): Promise<any> {
    const success = predicate.apply(null, args);
    if (success)
      return Promise.resolve(success);

    let fulfill;
    const result = new Promise(x => fulfill = x);
    const observer = new MutationObserver(mutations => {
      if (timedOut) {
        observer.disconnect();
        fulfill();
      }
      const success = predicate.apply(null, args);
      if (success) {
        observer.disconnect();
        fulfill(success);
      }
    });
    observer.observe(document, {
      childList: true,
      subtree: true,
      attributes: true
    });
    return result;
  }

  function pollRaf(): Promise<any> {
    let fulfill;
    const result = new Promise(x => fulfill = x);
    onRaf();
    return result;

    function onRaf() {
      if (timedOut) {
        fulfill();
        return;
      }
      const success = predicate.apply(null, args);
      if (success)
        fulfill(success);
      else
        requestAnimationFrame(onRaf);
    }
  }

  function pollInterval(pollInterval: number): Promise<any> {
    let fulfill;
    const result = new Promise(x => fulfill = x);
    onTimeout();
    return result;

    function onTimeout() {
      if (timedOut) {
        fulfill();
        return;
      }
      const success = predicate.apply(null, args);
      if (success)
        fulfill(success);
      else
        setTimeout(onTimeout, pollInterval);
    }
  }
}

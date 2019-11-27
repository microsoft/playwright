// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { assert, helper } from './helper';
import * as types from './types';
import { TimeoutError } from './Errors';

export type WaitTaskParams = {
  // TODO: ensure types.
  predicateBody: Function | string;
  title: string;
  polling: string | number;
  timeout: number;
  args: any[];
};

export class WaitTask<JSHandle extends types.JSHandle<JSHandle, ElementHandle>, ElementHandle extends types.ElementHandle<JSHandle, ElementHandle>> {
  readonly promise: Promise<JSHandle>;
  private _cleanup: () => void;
  private _params: WaitTaskParams & { predicateBody: string };
  private _runCount: number;
  private _resolve: (result: JSHandle) => void;
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
    this.promise = new Promise<JSHandle>((resolve, reject) => {
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

  async rerun(context: types.ExecutionContext<JSHandle, ElementHandle>) {
    const runCount = ++this._runCount;
    let success: JSHandle | null = null;
    let error = null;
    try {
      success = await context.evaluateHandle(waitForPredicatePageFunction, this._params.predicateBody, this._params.polling, this._params.timeout, ...this._params.args);
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

export function waitForSelectorOrXPath(
  selectorOrXPath: string,
  isXPath: boolean,
  options: { visible?: boolean, hidden?: boolean, timeout: number }): WaitTaskParams {
  const { visible: waitForVisible = false, hidden: waitForHidden = false, timeout } = options;
  const polling = waitForVisible || waitForHidden ? 'raf' : 'mutation';
  const title = `${isXPath ? 'XPath' : 'selector'} "${selectorOrXPath}"${waitForHidden ? ' to be hidden' : ''}`;
  const params: WaitTaskParams = {
    predicateBody: predicate,
    title,
    polling,
    timeout,
    args: [selectorOrXPath, isXPath, waitForVisible, waitForHidden]
  };
  return params;

  function predicate(selectorOrXPath: string, isXPath: boolean, waitForVisible: boolean, waitForHidden: boolean): (Node | boolean) | null {
    const node = isXPath
      ? document.evaluate(selectorOrXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue
      : document.querySelector(selectorOrXPath);
    if (!node)
      return waitForHidden;
    if (!waitForVisible && !waitForHidden)
      return node;
    const element = (node.nodeType === Node.TEXT_NODE ? node.parentElement : node) as Element;
    const style = window.getComputedStyle(element);
    const isVisible = style && style.visibility !== 'hidden' && hasVisibleBoundingBox();
    const success = (waitForVisible === isVisible || waitForHidden === !isVisible);
    return success ? node : null;

    function hasVisibleBoundingBox(): boolean {
      const rect = element.getBoundingClientRect();
      return !!(rect.top || rect.bottom || rect.width || rect.height);
    }
  }
}

async function waitForPredicatePageFunction(predicateBody: string, polling: string | number, timeout: number, ...args): Promise<any> {
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

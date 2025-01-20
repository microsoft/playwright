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
import type * as api from '../../types/types';
import * as network from './network';
import { urlMatches, urlMatchesEqual, type URLMatch } from '../utils/isomorphic/urlMatch';
import type { LocalUtils } from './localUtils';
import type * as channels from '@protocol/channels';
import { EventEmitter } from './eventEmitter';
import type { WaitForEventOptions } from './types';
import { Waiter } from './waiter';
import { Events } from './events';
import { isString } from '../utils/isomorphic/stringUtils';
import { isRegExp } from '../utils';
import { trimUrl } from './page';
import { TimeoutSettings } from '../common/timeoutSettings';

export class MockingProxyFactory implements api.MockingProxyFactory {
  constructor(private _localUtils: LocalUtils) {}
  async newProxy(port: number): Promise<api.MockingProxy> {
    return await MockingProxy.create(this._localUtils, port);
  }
}

export class MockingProxy extends EventEmitter implements api.MockingProxy {
  _routes: network.RouteHandler[] = [];
  private _localUtils: LocalUtils;
  private _port: number;
  private _timeoutSettings = new TimeoutSettings();

  private routeListener = ({ route }: channels.LocalUtilsRouteEvent) => {
    this._onRoute(network.Route.from(route));
  };
  private failedListener = (params: channels.LocalUtilsRequestFailedEvent) => {
    const request = network.Request.from(params.request);
    if (params.failureText)
      request._failureText = params.failureText;
    request._setResponseEndTiming(params.responseEndTiming);
    this.emit('requestfailed', request);
  };
  private finishedListener = (params: channels.LocalUtilsRequestFinishedEvent) => {
    const { responseEndTiming } = params;
    const request = network.Request.from(params.request);
    const response = network.Response.fromNullable(params.response);
    request._setResponseEndTiming(responseEndTiming);
    this.emit('requestfinished', request);
    response?._finishedPromise.resolve(null);
  };
  private responseListener = ({ response }: channels.LocalUtilsResponseEvent) => {
    this.emit('response', network.Response.from(response));
  };
  private requestListener = ({ request }: channels.LocalUtilsRequestEvent) => {
    this.emit('request', network.Request.from(request));
  };

  private constructor(localUtils: LocalUtils, port: number) {
    super();

    this._localUtils = localUtils;
    this._port = port;

    this._localUtils._channel.on('route', this.routeListener);
    this._localUtils._channel.on('request', this.requestListener);
    this._localUtils._channel.on('requestFailed', this.failedListener);
    this._localUtils._channel.on('requestFinished', this.finishedListener);
    this._localUtils._channel.on('response', this.responseListener);
  }

  private async _start() {
    await this._localUtils._channel.setServerNetworkInterceptionPatterns({ patterns: [], port: this._port });
  }

  static async create(localUtils: LocalUtils, port: number) {
    const instance = new MockingProxy(localUtils, port);
    await instance._start();
    return instance;
  }

  dispose() {
    this._localUtils._channel.off('route', this.routeListener);
    this._localUtils._channel.off('request', this.requestListener);
    this._localUtils._channel.off('requestFailed', this.failedListener);
    this._localUtils._channel.off('requestFinished', this.finishedListener);
    this._localUtils._channel.off('response', this.responseListener);
  }

  async route(url: URLMatch, handler: network.RouteHandlerCallback, options: { times?: number } = {}): Promise<void> {
    this._routes.unshift(new network.RouteHandler(undefined, url, handler, options.times));
    await this._updateInterceptionPatterns();
  }

  async unrouteAll(options?: { behavior?: 'wait' | 'ignoreErrors' | 'default' }): Promise<void> {
    await this._unrouteInternal(this._routes, [], options?.behavior);
  }

  async unroute(url: URLMatch, handler?: network.RouteHandlerCallback): Promise<void> {
    const removed = [];
    const remaining = [];
    for (const route of this._routes) {
      if (urlMatchesEqual(route.url, url) && (!handler || route.handler === handler))
        removed.push(route);
      else
        remaining.push(route);
    }
    await this._unrouteInternal(removed, remaining, 'default');
  }

  private async _unrouteInternal(removed: network.RouteHandler[], remaining: network.RouteHandler[], behavior?: 'wait' | 'ignoreErrors' | 'default'): Promise<void> {
    this._routes = remaining;
    await this._updateInterceptionPatterns();
    if (!behavior || behavior === 'default')
      return;
    const promises = removed.map(routeHandler => routeHandler.stop(behavior));
    await Promise.all(promises);
  }

  async _onRoute(route: network.Route) {
    route._request = this._localUtils.requestContext;
    const routeHandlers = this._routes.slice();
    for (const routeHandler of routeHandlers) {
      if (!routeHandler.matches(route.request().url()))
        continue;
      const index = this._routes.indexOf(routeHandler);
      if (index === -1)
        continue;
      if (routeHandler.willExpire())
        this._routes.splice(index, 1);
      const handled = await routeHandler.handle(route);
      if (!this._routes.length)
        this._updateInterceptionPatterns();
      if (handled)
        return;
    }
    // If the page is closed or unrouteAll() was called without waiting and interception disabled,
    // the method will throw an error - silence it.
    await route._innerContinue(true /* isFallback */).catch(() => { });
  }

  private async _updateInterceptionPatterns() {
    const patterns = network.RouteHandler.prepareInterceptionPatterns(this._routes);
    await this._localUtils._channel.setServerNetworkInterceptionPatterns({ patterns, port: this._port });
  }

  async waitForRequest(urlOrPredicate: string | RegExp | ((r: network.Request) => boolean | Promise<boolean>), options: { timeout?: number } = {}): Promise<network.Request> {
    const predicate = async (request: network.Request) => {
      if (isString(urlOrPredicate) || isRegExp(urlOrPredicate))
        return urlMatches(undefined, request.url(), urlOrPredicate);
      return await urlOrPredicate(request);
    };
    const trimmedUrl = trimUrl(urlOrPredicate);
    const logLine = trimmedUrl ? `waiting for request ${trimmedUrl}` : undefined;
    return await this._waitForEvent(Events.Page.Request, { predicate, timeout: options.timeout }, logLine);
  }

  async waitForResponse(urlOrPredicate: string | RegExp | ((r: network.Response) => boolean | Promise<boolean>), options: { timeout?: number } = {}): Promise<network.Response> {
    const predicate = async (response: network.Response) => {
      if (isString(urlOrPredicate) || isRegExp(urlOrPredicate))
        return urlMatches(undefined, response.url(), urlOrPredicate);
      return await urlOrPredicate(response);
    };
    const trimmedUrl = trimUrl(urlOrPredicate);
    const logLine = trimmedUrl ? `waiting for response ${trimmedUrl}` : undefined;
    return await this._waitForEvent(Events.Page.Response, { predicate, timeout: options.timeout }, logLine);
  }

  async waitForEvent(event: string, optionsOrPredicate: WaitForEventOptions = {}): Promise<any> {
    const result = await this._waitForEvent(event, optionsOrPredicate, `waiting for event "${event}"`);
    await this._updateInterceptionPatterns();
    return result;
  }

  private async _waitForEvent(event: string, optionsOrPredicate: WaitForEventOptions, logLine?: string): Promise<any> {
    return await this._localUtils._wrapApiCall(async () => {
      const timeout = this._timeoutSettings.timeout(typeof optionsOrPredicate === 'function' ? {} : optionsOrPredicate);
      const predicate = typeof optionsOrPredicate === 'function' ? optionsOrPredicate : optionsOrPredicate.predicate;
      const waiter = Waiter.createForEvent(this._localUtils, event);
      if (logLine)
        waiter.log(logLine);
      waiter.rejectOnTimeout(timeout, `Timeout ${timeout}ms exceeded while waiting for event "${event}"`);
      const result = await waiter.waitForEvent(this, event, predicate as any);
      waiter.dispose();
      return result;
    });
  }

  port(): number {
    return this._port;
  }

}

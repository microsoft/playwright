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

import { BrowserContext } from '../browserContext';
import type { APIRequestEvent, APIRequestFinishedEvent } from '../fetch';
import { APIRequestContext } from '../fetch';
import { helper } from '../helper';
import * as network from '../network';
import { Page } from '../page';
import type * as har from './har';
import { calculateSha1, monotonicTime } from '../../utils';
import type { RegisteredListener } from '../../utils/eventsHelper';
import { eventsHelper } from '../../utils/eventsHelper';
import { mime } from '../../utilsBundle';
import { ManualPromise } from '../../utils/manualPromise';
import { getPlaywrightVersion } from '../../common/userAgent';

const FALLBACK_HTTP_VERSION = 'HTTP/1.1';

export interface HarTracerDelegate {
  onEntryStarted(entry: har.Entry): void;
  onEntryFinished(entry: har.Entry): void;
  onContentBlob(sha1: string, buffer: Buffer): void;
}

type HarTracerOptions = {
  content: 'omit' | 'sha1' | 'embedded';
  skipScripts: boolean;
  waitForContentOnStop: boolean;
};

export class HarTracer {
  private _context: BrowserContext | APIRequestContext;
  private _barrierPromises = new Set<Promise<void>>();
  private _delegate: HarTracerDelegate;
  private _options: HarTracerOptions;
  private _pageEntries = new Map<Page, har.Page>();
  private _eventListeners: RegisteredListener[] = [];
  private _started = false;
  private _entrySymbol: symbol;

  constructor(context: BrowserContext | APIRequestContext, delegate: HarTracerDelegate, options: HarTracerOptions) {
    this._context = context;
    this._delegate = delegate;
    this._options = options;
    this._entrySymbol = Symbol('requestHarEntry');
  }

  start() {
    if (this._started)
      return;
    this._started = true;
    const apiRequest = this._context instanceof APIRequestContext ? this._context : this._context.fetchRequest;
    this._eventListeners = [
      eventsHelper.addEventListener(apiRequest, APIRequestContext.Events.Request, (event: APIRequestEvent) => this._onAPIRequest(event)),
      eventsHelper.addEventListener(apiRequest, APIRequestContext.Events.RequestFinished, (event: APIRequestFinishedEvent) => this._onAPIRequestFinished(event)),
    ];
    if (this._context instanceof BrowserContext) {
      this._eventListeners.push(
          eventsHelper.addEventListener(this._context, BrowserContext.Events.Page, (page: Page) => this._ensurePageEntry(page)),
          eventsHelper.addEventListener(this._context, BrowserContext.Events.Request, (request: network.Request) => this._onRequest(request)),
          eventsHelper.addEventListener(this._context, BrowserContext.Events.RequestFinished, ({ request, response }) => this._onRequestFinished(request, response).catch(() => {})),
          eventsHelper.addEventListener(this._context, BrowserContext.Events.RequestFailed, request => this._onRequestFailed(request)),
          eventsHelper.addEventListener(this._context, BrowserContext.Events.Response, (response: network.Response) => this._onResponse(response)));
    }

  }

  private _entryForRequest(request: network.Request | APIRequestEvent): har.Entry | undefined {
    return (request as any)[this._entrySymbol];
  }

  private _ensurePageEntry(page: Page) {
    let pageEntry = this._pageEntries.get(page);
    if (!pageEntry) {
      page.on(Page.Events.DOMContentLoaded, () => this._onDOMContentLoaded(page));
      page.on(Page.Events.Load, () => this._onLoad(page));

      pageEntry = {
        startedDateTime: new Date(),
        id: page.guid,
        title: '',
        pageTimings: {
          onContentLoad: -1,
          onLoad: -1,
        },
      };
      this._pageEntries.set(page, pageEntry);
    }
    return pageEntry;
  }

  private _onDOMContentLoaded(page: Page) {
    const pageEntry = this._ensurePageEntry(page);
    const promise = page.mainFrame().evaluateExpression(String(() => {
      return {
        title: document.title,
        domContentLoaded: performance.timing.domContentLoadedEventStart,
      };
    }), true, undefined, 'utility').then(result => {
      pageEntry.title = result.title;
      pageEntry.pageTimings.onContentLoad = result.domContentLoaded;
    }).catch(() => {});
    this._addBarrier(page, promise);
  }

  private _onLoad(page: Page) {
    const pageEntry = this._ensurePageEntry(page);
    const promise = page.mainFrame().evaluateExpression(String(() => {
      return {
        title: document.title,
        loaded: performance.timing.loadEventStart,
      };
    }), true, undefined, 'utility').then(result => {
      pageEntry.title = result.title;
      pageEntry.pageTimings.onLoad = result.loaded;
    }).catch(() => {});
    this._addBarrier(page, promise);
  }

  private _addBarrier(page: Page, promise: Promise<void>) {
    if (!this._options.waitForContentOnStop)
      return;
    const race = Promise.race([
      new Promise<void>(f => page.on('close', () => {
        this._barrierPromises.delete(race);
        f();
      })),
      promise
    ]) as Promise<void>;
    this._barrierPromises.add(race);
    race.then(() => this._barrierPromises.delete(race));
  }

  private _onAPIRequest(event: APIRequestEvent) {
    const harEntry = createHarEntry(event.method, event.url, '', '');
    harEntry.request.cookies = event.cookies;
    harEntry.request.headers = Object.entries(event.headers).map(([name, value]) => ({ name, value }));
    harEntry.request.postData = postDataForBuffer(event.postData || null, event.headers['content-type'],  this._options.content);
    harEntry.request.bodySize = event.postData?.length || 0;
    (event as any)[this._entrySymbol] = harEntry;
    if (this._started)
      this._delegate.onEntryStarted(harEntry);
  }

  private _onAPIRequestFinished(event: APIRequestFinishedEvent): void {
    const harEntry = this._entryForRequest(event.requestEvent);
    if (!harEntry)
      return;

    harEntry.response.status = event.statusCode;
    harEntry.response.statusText = event.statusMessage;
    harEntry.response.httpVersion = event.httpVersion;
    harEntry.response.redirectURL = event.headers.location || '';
    for (let i = 0; i < event.rawHeaders.length; i += 2) {
      harEntry.response.headers.push({
        name: event.rawHeaders[i],
        value: event.rawHeaders[i + 1]
      });
    }
    harEntry.response.cookies = event.cookies.map(c => {
      return {
        ...c,
        expires: c.expires === -1 ? undefined : new Date(c.expires)
      };
    });

    const content = harEntry.response.content;
    const contentType = event.headers['content-type'];
    if (contentType)
      content.mimeType = contentType;
    this._storeResponseContent(event.body, content);

    if (this._started)
      this._delegate.onEntryFinished(harEntry);
  }

  private _onRequest(request: network.Request) {
    const page = request.frame()._page;
    const url = network.parsedURL(request.url());
    if (!url)
      return;

    const pageEntry = this._ensurePageEntry(page);
    const harEntry = createHarEntry(request.method(), url, request.guid, request.frame().guid);
    harEntry.pageref = pageEntry.id;
    harEntry.request.postData = postDataForRequest(request, this._options.content);
    harEntry.request.bodySize = request.bodySize();
    if (request.redirectedFrom()) {
      const fromEntry = this._entryForRequest(request.redirectedFrom()!);
      if (fromEntry)
        fromEntry.response.redirectURL = request.url();
    }
    (request as any)[this._entrySymbol] = harEntry;
    if (this._started)
      this._delegate.onEntryStarted(harEntry);
  }

  private async _onRequestFinished(request: network.Request, response: network.Response | null) {
    if (!response)
      return;
    const page = request.frame()._page;
    const harEntry = this._entryForRequest(request);
    if (!harEntry)
      return;

    const httpVersion = response.httpVersion();
    harEntry.request.httpVersion = httpVersion;
    harEntry.response.httpVersion = httpVersion;

    const compressionCalculationBarrier = {
      _encodedBodySize: -1,
      _decodedBodySize: -1,
      barrier: new ManualPromise<void>(),
      _check: function() {
        if (this._encodedBodySize !== -1 && this._decodedBodySize !== -1) {
          harEntry.response.content.compression = Math.max(0, this._decodedBodySize - this._encodedBodySize);
          this.barrier.resolve();
        }
      },
      setEncodedBodySize: function(encodedBodySize: number){
        this._encodedBodySize = encodedBodySize;
        this._check();
      },
      setDecodedBodySize: function(decodedBodySize: number) {
        this._decodedBodySize = decodedBodySize;
        this._check();
      }
    };
    this._addBarrier(page, compressionCalculationBarrier.barrier);

    const promise = response.body().then(buffer => {
      if (this._options.skipScripts && request.resourceType() === 'script') {
        compressionCalculationBarrier.setDecodedBodySize(0);
        return;
      }

      const content = harEntry.response.content;
      compressionCalculationBarrier.setDecodedBodySize(buffer.length);
      this._storeResponseContent(buffer, content);
    }).catch(() => {
      compressionCalculationBarrier.setDecodedBodySize(0);
    }).then(() => {
      const postData = response.request().postDataBuffer();
      if (postData && harEntry.request.postData && this._options.content === 'sha1') {
        harEntry.request.postData._sha1 = calculateSha1(postData) + '.' + (mime.getExtension(harEntry.request.postData.mimeType) || 'dat');
        if (this._started)
          this._delegate.onContentBlob(harEntry.request.postData._sha1, postData);
      }
      if (this._started)
        this._delegate.onEntryFinished(harEntry);
    });
    this._addBarrier(page, promise);
    this._addBarrier(page, response.sizes().then(sizes => {
      harEntry.response.bodySize = sizes.responseBodySize;
      harEntry.response.headersSize = sizes.responseHeadersSize;
      // Fallback for WebKit by calculating it manually
      harEntry.response._transferSize = response.request().responseSize.transferSize || (sizes.responseHeadersSize + sizes.responseBodySize);
      harEntry.request.headersSize = sizes.requestHeadersSize;
      compressionCalculationBarrier.setEncodedBodySize(sizes.responseBodySize);
    }));
  }

  private async _onRequestFailed(request: network.Request) {
    const harEntry = this._entryForRequest(request);
    if (!harEntry)
      return;

    if (request._failureText !== null)
      harEntry.response._failureText = request._failureText;
    if (this._started)
      this._delegate.onEntryFinished(harEntry);
  }

  private _storeResponseContent(buffer: Buffer | undefined, content: har.Content) {
    if (!buffer) {
      content.size = 0;
      return;
    }
    content.size = buffer.length;
    if (this._options.content === 'embedded') {
      content.text = buffer.toString('base64');
      content.encoding = 'base64';
    } else if (this._options.content === 'sha1') {
      content._sha1 = calculateSha1(buffer) + '.' + (mime.getExtension(content.mimeType) || 'dat');
      if (this._started)
        this._delegate.onContentBlob(content._sha1, buffer);
    }
  }

  private _onResponse(response: network.Response) {
    const page = response.frame()._page;
    const pageEntry = this._ensurePageEntry(page);
    const harEntry = this._entryForRequest(response.request());
    if (!harEntry)
      return;
    const request = response.request();

    harEntry.request.postData = postDataForRequest(request, this._options.content);

    harEntry.response = {
      status: response.status(),
      statusText: response.statusText(),
      httpVersion: response.httpVersion(),
      // These are bad values that will be overwritten bellow.
      cookies: [],
      headers: [],
      content: {
        size: -1,
        mimeType: 'x-unknown',
      },
      headersSize: -1,
      bodySize: -1,
      redirectURL: '',
      _transferSize: -1
    };
    const timing = response.timing();
    if (pageEntry.startedDateTime.valueOf() > timing.startTime)
      pageEntry.startedDateTime = new Date(timing.startTime);
    const dns = timing.domainLookupEnd !== -1 ? helper.millisToRoundishMillis(timing.domainLookupEnd - timing.domainLookupStart) : -1;
    const connect = timing.connectEnd !== -1 ? helper.millisToRoundishMillis(timing.connectEnd - timing.connectStart) : -1;
    const ssl = timing.connectEnd !== -1 ? helper.millisToRoundishMillis(timing.connectEnd - timing.secureConnectionStart) : -1;
    const wait = timing.responseStart !== -1 ? helper.millisToRoundishMillis(timing.responseStart - timing.requestStart) : -1;
    const receive = response.request()._responseEndTiming !== -1 ? helper.millisToRoundishMillis(response.request()._responseEndTiming - timing.responseStart) : -1;
    harEntry.timings = {
      dns,
      connect,
      ssl,
      send: 0,
      wait,
      receive,
    };
    harEntry.time = [dns, connect, ssl, wait, receive].reduce((pre, cur) => cur > 0 ? cur + pre : pre, 0);
    this._addBarrier(page, response.serverAddr().then(server => {
      if (server?.ipAddress)
        harEntry.serverIPAddress = server.ipAddress;
      if (server?.port)
        harEntry._serverPort = server.port;
    }));
    this._addBarrier(page, response.securityDetails().then(details => {
      if (details)
        harEntry._securityDetails = details;
    }));
    this._addBarrier(page, request.rawRequestHeaders().then(headers => {
      for (const header of headers.filter(header => header.name.toLowerCase() === 'cookie'))
        harEntry.request.cookies.push(...header.value.split(';').map(parseCookie));
      harEntry.request.headers = headers;
    }));
    this._addBarrier(page, response.rawResponseHeaders().then(headers => {
      for (const header of headers.filter(header => header.name.toLowerCase() === 'set-cookie'))
        harEntry.response.cookies.push(parseCookie(header.value));
      harEntry.response.headers = headers;
      const contentType = headers.find(header => header.name.toLowerCase() === 'content-type');
      if (contentType)
        harEntry.response.content.mimeType = contentType.value;
    }));
  }

  async flush() {
    await Promise.all(this._barrierPromises);
  }

  stop() {
    this._started = false;
    eventsHelper.removeEventListeners(this._eventListeners);
    this._barrierPromises.clear();

    const context = this._context instanceof BrowserContext ? this._context : undefined;
    const log: har.Log = {
      version: '1.2',
      creator: {
        name: 'Playwright',
        version: getPlaywrightVersion(),
      },
      browser: {
        name: context?._browser.options.name || '',
        version: context?._browser.version() || ''
      },
      pages: Array.from(this._pageEntries.values()),
      entries: [],
    };
    for (const pageEntry of log.pages) {
      if (pageEntry.pageTimings.onContentLoad >= 0)
        pageEntry.pageTimings.onContentLoad -= pageEntry.startedDateTime.valueOf();
      else
        pageEntry.pageTimings.onContentLoad = -1;
      if (pageEntry.pageTimings.onLoad >= 0)
        pageEntry.pageTimings.onLoad -= pageEntry.startedDateTime.valueOf();
      else
        pageEntry.pageTimings.onLoad = -1;
    }
    this._pageEntries.clear();
    return log;
  }
}

function createHarEntry(method: string, url: URL, requestref: string, frameref: string): har.Entry {
  const harEntry: har.Entry = {
    _requestref: requestref,
    _frameref: frameref,
    _monotonicTime: monotonicTime(),
    startedDateTime: new Date(),
    time: -1,
    request: {
      method: method,
      url: url.toString(),
      httpVersion: FALLBACK_HTTP_VERSION,
      cookies: [],
      headers: [],
      queryString: [...url.searchParams].map(e => ({ name: e[0], value: e[1] })),
      headersSize: -1,
      bodySize: 0,
    },
    response: {
      status: -1,
      statusText: '',
      httpVersion: FALLBACK_HTTP_VERSION,
      cookies: [],
      headers: [],
      content: {
        size: -1,
        mimeType: 'x-unknown',
      },
      headersSize: -1,
      bodySize: -1,
      redirectURL: '',
      _transferSize: -1
    },
    cache: {
      beforeRequest: null,
      afterRequest: null,
    },
    timings: {
      send: -1,
      wait: -1,
      receive: -1
    },
  };
  return harEntry;
}

function postDataForRequest(request: network.Request, content: 'omit' | 'sha1' | 'embedded'): har.PostData | undefined {
  const postData = request.postDataBuffer();
  if (!postData)
    return;

  const contentType = request.headerValue('content-type');
  return postDataForBuffer(postData, contentType, content);
}

function postDataForBuffer(postData: Buffer | null, contentType: string | undefined, content: 'omit' | 'sha1' | 'embedded'): har.PostData | undefined {
  if (!postData)
    return;

  contentType ??= 'application/octet-stream';

  const result: har.PostData = {
    mimeType: contentType,
    text: '',
    params: []
  };

  if (content === 'embedded' && contentType !== 'application/octet-stream')
    result.text = postData.toString();

  if (contentType === 'application/x-www-form-urlencoded') {
    const parsed = new URLSearchParams(postData.toString());
    for (const [name, value] of parsed.entries())
      result.params.push({ name, value });
  }
  return result;
}

function parseCookie(c: string): har.Cookie {
  const cookie: har.Cookie = {
    name: '',
    value: ''
  };
  let first = true;
  for (const pair of c.split(/; */)) {
    const indexOfEquals = pair.indexOf('=');
    const name = indexOfEquals !== -1 ? pair.substr(0, indexOfEquals).trim() : pair.trim();
    const value = indexOfEquals !== -1 ? pair.substr(indexOfEquals + 1, pair.length).trim() : '';
    if (first) {
      first = false;
      cookie.name = name;
      cookie.value = value;
      continue;
    }

    if (name === 'Domain')
      cookie.domain = value;
    if (name === 'Expires')
      cookie.expires = new Date(value);
    if (name === 'HttpOnly')
      cookie.httpOnly = true;
    if (name === 'Max-Age')
      cookie.expires = new Date(Date.now() + (+value) * 1000);
    if (name === 'Path')
      cookie.path = value;
    if (name === 'SameSite')
      cookie.sameSite = value;
    if (name === 'Secure')
      cookie.secure = true;
  }
  return cookie;
}

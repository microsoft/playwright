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
import type { Worker } from '../page';
import type { Page } from '../page';
import type * as har from '@trace/har';
import { assert, calculateSha1, monotonicTime } from '../../utils';
import type { RegisteredListener } from '../../utils/eventsHelper';
import { eventsHelper } from '../../utils/eventsHelper';
import { mime } from '../../utilsBundle';
import { ManualPromise } from '../../utils/manualPromise';
import { getPlaywrightVersion } from '../../utils/userAgent';
import { urlMatches } from '../../utils/network';
import { Frame } from '../frames';
import type { HeadersArray, LifecycleEvent } from '../types';
import { isTextualMimeType } from '../../utils/mimeType';

const FALLBACK_HTTP_VERSION = 'HTTP/1.1';

export interface HarTracerDelegate {
  onEntryStarted(entry: har.Entry): void;
  onEntryFinished(entry: har.Entry): void;
  onContentBlob(sha1: string, buffer: Buffer): void;
}

type HarTracerOptions = {
  content: 'omit' | 'attach' | 'embed';
  skipScripts: boolean;
  includeTraceInfo: boolean;
  recordRequestOverrides: boolean;
  waitForContentOnStop: boolean;
  urlFilter?: string | RegExp;
  slimMode?: boolean;
  omitSecurityDetails?: boolean;
  omitCookies?: boolean;
  omitTiming?: boolean;
  omitServerIP?: boolean;
  omitPages?: boolean;
  omitSizes?: boolean;
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
  private _baseURL: string | undefined;
  private _page: Page | null;

  constructor(context: BrowserContext | APIRequestContext, page: Page | null, delegate: HarTracerDelegate, options: HarTracerOptions) {
    this._context = context;
    this._page = page;
    this._delegate = delegate;
    this._options = options;
    if (options.slimMode) {
      options.omitSecurityDetails = true;
      options.omitCookies = true;
      options.omitTiming = true;
      options.omitServerIP = true;
      options.omitSizes = true;
      options.omitPages = true;
    }
    this._entrySymbol = Symbol('requestHarEntry');
    this._baseURL = context instanceof APIRequestContext ? context._defaultOptions().baseURL : context._options.baseURL;
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
          eventsHelper.addEventListener(this._context, BrowserContext.Events.Page, (page: Page) => this._createPageEntryIfNeeded(page)),
          eventsHelper.addEventListener(this._context, BrowserContext.Events.Request, (request: network.Request) => this._onRequest(request)),
          eventsHelper.addEventListener(this._context, BrowserContext.Events.RequestFinished, ({ request, response }) => this._onRequestFinished(request, response).catch(() => {})),
          eventsHelper.addEventListener(this._context, BrowserContext.Events.RequestFailed, request => this._onRequestFailed(request)),
          eventsHelper.addEventListener(this._context, BrowserContext.Events.Response, (response: network.Response) => this._onResponse(response)));
    }
  }

  private _shouldIncludeEntryWithUrl(urlString: string) {
    return !this._options.urlFilter || urlMatches(this._baseURL, urlString, this._options.urlFilter);
  }

  private _entryForRequest(request: network.Request | APIRequestEvent): har.Entry | undefined {
    return (request as any)[this._entrySymbol];
  }

  private _createPageEntryIfNeeded(page?: Page): har.Page | undefined {
    if (!page)
      return;
    if (this._options.omitPages)
      return;
    if (this._page && page !== this._page)
      return;
    let pageEntry = this._pageEntries.get(page);
    if (!pageEntry) {
      pageEntry = {
        startedDateTime: new Date(),
        id: page.guid,
        title: '',
        pageTimings: this._options.omitTiming ? {} : {
          onContentLoad: -1,
          onLoad: -1,
        },
      };

      page.mainFrame().on(Frame.Events.AddLifecycle, (event: LifecycleEvent) => {
        if (event === 'load')
          this._onLoad(page, pageEntry!);
        if (event === 'domcontentloaded')
          this._onDOMContentLoaded(page, pageEntry!);
      });

      this._pageEntries.set(page, pageEntry);
    }
    return pageEntry;
  }

  private _onDOMContentLoaded(page: Page, pageEntry: har.Page) {
    const promise = page.mainFrame().evaluateExpression(String(() => {
      return {
        title: document.title,
        domContentLoaded: performance.timing.domContentLoadedEventStart,
      };
    }), true, undefined, 'utility').then(result => {
      pageEntry.title = result.title;
      if (!this._options.omitTiming)
        pageEntry.pageTimings.onContentLoad = result.domContentLoaded;
    }).catch(() => {});
    this._addBarrier(page, promise);
  }

  private _onLoad(page: Page, pageEntry: har.Page) {
    const promise = page.mainFrame().evaluateExpression(String(() => {
      return {
        title: document.title,
        loaded: performance.timing.loadEventStart,
      };
    }), true, undefined, 'utility').then(result => {
      pageEntry.title = result.title;
      if (!this._options.omitTiming)
        pageEntry.pageTimings.onLoad = result.loaded;
    }).catch(() => {});
    this._addBarrier(page, promise);
  }

  private _addBarrier(target: Page | Worker | null, promise: Promise<void>) {
    if (!target)
      return null;
    if (!this._options.waitForContentOnStop)
      return;
    const race = Promise.race([
      new Promise<void>(f => target.on('close', () => {
        this._barrierPromises.delete(race);
        f();
      })),
      promise
    ]) as Promise<void>;
    this._barrierPromises.add(race);
    race.then(() => this._barrierPromises.delete(race));
  }

  private _onAPIRequest(event: APIRequestEvent) {
    if (!this._shouldIncludeEntryWithUrl(event.url.toString()))
      return;
    const harEntry = createHarEntry(event.method, event.url, undefined, this._options);
    if (!this._options.omitCookies)
      harEntry.request.cookies = event.cookies;
    harEntry.request.headers = Object.entries(event.headers).map(([name, value]) => ({ name, value }));
    harEntry.request.postData = this._postDataForBuffer(event.postData || null, event.headers['content-type'],  this._options.content);
    if (!this._options.omitSizes)
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
    harEntry.response.cookies = this._options.omitCookies ? [] : event.cookies.map(c => {
      return {
        ...c,
        expires: c.expires === -1 ? undefined : new Date(c.expires)
      };
    });

    const content = harEntry.response.content;
    const contentType = event.headers['content-type'];
    if (contentType)
      content.mimeType = contentType;
    this._storeResponseContent(event.body, content, 'other');

    if (this._started)
      this._delegate.onEntryFinished(harEntry);
  }

  private _onRequest(request: network.Request) {
    if (!this._shouldIncludeEntryWithUrl(request.url()))
      return;
    const page = request.frame()?._page;
    if (this._page && page !== this._page)
      return;
    const url = network.parsedURL(request.url());
    if (!url)
      return;

    const pageEntry = this._createPageEntryIfNeeded(page);
    const harEntry = createHarEntry(request.method(), url, request.frame()?.guid, this._options);
    if (pageEntry)
      harEntry.pageref = pageEntry.id;
    this._recordRequestHeadersAndCookies(harEntry, request.headers());
    harEntry.request.postData = this._postDataForRequest(request, this._options.content);
    if (!this._options.omitSizes)
      harEntry.request.bodySize = request.bodySize();
    if (request.redirectedFrom()) {
      const fromEntry = this._entryForRequest(request.redirectedFrom()!);
      if (fromEntry)
        fromEntry.response.redirectURL = request.url();
    }
    (request as any)[this._entrySymbol] = harEntry;
    assert(this._started);
    this._delegate.onEntryStarted(harEntry);
  }

  private _recordRequestHeadersAndCookies(harEntry: har.Entry, headers: HeadersArray) {
    if (!this._options.omitCookies) {
      harEntry.request.cookies = [];
      for (const header of headers.filter(header => header.name.toLowerCase() === 'cookie'))
        harEntry.request.cookies.push(...header.value.split(';').map(parseCookie));
    }
    harEntry.request.headers = headers;
  }

  private _recordRequestOverrides(harEntry: har.Entry, request: network.Request) {
    if (!request._hasOverrides() || !this._options.recordRequestOverrides)
      return;
    harEntry.request.method = request.method();
    harEntry.request.url = request.url();
    harEntry.request.postData = this._postDataForRequest(request, this._options.content);
    this._recordRequestHeadersAndCookies(harEntry, request.headers());
  }

  private async _onRequestFinished(request: network.Request, response: network.Response | null) {
    if (!response)
      return;
    const harEntry = this._entryForRequest(request);
    if (!harEntry)
      return;
    const page = request.frame()?._page;

    const httpVersion = response.httpVersion();
    harEntry.request.httpVersion = httpVersion;
    harEntry.response.httpVersion = httpVersion;

    const compressionCalculationBarrier = this._options.omitSizes ? undefined : {
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
    if (compressionCalculationBarrier)
      this._addBarrier(page || request.serviceWorker(), compressionCalculationBarrier.barrier);

    const promise = response.body().then(buffer => {
      if (this._options.skipScripts && request.resourceType() === 'script') {
        compressionCalculationBarrier?.setDecodedBodySize(0);
        return;
      }

      const content = harEntry.response.content;
      compressionCalculationBarrier?.setDecodedBodySize(buffer.length);
      this._storeResponseContent(buffer, content, request.resourceType());
    }).catch(() => {
      compressionCalculationBarrier?.setDecodedBodySize(0);
    }).then(() => {
      if (this._started)
        this._delegate.onEntryFinished(harEntry);
    });
    this._addBarrier(page || request.serviceWorker(), promise);

    // Respose end timing is only available after the response event was received.
    const timing = response.timing();
    harEntry.timings.receive = response.request()._responseEndTiming !== -1 ? helper.millisToRoundishMillis(response.request()._responseEndTiming - timing.responseStart) : -1;
    this._computeHarEntryTotalTime(harEntry);

    if (!this._options.omitSizes) {
      this._addBarrier(page || request.serviceWorker(), response.sizes().then(sizes => {
        harEntry.response.bodySize = sizes.responseBodySize;
        harEntry.response.headersSize = sizes.responseHeadersSize;
        harEntry.response._transferSize = sizes.transferSize;
        harEntry.request.headersSize = sizes.requestHeadersSize;
        compressionCalculationBarrier?.setEncodedBodySize(sizes.responseBodySize);
      }));
    }
  }

  private async _onRequestFailed(request: network.Request) {
    const harEntry = this._entryForRequest(request);
    if (!harEntry)
      return;

    if (request._failureText !== null)
      harEntry.response._failureText = request._failureText;
    this._recordRequestOverrides(harEntry, request);
    if (this._started)
      this._delegate.onEntryFinished(harEntry);
  }

  private _storeResponseContent(buffer: Buffer | undefined, content: har.Content, resourceType: string) {
    if (!buffer) {
      content.size = 0;
      return;
    }

    if (!this._options.omitSizes)
      content.size = buffer.length;

    if (this._options.content === 'embed') {
      // Sometimes, we can receive a font/media file with textual mime type. Browser
      // still interprets them correctly, but the 'content-type' header is obviously wrong.
      if (isTextualMimeType(content.mimeType) && resourceType !== 'font') {
        content.text = buffer.toString();
      } else {
        content.text = buffer.toString('base64');
        content.encoding = 'base64';
      }
    } else if (this._options.content === 'attach') {
      const sha1 = calculateSha1(buffer) + '.' + (mime.getExtension(content.mimeType) || 'dat');
      if (this._options.includeTraceInfo)
        content._sha1 = sha1;
      else
        content._file = sha1;
      if (this._started)
        this._delegate.onContentBlob(sha1, buffer);
    }
  }

  private _onResponse(response: network.Response) {
    const harEntry = this._entryForRequest(response.request());
    if (!harEntry)
      return;
    const page = response.frame()?._page;
    const pageEntry = this._createPageEntryIfNeeded(page);
    const request = response.request();

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
      _transferSize: this._options.omitSizes ? undefined : -1
    };

    if (!this._options.omitTiming) {
      const timing = response.timing();
      if (pageEntry && pageEntry.startedDateTime.valueOf() > timing.startTime)
        pageEntry.startedDateTime = new Date(timing.startTime);
      const dns = timing.domainLookupEnd !== -1 ? helper.millisToRoundishMillis(timing.domainLookupEnd - timing.domainLookupStart) : -1;
      const connect = timing.connectEnd !== -1 ? helper.millisToRoundishMillis(timing.connectEnd - timing.connectStart) : -1;
      const ssl = timing.connectEnd !== -1 ? helper.millisToRoundishMillis(timing.connectEnd - timing.secureConnectionStart) : -1;
      const wait = timing.responseStart !== -1 ? helper.millisToRoundishMillis(timing.responseStart - timing.requestStart) : -1;
      const receive = -1;

      harEntry.timings = {
        dns,
        connect,
        ssl,
        send: 0,
        wait,
        receive,
      };
      this._computeHarEntryTotalTime(harEntry);
    }

    if (!this._options.omitServerIP) {
      this._addBarrier(page || request.serviceWorker(), response.serverAddr().then(server => {
        if (server?.ipAddress)
          harEntry.serverIPAddress = server.ipAddress;
        if (server?.port)
          harEntry._serverPort = server.port;
      }));
    }
    if (!this._options.omitSecurityDetails) {
      this._addBarrier(page || request.serviceWorker(), response.securityDetails().then(details => {
        if (details)
          harEntry._securityDetails = details;
      }));
    }
    this._recordRequestOverrides(harEntry, request);
    this._addBarrier(page || request.serviceWorker(), request.rawRequestHeaders().then(headers => {
      this._recordRequestHeadersAndCookies(harEntry, headers);
    }));
    this._addBarrier(page || request.serviceWorker(), response.rawResponseHeaders().then(headers => {
      if (!this._options.omitCookies) {
        for (const header of headers.filter(header => header.name.toLowerCase() === 'set-cookie'))
          harEntry.response.cookies.push(parseCookie(header.value));
      }
      harEntry.response.headers = headers;
      const contentType = headers.find(header => header.name.toLowerCase() === 'content-type');
      if (contentType)
        harEntry.response.content.mimeType = contentType.value;
    }));
  }

  private _computeHarEntryTotalTime(harEntry: har.Entry) {
    harEntry.time = [
      harEntry.timings.dns,
      harEntry.timings.connect,
      harEntry.timings.ssl,
      harEntry.timings.wait,
      harEntry.timings.receive
    ].reduce((pre, cur) => (cur || -1) > 0 ? cur! + pre! : pre, 0)!;
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
      pages: this._pageEntries.size ? Array.from(this._pageEntries.values()) : undefined,
      entries: [],
    };
    if (!this._options.omitTiming) {
      for (const pageEntry of log.pages || []) {
        if (typeof pageEntry.pageTimings.onContentLoad === 'number' && pageEntry.pageTimings.onContentLoad >= 0)
          pageEntry.pageTimings.onContentLoad -= pageEntry.startedDateTime.valueOf();
        else
          pageEntry.pageTimings.onContentLoad = -1;
        if (typeof pageEntry.pageTimings.onLoad === 'number' && pageEntry.pageTimings.onLoad >= 0)
          pageEntry.pageTimings.onLoad -= pageEntry.startedDateTime.valueOf();
        else
          pageEntry.pageTimings.onLoad = -1;
      }
    }
    this._pageEntries.clear();
    return log;
  }

  private _postDataForRequest(request: network.Request, content: 'omit' | 'attach' | 'embed'): har.PostData | undefined {
    const postData = request.postDataBuffer();
    if (!postData)
      return;

    const contentType = request.headerValue('content-type');
    return this._postDataForBuffer(postData, contentType, content);
  }

  private  _postDataForBuffer(postData: Buffer | null, contentType: string | undefined, content: 'omit' | 'attach' | 'embed'): har.PostData | undefined {
    if (!postData)
      return;

    contentType ??= 'application/octet-stream';

    const result: har.PostData = {
      mimeType: contentType,
      text: '',
      params: []
    };

    if (content === 'embed' && contentType !== 'application/octet-stream')
      result.text = postData.toString();

    if (content === 'attach') {
      const sha1 = calculateSha1(postData) + '.' + (mime.getExtension(contentType) || 'dat');
      if (this._options.includeTraceInfo)
        result._sha1 = sha1;
      else
        result._file = sha1;
      this._delegate.onContentBlob(sha1, postData);
    }

    if (contentType === 'application/x-www-form-urlencoded') {
      const parsed = new URLSearchParams(postData.toString());
      for (const [name, value] of parsed.entries())
        result.params.push({ name, value });
    }

    return result;
  }

}

function createHarEntry(method: string, url: URL, frameref: string | undefined, options: HarTracerOptions): har.Entry {
  const harEntry: har.Entry = {
    _frameref: options.includeTraceInfo ? frameref : undefined,
    _monotonicTime: options.includeTraceInfo ? monotonicTime() : undefined,
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
      bodySize: -1,
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
      _transferSize: options.omitSizes ? undefined : -1
    },
    cache: {},
    timings: {
      send: -1,
      wait: -1,
      receive: -1
    },
  };
  return harEntry;
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

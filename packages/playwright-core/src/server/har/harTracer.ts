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

import mime from 'mime';
import { base64ByteLength } from '@isomorphic/base64';
import { ManualPromise } from '@isomorphic/manualPromise';
import { eventsHelper } from '@utils/eventsHelper';
import { assert } from '@isomorphic/assert';
import { calculateSha1, createGuid } from '@utils/crypto';
import { monotonicTime } from '@isomorphic/time';
import { isTextualMimeType } from '@isomorphic/mimeType';
import { urlMatches } from '@isomorphic/urlMatch';
import { getPlaywrightVersion } from '../userAgent';
import { BrowserContext } from '../browserContext';
import { APIRequestContext } from '../fetch';
import { Frame } from '../frames';
import { helper } from '../helper';
import * as network from '../network';
import { nullProgress } from '../progress';

import { Page } from '../page';

import type { RegisteredListener } from '@utils/eventsHelper';
import type { APIRequestEvent, APIRequestFinishedEvent } from '../fetch';
import type { Worker } from '../page';
import type { HeadersArray, LifecycleEvent } from '../types';
import type * as har from '@trace/har';

const FALLBACK_HTTP_VERSION = 'HTTP/1.1';

export interface HarTracerDelegate {
  onEntryStarted(entry: har.Entry): void;
  onEntryFinished(entry: har.Entry): void;
  onContentBlob(sha1: string, buffer: Buffer): void;
  onContentBlobAppend(sha1: string, text: string): void;
}

type HarTracerOptions = {
  content: 'omit' | 'attach' | 'embed';
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
  omitScripts?: boolean;
};

export class HarTracer {
  private _context: BrowserContext | APIRequestContext;
  private _barrierPromises = new Set<Promise<void>>();
  private _delegate: HarTracerDelegate;
  private _options: HarTracerOptions;
  private _pageEntries: har.Page[] = [];
  private _eventListeners: RegisteredListener[] = [];
  private _started = false;
  private _entrySymbol: symbol;
  private _pageEntrySymbol: symbol;
  private _baseURL: string | undefined;
  private _page: Page | null;
  private _omitWebSocketFrames = true;

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
    this._pageEntrySymbol = Symbol('pageHarEntry');
    this._baseURL = context instanceof APIRequestContext ? context._defaultOptions().baseURL : context._options.baseURL;
  }

  setOmitWebSocketFrames(omitWebSocketFrames: boolean) {
    this._omitWebSocketFrames = omitWebSocketFrames;
  }

  start(options: { omitScripts: boolean }) {
    if (this._started)
      return;
    this._options.omitScripts = options.omitScripts;
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
          eventsHelper.addEventListener(this._context, BrowserContext.Events.Response, (response: network.Response) => this._onResponse(response)),
          eventsHelper.addEventListener(this._context, BrowserContext.Events.RequestAborted, request => this._onRequestAborted(request)),
          eventsHelper.addEventListener(this._context, BrowserContext.Events.RequestFulfilled, request => this._onRequestFulfilled(request)),
          eventsHelper.addEventListener(this._context, BrowserContext.Events.RequestContinued, request => this._onRequestContinued(request)),
          eventsHelper.addEventListener(this._context, BrowserContext.Events.WebSocket, (webSocket: network.WebSocket, page: Page) => this._onWebSocket(page, webSocket)),
      );
      for (const page of this._context.pages())
        this._createPageEntryIfNeeded(page);
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
    let pageEntry = (page as any)[this._pageEntrySymbol] as har.Page | undefined;
    if (!pageEntry) {
      const date = new Date();
      pageEntry = {
        startedDateTime: date.toISOString(),
        id: page.guid,
        title: '',
        pageTimings: this._options.omitTiming ? {} : {
          onContentLoad: -1,
          onLoad: -1,
        },
      };
      (pageEntry as any)[startedDateSymbol] = date;

      page.mainFrame().on(Frame.Events.AddLifecycle, (event: LifecycleEvent) => {
        if (event === 'load')
          this._onLoad(page, pageEntry!);
        if (event === 'domcontentloaded')
          this._onDOMContentLoaded(page, pageEntry!);
      });

      (page as any)[this._pageEntrySymbol] = pageEntry;
      this._pageEntries.push(pageEntry);
    }
    return pageEntry;
  }

  private _onDOMContentLoaded(page: Page, pageEntry: har.Page) {
    const promise = page.mainFrame().evaluateExpression(nullProgress, String(() => {
      return {
        title: document.title,
        domContentLoaded: performance.timing.domContentLoadedEventStart,
      };
    }), { isFunction: true, world: 'utility' }).then(result => {
      pageEntry.title = result.title;
      if (!this._options.omitTiming)
        pageEntry.pageTimings.onContentLoad = result.domContentLoaded;
    }).catch(() => {});
    this._addBarrier(page, promise);
  }

  private _onLoad(page: Page, pageEntry: har.Page) {
    const promise = page.mainFrame().evaluateExpression(nullProgress, String(() => {
      return {
        title: document.title,
        loaded: performance.timing.loadEventStart,
      };
    }), { isFunction: true, world: 'utility' }).then(result => {
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
    const race = target.openScope.safeRace(promise);
    this._barrierPromises.add(race);
    race.then(() => this._barrierPromises.delete(race));
  }

  private _onAPIRequest(event: APIRequestEvent) {
    if (!this._shouldIncludeEntryWithUrl(event.url.toString()))
      return;
    const harEntry = createHarEntry(undefined, event.method, event.url, undefined, this._options);
    harEntry._apiRequest = true;
    if (!this._options.omitCookies)
      harEntry.request.cookies = event.cookies;
    harEntry.request.headers = Object.entries(event.headers).map(([name, value]) => ({ name, value }));
    const contentType = Object.entries(event.headers).find(([name]) => name.toLowerCase() === 'content-type')?.[1];
    harEntry.request.postData = this._postDataForBuffer(event.postData || null, contentType, this._options.content);
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

    if (!this._options.omitServerIP) {
      harEntry.serverIPAddress = event.serverIPAddress;
      harEntry._serverPort = event.serverPort;
    }

    if (!this._options.omitTiming) {
      harEntry.timings = event.timings;
      this._computeHarEntryTotalTime(harEntry);
    }

    if (!this._options.omitSecurityDetails)
      harEntry._securityDetails = event.securityDetails;

    for (let i = 0; i < event.rawHeaders.length; i += 2) {
      harEntry.response.headers.push({
        name: event.rawHeaders[i],
        value: event.rawHeaders[i + 1]
      });
    }
    harEntry.response.cookies = this._options.omitCookies ? [] : event.cookies.map(c => {
      return {
        ...c,
        expires: c.expires === -1 ? undefined : safeDateToISOString(c.expires * 1000)
      };
    });

    const content = harEntry.response.content;
    const contentType = event.headers['content-type'];
    if (contentType)
      content.mimeType = contentType;
    this._storeResponseContent(event.body, content, 'other');
    if (!this._options.omitSizes)
      harEntry.response.bodySize = event.body?.length ?? 0;

    if (this._started)
      this._delegate.onEntryFinished(harEntry);
  }

  private _onRequest(request: network.Request) {
    if (!this._shouldIncludeEntryWithUrl(request.url()))
      return;
    const page = request.frame()?._page;
    if (this._page && page !== this._page)
      return;
    const url = network.parseURL(request.url());
    if (!url)
      return;

    const pageEntry = this._createPageEntryIfNeeded(page);
    const harEntry = createHarEntry(pageEntry?.id, request.method(), url, request.frame()?.guid, this._options, request.wallTimeMs());
    harEntry._resourceType = request.resourceType();
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
    if (!request.overrides() || !this._options.recordRequestOverrides)
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

    // In WebKit security details and server ip are reported in Network.loadingFinished, so we populate
    // it here to not hang in case of long chunked responses, see https://github.com/microsoft/playwright/issues/21182.
    if (!this._options.omitServerIP) {
      this._addBarrier(page || request.serviceWorker(), response.internalServerAddr().then(server => {
        if (server?.ipAddress)
          harEntry.serverIPAddress = server.ipAddress;
        if (server?.port)
          harEntry._serverPort = server.port;
      }));
    }
    if (!this._options.omitSecurityDetails) {
      this._addBarrier(page || request.serviceWorker(), response.internalSecurityDetails().then(details => {
        if (details)
          harEntry._securityDetails = details;
      }));
    }

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

    const promise = response.internalBody().then(buffer => {
      if (this._options.omitScripts && request.resourceType() === 'script') {
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

    this._addBarrier(page || request.serviceWorker(), response.internalHttpVersion().then(httpVersion => {
      harEntry.request.httpVersion = httpVersion;
      harEntry.response.httpVersion = httpVersion;
    }));

    // Response end timing is only available after the response event was received.
    const timing = response.timing();
    harEntry.timings.receive = response.request()._responseEndTiming !== -1 ? helper.millisToRoundishMillis(response.request()._responseEndTiming - timing.responseStart) : -1;
    this._computeHarEntryTotalTime(harEntry);

    if (!this._options.omitSizes) {
      this._addBarrier(page || request.serviceWorker(), response.internalSizes().then(sizes => {
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

  private _onRequestAborted(request: network.Request) {
    const harEntry = this._entryForRequest(request);
    if (harEntry)
      harEntry._wasAborted = true;
  }

  private _onRequestFulfilled(request: network.Request) {
    const harEntry = this._entryForRequest(request);
    if (harEntry)
      harEntry._wasFulfilled = true;
  }

  private _onRequestContinued(request: network.Request) {
    const harEntry = this._entryForRequest(request);
    if (harEntry)
      harEntry._wasContinued = true;
  }

  private _onWebSocket(page: Page, webSocket: network.WebSocket) {
    if (this._page && page !== this._page)
      return;
    if (!this._shouldIncludeEntryWithUrl(webSocket.url()))
      return;
    const url = network.parseURL(webSocket.url());
    if (!url)
      return;

    const method = 'GET';
    const pageEntry = this._createPageEntryIfNeeded(page);
    const harEntry = createHarEntry(pageEntry?.id, method, url, page.mainFrame().guid, this._options, webSocket.wallTimeMs());
    harEntry._resourceType = 'websocket';

    let sha1: string | undefined = undefined;
    const recordMessage = (type: 'send' | 'receive', opcode: number, data: string, wallTimeMs: number) => {
      if (this._omitWebSocketFrames)
        return;
      const message = { type, time: this._options.omitTiming ? -1 : wallTimeMs, opcode, data };
      if (this._options.content === 'embed') {
        harEntry._webSocketMessages ??= [];
        harEntry._webSocketMessages.push(message);
      } else if (this._options.content === 'attach') {
        if (!sha1) {
          sha1 = createGuid() + '.jsonl';
          if (this._options.includeTraceInfo)
            harEntry.response.content._sha1 = sha1;
          else
            harEntry.response.content._file = sha1;
        }

        if (this._started)
          this._delegate.onContentBlobAppend(sha1, JSON.stringify(message) + '\n');
      }
    };

    let oldestWallTimeMs = Infinity;
    let newestWallTimeMs = -Infinity;
    const updateTime = (wallTimeMs: number) => {
      if (this._options.omitTiming)
        return;

      if (wallTimeMs >= oldestWallTimeMs && wallTimeMs <= newestWallTimeMs)
        return;

      if (wallTimeMs < oldestWallTimeMs)
        oldestWallTimeMs = wallTimeMs;
      if (wallTimeMs > newestWallTimeMs)
        newestWallTimeMs = wallTimeMs;
      if (oldestWallTimeMs === newestWallTimeMs)
        return;

      harEntry.time = newestWallTimeMs - oldestWallTimeMs;
    };

    const eventListeners = [
      eventsHelper.addEventListener(webSocket, network.WebSocket.Events.Request, ({ headers }: { headers: HeadersArray }) => {
        this._recordRequestHeadersAndCookies(harEntry, headers);
        if (!this._options.omitSizes)
          harEntry.request.headersSize = network.requestHeadersSize(headers, webSocket.url(), method);
      }),
      eventsHelper.addEventListener(webSocket, network.WebSocket.Events.Response, ({ status, statusText, headers }: { status: number, statusText: string, headers: HeadersArray }) => {
        harEntry.response.status = status;
        harEntry.response.statusText = statusText;
        this._recordResponseHeaders(harEntry, headers);
        if (!this._options.omitSizes) {
          harEntry.response.headersSize = network.responseHeadersSize(headers, statusText);
          harEntry.response._transferSize = Math.max(0, harEntry.response._transferSize!) + harEntry.response.headersSize;
        }
      }),
      eventsHelper.addEventListener(webSocket, network.WebSocket.Events.FrameSent, ({ opcode, data, wallTimeMs }: { opcode: number, data: string, wallTimeMs: number }) => {
        recordMessage('send', opcode, data, wallTimeMs);
        updateTime(wallTimeMs);
      }),
      eventsHelper.addEventListener(webSocket, network.WebSocket.Events.FrameReceived, ({ opcode, data, wallTimeMs }: { opcode: number, data: string, wallTimeMs: number }) => {
        recordMessage('receive', opcode, data, wallTimeMs);
        updateTime(wallTimeMs);

        if (!this._options.omitSizes) {
          const length = (opcode === 1) ? Buffer.byteLength(data, 'utf8') : base64ByteLength(data);

          // According to <https://www.rfc-editor.org/info/rfc6455/#section-5.2>:
          // - there are always 16 bits at the beginning of every frame: FIN RSV1 RSV2 RSV3 opcode(4) mask length(7)
          // - there are always 4 bytes for the masking key (see <https://www.rfc-editor.org/info/rfc6455/#section-5.1>)
          // - there may be an additional 16 or 64 bits for payload length if it's too long to fit in the above 7 bits (or if it also can't fit in 16 bits)
          let headerSize = 6;
          if (length >= 2 ** 16)
            headerSize += 8;
          else if (length > 125)
            headerSize += 2;

          harEntry.response._transferSize = Math.max(0, harEntry.response._transferSize!) + headerSize + length;
        }
      }),
      eventsHelper.addEventListener(webSocket, network.WebSocket.Events.SocketError, (errorMessage: string) => {
        harEntry.response._failureText = errorMessage;
      }),
      eventsHelper.addEventListener(webSocket, network.WebSocket.Events.Close, () => {
        eventsHelper.removeEventListeners(eventListeners);

        if (this._started)
          this._delegate.onEntryFinished(harEntry);
      }),
    ];
    this._eventListeners.push(...eventListeners);

    if (this._started)
      this._delegate.onEntryStarted(harEntry);
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
      httpVersion: FALLBACK_HTTP_VERSION,
      // These are bad values that will be overwritten below.
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
      const startDateTime = pageEntry ? ((pageEntry as any)[startedDateSymbol] as Date).valueOf() : 0;
      const timing = response.timing();
      if (pageEntry && startDateTime > timing.startTime)
        pageEntry.startedDateTime = new Date(timing.startTime).toISOString();
      if (request.wallTimeMs() === undefined && timing.startTime > 0) {
        const startedDateTime = safeDateToISOString(timing.startTime);
        if (startedDateTime)
          harEntry.startedDateTime = startedDateTime;
      }
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

    this._recordRequestOverrides(harEntry, request);
    this._addBarrier(page || request.serviceWorker(), request.internalRawRequestHeaders().then(headers => {
      this._recordRequestHeadersAndCookies(harEntry, headers);
    }));
    // Record available headers including redirect location in case the tracing is stopped before
    // response extra info is received (in Chromium).
    this._recordResponseHeaders(harEntry, response.headers());
    this._addBarrier(page || request.serviceWorker(), response.internalRawResponseHeaders().then(headers => {
      this._recordResponseHeaders(harEntry, headers);
    }));
  }

  private _recordResponseHeaders(harEntry: har.Entry, headers: HeadersArray) {
    if (!this._options.omitCookies) {
      harEntry.response.cookies = headers
          .filter(header => header.name.toLowerCase() === 'set-cookie')
          .map(header => parseCookie(header.value));
    }
    harEntry.response.headers = headers;
    const contentType = headers.find(header => header.name.toLowerCase() === 'content-type');
    if (contentType)
      harEntry.response.content.mimeType = contentType.value;
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
      pages: this._pageEntries.length ? this._pageEntries.slice() : undefined,
      entries: [],
    };
    if (!this._options.omitTiming) {
      for (const pageEntry of log.pages || []) {
        const startDateTime = ((pageEntry as any)[startedDateSymbol] as Date).valueOf();
        if (typeof pageEntry.pageTimings.onContentLoad === 'number' && pageEntry.pageTimings.onContentLoad >= 0)
          pageEntry.pageTimings.onContentLoad -= startDateTime;
        else
          pageEntry.pageTimings.onContentLoad = -1;
        if (typeof pageEntry.pageTimings.onLoad === 'number' && pageEntry.pageTimings.onLoad >= 0)
          pageEntry.pageTimings.onLoad -= startDateTime;
        else
          pageEntry.pageTimings.onLoad = -1;
      }
    }
    this._pageEntries = [];
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

function createHarEntry(pageRef: string | undefined, method: string, url: URL, frameref: string | undefined, options: HarTracerOptions, wallTime?: number): har.Entry {
  const startedDateTime = (wallTime && safeDateToISOString(wallTime)) || new Date().toISOString();
  const harEntry: har.Entry = {
    pageref: pageRef,
    startedDateTime,
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
    _frameref: options.includeTraceInfo ? frameref : undefined,
    _monotonicTime: options.includeTraceInfo ? monotonicTime() : undefined,
  };
  return harEntry;
}

const SEMICOLON_SPLIT_RE = /; */;

function parseCookie(c: string): har.Cookie {
  const cookie: har.Cookie = {
    name: '',
    value: ''
  };
  let first = true;
  for (const pair of c.split(SEMICOLON_SPLIT_RE)) {
    const indexOfEquals = pair.indexOf('=');
    const name = indexOfEquals !== -1 ? pair.substr(0, indexOfEquals).trim() : pair.trim();
    const value = indexOfEquals !== -1 ? pair.substr(indexOfEquals + 1, pair.length).trim() : '';
    if (first) {
      first = false;
      cookie.name = name;
      cookie.value = value;
      continue;
    }

    switch (name.toLowerCase()) {
      case 'domain':
        cookie.domain = value;
        break;
      case 'expires':
        cookie.expires = safeDateToISOString(value);
        break;
      case 'httponly':
        cookie.httpOnly = true;
        break;
      case 'max-age':
        cookie.expires = safeDateToISOString(Date.now() + (+value) * 1000);
        break;
      case 'path':
        cookie.path = value;
        break;
      case 'samesite':
        cookie.sameSite = value;
        break;
      case 'secure':
        cookie.secure = true;
        break;
    }
  }
  return cookie;
}

function safeDateToISOString(value: string | number) {
  try {
    return new Date(value).toISOString();
  } catch (e) {
  }
}

const startedDateSymbol = Symbol('startedDate');

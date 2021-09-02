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

import { BrowserContext } from '../../browserContext';
import { helper } from '../../helper';
import * as network from '../../network';
import { Page } from '../../page';
import * as har from './har';
import { calculateSha1, monotonicTime } from '../../../utils/utils';
import { eventsHelper, RegisteredListener } from '../../../utils/eventsHelper';
import * as mime from 'mime';

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
  private _context: BrowserContext;
  private _barrierPromises = new Set<Promise<void>>();
  private _delegate: HarTracerDelegate;
  private _options: HarTracerOptions;
  private _pageEntries = new Map<Page, har.Page>();
  private _eventListeners: RegisteredListener[] = [];
  private _started = false;
  private _entrySymbol: symbol;

  constructor(context: BrowserContext, delegate: HarTracerDelegate, options: HarTracerOptions) {
    this._context = context;
    this._delegate = delegate;
    this._options = options;
    this._entrySymbol = Symbol('requestHarEntry');
  }

  start() {
    if (this._started)
      return;
    this._started = true;
    this._eventListeners = [
      eventsHelper.addEventListener(this._context, BrowserContext.Events.Page, (page: Page) => this._ensurePageEntry(page)),
      eventsHelper.addEventListener(this._context, BrowserContext.Events.Request, (request: network.Request) => this._onRequest(request)),
      eventsHelper.addEventListener(this._context, BrowserContext.Events.RequestFinished, ({ request, response }) => this._onRequestFinished(request, response).catch(() => {})),
      eventsHelper.addEventListener(this._context, BrowserContext.Events.Response, (response: network.Response) => this._onResponse(response)),
    ];
  }

  private _entryForRequest(request: network.Request): har.Entry | undefined {
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
  }

  private _onRequest(request: network.Request) {
    if (this._options.skipScripts && request.resourceType() === 'script')
      return;

    const page = request.frame()._page;
    const url = network.parsedURL(request.url());
    if (!url)
      return;

    const pageEntry = this._ensurePageEntry(page);
    const harEntry: har.Entry = {
      pageref: pageEntry.id,
      _frameref: request.frame().guid,
      _monotonicTime: monotonicTime(),
      startedDateTime: new Date(),
      time: -1,
      request: {
        method: request.method(),
        url: request.url(),
        httpVersion: FALLBACK_HTTP_VERSION,
        cookies: [],
        headers: [],
        queryString: [...url.searchParams].map(e => ({ name: e[0], value: e[1] })),
        postData: postDataForHar(request, this._options.content),
        headersSize: -1,
        bodySize: request.bodySize(),
      },
      response: {
        status: -1,
        statusText: '',
        httpVersion: FALLBACK_HTTP_VERSION,
        cookies: [],
        headers: [],
        content: {
          size: -1,
          mimeType: request.headerValue('content-type') || 'x-unknown',
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

    const promise = response.body().then(buffer => {
      const content = harEntry.response.content;
      content.size = buffer.length;
      if (buffer && buffer.length > 0) {
        if (this._options.content === 'embedded') {
          content.text = buffer.toString('base64');
          content.encoding = 'base64';
        } else if (this._options.content === 'sha1') {
          content._sha1 = calculateSha1(buffer) + '.' + (mime.getExtension(content.mimeType) || 'dat');
          if (this._started)
            this._delegate.onContentBlob(content._sha1, buffer);
        }
      }
    }).catch(() => {}).then(() => {
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
    this._addBarrier(page, response.sizes().then(async sizes => {
      harEntry.response.bodySize = sizes.responseBodySize;
      harEntry.response.headersSize = sizes.responseHeadersSize;
      harEntry.response._transferSize = sizes.responseTransferSize;
      harEntry.request.headersSize = sizes.requestHeadersSize;
      const content = harEntry.response.content;
      content.compression = Math.max(0, sizes.responseBodySize - sizes.responseTransferSize - sizes.responseHeadersSize);
    }));
  }

  private _onResponse(response: network.Response) {
    const page = response.frame()._page;
    const pageEntry = this._ensurePageEntry(page);
    const harEntry = this._entryForRequest(response.request());
    if (!harEntry)
      return;
    const request = response.request();

    harEntry.request.postData = postDataForHar(request, this._options.content);

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
    this._addBarrier(page, response.rawRequestHeaders().then(headers => {
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

    const log: har.Log = {
      version: '1.2',
      creator: {
        name: 'Playwright',
        version: require('../../../../package.json')['version'],
      },
      browser: {
        name: this._context._browser.options.name,
        version: this._context._browser.version()
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

function postDataForHar(request: network.Request, content: 'omit' | 'sha1' | 'embedded'): har.PostData | undefined {
  const postData = request.postDataBuffer();
  if (!postData)
    return;

  const contentType = request.headerValue('content-type') || 'application/octet-stream';
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

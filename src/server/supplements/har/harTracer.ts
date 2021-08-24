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

import { URL } from 'url';
import { BrowserContext } from '../../browserContext';
import { helper } from '../../helper';
import * as network from '../../network';
import { Page } from '../../page';
import * as har from './har';
import * as types from '../../types';
import { calculateSha1, monotonicTime } from '../../../utils/utils';
import { eventsHelper, RegisteredListener } from '../../../utils/eventsHelper';

const FALLBACK_HTTP_VERSION = 'HTTP/1.1';

export interface HarTracerDelegate {
  onPageEntry(entry: har.Page): void;
  onEntryStarted(entry: har.Entry): void;
  onEntryFinished(entry: har.Entry): void;
  onContentBlob(sha1: string, buffer: Buffer): void;
}

type HarTracerOptions = {
  content: 'omit' | 'sha1' | 'embedded';
  skipScripts: boolean;
  waitOnFlush: boolean;
};

export class HarTracer {
  private _context: BrowserContext;
  private _barrierPromises = new Set<Promise<void>>();
  private _delegate: HarTracerDelegate;
  private _options: HarTracerOptions;
  private _eventListeners: RegisteredListener[] = [];
  private _started = false;

  constructor(context: BrowserContext, delegate: HarTracerDelegate, options: HarTracerOptions) {
    this._context = context;
    this._delegate = delegate;
    this._options = options;
  }

  start() {
    if (this._started)
      return;
    this._started = true;
    this._eventListeners = [
      eventsHelper.addEventListener(this._context, BrowserContext.Events.Page, (page: Page) => this._ensurePageEntry(page)),
      eventsHelper.addEventListener(this._context, BrowserContext.Events.Request, (request: network.Request) => this._onRequest(request)),
      eventsHelper.addEventListener(this._context, BrowserContext.Events.RequestFinished, (request: network.Request) => this._onRequestFinished(request).catch(() => {})),
      eventsHelper.addEventListener(this._context, BrowserContext.Events.Response, (response: network.Response) => this._onResponse(response)),
    ];
  }

  private _ensurePageEntry(page: Page) {
    let pageEntry = (page as any)[kPageEntry] as har.Page | undefined;
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
      (page as any)[kPageEntry] = pageEntry;
      if (this._started)
        this._delegate.onPageEntry(pageEntry);
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
    if (!this._options.waitOnFlush)
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
        bodySize: calculateRequestBodySize(request) || 0,
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
      const fromEntry = entryForRequest(request.redirectedFrom()!)!;
      fromEntry.response.redirectURL = request.url();
    }
    (request as any)[kRequestEntry] = harEntry;
    if (this._started)
      this._delegate.onEntryStarted(harEntry);
  }

  private async _onRequestFinished(request: network.Request) {
    const page = request.frame()._page;
    const harEntry = entryForRequest(request);
    if (!harEntry)
      return;
    const response = await request.response();
    if (!response)
      return;

    const httpVersion = normaliseHttpVersion(response._httpVersion);
    const transferSize = response._transferSize || -1;
    const headersSize = calculateResponseHeadersSize(httpVersion, response.status(), response.statusText(), response.headers());
    const bodySize = transferSize !== -1 ? transferSize - headersSize : -1;

    harEntry.request.httpVersion = httpVersion;
    harEntry.response.bodySize = bodySize;
    harEntry.response.headersSize = headersSize;
    harEntry.response._transferSize = transferSize;
    harEntry.request.headersSize = calculateRequestHeadersSize(request.method(), request.url(), httpVersion, request.headers());

    const promise = this._finishResponseAsync(harEntry, response);
    this._addBarrier(page, promise);
  }

  private _onResponse(response: network.Response) {
    const page = response.frame()._page;
    const pageEntry = this._ensurePageEntry(page);
    const harEntry = entryForRequest(response.request());
    if (!harEntry)
      return;
    const request = response.request();

    // Rewrite provisional headers with actual
    harEntry.request.headers = request.headers().map(header => ({ name: header.name, value: header.value }));
    harEntry.request.cookies = cookiesForHar(request.headerValue('cookie'), ';');
    harEntry.request.postData = postDataForHar(request, this._options.content);

    harEntry.response = {
      status: response.status(),
      statusText: response.statusText(),
      httpVersion: normaliseHttpVersion(response._httpVersion),
      cookies: cookiesForHar(response.headerValue('set-cookie'), '\n'),
      headers: response.headers().map(header => ({ name: header.name, value: header.value })),
      content: {
        size: -1,
        mimeType: response.headerValue('content-type') || 'x-unknown',
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
  }

  private async _finishResponseAsync(harEntry: har.Entry, response: network.Response) {
    await Promise.all([
      response.serverAddr().then(server => {
        if (server?.ipAddress)
          harEntry.serverIPAddress = server.ipAddress;
        if (server?.port)
          harEntry._serverPort = server.port;
      }),
      response.securityDetails().then(details => {
        if (details)
          harEntry._securityDetails = details;
      }),
      response.body().then(buffer => {
        const content = harEntry.response.content;
        content.size = buffer.length;
        content.compression = harEntry.response.bodySize !== -1 ? buffer.length - harEntry.response.bodySize : 0;
        if (buffer && buffer.length > 0) {
          if (this._options.content === 'embedded') {
            content.text = buffer.toString('base64');
            content.encoding = 'base64';
          } else if (this._options.content === 'sha1') {
            content._sha1 = calculateSha1(buffer) + mimeToExtension(content.mimeType);
            if (this._started)
              this._delegate.onContentBlob(content._sha1, buffer);
          }
        }
      }).catch(() => {}),
    ]);
    const postData = response.request().postDataBuffer();
    if (postData && harEntry.request.postData && this._options.content === 'sha1') {
      harEntry.request.postData._sha1 = calculateSha1(postData) + mimeToExtension(harEntry.request.postData.mimeType);
      if (this._started)
        this._delegate.onContentBlob(harEntry.request.postData._sha1, postData);
    }
    if (this._started)
      this._delegate.onEntryFinished(harEntry);
  }

  async stop() {
    this._started = false;
    eventsHelper.removeEventListeners(this._eventListeners);
    await Promise.all(this._barrierPromises);
    this._barrierPromises.clear();
  }

  fixupPageEntry(pageEntry: har.Page) {
    if (pageEntry.pageTimings.onContentLoad >= 0)
      pageEntry.pageTimings.onContentLoad -= pageEntry.startedDateTime.valueOf();
    else
      pageEntry.pageTimings.onContentLoad = -1;
    if (pageEntry.pageTimings.onLoad >= 0)
      pageEntry.pageTimings.onLoad -= pageEntry.startedDateTime.valueOf();
    else
      pageEntry.pageTimings.onLoad = -1;
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

function cookiesForHar(header: string | undefined, separator: string): har.Cookie[] {
  if (!header)
    return [];
  return header.split(separator).map(c => parseCookie(c));
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

function calculateResponseHeadersSize(protocol: string, status: number, statusText: string , headers: types.HeadersArray) {
  let rawHeaders = `${protocol} ${status} ${statusText}\r\n`;
  for (const header of headers)
    rawHeaders += `${header.name}: ${header.value}\r\n`;
  rawHeaders += '\r\n';
  return rawHeaders.length;
}

function calculateRequestHeadersSize(method: string, url: string, httpVersion: string, headers: types.HeadersArray) {
  let rawHeaders = `${method} ${(new URL(url)).pathname} ${httpVersion}\r\n`;
  for (const header of headers)
    rawHeaders += `${header.name}: ${header.value}\r\n`;
  return rawHeaders.length;
}

function normaliseHttpVersion(httpVersion?: string) {
  if (!httpVersion)
    return FALLBACK_HTTP_VERSION;
  if (httpVersion === 'http/1.1')
    return 'HTTP/1.1';
  return httpVersion;
}

function calculateRequestBodySize(request: network.Request): number|undefined {
  const postData = request.postDataBuffer();
  if (!postData)
    return;
  return new TextEncoder().encode(postData.toString('utf8')).length;
}

const kPageEntry = Symbol('pageHarEntry');
const kRequestEntry = Symbol('requestHarEntry');
function entryForRequest(request: network.Request): har.Entry | undefined {
  return (request as any)[kRequestEntry];
}

const kMimeToExtension: { [key: string]: string } = {
  'application/javascript': 'js',
  'application/json': 'json',
  'application/json5': 'json5',
  'application/pdf': 'pdf',
  'application/xhtml+xml': 'xhtml',
  'application/zip': 'zip',
  'font/otf': 'otf',
  'font/woff': 'woff',
  'font/woff2': 'woff2',
  'image/bmp': 'bmp',
  'image/gif': 'gif',
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/tiff': 'tiff',
  'image/svg+xml': 'svg',
  'text/css': 'css',
  'text/csv': 'csv',
  'text/html': 'html',
  'text/plain': 'text',
  'video/mp4': 'mp4',
  'video/mpeg': 'mpeg',
};

function mimeToExtension(contentType: string): string {
  return '.' + (kMimeToExtension[contentType] || 'dat');
}

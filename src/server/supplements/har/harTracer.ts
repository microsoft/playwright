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

import fs from 'fs';
import * as util from 'util';
import { BrowserContext } from '../../browserContext';
import { helper } from '../../helper';
import * as network from '../../network';
import { Page } from '../../page';
import { InstrumentationListener } from '../../instrumentation';
import * as har from './har';

const fsWriteFileAsync = util.promisify(fs.writeFile.bind(fs));

export class HarTracer implements InstrumentationListener {
  private _contextTracers = new Map<BrowserContext, HarContextTracer>();

  async onContextCreated(context: BrowserContext): Promise<void> {
    if (!context._options.recordHar)
      return;
    const contextTracer = new HarContextTracer(context, context._options.recordHar);
    this._contextTracers.set(context, contextTracer);
  }

  async onContextWillDestroy(context: BrowserContext): Promise<void> {
    const contextTracer = this._contextTracers.get(context);
    if (contextTracer) {
      this._contextTracers.delete(context);
      await contextTracer.flush();
    }
  }
}

type HarOptions = {
  path: string;
  omitContent?: boolean;
};

class HarContextTracer {
  private _options: HarOptions;
  private _log: har.Log;
  private _pageEntries = new Map<Page, har.Page>();
  private _entries = new Map<network.Request, har.Entry>();
  private _lastPage = 0;
  private _barrierPromises = new Set<Promise<void>>();

  constructor(context: BrowserContext, options: HarOptions) {
    this._options = options;
    this._log = {
      version: '1.2',
      creator: {
        name: 'Playwright',
        version: require('../../../../package.json')['version'],
      },
      browser: {
        name: context._browser.options.name,
        version: context._browser.version()
      },
      pages: [],
      entries: []
    };
    context.on(BrowserContext.Events.Page, page => this._onPage(page));
  }

  private _onPage(page: Page) {
    const pageEntry: har.Page = {
      startedDateTime: new Date(),
      id: `page_${this._lastPage++}`,
      title: '',
      pageTimings: {
        onContentLoad: -1,
        onLoad: -1,
      },
    };
    this._pageEntries.set(page, pageEntry);
    this._log.pages.push(pageEntry);
    page.on(Page.Events.Request, (request: network.Request) => this._onRequest(page, request));
    page.on(Page.Events.Response, (response: network.Response) => this._onResponse(page, response));

    page.on(Page.Events.DOMContentLoaded, () => {
      const promise = page.mainFrame()._evaluateExpression(String(() => {
        return {
          title: document.title,
          domContentLoaded: performance.timing.domContentLoadedEventStart,
        };
      }), true, undefined, 'utility').then(result => {
        pageEntry.title = result.title;
        pageEntry.pageTimings.onContentLoad = result.domContentLoaded;
      }).catch(() => {});
      this._addBarrier(page, promise);
    });
    page.on(Page.Events.Load, () => {
      const promise = page.mainFrame()._evaluateExpression(String(() => {
        return {
          title: document.title,
          loaded: performance.timing.loadEventStart,
        };
      }), true, undefined, 'utility').then(result => {
        pageEntry.title = result.title;
        pageEntry.pageTimings.onLoad = result.loaded;
      }).catch(() => {});
      this._addBarrier(page, promise);
    });
  }

  private _addBarrier(page: Page, promise: Promise<void>) {
    const race = Promise.race([
      new Promise(f => page.on('close', () => {
        this._barrierPromises.delete(race);
        f();
      })),
      promise
    ]) as Promise<void>;
    this._barrierPromises.add(race);
  }

  private _onRequest(page: Page, request: network.Request) {
    const pageEntry = this._pageEntries.get(page)!;
    const url = network.parsedURL(request.url());
    if (!url)
      return;

    const harEntry: har.Entry = {
      pageref: pageEntry.id,
      startedDateTime: new Date(),
      time: -1,
      request: {
        method: request.method(),
        url: request.url(),
        httpVersion: 'HTTP/1.1',
        cookies: [],
        headers: [],
        queryString: [...url.searchParams].map(e => ({ name: e[0], value: e[1] })),
        postData: undefined,
        headersSize: -1,
        bodySize: -1,
      },
      response: {
        status: -1,
        statusText: '',
        httpVersion: 'HTTP/1.1',
        cookies: [],
        headers: [],
        content: {
          size: -1,
          mimeType: request.headerValue('content-type') || 'application/octet-stream',
        },
        headersSize: -1,
        bodySize: -1,
        redirectURL: ''
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
      const fromEntry = this._entries.get(request.redirectedFrom()!)!;
      fromEntry.response.redirectURL = request.url();
    }
    this._log.entries.push(harEntry);
    this._entries.set(request, harEntry);
  }

  private _onResponse(page: Page, response: network.Response) {
    const pageEntry = this._pageEntries.get(page)!;
    const harEntry = this._entries.get(response.request())!;
    // Rewrite provisional headers with actual
    const request = response.request();
    harEntry.request.headers = request.headers().map(header => ({ name: header.name, value: header.value }));
    harEntry.request.cookies = cookiesForHar(request.headerValue('cookie'), ';');
    harEntry.request.postData = postDataForHar(request) || undefined;

    harEntry.response = {
      status: response.status(),
      statusText: response.statusText(),
      httpVersion: 'HTTP/1.1',
      cookies: cookiesForHar(response.headerValue('set-cookie'), '\n'),
      headers: response.headers().map(header => ({ name: header.name, value: header.value })),
      content: {
        size: -1,
        mimeType: response.headerValue('content-type') || 'application/octet-stream',
      },
      headersSize: -1,
      bodySize: -1,
      redirectURL: ''
    };
    const timing = response.timing();
    if (pageEntry.startedDateTime.valueOf() > timing.startTime)
      pageEntry.startedDateTime = new Date(timing.startTime);
    harEntry.timings = {
      dns: timing.domainLookupEnd !== -1 ? helper.millisToRoundishMillis(timing.domainLookupEnd - timing.domainLookupStart) : -1,
      connect: timing.connectEnd !== -1 ? helper.millisToRoundishMillis(timing.connectEnd - timing.connectStart) : -1,
      ssl: timing.connectEnd !== -1 ? helper.millisToRoundishMillis(timing.connectEnd - timing.secureConnectionStart) : -1,
      send: 0,
      wait: timing.responseStart !== -1 ? helper.millisToRoundishMillis(timing.responseStart - timing.requestStart) : -1,
      receive: response.request()._responseEndTiming !== -1 ? helper.millisToRoundishMillis(response.request()._responseEndTiming - timing.responseStart) : -1,
    };
    if (!this._options.omitContent && response.status() === 200) {
      const promise = response.body().then(buffer => {
        harEntry.response.content.text = buffer.toString('base64');
        harEntry.response.content.encoding = 'base64';
      }).catch(() => {});
      this._addBarrier(page, promise);
    }
  }

  async flush() {
    await Promise.all(this._barrierPromises);
    for (const pageEntry of this._log.pages) {
      if (pageEntry.pageTimings.onContentLoad >= 0)
        pageEntry.pageTimings.onContentLoad -= pageEntry.startedDateTime.valueOf();
      else
        pageEntry.pageTimings.onContentLoad = -1;
      if (pageEntry.pageTimings.onLoad >= 0)
        pageEntry.pageTimings.onLoad -= pageEntry.startedDateTime.valueOf();
      else
        pageEntry.pageTimings.onLoad = -1;
    }
    await fsWriteFileAsync(this._options.path, JSON.stringify({ log: this._log }, undefined, 2));
  }
}

function postDataForHar(request: network.Request): har.PostData | null {
  const postData = request.postDataBuffer();
  if (!postData)
    return null;

  const contentType = request.headerValue('content-type') || 'application/octet-stream';
  const result: har.PostData = {
    mimeType: contentType,
    text: contentType === 'application/octet-stream' ? '' : postData.toString(),
    params: []
  };
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

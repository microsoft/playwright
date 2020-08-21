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

import * as path from 'path';
import * as util from 'util';
import * as fs from 'fs';
import { NetworkResourceTraceEvent, SnapshotTraceEvent, ContextCreatedTraceEvent, ContextDestroyedTraceEvent, FrameSnapshot, PageSnapshot } from '../utils/traceTypes';
import type { Browser, BrowserContext, Frame, Page, Route } from './api';
import type { Playwright } from './playwright';

const fsReadFileAsync = util.promisify(fs.readFile.bind(fs));
type TraceEvent =
    ContextCreatedTraceEvent |
    ContextDestroyedTraceEvent |
    NetworkResourceTraceEvent |
    SnapshotTraceEvent;

class TraceViewer {
  private _playwright: Playwright;
  private _traceStorageDir: string;
  private _traces: { traceFile: string, events: TraceEvent[] }[] = [];
  private _browserNames = new Set<string>();
  private _resourceEventsByUrl = new Map<string, NetworkResourceTraceEvent[]>();
  private _contextEventById = new Map<string, ContextCreatedTraceEvent>();
  private _contextById = new Map<string, BrowserContext>();

  constructor(playwright: Playwright, traceStorageDir: string) {
    this._playwright = playwright;
    this._traceStorageDir = traceStorageDir;
  }

  async load(traceFile: string) {
    // TODO: validate trace?
    const traceContent = await fsReadFileAsync(traceFile, 'utf8');
    const events = traceContent.split('\n').map(line => line.trim()).filter(line => !!line).map(line => JSON.parse(line));
    for (const event of events) {
      if (event.type === 'context-created')
        this._browserNames.add(event.browserName);
      if (event.type === 'resource') {
        let responseEvents = this._resourceEventsByUrl.get(event.url);
        if (!responseEvents) {
          responseEvents = [];
          this._resourceEventsByUrl.set(event.url, responseEvents);
        }
        responseEvents.push(event);
      }
      if (event.type === 'context-created')
        this._contextEventById.set(event.contextId, event);
    }
    this._traces.push({ traceFile, events });
  }

  browserNames(): Set<string> {
    return this._browserNames;
  }

  async show(browserName: string) {
    const browser = await this._playwright[browserName as ('chromium' | 'firefox' | 'webkit')].launch({ headless: false });
    const uiPage = await browser.newPage();
    await uiPage.exposeBinding('renderSnapshot', async (source, event: SnapshotTraceEvent) => {
      const snapshot = await fsReadFileAsync(path.join(this._traceStorageDir, event.sha1), 'utf8');
      const context = await this._ensureContext(browser, event.contextId);
      const page = await context.newPage();
      await this._renderSnapshot(page, JSON.parse(snapshot), event.contextId);
    });

    const snapshotsPerContext: { [contextId: string]: { label: string, snapshots: SnapshotTraceEvent[] } } = {};
    for (const trace of this._traces) {
      let contextId = 0;
      for (const event of trace.events) {
        if (event.type !== 'snapshot')
          continue;
        const contextEvent = this._contextEventById.get(event.contextId)!;
        if (contextEvent.browserName !== browserName)
          continue;
        let contextSnapshots = snapshotsPerContext[contextEvent.contextId];
        if (!contextSnapshots) {
          contextSnapshots = { label: trace.traceFile + ' :: context' + (++contextId), snapshots: [] };
          snapshotsPerContext[contextEvent.contextId] = contextSnapshots;
        }
        contextSnapshots.snapshots.push(event);
      }
    }
    await uiPage.evaluate(snapshotsPerContext => {
      for (const contextSnapshots of Object.values(snapshotsPerContext)) {
        const header = document.createElement('div');
        header.textContent = contextSnapshots.label;
        header.style.margin = '10px';
        document.body.appendChild(header);
        for (const event of contextSnapshots.snapshots) {
          const button = document.createElement('button');
          button.style.display = 'block';
          button.textContent = `${event.label}`;
          button.addEventListener('click', () => {
            (window as any).renderSnapshot(event);
          });
          document.body.appendChild(button);
        }
      }
    }, snapshotsPerContext);
  }

  private async _ensureContext(browser: Browser, contextId: string): Promise<BrowserContext> {
    let context = this._contextById.get(contextId);
    if (!context) {
      const event = this._contextEventById.get(contextId)!;
      context = await browser.newContext({
        isMobile: event.isMobile,
        viewport: event.viewportSize || null,
        deviceScaleFactor: event.deviceScaleFactor,
      });
      this._contextById.set(contextId, context);
    }
    return context;
  }

  private async _readResource(event: NetworkResourceTraceEvent, overrideSha1: string | undefined) {
    try {
      const body = await fsReadFileAsync(path.join(this._traceStorageDir, overrideSha1 || event.sha1));
      return {
        contentType: event.contentType,
        body,
        headers: event.responseHeaders,
      };
    } catch (e) {
      return undefined;
    }
  }

  private async _renderSnapshot(page: Page, snapshot: PageSnapshot, contextId: string): Promise<void> {
    const frameBySrc = new Map<string, FrameSnapshot>();
    for (const frameSnapshot of snapshot.frames)
      frameBySrc.set(frameSnapshot.url, frameSnapshot);

    const intercepted: Promise<any>[] = [];

    const unknownUrls = new Set<string>();
    const unknown = (route: Route): void => {
      const url = route.request().url();
      if (!unknownUrls.has(url)) {
        console.log(`Request to unknown url: ${url}`);  /* eslint-disable-line no-console */
        unknownUrls.add(url);
      }
      intercepted.push(route.abort());
    };

    await page.route('**', async route => {
      const url = route.request().url();
      if (frameBySrc.has(url)) {
        const frameSnapshot = frameBySrc.get(url)!;
        intercepted.push(route.fulfill({
          contentType: 'text/html',
          body: Buffer.from(frameSnapshot.html),
        }));
        return;
      }

      const frameSrc = route.request().frame().url();
      const frameSnapshot = frameBySrc.get(frameSrc);
      if (!frameSnapshot)
        return unknown(route);

      // Find a matching resource from the same context, preferrably from the same frame.
      // Note: resources are stored without hash, but page may reference them with hash.
      let resource: NetworkResourceTraceEvent | null = null;
      for (const resourceEvent of this._resourceEventsByUrl.get(removeHash(url)) || []) {
        if (resourceEvent.contextId !== contextId)
          continue;
        if (resource && resourceEvent.frameId !== frameSnapshot.frameId)
          continue;
        resource = resourceEvent;
        if (resourceEvent.frameId === frameSnapshot.frameId)
          break;
      }
      if (!resource)
        return unknown(route);

      // This particular frame might have a resource content override, for example when
      // stylesheet is modified using CSSOM.
      const resourceOverride = frameSnapshot.resourceOverrides.find(o => o.url === url);
      const overrideSha1 = resourceOverride ? resourceOverride.sha1 : undefined;
      const resourceData = await this._readResource(resource, overrideSha1);
      if (!resourceData)
        return unknown(route);
      const headers: { [key: string]: string } = {};
      for (const { name, value } of resourceData.headers)
        headers[name] = value;
      headers['Access-Control-Allow-Origin'] = '*';
      intercepted.push(route.fulfill({
        contentType: resourceData.contentType,
        body: resourceData.body,
        headers,
      }));
    });

    await page.goto(snapshot.frames[0].url);
    await this._postprocessSnapshotFrame(snapshot, snapshot.frames[0], page.mainFrame());
    await Promise.all(intercepted);
  }

  private async _postprocessSnapshotFrame(snapshot: PageSnapshot, frameSnapshot: FrameSnapshot, frame: Frame) {
    for (const childFrame of frame.childFrames()) {
      await childFrame.waitForLoadState();
      const url = childFrame.url();
      for (const childData of snapshot.frames) {
        if (url.endsWith(childData.url))
          await this._postprocessSnapshotFrame(snapshot, childData, childFrame);
      }
    }
  }
}

export async function showTraceViewer(playwright: Playwright, traceStorageDir: string, traceFiles: string[]) {
  const traceViewer = new TraceViewer(playwright, traceStorageDir);
  for (const traceFile of traceFiles)
    await traceViewer.load(traceFile);
  for (const browserName of traceViewer.browserNames())
    await traceViewer.show(browserName);
}

function removeHash(url: string) {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.toString();
  } catch (e) {
    return url;
  }
}

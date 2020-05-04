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
import { NetworkResponseTraceEvent, SnapshotTraceEvent, ContextCreatedTraceEvent, ContextDestroyedTraceEvent } from './browserContextTracer';
import { kTraceFileName } from './traceController';
import { BrowserContext } from '../browserContext';
import { renderSnapshot, ResourceGetter } from './snapshotter';
import { BrowserType } from '../server/browserType';
import { BrowserCreatedTraceEvent, BrowserDestroyedTraceEvent } from './browserTracer';

const fsReadFileAsync = util.promisify(fs.readFile.bind(fs));
type TraceEvent =
    BrowserCreatedTraceEvent |
    BrowserDestroyedTraceEvent |
    ContextCreatedTraceEvent |
    ContextDestroyedTraceEvent |
    NetworkResponseTraceEvent |
    SnapshotTraceEvent;

export async function showTraceViewer(browserType: BrowserType, tracePath: string) {
  // TODO: validate trace?
  const traceFile = await fsReadFileAsync(path.join(tracePath, kTraceFileName), 'utf8');
  const allEvents = traceFile.split('\n').map(line => line.trim()).filter(line => !!line).map(line => JSON.parse(line)) as TraceEvent[];
  const events = filterEvents(allEvents, browserType.name());

  const browser = await browserType.launch({ headless: false });

  const responseEventById = new Map<string, NetworkResponseTraceEvent>();
  for (const event of events) {
    if (event.type === 'resource')
      responseEventById.set(event.resourceId, event);
  }
  const resourceGetter: ResourceGetter = async (resourceId: string, overrideSha1: string | undefined) => {
    const event = responseEventById.get(resourceId);
    if (!event)
      return undefined;
    try {
      const body = await fsReadFileAsync(path.join(tracePath, overrideSha1 || event.sha1));
      return {
        contentType: event.contentType,
        body,
        headers: event.responseHeaders,
      };
    } catch (e) {
      return undefined;
    }
  };

  const contexts = new Map<string, BrowserContext>();
  for (const event of events) {
    if (event.type === 'context-created') {
      const context = await browser.newContext({
        isMobile: event.isMobile,
        viewport: event.viewportSize || null,
        deviceScaleFactor: event.deviceScaleFactor,
      });
      contexts.set(event.contextId, context);
    }
  }

  const uiPage = await browser.newPage();
  await uiPage.exposeBinding('renderSnapshot', async (source, event: SnapshotTraceEvent) => {
    const snapshot = await fsReadFileAsync(path.join(tracePath, event.sha1), 'utf8');
    const context = contexts.get(event.contextId)!;
    const page = await context.newPage();
    await renderSnapshot(page, resourceGetter, JSON.parse(snapshot));
  });

  const snapshotEvents = events.filter(e => e.type === 'snapshot') as SnapshotTraceEvent[];
  await uiPage.evaluate(snapshotEvents => {
    for (const event of snapshotEvents) {
      const button = document.createElement('button');
      button.style.display = 'block';
      button.textContent = `${event.label}`;
      button.addEventListener('click', () => {
        (window as any).renderSnapshot(event);
      });
      document.body.appendChild(button);
    }
  }, snapshotEvents);
}

function filterEvents(events: TraceEvent[], browserName: string): TraceEvent[] {
  const browserIds = new Set<string>();
  const contextIds = new Set<string>();
  const result: TraceEvent[] = [];
  for (const event of events) {
    if (event.type === 'browser-created') {
      if (event.name === browserName) {
        browserIds.add(event.browserId);
        result.push(event);
      }
    } else if (event.type === 'browser-destroyed') {
      if (browserIds.has(event.browserId))
        result.push(event);
    } else if (event.type === 'context-created') {
      if (browserIds.has(event.browserId)) {
        contextIds.add(event.contextId);
        result.push(event);
      }
    } else {
      if (contextIds.has(event.contextId))
        result.push(event);
    }
  }
  return result;
}

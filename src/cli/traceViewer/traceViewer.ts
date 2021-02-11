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
import path from 'path';
import * as playwright from '../../..';
import * as util from 'util';
import { ScreenshotGenerator } from './screenshotGenerator';
import { readTraceFile, TraceModel } from './traceModel';
import type { TraceEvent } from '../../trace/traceTypes';
import { SnapshotServer } from './snapshotServer';
import { ServerRouteHandler, TraceServer } from './traceServer';

const fsReadFileAsync = util.promisify(fs.readFile.bind(fs));

type TraceViewerDocument = {
  resourcesDir: string;
  model: TraceModel;
};

const emptyModel: TraceModel = {
  contexts: [
    {
      startTime: 0,
      endTime: 1,
      created: {
        timestamp: Date.now(),
        type: 'context-created',
        browserName: 'none',
        contextId: '<empty>',
        deviceScaleFactor: 1,
        isMobile: false,
        viewportSize: { width: 800, height: 600 },
        snapshotScript: '',
      },
      destroyed: {
        timestamp: Date.now(),
        type: 'context-destroyed',
        contextId: '<empty>',
      },
      name: '<empty>',
      filePath: '',
      pages: [],
    }
  ]
};

class TraceViewer {
  private _document: TraceViewerDocument | undefined;

  async load(traceDir: string) {
    const resourcesDir = path.join(traceDir, 'resources');
    const model = { contexts: [] };
    this._document = {
      model,
      resourcesDir,
    };

    for (const name of fs.readdirSync(traceDir)) {
      if (!name.endsWith('.trace'))
        continue;
      const filePath = path.join(traceDir, name);
      const traceContent = await fsReadFileAsync(filePath, 'utf8');
      const events = traceContent.split('\n').map(line => line.trim()).filter(line => !!line).map(line => JSON.parse(line)) as TraceEvent[];
      readTraceFile(events, model, filePath);
    }
  }

  async show() {
    const browser = await playwright.chromium.launch({ headless: false });

    // Served by TraceServer
    // - "/tracemodel" - json with trace model.
    //
    // Served by TraceViewer
    // - "/traceviewer/..." - our frontend.
    // - "/file?filePath" - local files, used by sources tab.
    // - "/action-preview/..." - lazily generated action previews.
    // - "/sha1/<sha1>" - trace resource bodies, used by network previews.
    //
    // Served by SnapshotServer
    // - "/resources/<resourceId>" - network resources from the trace.
    // - "/snapshot/" - root for snapshot frame.
    // - "/snapshot/pageId/..." - actual snapshot html.
    // - "/snapshot/service-worker.js" - service worker that intercepts snapshot resources
    //   and translates them into "/resources/<resourceId>".

    const server = new TraceServer(this._document ? this._document.model : emptyModel);
    const snapshotServer = new SnapshotServer(server, this._document ? this._document.model : emptyModel, this._document ? this._document.resourcesDir : undefined);
    const screenshotGenerator = this._document ? new ScreenshotGenerator(snapshotServer, this._document.resourcesDir, this._document.model) : undefined;

    const traceViewerHandler: ServerRouteHandler = (request, response) => {
      const relativePath = request.url!.substring('/traceviewer/'.length);
      const absolutePath = path.join(__dirname, '..', '..', 'web', ...relativePath.split('/'));
      return server.serveFile(response, absolutePath);
    };
    server.routePrefix('/traceviewer/', traceViewerHandler, true);

    const actionPreviewHandler: ServerRouteHandler = (request, response) => {
      if (!screenshotGenerator)
        return false;
      const fullPath = request.url!.substring('/action-preview/'.length);
      const actionId = fullPath.substring(0, fullPath.indexOf('.png'));
      screenshotGenerator.generateScreenshot(actionId).then(body => {
        if (!body) {
          response.statusCode = 404;
          response.end();
        } else {
          response.statusCode = 200;
          response.setHeader('Content-Type', 'image/png');
          response.setHeader('Content-Length', body.byteLength);
          response.end(body);
        }
      });
      return true;
    };
    server.routePrefix('/action-preview/', actionPreviewHandler);

    const fileHandler: ServerRouteHandler = (request, response) => {
      try {
        const url = new URL('http://localhost' + request.url!);
        const search = url.search;
        if (search[0] !== '?')
          return false;
        return server.serveFile(response, search.substring(1));
      } catch (e) {
        return false;
      }
    };
    server.routePath('/file', fileHandler);

    const sha1Handler: ServerRouteHandler = (request, response) => {
      if (!this._document)
        return false;
      const sha1 = request.url!.substring('/sha1/'.length);
      if (sha1.includes('/'))
        return false;
      return server.serveFile(response, path.join(this._document.resourcesDir, sha1));
    };
    server.routePrefix('/sha1/', sha1Handler);

    const urlPrefix = await server.start();
    const uiPage = await browser.newPage({ viewport: null });
    uiPage.on('close', () => process.exit(0));
    await uiPage.goto(urlPrefix + '/traceviewer/traceViewer/index.html');
  }
}

export async function showTraceViewer(traceDir: string) {
  const traceViewer = new TraceViewer();
  if (traceDir)
    await traceViewer.load(traceDir);
  await traceViewer.show();
}

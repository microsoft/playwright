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

import * as fs from 'fs';
import * as path from 'path';
import * as playwright from '../../..';
import * as util from 'util';
import { ScreenshotGenerator } from './screenshotGenerator';
import { SnapshotRouter } from './snapshotRouter';
import { readTraceFile, TraceModel } from './traceModel';
import type { ActionTraceEvent, TraceEvent } from '../../trace/traceTypes';
import { SnapshotServer } from './snapshotServer';

const fsReadFileAsync = util.promisify(fs.readFile.bind(fs));

type TraceViewerDocument = {
  resourcesDir: string;
  model: TraceModel;
  snapshotRouter: SnapshotRouter;
  screenshotGenerator: ScreenshotGenerator;
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
      },
      destroyed: {
        timestamp: Date.now(),
        type: 'context-destroyed',
        contextId: '<empty>',
      },
      name: '<empty>',
      filePath: '',
      pages: [],
      resourcesByUrl: new Map()
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
      snapshotRouter: new SnapshotRouter(resourcesDir),
      screenshotGenerator: new ScreenshotGenerator(resourcesDir, model),
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
    const server = await SnapshotServer.create(path.join(__dirname, 'web'), this._document ? this._document.resourcesDir : undefined, this._document ? this._document.model : emptyModel);
    const uiPage = await browser.newPage({ viewport: null });
    uiPage.on('close', () => process.exit(0));
    await uiPage.goto(server.traceViewerUrl('index.html'));

    // await uiPage.route('**/*', (route, request) => {
    //   if (request.frame().parentFrame() && this._document) {
    //     this._document.snapshotRouter.route(route);
    //     return;
    //   }
    //   try {
    //     const url = new URL(request.url());
    //     if (this._document && request.url().includes('action-preview')) {
    //       const fullPath = url.pathname.substring('/action-preview/'.length);
    //       const actionId = fullPath.substring(0, fullPath.indexOf('.png'));
    //       this._document.screenshotGenerator.generateScreenshot(actionId).then(body => {
    //         if (body)
    //           route.fulfill({ contentType: 'image/png', body });
    //         else
    //           route.fulfill({ status: 404 });
    //       });
    //       return;
    //     }
    //     const filePath = path.join(__dirname, 'web', url.pathname.substring(1));
    //     const body = fs.readFileSync(filePath);
    //     route.fulfill({
    //       contentType: extensionToMime[path.extname(url.pathname).substring(1)] || 'text/plain',
    //       body,
    //     });
    //   } catch (e) {
    //     console.log(e); // eslint-disable-line no-console
    //     route.fulfill({
    //       status: 404
    //     });
    //   }
    // });
  }
}

export async function showTraceViewer(traceDir: string) {
  const traceViewer = new TraceViewer();
  if (traceDir)
    await traceViewer.load(traceDir);
  await traceViewer.show();
}

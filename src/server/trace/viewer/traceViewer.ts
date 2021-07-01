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

import extract from 'extract-zip';
import fs from 'fs';
import os from 'os';
import path from 'path';
import rimraf from 'rimraf';
import { createPlaywright } from '../../playwright';
import { PersistentSnapshotStorage, TraceModel } from './traceModel';
import { TraceEvent } from '../common/traceEvents';
import { ServerRouteHandler, HttpServer } from '../../../utils/httpServer';
import { SnapshotServer } from '../../snapshot/snapshotServer';
import * as consoleApiSource from '../../../generated/consoleApiSource';
import { isUnderTest } from '../../../utils/utils';
import { internalCallMetadata } from '../../instrumentation';
import { ProgressController } from '../../progress';
import { BrowserContext } from '../../browserContext';

export class TraceViewer {
  private _server: HttpServer;
  private _browserName: string;

  constructor(tracesDir: string, browserName: string) {
    this._browserName = browserName;
    const resourcesDir = path.join(tracesDir, 'resources');

    // Served by TraceServer
    // - "/tracemodel" - json with trace model.
    //
    // Served by TraceViewer
    // - "/traceviewer/..." - our frontend.
    // - "/file?filePath" - local files, used by sources tab.
    // - "/sha1/<sha1>" - trace resource bodies, used by network previews.
    //
    // Served by SnapshotServer
    // - "/resources/<resourceId>" - network resources from the trace.
    // - "/snapshot/" - root for snapshot frame.
    // - "/snapshot/pageId/..." - actual snapshot html.
    // - "/snapshot/service-worker.js" - service worker that intercepts snapshot resources
    //   and translates them into "/resources/<resourceId>".
    const actionTraces = fs.readdirSync(tracesDir).filter(name => name.endsWith('.trace'));
    const debugNames = actionTraces.map(name => {
      const tracePrefix = path.join(tracesDir, name.substring(0, name.indexOf('.trace')));
      return path.basename(tracePrefix);
    });

    this._server = new HttpServer();

    const traceListHandler: ServerRouteHandler = (request, response) => {
      response.statusCode = 200;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify(debugNames));
      return true;
    };
    this._server.routePath('/contexts', traceListHandler);
    const snapshotStorage = new PersistentSnapshotStorage(resourcesDir);
    new SnapshotServer(this._server, snapshotStorage);

    const traceModelHandler: ServerRouteHandler = (request, response) => {
      const debugName = request.url!.substring('/context/'.length);
      const tracePrefix = path.join(tracesDir, debugName);
      snapshotStorage.clear();
      response.statusCode = 200;
      response.setHeader('Content-Type', 'application/json');
      (async () => {
        const traceContent = await fs.promises.readFile(tracePrefix + '.trace', 'utf8');
        const events = traceContent.split('\n').map(line => line.trim()).filter(line => !!line).map(line => JSON.parse(line)) as TraceEvent[];
        const model = new TraceModel(snapshotStorage);
        model.appendEvents(events, snapshotStorage);
        response.end(JSON.stringify(model.contextEntry));
      })().catch(e => console.error(e));
      return true;
    };
    this._server.routePrefix('/context/', traceModelHandler);

    const traceViewerHandler: ServerRouteHandler = (request, response) => {
      const relativePath = request.url!.substring('/traceviewer/'.length);
      const absolutePath = path.join(__dirname, '..', '..', '..', 'web', ...relativePath.split('/'));
      return this._server.serveFile(response, absolutePath);
    };
    this._server.routePrefix('/traceviewer/', traceViewerHandler);

    const fileHandler: ServerRouteHandler = (request, response) => {
      try {
        const url = new URL('http://localhost' + request.url!);
        const search = url.search;
        if (search[0] !== '?')
          return false;
        return this._server.serveFile(response, search.substring(1));
      } catch (e) {
        return false;
      }
    };
    this._server.routePath('/file', fileHandler);

    const sha1Handler: ServerRouteHandler = (request, response) => {
      const sha1 = request.url!.substring('/sha1/'.length);
      if (sha1.includes('/'))
        return false;
      return this._server.serveFile(response, path.join(resourcesDir!, sha1));
    };
    this._server.routePrefix('/sha1/', sha1Handler);
  }

  async show(headless: boolean): Promise<BrowserContext> {
    const urlPrefix = await this._server.start();

    const traceViewerPlaywright = createPlaywright(true);
    const args = [
      '--app=data:text/html,',
      '--window-size=1280,800'
    ];
    if (isUnderTest())
      args.push(`--remote-debugging-port=0`);
    const context = await traceViewerPlaywright[this._browserName as 'chromium'].launchPersistentContext(internalCallMetadata(), '', {
      // TODO: store language in the trace.
      sdkLanguage: 'javascript',
      args,
      noDefaultViewport: true,
      headless,
      useWebSocket: isUnderTest()
    });

    const controller = new ProgressController(internalCallMetadata(), context._browser);
    await controller.run(async progress => {
      await context._browser._defaultContext!._loadDefaultContextAsIs(progress);
    });
    await context.extendInjectedScript('main', consoleApiSource.source);
    const [page] = context.pages();
    if (isUnderTest())
      page.on('close', () => context.close(internalCallMetadata()).catch(() => {}));
    else
      page.on('close', () => process.exit());
    await page.mainFrame().goto(internalCallMetadata(), urlPrefix + '/traceviewer/traceViewer/index.html');
    return context;
  }
}

export async function showTraceViewer(tracePath: string, browserName: string, headless = false): Promise<BrowserContext | undefined> {
  let stat;
  try {
    stat = fs.statSync(tracePath);
  } catch (e) {
    console.log(`No such file or directory: ${tracePath}`);  // eslint-disable-line no-console
    return;
  }

  if (stat.isDirectory()) {
    const traceViewer = new TraceViewer(tracePath, browserName);
    return await traceViewer.show(headless);
  }

  const zipFile = tracePath;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `playwright-trace`));
  process.on('exit', () => rimraf.sync(dir));
  try {
    await extract(zipFile, { dir });
  } catch (e) {
    console.log(`Invalid trace file: ${zipFile}`);  // eslint-disable-line no-console
    return;
  }
  const traceViewer = new TraceViewer(dir, browserName);
  return await traceViewer.show(headless);
}

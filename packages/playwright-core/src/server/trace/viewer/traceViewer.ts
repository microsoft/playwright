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
import readline from 'readline';
import os from 'os';
import path from 'path';
import rimraf from 'rimraf';
import stream from 'stream';
import { createPlaywright } from '../../playwright';
import { PersistentSnapshotStorage, TraceModel } from './traceModel';
import { ServerRouteHandler, HttpServer } from '../../../utils/httpServer';
import { SnapshotServer } from '../../snapshot/snapshotServer';
import * as consoleApiSource from '../../../generated/consoleApiSource';
import { isUnderTest, download } from '../../../utils/utils';
import { internalCallMetadata } from '../../instrumentation';
import { ProgressController } from '../../progress';
import { BrowserContext } from '../../browserContext';
import { findChromiumChannel } from '../../../utils/registry';
import { installAppIcon } from '../../chromium/crApp';
import { debugLogger } from '../../../utils/debugLogger';
import { VirtualFileSystem, RealFileSystem, ZipFileSystem } from '../../../utils/vfs';

export class TraceViewer {
  private _vfs: VirtualFileSystem;
  private _server: HttpServer;
  private _browserName: string;

  constructor(vfs: VirtualFileSystem, browserName: string) {
    this._vfs = vfs;
    this._browserName = browserName;
    this._server = new HttpServer();
  }

  async init() {
    // Served by TraceServer
    // - "/tracemodel" - json with trace model.
    //
    // Served by TraceViewer
    // - "/" - our frontend.
    // - "/file?filePath" - local files, used by sources tab.
    // - "/sha1/<sha1>" - trace resource bodies, used by network previews.
    //
    // Served by SnapshotServer
    // - "/resources/" - network resources from the trace.
    // - "/snapshot/" - root for snapshot frame.
    // - "/snapshot/pageId/..." - actual snapshot html.
    //   and translates them into network requests.
    const entries = await this._vfs.entries();
    const debugNames = entries.filter(name => name.endsWith('.trace')).map(name => {
      return name.substring(0, name.indexOf('.trace'));
    });

    const traceListHandler: ServerRouteHandler = (request, response) => {
      response.statusCode = 200;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify(debugNames));
      return true;
    };
    this._server.routePath('/contexts', traceListHandler);
    const snapshotStorage = new PersistentSnapshotStorage(this._vfs);
    new SnapshotServer(this._server, snapshotStorage);

    const traceModelHandler: ServerRouteHandler = (request, response) => {
      const debugName = request.url!.substring('/context/'.length);
      snapshotStorage.clear();
      response.statusCode = 200;
      response.setHeader('Content-Type', 'application/json');
      (async () => {
        const traceFile = await this._vfs.readStream(debugName + '.trace');
        const match = debugName.match(/^(.*)-\d+$/);
        const networkFile = await this._vfs.readStream((match ? match[1] : debugName) + '.network').catch(() => undefined);
        const model = new TraceModel(snapshotStorage);
        await appendTraceEvents(model, traceFile);
        if (networkFile)
          await appendTraceEvents(model, networkFile);
        model.build();
        response.end(JSON.stringify(model.contextEntry));
      })().catch(e => console.error(e));
      return true;
    };
    this._server.routePrefix('/context/', traceModelHandler);

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
      this._server.serveVirtualFile(response, this._vfs, 'resources/' + sha1).catch(() => {});
      return true;
    };
    this._server.routePrefix('/sha1/', sha1Handler);

    const traceViewerHandler: ServerRouteHandler = (request, response) => {
      const relativePath = request.url!;
      const absolutePath = path.join(__dirname, '..', '..', '..', 'web', 'traceViewer', ...relativePath.split('/'));
      return this._server.serveFile(response, absolutePath);
    };
    this._server.routePrefix('/', traceViewerHandler);
  }

  async show(headless: boolean): Promise<BrowserContext> {
    const urlPrefix = await this._server.start();

    const traceViewerPlaywright = createPlaywright('javascript', true);
    const traceViewerBrowser = isUnderTest() ? 'chromium' : this._browserName;
    const args = traceViewerBrowser === 'chromium' ? [
      '--app=data:text/html,',
      '--window-size=1280,800'
    ] : [];
    if (isUnderTest())
      args.push(`--remote-debugging-port=0`);

    const context = await traceViewerPlaywright[traceViewerBrowser as 'chromium'].launchPersistentContext(internalCallMetadata(), '', {
      // TODO: store language in the trace.
      channel: findChromiumChannel(traceViewerPlaywright.options.sdkLanguage),
      args,
      noDefaultViewport: true,
      headless,
      useWebSocket: isUnderTest()
    });

    const controller = new ProgressController(internalCallMetadata(), context._browser);
    await controller.run(async progress => {
      await context._browser._defaultContext!._loadDefaultContextAsIs(progress);
    });
    await context.extendInjectedScript(consoleApiSource.source);
    const [page] = context.pages();

    if (traceViewerBrowser === 'chromium')
      await installAppIcon(page);

    if (isUnderTest())
      page.on('close', () => context.close(internalCallMetadata()).catch(() => {}));
    else
      page.on('close', () => process.exit());

    await page.mainFrame().goto(internalCallMetadata(), urlPrefix + '/index.html');
    return context;
  }
}

async function appendTraceEvents(model: TraceModel, input: stream.Readable) {
  const rl = readline.createInterface({
    input,
    crlfDelay: Infinity
  });
  for await (const line of rl as any)
    model.appendEvent(line);
}

export async function showTraceViewer(tracePath: string, browserName: string, headless = false): Promise<BrowserContext | undefined> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `playwright-trace`));
  process.on('exit', () => rimraf.sync(dir));

  if (/^https?:\/\//i.test(tracePath)){
    const downloadZipPath = path.join(dir, 'trace.zip');
    try {
      await download(tracePath, downloadZipPath, {
        progressBarName: tracePath,
        log: debugLogger.log.bind(debugLogger, 'download')
      });
    } catch (error) {
      console.log(`${error?.message || ''}`); // eslint-disable-line no-console
      return;
    }
    tracePath = downloadZipPath;
  }

  let stat;
  try {
    stat = fs.statSync(tracePath);
  } catch (e) {
    console.log(`No such file or directory: ${tracePath}`);  // eslint-disable-line no-console
    return;
  }

  if (stat.isDirectory()) {
    const traceViewer = new TraceViewer(new RealFileSystem(tracePath), browserName);
    await traceViewer.init();
    return await traceViewer.show(headless);
  }

  const traceViewer = new TraceViewer(new ZipFileSystem(tracePath), browserName);
  await traceViewer.init();
  return await traceViewer.show(headless);
}

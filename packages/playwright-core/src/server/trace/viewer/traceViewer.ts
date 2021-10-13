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

import path from 'path';
import * as consoleApiSource from '../../../generated/consoleApiSource';
import { HttpServer } from '../../../utils/httpServer';
import { findChromiumChannel } from '../../../utils/registry';
import { isUnderTest } from '../../../utils/utils';
import { BrowserContext } from '../../browserContext';
import { installAppIcon } from '../../chromium/crApp';
import { internalCallMetadata } from '../../instrumentation';
import { createPlaywright } from '../../playwright';
import { ProgressController } from '../../progress';

export async function showTraceViewer(traceUrl: string, browserName: string, headless = false, port?: number): Promise<BrowserContext | undefined> {
  const server = new HttpServer();
  server.routePath('/file', (request, response) => {
    try {
      const path = new URL('http://localhost' + request.url!).searchParams.get('path')!;
      return server.serveFile(response, path);
    } catch (e) {
      return false;
    }
  });

  server.routePrefix('/', (request, response) => {
    const relativePath = new URL('http://localhost' + request.url!).pathname.slice('/trace'.length);
    const absolutePath = path.join(__dirname, '..', '..', '..', 'webpack', 'traceViewer', ...relativePath.split('/'));
    return server.serveFile(response, absolutePath);
  });

  const urlPrefix = await server.start(port);

  const traceViewerPlaywright = createPlaywright('javascript', true);
  const traceViewerBrowser = isUnderTest() ? 'chromium' : browserName;
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

  await page.mainFrame().goto(internalCallMetadata(), urlPrefix + `/trace/index.html?trace=${traceUrl}`);
  return context;
}

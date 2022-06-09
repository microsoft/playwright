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
import fs from 'fs';
import * as consoleApiSource from '../../../generated/consoleApiSource';
import { HttpServer } from '../../../utils/httpServer';
import { findChromiumChannel } from '../../registry';
import { isUnderTest } from '../../../utils';
import type { BrowserContext } from '../../browserContext';
import { installAppIcon } from '../../chromium/crApp';
import { serverSideCallMetadata } from '../../instrumentation';
import { createPlaywright } from '../../playwright';
import { ProgressController } from '../../progress';

export async function showTraceViewer(traceUrls: string[], browserName: string, headless = false, port?: number): Promise<BrowserContext | undefined> {
  for (const traceUrl of traceUrls) {
    if (!traceUrl.startsWith('http://') && !traceUrl.startsWith('https://') && !fs.existsSync(traceUrl)) {
      // eslint-disable-next-line no-console
      console.error(`Trace file ${traceUrl} does not exist!`);
      process.exit(1);
    }
  }
  const server = new HttpServer();
  server.routePrefix('/trace', (request, response) => {
    const url = new URL('http://localhost' + request.url!);
    const relativePath = url.pathname.slice('/trace'.length);
    if (relativePath.startsWith('/file')) {
      try {
        return server.serveFile(request, response, url.searchParams.get('path')!);
      } catch (e) {
        return false;
      }
    }
    const absolutePath = path.join(__dirname, '..', '..', '..', 'webpack', 'traceViewer', ...relativePath.split('/'));
    return server.serveFile(request, response, absolutePath);
  });

  const urlPrefix = await server.start(port);

  const traceViewerPlaywright = createPlaywright('javascript', true);
  const traceViewerBrowser = isUnderTest() ? 'chromium' : browserName;
  const args = traceViewerBrowser === 'chromium' ? [
    '--app=data:text/html,',
    '--window-size=1280,800',
    '--test-type=',
  ] : [];
  if (isUnderTest())
    args.push(`--remote-debugging-port=0`);

  const context = await traceViewerPlaywright[traceViewerBrowser as 'chromium'].launchPersistentContext(serverSideCallMetadata(), '', {
    // TODO: store language in the trace.
    channel: findChromiumChannel(traceViewerPlaywright.options.sdkLanguage),
    args,
    noDefaultViewport: true,
    ignoreDefaultArgs: ['--enable-automation'],
    headless,
    useWebSocket: isUnderTest()
  });

  const controller = new ProgressController(serverSideCallMetadata(), context._browser);
  await controller.run(async progress => {
    await context._browser._defaultContext!._loadDefaultContextAsIs(progress);
  });
  await context.extendInjectedScript(consoleApiSource.source);
  const [page] = context.pages();

  if (traceViewerBrowser === 'chromium')
    await installAppIcon(page);

  if (isUnderTest())
    page.on('close', () => context.close(serverSideCallMetadata()).catch(() => {}));
  else
    page.on('close', () => process.exit());

  const searchQuery = traceUrls.length ? '?' + traceUrls.map(t => `trace=${t}`).join('&') : '';
  await page.mainFrame().goto(serverSideCallMetadata(), urlPrefix + `/trace/index.html${searchQuery}`);
  return context;
}

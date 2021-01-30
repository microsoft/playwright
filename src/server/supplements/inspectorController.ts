/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { BrowserContext, ContextListener } from '../browserContext';
import { isDebugMode } from '../../utils/utils';
import { ConsoleApiSupplement } from './consoleApiSupplement';
import { RecorderSupplement } from './recorderSupplement';
import { Page } from '../page';
import { ConsoleMessage } from '../console';

export class InspectorController implements ContextListener {
  async onContextCreated(context: BrowserContext): Promise<void> {
    if (isDebugMode()) {
      const consoleApi = new ConsoleApiSupplement(context);
      await consoleApi.install();
      RecorderSupplement.getOrCreate(context, 'debug', {
        language: 'javascript',
        terminal: true,
      });
      context.on(BrowserContext.Events.Page, (page: Page) => {
        page.on(Page.Events.Console, (message: ConsoleMessage) => context.emit(BrowserContext.Events.StdOut, message.text() + '\n'));
      });
    }
  }
  async onContextWillDestroy(context: BrowserContext): Promise<void> {}
  async onContextDidDestroy(context: BrowserContext): Promise<void> {}
}

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

import { BrowserContext, ContextListener, contextListeners } from '../server/browserContext';
import { isDebugMode } from '../utils/utils';
import * as consoleApiSource from '../generated/consoleApiSource';

export function installDebugController() {
  contextListeners.add(new DebugController());
}

class DebugController implements ContextListener {
  async onContextCreated(context: BrowserContext): Promise<void> {
    if (isDebugMode())
      context.extendInjectedScript(consoleApiSource.source);
  }
  async onContextWillDestroy(context: BrowserContext): Promise<void> {}
  async onContextDidDestroy(context: BrowserContext): Promise<void> {}
}

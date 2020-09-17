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
import * as frames from '../server/frames';
import { Page } from '../server/page';
import { isDebugMode } from '../utils/utils';
import * as debugScriptSource from '../generated/debugScriptSource';

export function installDebugController() {
  contextListeners.add(new DebugController());
}

class DebugController implements ContextListener {
  private async ensureInstalledInFrame(frame: frames.Frame) {
    try {
      await frame.extendInjectedScript(debugScriptSource.source);
    } catch (e) {
    }
  }

  async onContextCreated(context: BrowserContext): Promise<void> {
    if (!isDebugMode())
      return;
    context.on(BrowserContext.Events.Page, (page: Page) => {
      for (const frame of page.frames())
        this.ensureInstalledInFrame(frame);
      page.on(Page.Events.FrameNavigated, frame => this.ensureInstalledInFrame(frame));
    });
  }

  async onContextDestroyed(context: BrowserContext): Promise<void> {
  }
}

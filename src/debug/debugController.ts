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

import { BrowserContext } from '../server/browserContext';
import * as frames from '../server/frames';
import * as js from '../server/javascript';
import { Page } from '../server/page';
import { InstrumentingAgent } from '../server/instrumentation';
import type DebugScript from './injected/debugScript';
import { Progress } from '../server/progress';
import { isDebugMode } from '../utils/utils';
import * as debugScriptSource from '../generated/debugScriptSource';

const debugScriptSymbol = Symbol('debugScript');

export class DebugController implements InstrumentingAgent {
  private async ensureInstalledInFrame(frame: frames.Frame) {
    try {
      const mainContext = await frame._mainContext();
      if ((mainContext as any)[debugScriptSymbol])
        return;
      (mainContext as any)[debugScriptSymbol] = true;
      const objectId = await mainContext._delegate.rawEvaluate(`new (${debugScriptSource.source})()`);
      const debugScript = new js.JSHandle(mainContext, 'object', objectId) as js.JSHandle<DebugScript>;
      const injectedScript = await mainContext.injectedScript();
      await debugScript.evaluate((debugScript, injectedScript) => {
        debugScript.initialize(injectedScript, { console: true });
      }, injectedScript);
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

  async onBeforePageAction(page: Page, progress: Progress): Promise<void> {
  }
}

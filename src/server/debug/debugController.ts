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

import { BrowserContext } from '../../browserContext';
import * as frames from '../../frames';
import * as js from '../../javascript';
import { Page } from '../../page';
import type DebugScript from './injected/debugScript';

export class DebugController {
  constructor(context: BrowserContext) {
    context.on(BrowserContext.Events.Page, (page: Page) => {
      for (const frame of page.frames())
        this.ensureInstalledInFrame(frame);
      page.on(Page.Events.FrameNavigated, frame => this.ensureInstalledInFrame(frame));
    });
  }

  private async ensureInstalledInFrame(frame: frames.Frame): Promise<js.JSHandle<DebugScript> | undefined> {
    try {
      const mainContext = await frame._mainContext();
      return await mainContext.createDebugScript({ console: true });
    } catch (e) {
    }
  }
}

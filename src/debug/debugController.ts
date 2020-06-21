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

import { Writable } from 'stream';
import { BrowserContextBase } from '../browserContext';
import { Events } from '../events';
import * as frames from '../frames';
import { Page } from '../page';
import { RecorderController } from './recorderController';

export class DebugController {
  constructor(context: BrowserContextBase, options: { recorderOutput?: Writable | undefined }) {
    const installInFrame = async (frame: frames.Frame) => {
      try {
        const mainContext = await frame._mainContext();
        await mainContext.createDebugScript({ console: true, record: !!options.recorderOutput });
      } catch (e) {
      }
    };

    if (options.recorderOutput)
      new RecorderController(context, options.recorderOutput);

    context.on(Events.BrowserContext.Page, (page: Page) => {
      for (const frame of page.frames())
        installInFrame(frame);
      page.on(Events.Page.FrameNavigated, installInFrame);
    });
  }
}

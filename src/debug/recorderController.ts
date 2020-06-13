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

import * as actions from './recorderActions';
import * as frames from '../frames';
import { Page } from '../page';
import { Events } from '../events';
import { TerminalOutput } from './terminalOutput';

export class RecorderController {
  private _page: Page;
  private _output = new TerminalOutput();

  constructor(page: Page) {
    this._page = page;

    this._page.exposeBinding('recordPlaywrightAction', (source, action: actions.Action) => {
      if (source.frame !== this._page.mainFrame())
        action.frameUrl = source.frame.url();
      this._output.addAction(action);
    });

    this._page.on(Events.Page.FrameNavigated, (frame: frames.Frame) => {
      if (frame.parentFrame())
        return;
      const action = this._output.lastAction();
      if (action) {
        this._output.signal({ name: 'navigation', url: frame.url() });
      } else {
        this._output.addAction({
          name: 'navigate',
          url: this._page.url(),
          signals: [],
        });
      }
    });
  }
}

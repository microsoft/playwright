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
import { Script } from './recorderScript';

export class RecorderController {
  private _page: Page;
  private _script = new Script();

  constructor(page: Page) {
    this._page = page;
  }

  start() {
    this._script.addAction({
      name: 'navigate',
      url: this._page.url(),
      signals: [],
    });
    this._printScript();

    this._page.exposeBinding('recordPlaywrightAction', (source, action: actions.Action) => {
      action.frameUrl = source.frame.url();
      this._script.addAction(action);
      this._printScript();
    });

    this._page.on(Events.Page.FrameNavigated, (frame: frames.Frame) => {
      if (frame.parentFrame())
        return;
      const action = this._script.lastAction();
      if (action)
        action.signals.push({ name: 'navigation', url: frame.url() });
      this._printScript();
    });
  }

  _printScript() {
    console.log('\x1Bc');  // eslint-disable-line no-console
    console.log(this._script.generate('chromium'));  // eslint-disable-line no-console
  }
}

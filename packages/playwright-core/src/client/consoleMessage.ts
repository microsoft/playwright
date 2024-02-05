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

import * as util from 'util';
import { JSHandle } from './jsHandle';
import type * as channels from '@protocol/channels';
import type * as api from '../../types/types';
import { Page } from './page';

type ConsoleMessageLocation = channels.BrowserContextConsoleEvent['location'];

export class ConsoleMessage implements api.ConsoleMessage {

  private _page: Page | null;
  private _event: channels.BrowserContextConsoleEvent | channels.ElectronApplicationConsoleEvent;

  constructor(event: channels.BrowserContextConsoleEvent | channels.ElectronApplicationConsoleEvent) {
    this._page = ('page' in event && event.page) ? Page.from(event.page) : null;
    this._event = event;
  }

  page() {
    return this._page;
  }

  type(): string {
    return this._event.type;
  }

  text(): string {
    return this._event.text;
  }

  args(): JSHandle[] {
    return this._event.args.map(JSHandle.from);
  }

  location(): ConsoleMessageLocation {
    return this._event.location;
  }

  [util.inspect.custom]() {
    return this.text();
  }
}

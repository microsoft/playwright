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

import { JSHandle } from './jsHandle';
import { Page } from './page';

import type * as api from '../../types/types';
import type { Platform } from './platform';
import type * as channels from '@protocol/channels';

type ConsoleMessageLocation = channels.BrowserContextConsoleEvent['location'];

export class ConsoleMessage implements api.ConsoleMessage {

  private _page: Page | null;
  private _event: channels.BrowserContextConsoleEvent | channels.ElectronApplicationConsoleEvent;

  constructor(platform: Platform, event: channels.BrowserContextConsoleEvent | channels.ElectronApplicationConsoleEvent) {
    this._page = ('page' in event && event.page) ? Page.from(event.page) : null;
    this._event = event;
    if (platform.inspectCustom)
      (this as any)[platform.inspectCustom] = () => this._inspect();
  }

  page() {
    return this._page;
  }

  type(): ReturnType<api.ConsoleMessage['type']> {
    return this._event.type as ReturnType<api.ConsoleMessage['type']>;
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

  private _inspect() {
    return this.text();
  }
}

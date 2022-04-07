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

import { Events } from './events';
import type * as channels from '../protocol/channels';
import { ChannelOwner } from './channelOwner';
import { assertMaxArguments, JSHandle, parseResult, serializeArgument } from './jsHandle';
import type { Page } from './page';
import type { BrowserContext } from './browserContext';
import type * as api from '../../types/types';
import type * as structs from '../../types/structs';

export class Worker extends ChannelOwner<channels.WorkerChannel> implements api.Worker {
  _page: Page | undefined;  // Set for web workers.
  _context: BrowserContext | undefined;  // Set for service workers.

  static from(worker: channels.WorkerChannel): Worker {
    return (worker as any)._object;
  }

  constructor(parent: ChannelOwner, type: string, guid: string, initializer: channels.WorkerInitializer) {
    super(parent, type, guid, initializer);
    this._channel.on('close', () => {
      if (this._page)
        this._page._workers.delete(this);
      if (this._context)
        this._context._serviceWorkers.delete(this);
      this.emit(Events.Worker.Close, this);
    });
  }

  url(): string {
    return this._initializer.url;
  }

  async evaluate<R, Arg>(pageFunction: structs.PageFunction<Arg, R>, arg?: Arg): Promise<R> {
    assertMaxArguments(arguments.length, 2);
    const result = await this._channel.evaluateExpression({ expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializeArgument(arg) });
    return parseResult(result.value);
  }

  async evaluateHandle<R, Arg>(pageFunction: structs.PageFunction<Arg, R>, arg?: Arg): Promise<structs.SmartHandle<R>> {
    assertMaxArguments(arguments.length, 2);
    const result = await this._channel.evaluateExpressionHandle({ expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializeArgument(arg) });
    return JSHandle.from(result.handle) as any as structs.SmartHandle<R>;
  }
}

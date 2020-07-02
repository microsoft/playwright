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

import { Events } from '../../events';
import { assertMaxArguments } from '../../helper';
import { WorkerChannel, WorkerInitializer } from '../channels';
import { ConnectionScope } from './connection';
import { ChannelOwner } from './channelOwner';
import { Func1, JSHandle, parseResult, serializeArgument, SmartHandle } from './jsHandle';
import { Page } from './page';

export class Worker extends ChannelOwner<WorkerChannel, WorkerInitializer> {
  _page: Page | undefined;

  static from(worker: WorkerChannel): Worker {
    return (worker as any)._object;
  }

  constructor(scope: ConnectionScope, guid: string, initializer: WorkerInitializer) {
    super(scope, guid, initializer);
    this._channel.on('close', () => {
      this._page!._workers.delete(this);
      this.emit(Events.Worker.Close, this);
    });
  }

  url(): string {
    return this._initializer.url;
  }

  async evaluate<R, Arg>(pageFunction: Func1<Arg, R>, arg: Arg): Promise<R>;
  async evaluate<R>(pageFunction: Func1<void, R>, arg?: any): Promise<R>;
  async evaluate<R, Arg>(pageFunction: Func1<Arg, R>, arg: Arg): Promise<R> {
    assertMaxArguments(arguments.length, 2);
    return parseResult(await this._channel.evaluateExpression({ expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializeArgument(arg) }));
  }

  async evaluateHandle<R, Arg>(pageFunction: Func1<Arg, R>, arg: Arg): Promise<SmartHandle<R>>;
  async evaluateHandle<R>(pageFunction: Func1<void, R>, arg?: any): Promise<SmartHandle<R>>;
  async evaluateHandle<R, Arg>(pageFunction: Func1<Arg, R>, arg: Arg): Promise<SmartHandle<R>> {
    assertMaxArguments(arguments.length, 2);
    return JSHandle.from(await this._channel.evaluateExpressionHandle({ expression: String(pageFunction), isFunction: typeof pageFunction === 'function', arg: serializeArgument(arg) })) as SmartHandle<R>;
  }
}

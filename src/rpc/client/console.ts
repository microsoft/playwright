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
import { ConsoleMessageLocation } from '../../types';
import { JSHandle } from './jsHandle';
import { ConsoleMessageChannel, JSHandleChannel } from '../channels';
import { ChannelOwner } from './channelOwner';
import { Connection } from '../connection';

export class ConsoleMessage extends ChannelOwner<ConsoleMessageChannel> {
  private _type: string = '';
  private _text: string = '';
  private _args: JSHandle[] = [];
  private _location: ConsoleMessageLocation = {};

  static from(request: ConsoleMessageChannel): ConsoleMessage {
    return request._object;
  }

  constructor(connection: Connection, channel: ConsoleMessageChannel) {
    super(connection, channel);
  }

  _initialize(params: { type: string, text: string, args: JSHandleChannel[], location: ConsoleMessageLocation }) {
    this._type = params.type;
    this._text = params.text;
    this._args = params.args.map(JSHandle.from);
    this._location = params.location;
  }

  type(): string {
    return this._type;
  }

  text(): string {
    return this._text;
  }

  args(): JSHandle[] {
    return this._args;
  }

  location(): ConsoleMessageLocation {
    return this._location;
  }

  [util.inspect.custom]() {
    return this.text();
  }
}

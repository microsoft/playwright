/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type * as channels from '@protocol/channels';
import type { ElementHandle } from './elementHandle';
import type * as api from '../../types/types';

type SerializedAXNode = Omit<channels.AXNode, 'valueString' | 'valueNumber' | 'children' | 'checked' | 'pressed'> & {
  value?: string|number,
  checked?: boolean | 'mixed',
  pressed?: boolean | 'mixed',
  children?: SerializedAXNode[]
};

function axNodeFromProtocol(axNode: channels.AXNode): SerializedAXNode {
  const result: SerializedAXNode = {
    ...axNode,
    value: axNode.valueNumber !== undefined ? axNode.valueNumber : axNode.valueString,
    checked: axNode.checked === 'checked' ? true : axNode.checked === 'unchecked' ? false : axNode.checked,
    pressed: axNode.pressed === 'pressed' ? true : axNode.pressed === 'released' ? false : axNode.pressed,
    children: axNode.children ? axNode.children.map(axNodeFromProtocol) : undefined,
  };
  delete (result as any).valueNumber;
  delete (result as any).valueString;
  return result;
}

export class Accessibility implements api.Accessibility {
  private _channel: channels.PageChannel;

  constructor(channel: channels.PageChannel) {
    this._channel = channel;
  }

  async snapshot(options: { interestingOnly?: boolean; root?: ElementHandle } = {}): Promise<SerializedAXNode | null> {
    const root = options.root ? options.root._elementChannel : undefined;
    const result = await this._channel.accessibilitySnapshot({ interestingOnly: options.interestingOnly, root });
    return result.rootAXNode ? axNodeFromProtocol(result.rootAXNode) : null;
  }
}
